import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json().catch(() => ({}));
    const { instanceId, token, clientToken } = body;

    const currentInstanceId = instanceId || process.env.ZAPI_INSTANCE_ID || '3F8144490C66805B4E3FD64A35E2F2DC';
    const currentToken = token || process.env.ZAPI_INSTANCE_TOKEN || '550DBC07B2F984AB74E4BCE5';
    const securityToken = clientToken || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';

    const client = new ZApiClient({
      instanceId: currentInstanceId,
      instanceToken: currentToken,
      securityToken,
    });

    const result = await client.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Sessão Z-API desconectada com sucesso. Pronto para novo pareamento via QR Code.',
      details: result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao desconectar da Z-API',
    }, { status: 500 });
  }
}
