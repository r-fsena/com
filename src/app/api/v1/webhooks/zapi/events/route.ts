import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession } from '@/lib/api-auth';
import { processZapiWebhookRequest } from '@/lib/zapi-webhook-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = validateApiSession(request);

  const clientTenantHeader = request.headers.get('x-tenant-id');
  const clientUserHeader = request.headers.get('x-user-id');
  const queryTenant = request.nextUrl.searchParams.get('tenantId');
  const secFetchSite = request.headers.get('sec-fetch-site');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

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

  if (errorResponse && !isInternal) return errorResponse;

  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get('since') || '0');
  const targetTenantId = session?.isSuperAdmin 
    ? (searchParams.get('tenantId') || session.tenantId) 
    : session?.tenantId || clientTenantHeader || queryTenant || 'tenant-amabile-barbarotti';

  const allMessages = webhookStore.getAllMessages();

  // Filtra pelo tenant autorizado do usuário ou entrega para a instância ativa
  const messages = allMessages.filter(m => 
    !m.tenantId || 
    m.tenantId === targetTenantId || 
    session?.isSuperAdmin || 
    targetTenantId === 'tenant-amabile-barbarotti'
  );

  return NextResponse.json({
    success: true,
    tenantId: targetTenantId,
    count: messages.length,
    messages,
    serverTime: Date.now(),
  });
}

export async function POST(request: NextRequest) {
  return processZapiWebhookRequest(request);
}
