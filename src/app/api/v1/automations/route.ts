import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizedTenant, validateApiSession } from '@/lib/api-auth';
import { readCRMState } from '@/lib/crm-repository';
import { automationCapabilities, automationEnvironment, AutomationError, changeAutomation } from '@/lib/automation-service';
import { emptyAutomations } from '@/lib/automations';

export const dynamic = 'force-dynamic';
const command = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('save'), id: z.string().uuid().optional(), revision: z.number().int().positive().optional(), config: z.unknown() }).strict(),
  ...(['simulate', 'publish', 'pause', 'archive'] as const).map(operation => z.object({ operation: z.literal(operation), id: z.string().uuid(), revision: z.number().int().positive(), contactId: z.string().max(200).optional() }).strict()),
]);
function errorResponse(error: unknown) {
  return NextResponse.json({ success: false, error: error instanceof AutomationError ? error.message : 'Não foi possível confirmar a operação. Suas alterações não foram confirmadas; tente novamente.' },
    { status: error instanceof AutomationError ? error.status : 503 });
}
export async function GET(req: NextRequest) {
  const { session, errorResponse: denied } = validateApiSession(req);
  if (denied) return denied;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Entre no CRM para consultar automações.' }, { status: 403 });
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const [state, environment] = await Promise.all([readCRMState(tenantId), automationEnvironment(tenantId)]);
    const automation = state.automation || emptyAutomations();
    return NextResponse.json({ success: true, tenantId, rules: automation.rules, jobs: automation.jobs.slice(-300).reverse(), audit: automation.audit.slice(-100).reverse(),
      members: environment.members, capabilities: automationCapabilities(state) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: NextRequest) {
  const { session, errorResponse: denied } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] });
  if (denied) return denied;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Entre no CRM para alterar automações.' }, { status: 403 });
  try {
    if (Number(req.headers.get('content-length') || 0) > 65536) return NextResponse.json({ error: 'Regra muito grande.' }, { status: 413 });
    const parsed = command.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Solicitação inválida. Atualize a tela e confira os campos.' }, { status: 400 });
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const result = await changeAutomation(tenantId, session!.userId, parsed.data);
    return NextResponse.json({ success: true, tenantId, ...result });
  } catch (error) { return errorResponse(error); }
}
