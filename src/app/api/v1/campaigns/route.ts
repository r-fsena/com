import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { AutomationError } from '@/lib/automation-service';
import { listCampaigns, previewCampaign, changeCampaign, campaignRecipients, setMarketingPermission } from '@/lib/campaign-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
const identity = { id: z.string().min(1).max(200), revision: z.number().int().positive() };
const command = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('save'), id: z.string().max(200).optional(), revision: z.number().int().positive().optional(), config: z.unknown() }).strict(),
  z.object({ operation: z.literal('preview'), config: z.unknown() }).strict(),
  z.object({ operation: z.literal('check-connection'), instanceId: z.string().min(1).max(200) }).strict(),
  z.object({ operation: z.literal('start'), ...identity, confirmed: z.literal(true), confirmedCount: z.number().int().positive().max(5000) }).strict(),
  z.object({ operation: z.literal('send-test'), ...identity, confirmed: z.literal(true), requestId: z.string().uuid() }).strict(),
  z.object({ operation: z.literal('permission'), contactId: z.string().min(1).max(200), granted: z.boolean(), confirmed: z.literal(true), expectedRecordedAt: z.string().optional(),
    obtainedAt: z.string().datetime().optional(),
    source: z.string().trim().min(3).max(100), notes: z.string().trim().min(10, 'Descreva como a autorização foi obtida.').max(1000) }).strict(),
  ...(['simulate', 'pause', 'resume', 'cancel'] as const).map(operation => z.object({ operation: z.literal(operation), ...identity }).strict()),
]);
function fail(error: unknown) {
  return NextResponse.json({ success: false, error: error instanceof AutomationError ? error.message : error instanceof z.ZodError ? error.issues.map(issue => issue.message).join(' ') : 'Operação não confirmada. Verifique o banco e a migração de campanhas antes de tentar novamente.' },
    { status: error instanceof AutomationError ? error.status : error instanceof z.ZodError ? 400 : 503 });
}
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req); if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Entre no CRM para acompanhar campanhas.' }, { status: 403 });
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const id = req.nextUrl.searchParams.get('id');
    const offset = z.coerce.number().int().min(0).max(100000).parse(req.nextUrl.searchParams.get('offset') || 0);
    const status = req.nextUrl.searchParams.get('status') || undefined;
    if (status && !['PENDING','PROCESSING','WAITING_CHANNEL','DISPATCHING','ACCEPTED','DELIVERED','READ','FAILED','SKIPPED','CANCELLED','UNKNOWN'].includes(status)) throw new AutomationError('Filtro de resultado inválido.');
    const data = id ? await campaignRecipients(tenantId, id, offset, status) : await listCampaigns(tenantId, session!.userId, offset);
    return NextResponse.json({ success: true, tenantId, ...data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] }); if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Entre no CRM para configurar campanhas.' }, { status: 403 });
  if (!checkRateLimit(`campaign:${session!.userId}:${getClientIp(req.headers)}`, 90, 60).allowed) return NextResponse.json({ error: 'Muitas solicitações. Aguarde um minuto.' }, { status: 429 });
  try {
    if (Number(req.headers.get('content-length') || 0) > 600000) throw new AutomationError('Seleção muito grande.', 413);
    const input = command.parse(await req.json());
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    if (input.operation === 'permission') { await setMarketingPermission(tenantId, session!.userId, input); return NextResponse.json({ success: true, tenantId }); }
    const data = input.operation === 'preview' ? await previewCampaign(tenantId, input.config) : await changeCampaign(tenantId, session!.userId, input);
    return NextResponse.json({ success: true, tenantId, ...data });
  } catch (error) { return fail(error); }
}
