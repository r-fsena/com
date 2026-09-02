import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';
import { normalizePhoneNumber } from '@/lib/vcf-parser';
import { isWhatsAppChannelOrGroup } from '@/lib/whatsapp-filter';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';
import { serverCRMStore } from '@/lib/server-crm-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  let instanceId = process.env.ZAPI_INSTANCE_ID || '3F8144490C66805B4E3FD64A35E2F2DC';
  let instanceToken = process.env.ZAPI_INSTANCE_TOKEN || '550DBC07B2F984AB74E4BCE5';
  let securityToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  let tenantId = session?.tenantId || process.env.NEXT_PUBLIC_TENANT_ID || 'tenant-amabile-barbarotti';

  try {
    const body = await req.json().catch(() => ({}));
    const items: Array<{
      phone: string;
      name?: string;
      lid?: string;
      avatarUrl?: string;
      whatsappLabels?: string[];
      tags?: string[];
    }> = Array.isArray(body.items) ? body.items : [];

    const historyLimit = Number(body.historyLimit || 15);
    const assignedUserId = body.assignedUserId || session?.userId;

    if (body.instanceId) instanceId = body.instanceId;
    if (body.token) instanceToken = body.token;
    if (body.clientToken) securityToken = body.clientToken;

    if (items.length === 0) {
      return NextResponse.json({ success: true, contacts: [], conversations: [], messages: [], count: 0 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    const contacts: Contact[] = [];
    const conversations: Conversation[] = [];
    const messages: Message[] = [];

    // Processa os itens do lote em paralelo
    const results = await Promise.allSettled(
      items.map(async (item) => {
        if (!item || isWhatsAppChannelOrGroup(item)) return null;
        const cleanPhone = (item.phone || '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 8) return null;

        const { display } = normalizePhoneNumber(cleanPhone);
        const contactId = `contact-zapi-${cleanPhone}`;
        const conversationId = `conv-zapi-${cleanPhone}`;
        const contactName = item.name && !item.name.startsWith('+') && !item.name.startsWith('WhatsApp') 
          ? item.name 
          : `WhatsApp ${cleanPhone.slice(-4)}`;

        // Busca mensagens históricas leves do contato (últimas 10-15 mensagens)
        let itemMessages: Message[] = [];
        let lastPreview = 'Conversa importada';
        let lastMsgAt = new Date().toISOString();

        try {
          const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats-messages?phone=${cleanPhone}`, { headers });
          if (res.ok) {
            const rawMsgs = await res.json();
            if (Array.isArray(rawMsgs) && rawMsgs.length > 0) {
              const recentSlice = rawMsgs.slice(-historyLimit);
              
              recentSlice.forEach((m: any) => {
                const isFromMe = Boolean(m.fromMe || m.sender === 'me');
                let mType: MessageType = 'TEXT';
                let contentText = m.text?.message || m.caption || m.body || m.message || '';

                if (m.type === 'audio' || m.audio) {
                  mType = 'AUDIO';
                  contentText = contentText || '🎵 Áudio';
                } else if (m.type === 'image' || m.image) {
                  mType = 'IMAGE';
                  contentText = contentText || '📷 Imagem';
                } else if (m.type === 'document' || m.document) {
                  mType = 'DOCUMENT';
                  contentText = contentText || '📄 Documento';
                }

                let msgTimestamp = new Date().toISOString();
                if (m.timestamp) {
                  const ms = typeof m.timestamp === 'number' ? (m.timestamp < 1e12 ? m.timestamp * 1000 : m.timestamp) : new Date(m.timestamp).getTime();
                  if (!isNaN(ms) && ms > 0) msgTimestamp = new Date(ms).toISOString();
                }

                const msgId = m.id || m.messageId || m.zaapId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

                itemMessages.push({
                  id: msgId,
                  tenantId,
                  conversationId,
                  senderType: isFromMe ? 'USER' : 'CONTACT',
                  senderUserId: isFromMe ? assignedUserId : undefined,
                  senderName: isFromMe ? 'Corretor' : contactName,
                  messageType: mType,
                  content: contentText || (mType === 'AUDIO' ? '🎵 Mensagem de Voz' : 'Mensagem'),
                  attachments: (m.audio?.audioUrl || m.image?.imageUrl || m.document?.documentUrl) ? [{
                    id: `att-${msgId}`,
                    url: m.audio?.audioUrl || m.image?.imageUrl || m.document?.documentUrl,
                    fileName: m.document?.fileName || (mType === 'AUDIO' ? 'Audio.ogg' : mType === 'IMAGE' ? 'Foto.jpg' : 'Documento.pdf'),
                    fileSize: 1024,
                    mimeType: mType === 'AUDIO' ? 'audio/ogg' : mType === 'IMAGE' ? 'image/jpeg' : 'application/pdf',
                  }] : undefined,
                  status: 'DELIVERED',
                  isInternalNote: false,
                  timestamp: msgTimestamp,
                });
              });

              if (itemMessages.length > 0) {
                const last = itemMessages[itemMessages.length - 1];
                lastPreview = last.content;
                lastMsgAt = last.timestamp;
              }
            }
          }
        } catch (err) {
          console.warn(`Aviso: falha ao buscar histórico de mensagens para ${cleanPhone}:`, err);
        }

        const combinedTags = Array.from(new Set([
          'Lead WhatsApp',
          'Importação em Lote',
          ...(item.whatsappLabels || []),
          ...(item.tags || []),
        ]));

        const newContact: Contact = {
          id: contactId,
          tenantId,
          name: contactName,
          phone: display,
          lid: item.lid,
          avatarUrl: item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=059669&color=fff`,
          assignedUserId: assignedUserId || undefined,
          source: 'WHATSAPP',
          temperature: 'WARM',
          aiPriorityScore: 80,
          tags: combinedTags,
          whatsappLabels: item.whatsappLabels || [],
          firstSyncedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          targetRegions: ['Região Metropolitana'],
          notesCount: 0,
          consentGiven: true,
          consentDate: new Date().toISOString(),
          hasOptedOut: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newConv: Conversation = {
          id: conversationId,
          tenantId,
          instanceId,
          contactId,
          assignedUserId: assignedUserId || undefined,
          status: 'PENDING_TEAM',
          unreadCount: 0,
          lastMessagePreview: lastPreview,
          lastMessageAt: lastMsgAt,
          slaBreached: false,
        };

        return {
          contact: newContact,
          conversation: newConv,
          messages: itemMessages,
        };
      })
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        contacts.push(res.value.contact);
        conversations.push(res.value.conversation);
        messages.push(...res.value.messages);
      }
    });

    // Atualiza o estado em memória do servidor
    serverCRMStore.updateState({
      contacts,
      conversations,
      messages,
    });

    return NextResponse.json({
      success: true,
      contacts,
      conversations,
      messages,
      count: contacts.length,
    });
  } catch (error: any) {
    console.error('Erro no processamento de lote da Z-API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao processar lote de importação',
    }, { status: 500 });
  }
}
