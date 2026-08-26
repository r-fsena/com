import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';

export const dynamic = 'force-dynamic';

async function handleSyncChats(req: NextRequest) {
  let instanceId = process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
  let instanceToken = process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
  let securityToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  let tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'tenant-amabile-barbarotti';
  let assignedUserId: string | undefined;
  let fetchHistoryMessages = true;
  let historyDays = 15; // Padrão inicial de 15 dias

  // Extração via GET query params ou POST JSON body
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body.instanceId) instanceId = body.instanceId;
      if (body.token) instanceToken = body.token;
      if (body.clientToken) securityToken = body.clientToken;
      if (body.tenantId) tenantId = body.tenantId;
      if (body.assignedUserId) assignedUserId = body.assignedUserId;
      if (typeof body.fetchHistoryMessages === 'boolean') fetchHistoryMessages = body.fetchHistoryMessages;
      if (body.historyDays !== undefined) historyDays = Number(body.historyDays);
    } catch {}
  } else {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('instanceId')) instanceId = searchParams.get('instanceId')!;
    if (searchParams.get('token')) instanceToken = searchParams.get('token')!;
    if (searchParams.get('clientToken')) securityToken = searchParams.get('clientToken')!;
    if (searchParams.get('tenantId')) tenantId = searchParams.get('tenantId')!;
    if (searchParams.get('assignedUserId')) assignedUserId = searchParams.get('assignedUserId')!;
    if (searchParams.get('historyDays')) historyDays = Number(searchParams.get('historyDays'));
  }

  const cutoffMs = historyDays > 0 ? Date.now() - (historyDays * 24 * 60 * 60 * 1000) : 0;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    // 1. Busca lista de chats e agenda de contatos em paralelo
    const [chatsRes, contactsRes] = await Promise.allSettled([
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats?page=1&pageSize=40`, { headers }),
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/contacts?page=1&pageSize=200`, { headers }),
    ]);

    let zapiChats: any[] = [];
    if (chatsRes.status === 'fulfilled' && chatsRes.value.ok) {
      zapiChats = await chatsRes.value.json();
    }

    const contactsNameMap = new Map<string, string>();
    if (contactsRes.status === 'fulfilled' && contactsRes.value.ok) {
      try {
        const zapiContacts = await contactsRes.value.json();
        if (Array.isArray(zapiContacts)) {
          zapiContacts.forEach((cnt: any) => {
            const raw = (cnt.phone || '').replace(/\D/g, '');
            const resolvedName = cnt.name || cnt.vname || cnt.short || cnt.notify;
            if (raw && resolvedName) {
              contactsNameMap.set(raw, resolvedName);
            }
          });
        }
      } catch {}
    }

    if (!Array.isArray(zapiChats)) {
      return NextResponse.json({
        success: true,
        contacts: [],
        conversations: [],
        messages: [],
      });
    }

    // 2. Filtra conversas válidas (ignora grupos) e ordena pela mais recente
    const validChats = zapiChats
      .filter((c: any) => c.phone && c.phone !== '0' && !c.isGroup)
      .sort((a: any, b: any) => {
        const timeA = Number(a.lastMessageTime || 0);
        const timeB = Number(b.lastMessageTime || 0);
        return timeB - timeA;
      });

    // 3. Busca foto de perfil do WhatsApp para os chats em paralelo
    const picturesMap = new Map<string, string>();
    await Promise.allSettled(
      validChats.slice(0, 30).map(async (c: any) => {
        try {
          const picRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/profile-picture?phone=${c.phone}`, {
            headers,
          });
          if (picRes.ok) {
            const picData = await picRes.json();
            if (picData && picData.link) {
              picturesMap.set(c.phone, picData.link);
            }
          }
        } catch {}
      })
    );

    // 4. Constrói contatos e conversas
    const contacts = validChats.map((c: any) => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const formattedPhone = c.phone.startsWith('+') ? c.phone : `+${c.phone}`;
      
      // Resolução de nome: chat name -> agenda de contatos do corretor -> formatação de telefone
      const resolvedName = c.name 
        || contactsNameMap.get(cleanPhone) 
        || (cleanPhone.length >= 10 ? `WhatsApp (${cleanPhone.slice(-4)})` : `Cliente ${cleanPhone}`);

      const avatar = picturesMap.get(c.phone) 
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=059669&color=fff`;

      const lastInteraction = c.lastMessageTime 
        ? new Date(Number(c.lastMessageTime)).toISOString() 
        : new Date().toISOString();

      return {
        id: `contact-zapi-${cleanPhone}`,
        tenantId,
        name: resolvedName,
        phone: formattedPhone,
        avatarUrl: avatar,
        assignedUserId: assignedUserId || undefined,
        source: 'WHATSAPP' as const,
        temperature: 'WARM' as const,
        aiPriorityScore: 82,
        tags: ['WhatsApp Sync', 'Lead WhatsApp'],
        targetRegions: ['Região Metropolitana'],
        notesCount: 0,
        consentGiven: true,
        consentDate: new Date().toISOString(),
        hasOptedOut: false,
        lastClientInteractionAt: lastInteraction,
        lastTeamInteractionAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const conversations = validChats.map((c: any) => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const unread = Number(c.unread || c.messagesUnread || 0);
      const lastMsgDate = c.lastMessageTime 
        ? new Date(Number(c.lastMessageTime)).toISOString() 
        : new Date().toISOString();

      const lastMessageText = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.message || c.message || 'Conversa ativa no WhatsApp');

      return {
        id: `conv-zapi-${cleanPhone}`,
        tenantId,
        instanceId,
        contactId: `contact-zapi-${cleanPhone}`,
        assignedUserId: assignedUserId || undefined,
        status: unread > 0 ? ('PENDING_TEAM' as const) : ('OPEN' as const),
        unreadCount: unread,
        lastMessagePreview: lastMessageText,
        lastMessageAt: lastMsgDate,
        slaBreached: false,
      };
    });

    // 5. Histórico recente das mensagens (para os 10 chats mais ativos)
    const historyMessages: any[] = [];
    if (fetchHistoryMessages) {
      const topChats = validChats.slice(0, 10);
      await Promise.allSettled(
        topChats.map(async (c: any) => {
          try {
            const clean = (c.phone || '').replace(/\D/g, '');
            const msgRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chat-messages/${clean}?page=1&pageSize=10`, {
              headers,
            });
            if (msgRes.ok) {
              const msgsData = await msgRes.json();
              if (Array.isArray(msgsData)) {
                msgsData.forEach((m: any, idx: number) => {
                  if (m && (m.text || m.body || m.caption || m.message || m.audio || m.image || m.document)) {
                    const isFromMe = Boolean(m.fromMe);
                    const text = m.text?.message || m.body || m.caption || m.message || (m.image ? '📷 [Foto]' : m.audio ? '🎙️ [Áudio]' : m.document ? '📄 [Documento]' : '');
                    const timestamp = m.momment ? new Date(Number(m.momment)).toISOString() : (m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString());
                    
                    // Filtra por data de corte selecionada (ex: últimos 15 dias)
                    if (cutoffMs > 0 && new Date(timestamp).getTime() < cutoffMs) {
                      return;
                    }

                    const mId = m.id || m.zaapId || m.messageId || `hist-${clean}-${idx}-${Date.now()}`;
                    const mediaUrl = m.image?.imageUrl || m.audio?.audioUrl || m.document?.documentUrl;

                    historyMessages.push({
                      id: mId,
                      tenantId,
                      conversationId: `conv-zapi-${clean}`,
                      senderType: isFromMe ? 'USER' : 'CONTACT',
                      senderName: isFromMe ? 'Corretor' : (contactsNameMap.get(clean) || c.name || 'Cliente'),
                      messageType: m.audio ? 'AUDIO' : m.image ? 'IMAGE' : m.document ? 'DOCUMENT' : 'TEXT',
                      attachments: mediaUrl ? [{
                        id: `att-${mId}`,
                        url: mediaUrl,
                        fileName: m.document?.fileName || (m.image ? 'Foto.jpg' : 'Audio.ogg'),
                        fileSize: 1024,
                        mimeType: m.image ? 'image/jpeg' : m.audio ? 'audio/ogg' : 'application/pdf',
                      }] : undefined,
                      content: text,
                      status: 'DELIVERED',
                      isInternalNote: false,
                      timestamp,
                    });
                  }
                });
              }
            }
          } catch {}
        })
      );
    }

    // 6. Combina mensagens capturadas em tempo real pelo webhook
    const liveWebhookMessages = webhookStore.getAllMessages().map(m => {
      const rawPhone = m.phone.replace(/\D/g, '');
      return {
        id: m.id,
        tenantId: m.tenantId || tenantId,
        conversationId: `conv-zapi-${rawPhone}`,
        senderType: m.fromMe ? ('USER' as const) : ('CONTACT' as const),
        senderName: m.fromMe ? 'Corretor' : m.senderName,
        messageType: (m.mediaType === 'audio' ? 'AUDIO' : m.mediaType === 'image' ? 'IMAGE' : m.mediaType === 'document' ? 'DOCUMENT' : 'TEXT') as any,
        attachments: m.mediaUrl ? [{
          id: `att-${m.id}`,
          url: m.mediaUrl,
          fileName: m.fileName || (m.mediaType === 'audio' ? 'Áudio' : m.mediaType === 'image' ? 'Imagem' : 'Documento'),
          fileSize: m.fileSize || 1024,
          mimeType: m.mimeType || (m.mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        }] : undefined,
        content: m.content,
        status: 'DELIVERED' as const,
        isInternalNote: false,
        timestamp: m.timestamp,
      };
    });

    const allMessagesMap = new Map<string, any>();
    [...historyMessages, ...liveWebhookMessages].forEach(m => {
      allMessagesMap.set(m.id, m);
    });

    return NextResponse.json({
      success: true,
      count: validChats.length,
      contacts,
      conversations,
      messages: Array.from(allMessagesMap.values()),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao sincronizar conversas com a Z-API',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleSyncChats(req);
}

export async function POST(req: NextRequest) {
  return handleSyncChats(req);
}

