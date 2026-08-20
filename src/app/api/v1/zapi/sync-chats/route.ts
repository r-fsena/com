import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId') || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
  const instanceToken = searchParams.get('token') || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
  const securityToken = searchParams.get('clientToken') || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  const tenantId = searchParams.get('tenantId') || process.env.NEXT_PUBLIC_TENANT_ID || 'tenant-vanguard-01';

  try {
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats?page=1&pageSize=25`, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': securityToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `Z-API HTTP ${response.status}: ${errorText}`,
      }, { status: response.status });
    }

    const zapiChats = await response.json();

    if (!Array.isArray(zapiChats)) {
      return NextResponse.json({
        success: true,
        contacts: [],
        conversations: [],
      });
    }

    // Mapeia conversas da Z-API para contatos e conversas do CRM
    const validChats = zapiChats.filter((c: any) => c.phone && c.phone !== '0');

    const contacts = validChats.map((c: any) => {
      const formattedPhone = c.phone.startsWith('+') ? c.phone : `+${c.phone}`;
      const contactName = c.name || `WhatsApp ${c.phone.slice(-4)}`;
      
      return {
        id: `contact-zapi-${c.phone}`,
        tenantId,
        name: contactName,
        phone: formattedPhone,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=059669&color=fff`,
        source: 'WHATSAPP' as const,
        temperature: 'WARM' as const,
        aiPriorityScore: 75,
        tags: ['WhatsApp Z-API', 'Importado'],
        targetRegions: ['Geral'],
        notesCount: 0,
        consentGiven: true,
        consentDate: new Date().toISOString(),
        hasOptedOut: false,
        lastClientInteractionAt: c.lastMessageTime ? new Date(Number(c.lastMessageTime)).toISOString() : new Date().toISOString(),
        lastTeamInteractionAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const conversations = validChats.map((c: any) => {
      const unread = Number(c.unread || c.messagesUnread || 0);
      const lastMsgDate = c.lastMessageTime ? new Date(Number(c.lastMessageTime)).toISOString() : new Date().toISOString();

      return {
        id: `conv-zapi-${c.phone}`,
        tenantId,
        instanceId,
        contactId: `contact-zapi-${c.phone}`,
        status: unread > 0 ? ('PENDING_TEAM' as const) : ('OPEN' as const),
        unreadCount: unread,
        lastMessagePreview: 'Conversa sincronizada via WhatsApp Z-API',
        lastMessageAt: lastMsgDate,
        slaBreached: false,
      };
    });

    const messages = validChats.map((c: any) => ({
      id: `msg-init-${c.phone}`,
      tenantId,
      conversationId: `conv-zapi-${c.phone}`,
      senderType: 'CONTACT' as const,
      messageType: 'TEXT' as const,
      content: 'Olá! Conversa ativa no WhatsApp.',
      isInternalNote: false,
      timestamp: c.lastMessageTime ? new Date(Number(c.lastMessageTime)).toISOString() : new Date().toISOString(),
      status: 'READ' as const,
    }));

    return NextResponse.json({
      success: true,
      count: validChats.length,
      contacts,
      conversations,
      messages,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao sincronizar conversas com a Z-API',
    }, { status: 500 });
  }
}
