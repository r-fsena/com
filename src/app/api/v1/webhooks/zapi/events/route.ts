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

  const allMessages = since > 0 
    ? webhookStore.getMessagesSince(since)
    : webhookStore.getAllMessages();

  // Consulta também o banco PostgreSQL para resgatar mensagens offline ou históricas
  let dbMessages: any[] = [];
  if (process.env.DATABASE_URL) {
    try {
      const { ContactsDBService } = await import('@/lib/db/contacts-service');
      dbMessages = await ContactsDBService.getMessagesSince(targetTenantId, since);
    } catch (err) {
      console.warn('[Events API] Aviso ao buscar mensagens no PostgreSQL:', err);
    }
  }

  // Mescla mensagens do banco com as da memória sem duplicar IDs
  const messageMap = new Map<string, any>();
  for (const m of dbMessages) {
    if (m && m.id) messageMap.set(m.id, m);
  }
  for (const m of allMessages) {
    if (m && m.id) messageMap.set(m.id, m);
  }
  const mergedList = Array.from(messageMap.values());

  // Filtra pelo tenant autorizado do usuário ou entrega para a instância ativa
  const messages = mergedList.filter(m => 
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

export async function PUT(request: NextRequest) {
  return processZapiWebhookRequest(request);
}
