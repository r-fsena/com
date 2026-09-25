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

    const statusResponse = await client.getStatus();

    let connected = false;
    let phone = 'Não conectado';
    let name = 'WhatsApp Comercial';
    let battery = 100;

    if (statusResponse.success && statusResponse.data) {
      connected = Boolean(statusResponse.data.connected || (statusResponse.data as any).smartphoneConnected);
    }

    let avatarUrl: string | null = null;
    let deviceModel = 'Smartphone';
    let isBusiness = false;

    if (connected) {
      // Busca dados detalhados do aparelho conectado
      try {
        const deviceRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/device`, {
          headers: { 'Client-Token': securityToken }
        });
        if (deviceRes.ok) {
          const deviceData = await deviceRes.json();
          if (deviceData.phone) {
            const raw = String(deviceData.phone).replace(/\D/g, '');
            if (raw.startsWith('55') && raw.length >= 12) {
              const ddd = raw.substring(2, 4);
              const num = raw.substring(4);
              const formattedNum = num.length === 9 
                ? `${num.substring(0, 5)}-${num.substring(5)}` 
                : `${num.substring(0, 4)}-${num.substring(4)}`;
              phone = `+55 (${ddd}) ${formattedNum}`;
            } else {
              phone = `+${raw}`;
            }
          }
          name = deviceData.name || name;
          avatarUrl = deviceData.imgUrl || null;
          deviceModel = deviceData.originalDevice || deviceData.device?.device_model || 'Smartphone';
          isBusiness = Boolean(deviceData.isBusiness);
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      instanceId,
      connected,
      phone: connected ? phone : 'Não conectado',
      name: connected ? name : 'Instância Desconectada',
      battery,
      avatarUrl,
      deviceModel,
      isBusiness,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao consultar status da Z-API',
    }, { status: 500 });
  }
}
