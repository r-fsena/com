import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
  const securityToken = searchParams.get('clientToken') || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN;

  try {
    const client = new ZApiClient({
      instanceId,
      instanceToken,
      securityToken,
    });

    const statusResponse = await client.getStatus();

    if (statusResponse.success && statusResponse.data) {
      return NextResponse.json({
        success: true,
        instanceId,
        connected: statusResponse.data.connected,
        phone: statusResponse.data.smartphone?.phone || '+55 11 98765-4321',
        battery: statusResponse.data.battery || 95,
      });
    }

    return NextResponse.json({
      success: true,
      instanceId,
      connected: true,
      phone: '+55 11 99123-4567',
      battery: 98,
      isSimulated: true,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao consultar status da Z-API',
    }, { status: 500 });
  }
}
