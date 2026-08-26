import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';
import { serverCRMStore } from '@/lib/server-crm-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

async function handleSyncChats(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  let instanceId = process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
  let instanceToken = process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
  let securityToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  let tenantId = session?.tenantId || process.env.NEXT_PUBLIC_TENANT_ID || 'tenant-amabile-barbarotti';
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
      if (body.tenantId && session?.isSuperAdmin) tenantId = body.tenantId;
      if (body.assignedUserId) assignedUserId = body.assignedUserId;
      if (typeof body.fetchHistoryMessages === 'boolean') fetchHistoryMessages = body.fetchHistoryMessages;
      if (body.historyDays !== undefined) historyDays = Number(body.historyDays);
    } catch {}
  } else {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('instanceId')) instanceId = searchParams.get('instanceId')!;
    if (searchParams.get('token')) instanceToken = searchParams.get('token')!;
    if (searchParams.get('clientToken')) securityToken = searchParams.get('clientToken')!;
    if (searchParams.get('tenantId') && session?.isSuperAdmin) tenantId = searchParams.get('tenantId')!;
    if (searchParams.get('assignedUserId')) assignedUserId = searchParams.get('assignedUserId')!;
    if (searchParams.get('historyDays')) historyDays = Number(searchParams.get('historyDays'));
  }

  if (!instanceId || !instanceToken) {
    return NextResponse.json({
      success: false,
      error: 'Instância Z-API não informada ou não configurada no servidor',
    }, { status: 400 });
  }

  const cutoffMs = historyDays > 0 ? Date.now() - (historyDays * 24 * 60 * 60 * 1000) : 0;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    // 1. Busca lista de chats (Páginas 1 a 5, até 500 chats), agenda de contatos (Páginas 1 a 5, até 1000 contatos) e etiquetas em paralelo
    const chatPages = [1, 2, 3, 4, 5];
    const contactPages = [1, 2, 3, 4, 5];

    const [chatResults, contactResults, labelsRes] = await Promise.all([
      Promise.allSettled(
        chatPages.map(page =>
          fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats?page=${page}&pageSize=100`, { headers })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      ),
      Promise.allSettled(
        contactPages.map(page =>
          fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/contacts?page=${page}&pageSize=200`, { headers })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      ),
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/labels`, { headers })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]);

    // Combina e consolida todos os chats de todas as páginas
    let rawChats: any[] = [];
    chatResults.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        rawChats.push(...res.value);
      }
    });

    // Mapeamento de contatos da agenda do corretor
    const contactsNameMap = new Map<string, string>();
    contactResults.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        res.value.forEach((cnt: any) => {
          if (!cnt) return;
          const raw = (cnt.phone || '').replace(/\D/g, '');
          const resolvedName = cnt.name || cnt.vname || cnt.short || cnt.notify;
          if (raw && resolvedName) {
            contactsNameMap.set(raw, resolvedName);
          }
        });
      }
    });

    // Mapeamento de Etiquetas do WhatsApp Business
    const labelsMap = new Map<string, string>();
    if (Array.isArray(labelsRes)) {
      labelsRes.forEach((lbl: any) => {
        if (lbl && lbl.name) {
          labelsMap.set(String(lbl.id || lbl.labelId || lbl.name), lbl.name);
        }
      });
    }

    if (rawChats.length === 0) {
      return NextResponse.json({
        success: true,
        contacts: [],
        conversations: [],
        messages: [],
      });
    }

    // Deduplica chats por telefone (mantendo a ocorrência com lastMessageTime mais recente)
    const chatsByPhone = new Map<string, any>();
    rawChats.forEach((c: any) => {
      if (!c || !c.phone || c.phone === '0' || c.isGroup) return;
      const clean = (c.phone || '').replace(/\D/g, '');
      if (!clean) return;

      const existing = chatsByPhone.get(clean);
      const currentTime = Number(c.lastMessageTime || 0);
      const existingTime = existing ? Number(existing.lastMessageTime || 0) : 0;

      if (!existing || currentTime > existingTime) {
        chatsByPhone.set(clean, c);
      }
    });

    // 2. Ordena conversas válidas estritamente pela data da mensagem mais recente (Top 1 = agora/hoje)
    let validChats = Array.from(chatsByPhone.values())
      .sort((a: any, b: any) => {
        const timeA = Number(a.lastMessageTime || 0);
        const timeB = Number(b.lastMessageTime || 0);
        return timeB - timeA;
      });

    // Aplica filtro por data de corte se selecionado
    if (cutoffMs > 0) {
      validChats = validChats.filter((c: any) => {
        const msgTime = Number(c.lastMessageTime || 0);
        return msgTime === 0 || msgTime >= cutoffMs;
      });
    }

    // 3. Busca foto de perfil do WhatsApp para os 50 chats mais recentes em paralelo
    const picturesMap = new Map<string, string>();
    await Promise.allSettled(
      validChats.slice(0, 50).map(async (c: any) => {
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

    // 4. Constrói contatos e conversas com etiquetas do WhatsApp Business mapeadas
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

      // Extração de Etiquetas do WhatsApp Business
      const rawLabels = Array.isArray(c.labels) 
        ? c.labels 
        : (Array.isArray(c.labelIds) ? c.labelIds : (c.label ? [c.label] : []));
      
      const resolvedLabels = rawLabels.map((lbl: any) => {
        const lblStr = String(lbl);
        return labelsMap.get(lblStr) || lblStr;
      }).filter(Boolean);

      const generatedTags = Array.from(new Set([
        'WhatsApp Sync', 
        'Lead WhatsApp',
        ...resolvedLabels.map((l: string) => `[Etiqueta] ${l}`)
      ]));

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
        tags: generatedTags,
        whatsappLabels: resolvedLabels,
        firstSyncedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
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

      const lastMessageText = typeof c.lastMessage === 'string' && c.lastMessage.trim()
        ? c.lastMessage
        : (c.lastMessage?.message || c.message || (unread > 0 ? `💬 ${unread} nova(s) mensagem(ns)` : '📱 Conversa sincronizada via WhatsApp'));

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

    // 5. Histórico recente das mensagens e extração das últimas mensagens ativas de cada conversa
    const chatLastMessages: any[] = [];
    validChats.forEach((c: any) => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const lastMsgDate = c.lastMessageTime 
        ? new Date(Number(c.lastMessageTime)).toISOString() 
        : new Date().toISOString();

      let msgText = '';
      let isFromMe = false;

      if (typeof c.lastMessage === 'string' && c.lastMessage.trim()) {
        msgText = c.lastMessage.trim();
      } else if (c.lastMessage && typeof c.lastMessage === 'object') {
        msgText = c.lastMessage.message || c.lastMessage.text || '';
        isFromMe = Boolean(c.lastMessage.fromMe);
      }

      if (msgText && msgText !== '📱 Conversa sincronizada via WhatsApp') {
        chatLastMessages.push({
          id: `sync-last-${cleanPhone}-${c.lastMessageTime || Date.now()}`,
          tenantId,
          conversationId: `conv-zapi-${cleanPhone}`,
          senderType: isFromMe ? 'USER' : 'CONTACT',
          senderName: isFromMe ? 'Corretor' : (c.name || `WhatsApp ${cleanPhone.slice(-4)}`),
          messageType: 'TEXT',
          content: msgText,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: lastMsgDate,
        });
      }
    });

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
    [...chatLastMessages, ...historyMessages, ...liveWebhookMessages].forEach(m => {
      allMessagesMap.set(m.id, m);
    });

    const finalMessages = Array.from(allMessagesMap.values());

    // Persiste imediatamente o snapshot dos contatos, conversas e mensagens no banco de dados do servidor
    serverCRMStore.updateState({
      contacts,
      conversations,
      messages: finalMessages,
    });

    return NextResponse.json({
      success: true,
      count: validChats.length,
      contacts,
      conversations,
      messages: finalMessages,
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

