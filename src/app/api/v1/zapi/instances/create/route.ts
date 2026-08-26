import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requireSuperAdmin: true,
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { tenantId, name, partnerToken } = body;

    const tokenToUse = partnerToken || process.env.ZAPI_PARTNER_TOKEN || process.env.ZAPI_MASTER_KEY;

    if (!tokenToUse) {
      return NextResponse.json({
        success: false,
        requiresManualCredentials: true,
        error: 'Chave de Parceiro/Integrador Z-API não configurada no SaaS Master.',
        message: 'Para criar instâncias automatizadas em 1 clique via API, configure o Partner Token da Z-API nas Configurações de API do SaaS Master. Alternativamente, crie a instância no painel app.z-api.io e informe o Instance ID e Token diretamente no CRM.'
      }, { status: 400 });
    }

    const instanceName = name || `Tenant-${tenantId || 'Default'}`;
    const webhookUrl = `https://crm.faithhubs.com/api/v1/webhooks/zapi/${tenantId || 'default'}`;

    const zapiRes = await fetch('https://api.z-api.io/instances/integrator/on-demand', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenToUse}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: instanceName,
        receivedCallbackUrl: webhookUrl,
        deliveryCallbackUrl: webhookUrl,
        disconnectedCallbackUrl: webhookUrl,
        connectedCallbackUrl: webhookUrl,
      }),
    });

    const data = await zapiRes.json();

    if (!zapiRes.ok || !data.id || !data.token) {
      return NextResponse.json({
        success: false,
        error: data.message || 'Falha ao provisionar instância on-demand na Z-API.',
        details: data,
      }, { status: zapiRes.status || 400 });
    }

    return NextResponse.json({
      success: true,
      instanceId: data.id,
      token: data.token,
      name: data.name || instanceName,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro de comunicação ao criar instância Z-API.',
    }, { status: 500 });
  }
}
