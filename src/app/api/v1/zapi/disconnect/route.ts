import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'BROKER'],
  });

  const clientTenantHeader = req.headers.get('x-tenant-id');
  const clientUserHeader = req.headers.get('x-user-id');

  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { instanceId, token, clientToken, tenantId } = body;
    const currentTenantId = tenantId || clientTenantHeader || session?.tenantId;

    const creds = await ZapiCredentialsService.resolveCredentials({
      instanceId,
      tenantId: session!.isSuperAdmin ? (req.headers.get('x-tenant-id') || session!.tenantId) : session!.tenantId,
      token,
      clientToken,
    });

    const client = new ZApiClient({
      instanceId: creds.instanceId,
      instanceToken: creds.instanceToken,
      securityToken: creds.securityToken,
    });

    const result = await client.disconnect();

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Sessão desconectada com sucesso.' : 'Não foi possível desconectar a sessão.',
      details: result,
    }, { status: result.success ? 200 : 502 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao desconectar da Z-API',
    }, { status: 500 });
  }
}
