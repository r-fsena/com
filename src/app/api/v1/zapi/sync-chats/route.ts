import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
  const securityToken = searchParams.get('clientToken') || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  const tenantId = searchParams.get('tenantId') || process.env.NEXT_PUBLIC_TENANT_ID || 'tenant-vanguard-01';

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    // 1. Busca lista de chats e agenda de contatos em paralelo
    const [chatsRes, contactsRes] = await Promise.allSettled([
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats?page=1&pageSize=35`, { headers }),
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/contacts?page=1&pageSize=150`, { headers }),
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
            const resolvedName = cnt.name || cnt.vname || cnt.short;
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

    // 2. Filtra conversas válidas (ignora grupos ou phone 0)
    const validChats = zapiChats.filter((c: any) => c.phone && c.phone !== '0' && !c.isGroup);

    // 3. Busca foto de perfil do WhatsApp para cada chat em paralelo com timeout
    const picturesMap = new Map<string, string>();
    await Promise.allSettled(
      validChats.slice(0, 20).map(async (c: any) => {
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
      
      // Resolução de nome: chat name -> agenda de contatos -> formatação de telefone
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
        source: 'WHATSAPP' as const,
        temperature: 'WARM' as const,
        aiPriorityScore: 80,
        tags: ['WhatsApp Z-API', 'Sincronizado'],
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

      return {
        id: `conv-zapi-${cleanPhone}`,
        tenantId,
        instanceId,
        contactId: `contact-zapi-${cleanPhone}`,
        status: unread > 0 ? ('PENDING_TEAM' as const) : ('OPEN' as const),
        unreadCount: unread,
        lastMessagePreview: 'Conversa ativa no WhatsApp',
        lastMessageAt: lastMsgDate,
        slaBreached: false,
      };
    });

    // 5. Mensagens iniciais + mensagens do buffer do webhook
    const initialMessages = validChats.map((c: any) => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const lastMsgDate = c.lastMessageTime 
        ? new Date(Number(c.lastMessageTime)).toISOString() 
        : new Date().toISOString();

      return {
        id: `msg-sync-${cleanPhone}`,
        tenantId,
        conversationId: `conv-zapi-${cleanPhone}`,
        senderType: 'CONTACT' as const,
        senderName: contactsNameMap.get(cleanPhone) || c.name || 'Cliente',
        messageType: 'TEXT' as const,
        content: 'Olá! Conversa sincronizada do WhatsApp.',
        isInternalNote: false,
        timestamp: lastMsgDate,
        status: 'READ' as const,
      };
    });

    // Inclui mensagens capturadas pelo webhook em tempo real
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
          fileName: m.mediaType === 'audio' ? 'Áudio' : m.mediaType === 'image' ? 'Imagem' : 'Documento',
          fileSize: 1024,
          mimeType: 'application/octet-stream',
        }] : undefined,
        content: m.content,
        status: 'DELIVERED' as const,
        isInternalNote: false,
        timestamp: m.timestamp,
      };
    });

    const allMessages = [...initialMessages, ...liveWebhookMessages];

    return NextResponse.json({
      success: true,
      count: validChats.length,
      contacts,
      conversations,
      messages: allMessages,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao sincronizar conversas com a Z-API',
    }, { status: 500 });
  }
}
