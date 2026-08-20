import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instanceId, token, tenantId } = body;

    const currentTenantId = tenantId || 'tenant-vanguard-01';
    const currentInstanceId = instanceId || process.env.ZAPI_INSTANCE_ID || '3D8F2A1B4C5E6D7E8F9A0B1C';
    const currentToken = token || process.env.ZAPI_INSTANCE_TOKEN || 'A1B2C3D4E5F6789012345678';
    const securityToken = process.env.ZAPI_WEBHOOK_SECRET;

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
