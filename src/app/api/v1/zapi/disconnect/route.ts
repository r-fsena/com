import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { instanceId, token, clientToken } = body;

    const currentInstanceId = instanceId || process.env.ZAPI_INSTANCE_ID || '';
    const currentToken = token || process.env.ZAPI_INSTANCE_TOKEN || '';
    const securityToken = clientToken || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || '';

    if (!currentInstanceId || !currentToken) {
      return NextResponse.json({
        success: false,
        error: 'Instância Z-API não configurada',
      }, { status: 400 });
    }

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
