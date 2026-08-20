import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
  const securityToken = searchParams.get('clientToken') || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';

  try {
    const client = new ZApiClient({
      instanceId,
      instanceToken,
      securityToken,
    });

    const statusResponse = await client.getStatus();

    let connected = false;
    let phone = 'Não conectado';
    let name = 'WhatsApp Comercial';
    let battery = 100;

    if (statusResponse.success && statusResponse.data) {
      connected = Boolean(statusResponse.data.connected || (statusResponse.data as any).smartphoneConnected);
    }

    if (connected) {
      // Busca dados detalhados do aparelho conectado
      try {
        const deviceRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/device`, {
          headers: { 'Client-Token': securityToken }
        });
        if (deviceRes.ok) {
          const deviceData = await deviceRes.json();
          phone = deviceData.phone ? `+55 (${deviceData.phone.substring(2, 4)}) ${deviceData.phone.substring(4)}` : phone;
          name = deviceData.name || name;
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      instanceId,
      connected,
      phone,
      name,
      battery,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao consultar status da Z-API',
    }, { status: 500 });
  }
}
