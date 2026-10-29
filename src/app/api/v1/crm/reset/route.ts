import { resetCRMState } from '@/lib/crm-repository';
import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 0. Validação Estrita de Sessão & Identidade (Apenas ADMIN ou SUPERADMIN)
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN_MASTER', 'ADMIN'],
  });


  if (errorResponse) {
    return errorResponse;
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const isMaster = session?.isSuperAdmin || session?.role === 'SUPERADMIN' || session?.role === 'ADMIN_MASTER';
    const targetTenantId = isMaster ? (body?.tenantId || session?.tenantId || 'tenant-amabile-barbarotti') : (session?.tenantId || 'tenant-amabile-barbarotti');
    const wipeAll = isMaster && body?.wipeAll === true;

    if (wipeAll) return NextResponse.json({ success: false, error: 'Execute a limpeza global por ferramenta administrativa no servidor.' }, { status: 400 });
    await resetCRMState(targetTenantId);

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
