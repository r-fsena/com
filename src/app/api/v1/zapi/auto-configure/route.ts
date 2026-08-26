import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { instanceId, token, clientToken, tenantId } = body;

    const currentTenantId = tenantId || session?.tenantId || 'tenant-amabile-barbarotti';
    const currentInstanceId = instanceId || process.env.ZAPI_INSTANCE_ID || '';
    const currentToken = token || process.env.ZAPI_INSTANCE_TOKEN || '';
    const securityToken = clientToken || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || '';

    if (!currentInstanceId || !currentToken) {
      return NextResponse.json({
        success: false,
        error: 'Instância Z-API não configurada',
      }, { status: 400 });
    }

    const webhookUrl = `https://crm.faithhubs.com/api/v1/webhooks/zapi/${currentTenantId}/${currentInstanceId}`;

    const client = new ZApiClient({
      instanceId: currentInstanceId,
      instanceToken: currentToken,
      securityToken,
    });

    const result = await client.configureAllWebhooks(webhookUrl);

    return NextResponse.json({
      success: true,
      message: 'Webhooks da Z-API configurados automaticamente com sucesso!',
      webhookUrl,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha na auto-configuração de webhooks da Z-API',
    }, { status: 500 });
  }
}
