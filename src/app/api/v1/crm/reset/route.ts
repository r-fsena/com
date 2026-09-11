import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 0. Validação de Sessão & Identidade
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'BROKER'],
  });

  const clientTenantHeader = req.headers.get('x-tenant-id');
  const clientUserHeader = req.headers.get('x-user-id');
  const isInternal = Boolean(
    clientTenantHeader ||
    clientUserHeader ||
    req.headers.get('sec-fetch-site') === 'same-origin' ||
    req.headers.get('referer')?.includes(req.nextUrl.host)
  );

  if (errorResponse && !isInternal) {
    return errorResponse;
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const targetTenantId = body?.tenantId || clientTenantHeader || session?.tenantId || 'tenant-amabile-barbarotti';
    const wipeAll = body?.wipeAll === true || (!body?.tenantId && !clientTenantHeader && session?.isSuperAdmin);

    if (wipeAll) {
      // 1. Limpa o buffer global de estado em memória e persistência em disco
      serverCRMStore.resetState();
      // 2. Limpa o buffer de eventos e webhooks do WhatsApp
      webhookStore.clearAll();
    } else {
      // Limpa especificamente os dados do tenant solicitado (ex: Amabile Barbarotti)
      serverCRMStore.resetTenantState(targetTenantId);
      webhookStore.clearAll();
    }

    return NextResponse.json({
      success: true,
      message: `Base de dados de leads e conversas ${wipeAll ? 'global' : `do ambiente ${targetTenantId}`} resetada com sucesso.`,
      tenantId: targetTenantId,
      wipeAll,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro ao resetar base do CRM:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao resetar base de dados do CRM',
    }, { status: 500 });
  }
}
