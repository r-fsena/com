import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverCRMStore } from '@/lib/server-crm-store';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';
import { isWhatsAppChannelOrGroup } from '@/lib/whatsapp-filter';

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

      const contactId = `contact-zapi-${cleanPhone}`;
      const conversationId = `conv-zapi-${cleanPhone}`;
      const contactName = chat.name && !chat.name.startsWith('+') && !chat.name.startsWith('WhatsApp')
        ? chat.name.trim()
        : `WhatsApp ${cleanPhone.slice(-4)}`;

      // 1. Processa mensagens do chat
      let lastMsgText = chat.lastMessagePreview || '';
      let lastMsgTime = chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : nowIso;

      if (Array.isArray(chat.messages) && chat.messages.length > 0) {
        chat.messages.forEach((m, idx) => {
          const mContent = (m.content || '').trim();
          if (!mContent && !m.mediaUrl) return;

          let mTimestamp = nowIso;
          if (m.timestamp) {
            const timeNum = Number(m.timestamp);
            if (!isNaN(timeNum) && timeNum > 1000000000) {
              mTimestamp = new Date(timeNum > 1000000000000 ? timeNum : timeNum * 1000).toISOString();
            } else {
              try {
                mTimestamp = new Date(m.timestamp).toISOString();
              } catch {}
            }
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

      // 2. Contato
      newContacts.push({
        id: contactId,
        tenantId,
        name: contactName,
        phone: `+${cleanPhone}`,
        lid: chat.lid,
        avatarUrl: chat.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=059669&color=fff`,
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
