import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { readCRMState, mutateCRMState } from '@/lib/crm-repository';
import { enqueueQualifications, qualificationFields } from '@/lib/lead-qualification';
import { runQualificationWorker, qualificationInsight } from '@/lib/lead-qualification-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const schema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('run'), conversationIds: z.array(z.string().min(1)).min(1).max(50), force: z.boolean().optional() }),
  z.object({ operation: z.literal('resolve'), conversationId: z.string(), field: z.enum(qualificationFields), decision: z.enum(['ACCEPT', 'KEEP']) }),
]);
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req); if (errorResponse) return errorResponse;
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const state = await readCRMState(tenantId);
    const conversationId = req.nextUrl.searchParams.get('conversationId');
    if (conversationId && !state.conversations.some(c => c.id === conversationId)) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
    const jobs = conversationId ? Object.fromEntries(Object.entries(state.qualification?.jobs || {}).filter(([id]) => id === conversationId)) : state.qualification?.jobs || {};
    return NextResponse.json({ success: true, jobs, lastWorkerAt: state.qualification?.lastScheduledAt || null,
      schedulerConfigured: !!(process.env.QUALIFICATION_CRON_SECRET || process.env.AUTOMATIONS_CRON_SECRET) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Não foi possível consultar a qualificação.' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['ADMIN', 'MANAGER', 'BROKER'] }); if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Use o CRM para revisar a qualificação.' }, { status: 403 });
  if (!checkRateLimit(`qualification:${session!.userId}:${getClientIp(req.headers)}`, 30, 60).allowed) return NextResponse.json({ error: 'Aguarde para solicitar outra análise.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Solicitação de qualificação inválida.' }, { status: 400 });
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const input = parsed.data;
    const state = await readCRMState(tenantId);
    const ids = input.operation === 'run' ? input.conversationIds : [input.conversationId];
    if (ids.some(id => !state.conversations.some(c => c.id === id && c.tenantId === tenantId))) return NextResponse.json({ error: 'Conversa não encontrada nesta imobiliária.' }, { status: 404 });
    await mutateCRMState(tenantId, state => {
      enqueueQualifications(state);
      if (input.operation === 'run') {
        for (const id of ids) {
          const job = state.qualification?.jobs[id]; if (!job || job.status === 'PROCESSING') continue;
          if (job.status === 'ERROR') Object.assign(job, { status: 'QUEUED', attempts: 0, retryAt: undefined });
          if (input.force) Object.assign(job, { status: 'QUEUED', cursor: 0, facts: {}, summary: '', classification: 'INSUFFICIENT_DATA', attempts: 0, contextAttempts: 0, degraded: false, conflicts: [], retryAt: undefined });
        }
      } else {
        const job = state.qualification?.jobs[input.conversationId];
        if (!job?.conflicts?.includes(input.field)) throw new Error('Esta pendência já foi resolvida. Atualize a conversa.');
        const conversation = state.conversations.find(c => c.id === input.conversationId)!;
        const contact = state.contacts.find(c => c.id === conversation.contactId)!;
        const value = input.decision === 'ACCEPT' ? job.facts[input.field]?.value : contact[input.field];
        if (input.decision === 'ACCEPT' && value === undefined) throw new Error('Sugestão indisponível.');
        (contact as any)[input.field] = value;
        contact.qualificationFields = { ...contact.qualificationFields, [input.field]: { source: 'HUMAN', value: value ?? '', messageId: '', quote: '', at: new Date().toISOString(), confidence: 1 } };
        contact.updatedAt = new Date().toISOString();
        job.conflicts = job.conflicts.filter(field => field !== input.field); job.status = job.conflicts.length ? 'REVIEW' : 'UPDATED';
        state.aiInsights[input.conversationId] = qualificationInsight(tenantId, input.conversationId, contact.id, job, state.aiInsights[input.conversationId]);
      }
      return state;
    });
    const next = input.operation === 'run' ? await runQualificationWorker(tenantId, { conversationIds: ids, deadline: Date.now() + 35000 }) : await readCRMState(tenantId);
    return NextResponse.json({ success: true, tenantId, contacts: next.contacts, aiInsights: next.aiInsights, jobs: next.qualification?.jobs || {} });
  } catch { return NextResponse.json({ error: 'A análise não foi concluída. Os dados existentes foram preservados.' }, { status: 503 }); }
}
