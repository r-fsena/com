import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { readCRMState } from '@/lib/crm-repository';
import { runQualificationWorker } from '@/lib/lead-qualification-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['BROKER', 'MANAGER', 'ADMIN'] }); if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Use o CRM para solicitar a análise.' }, { status: 403 });
  if (!checkRateLimit(`batch-qualify:${session!.userId}:${getClientIp(req.headers)}`, 30, 60).allowed) return NextResponse.json({ error: 'Aguarde antes de analisar outro lote.' }, { status: 429 });
  const body = z.object({ items: z.array(z.object({ conversationId: z.string().min(1), contactId: z.string().min(1) })).min(1).max(50) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Selecione conversas para analisar.' }, { status: 400 });
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const state = await readCRMState(tenantId);
    if (body.data.items.some(item => !state.conversations.some(c => c.id === item.conversationId && c.contactId === item.contactId))) return NextResponse.json({ error: 'Conversa não encontrada nesta imobiliária.' }, { status: 404 });
    const next = await runQualificationWorker(tenantId, { conversationIds: body.data.items.map(i => i.conversationId), deadline: Date.now() + 24000 });
    const results = body.data.items.map(item => ({ ...next.aiInsights[item.conversationId], conversationId: item.conversationId, contactId: item.contactId, status: next.qualification?.jobs[item.conversationId]?.status || 'QUEUED' }));
    return NextResponse.json({ success: true, results, totalProcessed: results.filter(r => ['UPDATED','REVIEW'].includes(r.status)).length,
      pendingCount: results.filter(r => !['UPDATED','REVIEW','DISABLED'].includes(r.status)).length,
      leadsCount: results.filter(r => r.conversationType === 'REAL_ESTATE_LEAD').length, personalCount: results.filter(r => r.conversationType === 'PERSONAL_OR_OTHER').length });
  } catch { return NextResponse.json({ error: 'O lote permanece pendente para nova tentativa; os dados existentes foram preservados.' }, { status: 503 }); }
}
