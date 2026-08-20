import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instanceId, token, clientToken, tenantId } = body;

    const currentTenantId = tenantId || 'tenant-vanguard-01';
    const currentInstanceId = instanceId || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
    const currentToken = token || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
    const securityToken = clientToken || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN;

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
