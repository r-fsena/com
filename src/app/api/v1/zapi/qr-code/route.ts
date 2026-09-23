import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || '';
  const securityToken = searchParams.get('clientToken') || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || '';

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

    // Se a instância estiver sem QR code retornado ou erro, tenta endpoint alternativo /qr-code direto
    try {
      const altRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/qr-code`, {
        headers: { 'Client-Token': securityToken }
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        if (altData?.value) {
          return NextResponse.json({
            success: true,
            instanceId,
            qrCode: altData.value,
            connected: false,
          });
        }
      }
    } catch {}

    return NextResponse.json({
      success: false,
      error: qrResponse.error || 'Não foi possível obter o QR Code da Z-API',
    }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao buscar QR Code da Z-API',
    }, { status: 500 });
  }
}
