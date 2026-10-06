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
    const { instanceId, token, clientToken, tenantId } = body;

    const currentTenantId = tenantId || clientTenantHeader || session?.tenantId || 'tenant-amabile-barbarotti';

    const creds = await ZapiCredentialsService.resolveCredentials({
      instanceId,
      tenantId: currentTenantId,
      token,
      clientToken,
    });

    const webhookUrl = 'https://crm.faithhubs.com/api/v1/webhooks/zapi';

    const client = new ZApiClient({
      instanceId: creds.instanceId,
      instanceToken: creds.instanceToken,
      securityToken: creds.securityToken,
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
