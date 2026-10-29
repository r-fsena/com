import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverCRMStore } from '@/lib/server-crm-store';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';
import { isWhatsAppChannelOrGroup, arePhonesEquivalent, canonicalPhoneKey, isWhatsAppSystemMessage, isLidIdentifier, cleanLid, formatCanonicalPhone } from '@/lib/whatsapp-filter';
import { recordExtensionLog } from '@/lib/cloudwatch-logger';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

import { readCRMState, writeCRMState } from '@/lib/crm-repository';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-extension-token, x-tenant-id',
};

function jsonWithCors(data: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return NextResponse.json(data, { ...init, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

const IngestMessageSchema = z.object({
  id: z.string().optional(),
  content: z.string().default(''),
  fromMe: z.boolean().default(false),
  timestamp: z.string().or(z.number()).optional(),
  senderName: z.string().optional(),
  messageType: z.string().optional().transform(v => {
    const norm = (v || 'TEXT').toUpperCase();
    if (['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'VIDEO', 'STICKER'].includes(norm)) {
      return norm as MessageType;
    }
    return 'TEXT' as MessageType;
  }).default('TEXT'),
  mediaUrl: z.string().optional(),
  fileName: z.string().optional(),
});

const IngestChatSchema = z.object({
  phone: z.string(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  lid: z.string().optional(),
  tags: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  messages: z.array(IngestMessageSchema).default([]),
  lastMessagePreview: z.string().optional(),
  lastMessageAt: z.string().or(z.number()).optional(),
});

const BatchSyncSchema = z.object({
  tenantId: z.string().optional(),
  brokerUserId: z.string().optional(),
  brokerName: z.string().optional(),
  chats: z.array(IngestChatSchema).max(100),
  instanceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (Máx 60 lotes por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`ext-sync:${clientIp}`, 60, 60);
  if (!rateCheck.allowed) {
    return jsonWithCors({
      success: false,
      error: `Limite de requisições excedido. Aguarde ${rateCheck.resetInSeconds}s.`,
    }, { status: 429 });
  }

  // 2. Validação de Sessão ou Token da Extensão
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => errorResponse.headers.set(k, v));
    return errorResponse;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BatchSyncSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithCors({
        success: false,
        error: 'Estrutura de dados inválida',
        details: parsed.error.format(),
      }, { status: 400 });
    }

    const { tenantId, brokerUserId, brokerName, chats } = parsed.data;

    if (tenantId && tenantId !== session!.tenantId && !session!.isSuperAdmin) return jsonWithCors({ success: false, error: 'Imobiliária não autorizada.' }, { status: 403 });
    const effectiveTenantId = authorizedTenant(session!, tenantId);
    const effectiveBrokerUserId = session!.userId;
    const effectiveBrokerName = session!.userName;
    const currentState = await readCRMState(effectiveTenantId);
    // A importação via WhatsApp Web não implica uma conexão Z-API existente.
    const targetInstanceId = parsed.data.instanceId || `extension-${session!.userId}`;

    let importedContactsCount = 0;
    let importedMessagesCount = 0;

    const newContacts: Contact[] = [];
    const newConversations: Conversation[] = [];
    const newMessages: Message[] = [];

    const nowIso = new Date().toISOString();

    for (const chat of chats) {
      let rawDigits = chat.phone.replace(/\D/g, '');
      if (!rawDigits || rawDigits.length < 8) continue;
      if (isWhatsAppChannelOrGroup({ phone: rawDigits, name: chat.name, lid: chat.lid })) continue;

      const isInputLid = isLidIdentifier(rawDigits) || isLidIdentifier(chat.phone);
      const incomingLid = cleanLid(chat.lid || (isInputLid ? rawDigits : ''));

      // Tenta resolver para o telefone canônico caso seja um LID
      let cleanPhone = rawDigits;
      if (isInputLid) {
        const resolvedFromStore = currentState.contacts.find(c => c.lid === (incomingLid || rawDigits))?.phone?.replace(/\D/g, '');
        if (resolvedFromStore) {
          cleanPhone = resolvedFromStore;
        }
      }

      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }

      // Localiza se já existe contato ou conversa prévia DENTRO DO MESMO TENANT (Isolamento Estrito)
      const cleanIncomingName = (chat.name || '').trim().toLowerCase();

      const existingContact = currentState.contacts.find(c => {
        if (c.tenantId !== effectiveTenantId) return false;

        const matchPhone = arePhonesEquivalent(c.phone, rawDigits) || 
                           arePhonesEquivalent(c.phone, cleanPhone) ||
                           arePhonesEquivalent(c.phone, chat.phone);
        const matchLid = (incomingLid && c.lid && cleanLid(c.lid) === incomingLid) ||
                         (c.lid && rawDigits && cleanLid(c.lid) === cleanLid(rawDigits));
        if (matchPhone || matchLid) return true;

        // Unificação Inteligente por Nome Exato: se o contato existente possui um identificador corrompido/LID
        // (ex: LID, 4400..., 5500... sintético) e o novo registro traz o telefone real da mesma pessoa:
        const cleanNameA = (c.name || '').trim().toLowerCase();
        if (cleanNameA && cleanIncomingName && cleanNameA === cleanIncomingName && cleanNameA !== 'contato whatsapp') {
          const cHasInvalidPhone = isLidIdentifier(c.phone) || !c.phone || c.phone.includes('4400') || c.phone.includes('5500') || !c.phone.startsWith('+55');
          const incomingIsReal = cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 13 && !isLidIdentifier(cleanPhone);
          if (cHasInvalidPhone && incomingIsReal) {
            return true;
          }
        }
        return false;
      });

      // Se o contato existente possuir telefone real válido, adota-o como canônico
      // MAS se o contato existente tinha um identificador inválido/LID e o novo dado traz um telefone real, o telefone real tem precedência!
      const existingHasValidPhone = existingContact?.phone && !isLidIdentifier(existingContact.phone) && existingContact.phone.startsWith('+55');
      const incomingHasValidPhone = cleanPhone.startsWith('55') && !isLidIdentifier(cleanPhone) && cleanPhone.length >= 10 && cleanPhone.length <= 13;

      if (existingHasValidPhone && !incomingHasValidPhone) {
        cleanPhone = existingContact.phone.replace(/\D/g, '');
      }

      // Registra a correlação LID <-> Telefone se ambos estiverem presentes
      if (incomingLid && cleanPhone && !isLidIdentifier(cleanPhone)) {
        serverCRMStore.registerLidPhone(incomingLid, cleanPhone);
      }

      // ID canônico padronizado para conv-zapi- e contact-zapi- (unificado com Inbox e Webhooks)
      const defaultContactId = `contact-zapi-${cleanPhone}`;
      const defaultConversationId = `conv-zapi-${cleanPhone}`;

      const existingConv = currentState.conversations.find(cv => {
        if (cv.tenantId !== effectiveTenantId) return false;
        const convDigits = cv.id.replace(/\D/g, '') || cv.contactId.replace(/\D/g, '');
        const matchConvPhone = arePhonesEquivalent(convDigits, cleanPhone) ||
                               arePhonesEquivalent(convDigits, rawDigits);
        return cv.id === defaultConversationId || 
               matchConvPhone || 
               (existingContact && (cv.contactId === existingContact.id || cv.id.includes(existingContact.id)));
      });

      const contactId = existingContact ? existingContact.id : defaultContactId;
      const conversationId = existingConv ? existingConv.id : defaultConversationId;

      let contactName = (chat.name || '').trim();
      if (existingContact?.name && !existingContact.name.startsWith('+') && !existingContact.name.startsWith('WhatsApp') && existingContact.name !== 'Contato WhatsApp') {
        contactName = existingContact.name;
      } else if (!contactName || contactName === 'Contato WhatsApp' || contactName.toLowerCase() === 'whatsapp') {
        contactName = existingContact?.name || formatCanonicalPhone(cleanPhone) || `Contato ${cleanPhone.slice(-4)}`;
      } else if (contactName.startsWith('+')) {
        contactName = formatCanonicalPhone(cleanPhone) || contactName;
      }

      // 1. Processa mensagens do chat
      let lastMsgText = chat.lastMessagePreview || '';
      if (isWhatsAppSystemMessage(lastMsgText)) {
        lastMsgText = '';
      }
      let lastMsgTime = nowIso;
      if (chat.lastMessageAt) {
        const ms = parseWhatsAppTimestamp(chat.lastMessageAt);
        if (ms > 0) lastMsgTime = new Date(ms).toISOString();
      }

      if (Array.isArray(chat.messages) && chat.messages.length > 0) {
        const seenInBatch = new Set<string>();
        chat.messages.forEach((m, idx) => {
          let cleanContent = (m.content || '').trim();

          // Remove horários residuais colados no final (ex: " 14:32", "\n14:32", " 2:30 PM", " 14:32✓")
          cleanContent = cleanContent.replace(/[\s\u00a0\u200e\u200f\n\r]+(\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?)\s*$/i, '').trim();

          // Remove menções de tamanho de arquivo (ex: " (42 KB)", " 42 KB", "1.2 MB", etc.)
          cleanContent = cleanContent.replace(/\s*\(\s*\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\s*\)/gi, '');
          cleanContent = cleanContent.replace(/\b\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\b/gi, '').trim();

          // Remove nomes de ícones SVG do WhatsApp Web (tail-out, tail-in, ic-fast-forward)
          cleanContent = cleanContent.replace(/\b(tail-in|tail-out|ic-fast-forward|fast-forward)\b/gi, '').trim();

          // Limpa múltiplos espaços
          cleanContent = cleanContent.replace(/\s{2,}/g, ' ').trim();

          // Se o conteúdo for puramente vazio, horário ou ruído, atribui fallback limpo ou descarta
          if (!cleanContent || /^\d{1,2}:\d{2}$/.test(cleanContent) || /^\d+([.,]\d+)?\s*(KB|MB|GB|B)$/i.test(cleanContent)) {
            if (m.messageType === 'AUDIO') cleanContent = '🎵 Mensagem de Voz';
            else if (m.messageType === 'IMAGE') cleanContent = '📷 Foto';
            else if (m.messageType === 'DOCUMENT') cleanContent = '📄 Documento';
            else if (!m.mediaUrl) return; // Descarta balão de ruído/sistema sem conteúdo
          }

          // Se foi enviado como AUDIO mas contém texto real digitado pelo usuário, é uma mensagem de TEXTO legítima
          if (m.messageType === 'AUDIO' && cleanContent && !cleanContent.includes('Mensagem de Voz') && !cleanContent.includes('[Áudio]')) {
            m.messageType = 'TEXT';
          }

          if (isWhatsAppSystemMessage(cleanContent)) return;

          let mTimestamp = nowIso;
          if (m.timestamp) {
            const ms = parseWhatsAppTimestamp(m.timestamp);
            if (ms > 0) mTimestamp = new Date(ms).toISOString();
          }

          const mId = m.id || `ext-msg-${crypto.createHash('sha256').update(JSON.stringify([conversationId, cleanContent, m.timestamp || '', m.fromMe, idx])).digest('hex').slice(0, 32)}`;
          const isFromMe = Boolean(m.fromMe);
          const batchDedupeKey = m.id || `${conversationId}-${cleanContent}-${mTimestamp.slice(0, 19)}-${isFromMe}`;
          if (seenInBatch.has(batchDedupeKey)) return;
          seenInBatch.add(batchDedupeKey);

          newMessages.push({
            id: mId,
            externalId: m.id || mId,
            tenantId: effectiveTenantId,
            conversationId,
            senderType: isFromMe ? 'USER' : 'CONTACT',
            senderUserId: isFromMe ? effectiveBrokerUserId : undefined,
            senderName: isFromMe ? (effectiveBrokerName || 'Corretor') : contactName,
            messageType: (m.messageType || 'TEXT') as MessageType,
            content: cleanContent || (m.messageType === 'AUDIO' ? '🎵 Mensagem de Voz' : m.messageType === 'IMAGE' ? '📷 Foto' : m.messageType === 'VIDEO' ? '🎥 Vídeo' : 'Mensagem'),
            attachments: m.mediaUrl ? [{
              id: `att-${mId}`,
              url: m.mediaUrl,
              fileName: m.fileName || (m.messageType === 'AUDIO' ? 'Audio.ogg' : m.messageType === 'IMAGE' ? 'Foto.jpg' : m.messageType === 'VIDEO' ? 'Video.mp4' : 'Documento.pdf'),
              fileSize: 1024,
              mimeType: m.messageType === 'AUDIO' ? 'audio/ogg' : m.messageType === 'IMAGE' ? 'image/jpeg' : m.messageType === 'VIDEO' ? 'video/mp4' : 'application/pdf',
            }] : undefined,
            status: 'DELIVERED',
            isInternalNote: false,
            timestamp: mTimestamp,
            phone: cleanPhone,
          } as any);

          importedMessagesCount++;
          lastMsgText = cleanContent;
          lastMsgTime = mTimestamp;
        });
      }

      // 2. Contato: Garante separação estrita entre telefone e LID
      const isCleanPhoneLid = isLidIdentifier(cleanPhone);
      const resolvedPhoneFromStore = isCleanPhoneLid ? currentState.contacts.find(c => c.lid === cleanPhone)?.phone?.replace(/\D/g, '') : null;
      const resolvedPhone = existingContact?.phone && !isLidIdentifier(existingContact.phone)
        ? existingContact.phone
        : (resolvedPhoneFromStore ? `+${resolvedPhoneFromStore}` : `+${cleanPhone}`);
      
      const resolvedLid = cleanLid(chat.lid || existingContact?.lid || (isCleanPhoneLid ? cleanPhone : '')) || undefined;
      if (resolvedLid && resolvedPhone && !isLidIdentifier(resolvedPhone)) {
        serverCRMStore.registerLidPhone(resolvedLid, resolvedPhone);
      }

      const existingAvatar = existingContact?.avatarUrl;
      const isExistingHd = Boolean(existingAvatar && existingAvatar.startsWith('http') && !existingAvatar.includes('ui-avatars.com'));
      const finalAvatar = isExistingHd
        ? existingAvatar
        : (chat.avatarUrl || existingAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=059669&color=fff`);

      newContacts.push({
        id: contactId,
        tenantId: effectiveTenantId,
        name: contactName,
        phone: resolvedPhone,
        lid: resolvedLid,
        avatarUrl: finalAvatar,
        assignedUserId: effectiveBrokerUserId || undefined,
        source: 'WHATSAPP',
        temperature: existingContact?.temperature || 'COLD',
        aiPriorityScore: existingContact?.aiPriorityScore !== undefined ? existingContact.aiPriorityScore : 0,
        tags: Array.from(new Set([
          ...(chat.tags || []),
          ...(chat.labels || []),
          ...(existingContact?.tags || []),
          'WhatsApp Web Sincronizado',
        ])).filter(Boolean),
        targetRegions: existingContact?.targetRegions || [],
        preferredPropertyType: existingContact?.preferredPropertyType,
        maxPropertyValue: existingContact?.maxPropertyValue,
        downPaymentAvailable: existingContact?.downPaymentAvailable,
        monthlyIncome: existingContact?.monthlyIncome,
        notesCount: existingContact?.notesCount || 0,
        consentGiven: true,
        consentDate: lastMsgTime,
        hasOptedOut: false,
        isPersonal: existingContact?.isPersonal ?? false,
        lastClientInteractionAt: lastMsgTime,
        createdAt: existingContact?.createdAt || lastMsgTime,
        updatedAt: nowIso,
      });
      importedContactsCount++;

      // 3. Conversa
      const cleanPreview = (lastMsgText && !isWhatsAppSystemMessage(lastMsgText)) 
        ? lastMsgText 
        : 'Conversa sincronizada via Extensão Chrome';

      const lastMsgObj = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
      const lastIsFromMe = lastMsgObj ? Boolean(lastMsgObj.fromMe) : false;

      newConversations.push({
        id: conversationId,
        tenantId: effectiveTenantId,
        instanceId: targetInstanceId,
        contactId,
        assignedUserId: effectiveBrokerUserId || undefined,
        status: lastIsFromMe ? 'PENDING_CLIENT' : 'PENDING_TEAM',
        unreadCount: 0,
        lastMessagePreview: cleanPreview,
        lastMessageAt: lastMsgTime,
        slaBreached: false,
        isPersonal: false,
        aiEnabled: lastIsFromMe ? false : undefined,
        humanTakeoverAt: lastIsFromMe ? lastMsgTime : undefined,
        autoFollowupCount: 0,
      });
    }


    // O ACK só é devolvido depois de contatos, conversas e mensagens terem sido confirmados juntos.
    await writeCRMState(effectiveTenantId, { contacts: newContacts, conversations: newConversations, messages: newMessages });

    // Registra log estruturado no CloudWatch
    await recordExtensionLog({
      timestamp: Date.now(),
      level: 'INFO',
      event: 'BATCH_SYNC_INGESTED',
      tenantId: effectiveTenantId,
      brokerName: effectiveBrokerName,
      messagesCount: importedMessagesCount,
      details: {
        contactsCount: importedContactsCount,
        chatsReceived: chats.length,
        contactsSample: newContacts.slice(0, 5).map(c => ({ name: c.name, phone: c.phone })),
      },
    }).catch(() => {});

    return jsonWithCors({
      tenantId: effectiveTenantId,
      success: true,
      message: `Sincronização concluída: ${importedContactsCount} contatos e ${importedMessagesCount} mensagens ingeridas com sucesso!`,
      contactsCount: importedContactsCount,
      messagesCount: importedMessagesCount,
      resultContacts: newContacts,
      resultConversations: newConversations,
      resultMessages: newMessages,
    });
  } catch (error: any) {
    console.error('Erro na sincronização da extensão:', error);
    return jsonWithCors({
      success: false,
      error: error.message || 'Falha ao processar histórico da extensão',
    }, { status: 500 });
  }
}
