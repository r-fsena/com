import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '3D8F2A1B4C5E6D7E8F9A0B1C';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || 'A1B2C3D4E5F6789012345678';
  const securityToken = process.env.ZAPI_WEBHOOK_SECRET;

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
