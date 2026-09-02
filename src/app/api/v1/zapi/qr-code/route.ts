import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '3F8144490C66805B4E3FD64A35E2F2DC';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || '550DBC07B2F984AB74E4BCE5';
  const securityToken = searchParams.get('clientToken') || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';

  try {
    const client = new ZApiClient({
      instanceId,
      instanceToken,
      securityToken,
    });

    const qrResponse = await client.getQRCode();

    if (qrResponse.success && qrResponse.data) {
      const isConnected = Boolean((qrResponse.data as any).connected || (qrResponse.data as any).smartphoneConnected);
      const code = (qrResponse.data as any).value || (qrResponse.data as any).image || null;
      return NextResponse.json({
        success: true,
        instanceId,
        qrCode: isConnected ? null : code,
        connected: isConnected,
      });
    }

    // Se a instância estiver em mock/simulação ou sem conexão externa imediata:
    return NextResponse.json({
      success: true,
      instanceId,
      qrCode: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ffffff" width="100" height="100"/><rect fill="%23059669" x="10" y="10" width="30" height="30"/><rect fill="%23ffffff" x="15" y="15" width="20" height="20"/><rect fill="%23059669" x="20" y="20" width="10" height="10"/><rect fill="%23059669" x="60" y="10" width="30" height="30"/><rect fill="%23ffffff" x="65" y="15" width="20" height="20"/><rect fill="%23059669" x="70" y="20" width="10" height="10"/><rect fill="%23059669" x="10" y="60" width="30" height="30"/><rect fill="%23ffffff" x="15" y="65" width="20" height="20"/><rect fill="%23059669" x="20" y="70" width="10" height="10"/><rect fill="%230f172a" x="45" y="15" width="10" height="20"/><rect fill="%230f172a" x="45" y="45" width="10" height="10"/><rect fill="%230f172a" x="65" y="55" width="25" height="10"/><rect fill="%230f172a" x="55" y="70" width="15" height="20"/><rect fill="%230f172a" x="75" y="75" width="15" height="15"/></svg>',
      connected: false,
      isSimulated: true,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao buscar QR Code da Z-API',
    }, { status: 500 });
  }
}
