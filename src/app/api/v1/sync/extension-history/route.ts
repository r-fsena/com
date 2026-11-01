import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';
import { arePhonesEquivalent, cleanLid, isWhatsAppChannelOrGroup } from '@/lib/whatsapp-filter';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { mutateCRMState, mergeTenantState } from '@/lib/crm-repository';

export const dynamic = 'force-dynamic';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
  'Access-Control-Expose-Headers': 'X-Brokiva-Import-Protocol, X-Brokiva-Import-Revision',
  'X-Brokiva-Import-Protocol': '2', 'X-Brokiva-Import-Revision': '20261029.3',
};
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: CORS_HEADERS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS_HEADERS }); }
const messageTypes = ['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'VIDEO', 'STICKER', 'CALL', 'CONTACT_CARD'] as const;
const MessageSchema = z.object({
  id: z.string().min(1).max(2048).optional(), content: z.string().default(''), fromMe: z.boolean().default(false),
  timestamp: z.string().or(z.number()).optional(), messageType: z.string().optional(),
  mediaUrl: z.string().nullish(), fileName: z.string().nullish(), senderName: z.string().optional(),
});
const BatchSchema = z.object({
  protocol: z.literal(2).optional(), batchId: z.string().uuid().optional(), tenantId: z.string().optional(),
  brokerUserId: z.string().optional(), brokerName: z.string().optional(), instanceId: z.string().optional(),
  chats: z.array(z.object({ phone: z.string().min(1), name: z.string().optional(), lid: z.string().optional(),
    avatarUrl: z.string().nullish(), tags: z.array(z.string()).optional(), labels: z.array(z.string()).optional(),
    messages: z.array(MessageSchema).max(1000).default([]), lastMessagePreview: z.string().optional(), lastMessageAt: z.string().or(z.number()).optional(),
  })).min(1).max(100),
});
class InvalidImport extends Error {}
function timestamp(value: string | number | undefined): string | undefined {
  if (value === undefined) return;
  const ms = parseWhatsAppTimestamp(value);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined;
}
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`ext-sync:${getClientIp(req.headers)}`, 60, 60);
  if (!rate.allowed) return json({ success: false, error: `Limite excedido. Aguarde ${rate.resetInSeconds}s.` }, 429);
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) { Object.entries(CORS_HEADERS).forEach(([k, v]) => errorResponse.headers.set(k, v)); return errorResponse; }
  try {
    const raw = await req.json();
    if (raw?.tenantId && raw.tenantId !== session!.tenantId && !session!.isSuperAdmin) return json({ success: false, error: 'Imobiliária não autorizada.' }, 403);
    const parsed = BatchSchema.safeParse(raw);
    if (!parsed.success) return json({ success: false, error: 'Estrutura de importação inválida.', details: parsed.error.format() }, 400);
    const input = parsed.data;
    if (input.tenantId && input.tenantId !== session!.tenantId && !session!.isSuperAdmin) return json({ success: false, error: 'Imobiliária não autorizada.' }, 403);
    const tenantId = authorizedTenant(session!, input.tenantId);
    if (input.protocol === 2 && !input.batchId) throw new InvalidImport('Identificador de lote obrigatório.');
    const resultContacts: Contact[] = [], resultConversations: Conversation[] = [], resultMessages: Message[] = [];
    const messageIds: string[] = [];
    const requestIds = new Set<string>();
    const now = new Date().toISOString();
    await mutateCRMState(tenantId, previous => {
      let state = previous;
      for (const chat of input.chats) {
        if (isWhatsAppChannelOrGroup({ phone: chat.phone, lid: chat.lid })) throw new InvalidImport('Grupos e canais não são importados como conversas individuais.');
        const phoneDigits = chat.phone.replace(/\D/g, '');
        const lid = cleanLid(chat.lid || (chat.phone.includes('@lid') ? chat.phone : ''));
        const existingByLid = lid ? state.contacts.find(c => c.lid && cleanLid(c.lid) === lid) : undefined;
        const phone = chat.phone.includes('@lid') ? existingByLid?.phone?.replace(/\D/g, '') || '' : phoneDigits;
        if (!/^\d{8,15}$/.test(phone) || /^(4400|5500)/.test(phone)) throw new InvalidImport('Telefone não confirmado. Identifique o contato no WhatsApp e tente novamente; nenhuma mensagem deste lote foi gravada.');
        const existingContact = state.contacts.find(c => arePhonesEquivalent(c.phone, phone) || (lid && c.lid && cleanLid(c.lid) === lid));
        const contactId = existingContact?.id || `contact-zapi-${phone}`;
        const existingConv = state.conversations.find(c => c.contactId === contactId || c.id === `conv-zapi-${phone}`);
        const conversationId = existingConv?.id || `conv-zapi-${phone}`;
        const messages: Message[] = [];
        for (let index = 0; index < chat.messages.length; index++) {
          const message = chat.messages[index];
          const date = timestamp(message.timestamp);
          if (input.protocol === 2 && (!message.id || !date)) throw new InvalidImport('Mensagem sem ID ou data válida. Releia a conversa.');
          const sourceId = message.id || `ext-${crypto.createHash('sha256').update(JSON.stringify([conversationId, message.content, message.timestamp || '', message.fromMe, index])).digest('hex')}`;
          if (requestIds.has(sourceId)) throw new InvalidImport('ID repetido no mesmo lote.');
          requestIds.add(sourceId);
          const nativeId = sourceId.match(/^(true|false)_(\d+)@(c\.us|s\.whatsapp\.net|lid)_(.+)$/);
          if (input.protocol === 2 && (!nativeId || (nativeId[1] === 'true') !== message.fromMe
            || (nativeId[3] === 'lid' ? cleanLid(chat.lid || '') !== nativeId[2] : !arePhonesEquivalent(nativeId[2], phone)))) {
            throw new InvalidImport('Mensagem e contato não pertencem à mesma conversa.');
          }
          const externalId = nativeId?.[4] || sourceId;
          const old = state.messages.find(m => m.conversationId === conversationId && (m.id === sourceId || m.externalId === sourceId || m.externalId === externalId));
          const type = (message.messageType || 'TEXT').toUpperCase();
          if (!messageTypes.includes(type as MessageType)) throw new InvalidImport(`Tipo de mensagem não suportado: ${type}.`);
          const messageType = type as MessageType;
          // Texto do usuário é preservado: números, horários, quebras de linha e nomes de arquivos são conteúdo válido.
          const content = message.content || (messageType === 'TEXT' || messageType === 'CONTACT_CARD' ? '' : `[${messageType}]`);
          if (!content && (messageType === 'CONTACT_CARD' || !message.mediaUrl)) throw new InvalidImport('Balão sem conteúdo legível. Releia a conversa.');
          const mediaUrl = message.mediaUrl || undefined;
          if (mediaUrl && !/^(https:\/\/|data:image\/)/i.test(mediaUrl)) throw new InvalidImport('Mídia temporária ou URL inválida. Reabra o arquivo no WhatsApp antes de importar.');
          const id = old?.id || sourceId;
          messages.push({ ...old, id, externalId, tenantId, conversationId,
            senderType: message.fromMe ? 'USER' : 'CONTACT', senderUserId: message.fromMe ? session!.userId : undefined,
            senderName: message.fromMe ? session!.userName : (existingContact?.name || chat.name || `Contato ${phone.slice(-4)}`),
            messageType, content, timestamp: date || old?.timestamp || now,
            attachments: mediaUrl ? [{ id: `att-${id}`, url: mediaUrl, fileName: message.fileName || 'Arquivo', fileSize: 0,
              mimeType: messageType === 'AUDIO' ? 'audio/ogg' : messageType === 'IMAGE' ? 'image/jpeg' : messageType === 'VIDEO' ? 'video/mp4' : 'application/octet-stream' }] : old?.attachments,
            status: old?.status || 'DELIVERED', isInternalNote: false });
          messageIds.push(sourceId);
        }
        const latest = messages.reduce<Message | undefined>((last, m) => !last || Date.parse(m.timestamp) >= Date.parse(last.timestamp) ? m : last, undefined);
        const latestIncoming = messages.filter(m => m.senderType === 'CONTACT').reduce((max, m) => Date.parse(m.timestamp) > Date.parse(max || '1970-01-01') ? m.timestamp : max, existingContact?.lastClientInteractionAt);
        const latestOutgoing = messages.filter(m => m.senderType === 'USER').reduce((max, m) => Date.parse(m.timestamp) > Date.parse(max || '1970-01-01') ? m.timestamp : max, existingContact?.lastTeamInteractionAt);
        const contact: Contact = { assignedUserId: session!.userId, source: 'WHATSAPP', temperature: 'COLD', aiPriorityScore: 0, targetRegions: [], notesCount: 0,
          consentGiven: false, hasOptedOut: false, isPersonal: false, createdAt: now, ...existingContact,
          id: contactId, tenantId, phone: `+${phone}`, name: existingContact?.name || chat.name || `Contato ${phone.slice(-4)}`,
          lid: lid || existingContact?.lid, avatarUrl: chat.avatarUrl || existingContact?.avatarUrl,
          tags: Array.from(new Set([...(existingContact?.tags || []), ...(chat.tags || []), ...(chat.labels || []), 'WhatsApp Web Sincronizado'])),
          whatsappLabels: Array.from(new Set([...(existingContact?.whatsappLabels || []), ...(chat.labels || [])])),
          lastClientInteractionAt: latestIncoming, lastTeamInteractionAt: latestOutgoing, updatedAt: now };
        const replacePreview = latest && (!existingConv || Date.parse(latest.timestamp) >= Date.parse(existingConv.lastMessageAt));
        const conversation: Conversation = { assignedUserId: session!.userId, status: 'UNASSIGNED', unreadCount: 0, slaBreached: false, isPersonal: false,
          lastMessagePreview: '', lastMessageAt: latest?.timestamp || timestamp(chat.lastMessageAt) || now, ...existingConv,
          id: conversationId, tenantId, contactId, instanceId: existingConv?.instanceId || `extension-${session!.userId}`,
          ...(replacePreview ? { lastMessagePreview: latest.content.slice(0, 100), lastMessageAt: latest.timestamp,
            status: latest.senderType === 'USER' ? 'PENDING_CLIENT' as const : 'PENDING_TEAM' as const } : {}) };
        state = mergeTenantState(tenantId, state, { contacts: [contact], conversations: [conversation], messages });
        resultContacts.push(contact); resultConversations.push(conversation); resultMessages.push(...messages);
      }
      return state;
    });
    return json({ success: true, tenantId, contactsCount: resultContacts.length, messagesCount: messageIds.length,
      receipt: { protocol: 2, batchId: input.batchId || null, messageIds }, resultContacts, resultConversations, resultMessages });
  } catch (error: any) {
    return json({ success: false, error: error.message || 'Falha ao gravar importação.' }, error instanceof InvalidImport ? 400 : 500);
  }
}
