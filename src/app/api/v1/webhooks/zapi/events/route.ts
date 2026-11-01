import { readCRMState } from '@/lib/crm-repository';
import { NextRequest, NextResponse } from 'next/server';
import { crmEventCursor, messageEventTime } from '@/lib/crm-event-cursor';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { processZapiWebhookRequest } from '@/lib/zapi-webhook-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = validateApiSession(request);
  if (errorResponse) return errorResponse;
  const tenantId = authorizedTenant(session!, request.nextUrl.searchParams.get('tenantId') || request.headers.get('x-tenant-id'));
  const since = Number(request.nextUrl.searchParams.get('since') || '0');
  if (!Number.isFinite(since) || since < 0) return NextResponse.json({ error: 'Cursor inválido.' }, { status: 400 });
  try {
    const state = await readCRMState(tenantId);
    const messages = state.messages.filter(m => !m.isInternalNote && messageEventTime(m) > since).map(m => {
      const conversation = state.conversations.find(c => c.id === m.conversationId);
      const contact = state.contacts.find(c => c.id === conversation?.contactId);
      return { ...m, phone: contact?.phone || '', instanceId: conversation?.instanceId, lid: contact?.lid,
        fromMe: m.senderType === 'USER', mediaUrl: m.attachments?.[0]?.url, mediaType: m.messageType.toLowerCase(), receivedAt: messageEventTime(m) };
    });
    // O cursor pertence exatamente ao snapshot lido. Um commit posterior fica para a próxima consulta.
    const conversationIds = new Set(messages.map(m => m.conversationId));
    const conversations = state.conversations.filter(c => conversationIds.has(c.id));
    const contactIds = new Set(conversations.map(c => c.contactId));
    const contacts = state.contacts.filter(c => contactIds.has(c.id));
    return NextResponse.json({ success: true, tenantId, count: messages.length, messages, contacts, conversations, tasks: state.tasks || [], serverTime: crmEventCursor(state) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ success: false, error: 'Histórico indisponível. Tente novamente.' }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  return processZapiWebhookRequest(request);
}

export async function PUT(request: NextRequest) {
  return processZapiWebhookRequest(request);
}
