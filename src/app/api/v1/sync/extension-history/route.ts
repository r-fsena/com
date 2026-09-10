import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverCRMStore } from '@/lib/server-crm-store';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';
import { isWhatsAppChannelOrGroup, arePhonesEquivalent, canonicalPhoneKey, isWhatsAppSystemMessage, isLidIdentifier, cleanLid, formatCanonicalPhone } from '@/lib/whatsapp-filter';
import { recordExtensionLog } from '@/lib/cloudwatch-logger';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const IngestMessageSchema = z.object({
  id: z.string().optional(),
  content: z.string().default(''),
  fromMe: z.boolean().default(false),
  timestamp: z.string().or(z.number()).optional(),
  senderName: z.string().optional(),
  messageType: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE']).default('TEXT'),
  mediaUrl: z.string().optional(),
  fileName: z.string().optional(),
});

const IngestChatSchema = z.object({
  phone: z.string(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  lid: z.string().optional(),
  messages: z.array(IngestMessageSchema).default([]),
  lastMessagePreview: z.string().optional(),
  lastMessageAt: z.string().or(z.number()).optional(),
});

const BatchSyncSchema = z.object({
  tenantId: z.string().default('tenant-amabile-barbarotti'),
  brokerUserId: z.string().optional(),
  brokerName: z.string().optional(),
  chats: z.array(IngestChatSchema),
});

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (Máx 60 lotes por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`ext-sync:${clientIp}`, 60, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de requisições excedido. Aguarde ${rateCheck.resetInSeconds}s.`,
    }, { status: 429 });
  }

  // 2. Validação de Sessão ou Token da Extensão
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BatchSyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Estrutura de dados inválida',
        details: parsed.error.format(),
      }, { status: 400 });
    }

    const { tenantId, brokerUserId, brokerName, chats } = parsed.data;

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
        const resolvedFromStore = serverCRMStore.resolvePhoneFromLid(incomingLid || rawDigits);
        if (resolvedFromStore) {
          cleanPhone = resolvedFromStore;
        }
      }

      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }

      // Localiza se já existe contato ou conversa prévia com esse número ou LID
      const currentState = serverCRMStore.getState();
      const existingContact = currentState.contacts.find(c => {
        const matchPhone = arePhonesEquivalent(c.phone, rawDigits) || 
                           arePhonesEquivalent(c.phone, cleanPhone) ||
                           arePhonesEquivalent(c.phone, chat.phone);
        const matchLid = (incomingLid && c.lid && cleanLid(c.lid) === incomingLid) ||
                         (c.lid && rawDigits && cleanLid(c.lid) === cleanLid(rawDigits));
        return matchPhone || matchLid;
      });

      // Se o contato existente possuir telefone real válido, adota-o como canônico
      if (existingContact?.phone && !isLidIdentifier(existingContact.phone)) {
        cleanPhone = existingContact.phone.replace(/\D/g, '');
      }

      // Registra a correlação LID <-> Telefone se ambos estiverem presentes
      if (incomingLid && cleanPhone && !isLidIdentifier(cleanPhone)) {
        serverCRMStore.registerLidPhone(incomingLid, cleanPhone);
      }

      const defaultContactId = `contact-zapi-${cleanPhone}`;
      const defaultConversationId = `conv-zapi-${cleanPhone}`;

      const existingConv = currentState.conversations.find(cv => {
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
      if (!contactName || contactName === 'Contato WhatsApp' || contactName.toLowerCase() === 'whatsapp') {
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

          const mId = m.id || `ext-msg-${cleanPhone}-${idx}-${mTimestamp}`;
          const isFromMe = Boolean(m.fromMe);
          const batchDedupeKey = m.id || `${conversationId}-${cleanContent}-${mTimestamp.slice(0, 19)}-${isFromMe}`;
          if (seenInBatch.has(batchDedupeKey)) return;
          seenInBatch.add(batchDedupeKey);

          newMessages.push({
            id: mId,
            tenantId,
            conversationId,
            senderType: isFromMe ? 'USER' : 'CONTACT',
            senderUserId: isFromMe ? brokerUserId : undefined,
            senderName: isFromMe ? (brokerName || 'Corretor') : contactName,
            messageType: (m.messageType || 'TEXT') as MessageType,
            content: cleanContent || (m.messageType === 'AUDIO' ? '🎵 Mensagem de Voz' : m.messageType === 'IMAGE' ? '📷 Foto' : 'Mensagem'),
            attachments: m.mediaUrl ? [{
              id: `att-${mId}`,
              url: m.mediaUrl,
              fileName: m.fileName || (m.messageType === 'AUDIO' ? 'Audio.ogg' : m.messageType === 'IMAGE' ? 'Foto.jpg' : 'Documento.pdf'),
              fileSize: 1024,
              mimeType: m.messageType === 'AUDIO' ? 'audio/ogg' : m.messageType === 'IMAGE' ? 'image/jpeg' : 'application/pdf',
            }] : undefined,
            status: 'DELIVERED',
            isInternalNote: false,
            timestamp: mTimestamp,
          });

          importedMessagesCount++;
          lastMsgText = cleanContent;
          lastMsgTime = mTimestamp;
        });
      }

      // Se nenhuma mensagem foi incluída no array, cria mensagem de interação
      if (newMessages.filter(m => m.conversationId === conversationId).length === 0) {
        const initialText = (lastMsgText && !isWhatsAppSystemMessage(lastMsgText))
          ? lastMsgText
          : `Conversa ativa no WhatsApp com ${contactName}`;

        newMessages.push({
          id: `ext-msg-initial-${cleanPhone}-${Date.now()}`,
          tenantId,
          conversationId,
          senderType: 'CONTACT',
          senderName: contactName,
          messageType: 'TEXT',
          content: initialText,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: lastMsgTime,
        });
      }

      // 2. Contato: Garante separação estrita entre telefone e LID
      const isCleanPhoneLid = isLidIdentifier(cleanPhone);
      const resolvedPhoneFromStore = isCleanPhoneLid ? serverCRMStore.resolvePhoneFromLid(cleanPhone) : null;
      const resolvedPhone = existingContact?.phone && !isLidIdentifier(existingContact.phone)
        ? existingContact.phone
        : (resolvedPhoneFromStore ? `+${resolvedPhoneFromStore}` : `+${cleanPhone}`);
      
      const resolvedLid = cleanLid(chat.lid || existingContact?.lid || (isCleanPhoneLid ? cleanPhone : '')) || undefined;
      if (resolvedLid && resolvedPhone && !isLidIdentifier(resolvedPhone)) {
        serverCRMStore.registerLidPhone(resolvedLid, resolvedPhone);
      }

      newContacts.push({
        id: contactId,
        tenantId,
        name: contactName,
        phone: resolvedPhone,
        lid: resolvedLid,
        avatarUrl: chat.avatarUrl || existingContact?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=059669&color=fff`,
        assignedUserId: brokerUserId || undefined,
        source: 'WHATSAPP',
        temperature: 'WARM',
        aiPriorityScore: 85,
        tags: ['Extensão Chrome', 'WhatsApp Web Sincronizado'],
        targetRegions: [],
        notesCount: 0,
        consentGiven: true,
        consentDate: lastMsgTime,
        hasOptedOut: false,
        isPersonal: false,
        lastClientInteractionAt: lastMsgTime,
        createdAt: lastMsgTime,
        updatedAt: nowIso,
      });
      importedContactsCount++;

      // 3. Conversa
      const cleanPreview = (lastMsgText && !isWhatsAppSystemMessage(lastMsgText)) 
        ? lastMsgText 
        : 'Conversa sincronizada via Extensão Chrome';

      newConversations.push({
        id: conversationId,
        tenantId,
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        contactId,
        assignedUserId: brokerUserId || undefined,
        status: 'PENDING_TEAM',
        unreadCount: 0,
        lastMessagePreview: cleanPreview,
        lastMessageAt: lastMsgTime,
        slaBreached: false,
        isPersonal: false,
      });
    }


    // Atualiza estado do servidor centralizado
    serverCRMStore.updateState({
      contacts: newContacts,
      conversations: newConversations,
      messages: newMessages,
    });

    // Registra log estruturado no CloudWatch
    await recordExtensionLog({
      timestamp: Date.now(),
      level: 'INFO',
      event: 'BATCH_SYNC_INGESTED',
      tenantId,
      brokerName,
      messagesCount: importedMessagesCount,
      details: {
        contactsCount: importedContactsCount,
        chatsReceived: chats.length,
        contactsSample: newContacts.slice(0, 5).map(c => ({ name: c.name, phone: c.phone })),
      },
    });

    return NextResponse.json({
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
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao processar histórico da extensão',
    }, { status: 500 });
  }
}
