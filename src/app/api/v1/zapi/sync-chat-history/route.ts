import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, conversationId, tenantId = 'tenant-amabile-barbarotti' } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const instanceId = process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
    const instanceToken = process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
    const securityToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';

    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    // Consulta histórico de mensagens diretamente na Z-API
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chat-messages/${cleanPhone}?page=1&pageSize=50`, {
      headers,
    });

    let rawMessages: any[] = [];
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        rawMessages = data;
      }
    }

    // Formata mensagens da Z-API para o formato padrão do CRM
    const formattedMessages = rawMessages
      .filter((m: any) => m && (m.text || m.body || m.caption || m.message || (m.audio && m.audio.audioUrl) || (m.image && m.image.imageUrl)))
      .map((m: any, idx: number) => {
        const isFromMe = Boolean(m.fromMe);
        const textContent = m.text?.message || m.body || m.caption || m.message || (m.image ? '📷 [Foto]' : m.audio ? '🎙️ [Áudio]' : '');
        const timestamp = m.momment ? new Date(Number(m.momment)).toISOString() : (m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString());
        const msgId = m.id || m.zaapId || m.messageId || `hist-msg-${cleanPhone}-${idx}-${Date.now()}`;

        return {
          id: msgId,
          tenantId,
          conversationId: conversationId || `conv-zapi-${cleanPhone}`,
          senderType: isFromMe ? ('USER' as const) : ('CONTACT' as const),
          senderName: isFromMe ? 'Corretor' : 'Cliente',
          messageType: m.audio ? ('AUDIO' as const) : m.image ? ('IMAGE' as const) : ('TEXT' as const),
          attachments: (m.image?.imageUrl || m.audio?.audioUrl) ? [{
            id: `att-${msgId}`,
            url: m.image?.imageUrl || m.audio?.audioUrl,
            fileName: m.image ? 'Imagem' : 'Áudio',
            fileSize: 1024,
            mimeType: m.image ? 'image/jpeg' : 'audio/ogg',
          }] : undefined,
          content: textContent,
          status: 'READ' as const,
          isInternalNote: false,
          timestamp,
        };
      });

    return NextResponse.json({
      success: true,
      count: formattedMessages.length,
      messages: formattedMessages,
    });
  } catch (err: any) {
    console.error('Erro ao buscar histórico Z-API:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao sincronizar histórico da conversa',
      messages: [],
    }, { status: 500 });
  }
}
