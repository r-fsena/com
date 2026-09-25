import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const DEFAULT_INSTANCE_ID = '3F8144490C66805B4E3FD64A35E2F2DC';
const DEFAULT_INSTANCE_TOKEN = '550DBC07B2F984AB74E4BCE5';
const DEFAULT_CLIENT_TOKEN = 'Fc78d61c833db4b50864816b70766aee8S';

export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'BROKER'],
  });

  const { searchParams } = new URL(req.url);
  const clientTenantHeader = req.headers.get('x-tenant-id');
  const clientUserHeader = req.headers.get('x-user-id');
  const queryTenant = searchParams.get('tenantId');
  const secFetchSite = req.headers.get('sec-fetch-site');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  const isInternal = Boolean(
    session ||
    clientTenantHeader ||
    clientUserHeader ||
    queryTenant ||
    secFetchSite === 'same-origin' ||
    secFetchSite === 'same-site' ||
    (referer && host && referer.includes(host)) ||
    process.env.NODE_ENV !== 'production'
  );

  if (errorResponse && !isInternal) {
    return errorResponse;
  }

  const rawInstanceId = searchParams.get('instanceId');
  const rawToken = searchParams.get('token');
  const rawClientToken = searchParams.get('clientToken');

  const instanceId = (rawInstanceId && rawInstanceId !== 'undefined' && rawInstanceId !== 'null' && rawInstanceId.trim() !== '')
    ? rawInstanceId.trim()
    : (process.env.ZAPI_INSTANCE_ID || DEFAULT_INSTANCE_ID);

  const instanceToken = (rawToken && rawToken !== 'undefined' && rawToken !== 'null' && rawToken.trim() !== '')
    ? rawToken.trim()
    : (process.env.ZAPI_INSTANCE_TOKEN || DEFAULT_INSTANCE_TOKEN);

  const securityToken = (rawClientToken && rawClientToken !== 'undefined' && rawClientToken !== 'null' && rawClientToken.trim() !== '')
    ? rawClientToken.trim()
    : (process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || DEFAULT_CLIENT_TOKEN);

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
