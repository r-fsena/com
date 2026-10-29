import { buildZapiWebhookUrl } from '@/lib/zapi-webhook-auth';
import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';

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

    const currentTenantId = authorizedTenant(session!, tenantId || clientTenantHeader);

    const creds = await ZapiCredentialsService.resolveCredentials({
      instanceId,
      tenantId: currentTenantId,
      token,
      clientToken,
    });

    const webhookUrl = buildZapiWebhookUrl(creds.instanceId, currentTenantId!);

    const client = new ZApiClient({
      instanceId: creds.instanceId,
      instanceToken: creds.instanceToken,
      securityToken: creds.securityToken,
    });

    const result = await client.configureAllWebhooks(webhookUrl);

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Webhooks da Z-API configurados automaticamente com sucesso!' : 'Configuração de webhooks incompleta.',
      webhookUrl: webhookUrl.split('?')[0],
      result,
    }, { status: result.success ? 200 : 502 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha na auto-configuração de webhooks da Z-API',
    }, { status: 500 });
  }
}
