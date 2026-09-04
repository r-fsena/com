import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverCRMStore } from '@/lib/server-crm-store';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';
import { isWhatsAppChannelOrGroup, arePhonesEquivalent, canonicalPhoneKey } from '@/lib/whatsapp-filter';
import { recordExtensionLog } from '@/lib/cloudwatch-logger';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';

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
      const rawDigits = chat.phone.replace(/\D/g, '');
      if (!rawDigits || rawDigits.length < 8) continue;
      if (isWhatsAppChannelOrGroup({ phone: rawDigits, name: chat.name })) continue;

      let cleanPhone = rawDigits;
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }

      const defaultContactId = `contact-zapi-${cleanPhone}`;
      const defaultConversationId = `conv-zapi-${cleanPhone}`;

      // Localiza se já existe contato ou conversa prévia com esse número (com ou sem 9º dígito), LID ou nome no CRM
      const currentState = serverCRMStore.getState();
      const existingContact = currentState.contacts.find(c => {
        const matchPhone = arePhonesEquivalent(c.phone, rawDigits) || 
                           arePhonesEquivalent(c.phone, cleanPhone) ||
                           arePhonesEquivalent(c.phone, chat.phone);
        const matchLid = (chat.lid && c.lid && (c.lid === chat.lid || c.lid.includes(chat.lid))) ||
                         (c.lid && rawDigits && c.lid.includes(rawDigits));
        const matchName = chat.name && c.name && 
                          !chat.name.startsWith('+') && 
                          !c.name.startsWith('+') && 
                          c.name.toLowerCase().trim() === chat.name.toLowerCase().trim();
        return matchPhone || matchLid || matchName;
      });

      const existingConv = currentState.conversations.find(cv => {
        const convDigits = cv.id.replace(/\D/g, '') || cv.contactId.replace(/\D/g, '');
        const matchConvPhone = arePhonesEquivalent(convDigits, rawDigits) || 
                               arePhonesEquivalent(convDigits, cleanPhone) ||
                               arePhonesEquivalent(convDigits, chat.phone);
        return cv.id === defaultConversationId || 
               matchConvPhone || 
               (existingContact && (cv.contactId === existingContact.id || cv.id.includes(existingContact.id)));
      });

      const contactId = existingContact ? existingContact.id : defaultContactId;
      if (existingContact?.phone && existingContact.phone.replace(/\D/g, '').length <= 13) {
        cleanPhone = existingContact.phone.replace(/\D/g, '');
      }
      const conversationId = existingConv 
        ? existingConv.id 
        : (existingContact ? (existingContact.phone ? `conv-zapi-${existingContact.phone.replace(/\D/g, '')}` : `conv-${existingContact.id}`) : defaultConversationId);

      const contactName = chat.name && !chat.name.startsWith('+') && !chat.name.startsWith('WhatsApp')
        ? chat.name.trim()
        : (existingContact?.name || `WhatsApp ${cleanPhone.slice(-4)}`);

      // 1. Processa mensagens do chat
      let lastMsgText = chat.lastMessagePreview || '';
      let lastMsgTime = nowIso;
      if (chat.lastMessageAt) {
        const ms = parseWhatsAppTimestamp(chat.lastMessageAt);
        if (ms > 0) lastMsgTime = new Date(ms).toISOString();
      }

      if (Array.isArray(chat.messages) && chat.messages.length > 0) {
        chat.messages.forEach((m, idx) => {
          const mContent = (m.content || '').trim();
          if (!mContent && !m.mediaUrl) return;

          let mTimestamp = nowIso;
          if (m.timestamp) {
            const ms = parseWhatsAppTimestamp(m.timestamp);
            if (ms > 0) mTimestamp = new Date(ms).toISOString();
          }

          const mId = m.id || `ext-msg-${cleanPhone}-${idx}-${Date.now()}`;
          const isFromMe = Boolean(m.fromMe);

          newMessages.push({
            id: mId,
            tenantId,
            conversationId,
            senderType: isFromMe ? 'USER' : 'CONTACT',
            senderUserId: isFromMe ? brokerUserId : undefined,
            senderName: isFromMe ? (brokerName || 'Corretor') : contactName,
            messageType: (m.messageType || 'TEXT') as MessageType,
            content: mContent || (m.messageType === 'AUDIO' ? '🎵 Mensagem de Voz' : m.messageType === 'IMAGE' ? '📷 Foto' : 'Mensagem'),
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
          lastMsgText = mContent || lastMsgText;
          lastMsgTime = mTimestamp;
        });
      }

      // Se nenhuma mensagem foi incluída no array, cria mensagem de interação
      if (newMessages.filter(m => m.conversationId === conversationId).length === 0) {
        newMessages.push({
          id: `ext-msg-initial-${cleanPhone}-${Date.now()}`,
          tenantId,
          conversationId,
          senderType: 'CONTACT',
          senderName: contactName,
          messageType: 'TEXT',
          content: lastMsgText || `Conversa ativa no WhatsApp com ${contactName}`,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: lastMsgTime,
        });
      }

      // 2. Contato: Garante separação estrita entre telefone e LID
      const isCleanPhoneLid = cleanPhone.length > 13 || (cleanPhone.length >= 14 && cleanPhone.startsWith('1'));
      const resolvedPhone = existingContact?.phone && !existingContact.phone.includes('@lid') && existingContact.phone.replace(/\D/g, '').length <= 13
        ? existingContact.phone
        : (isCleanPhoneLid ? (existingContact?.phone || `+${cleanPhone}`) : `+${cleanPhone}`);
      
      const resolvedLid = chat.lid || existingContact?.lid || (isCleanPhoneLid ? `${cleanPhone}@lid` : undefined);

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
        lastClientInteractionAt: lastMsgTime,
        createdAt: lastMsgTime,
        updatedAt: nowIso,
      });
      importedContactsCount++;

      // 3. Conversa
      newConversations.push({
        id: conversationId,
        tenantId,
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        contactId,
        assignedUserId: brokerUserId || undefined,
        status: 'PENDING_TEAM',
        unreadCount: 0,
        lastMessagePreview: lastMsgText || 'Conversa sincronizada via Extensão Chrome',
        lastMessageAt: lastMsgTime,
        slaBreached: false,
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
