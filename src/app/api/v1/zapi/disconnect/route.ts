import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { instanceId, token, clientToken } = body;

    const currentInstanceId = instanceId || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
    const currentToken = token || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
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
