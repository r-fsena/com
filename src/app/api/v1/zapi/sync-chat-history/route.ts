import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';
import { serverCRMStore } from '@/lib/server-crm-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { session } = validateApiSession(req);

  try {
    const body = await req.json();
    const { 
      phone, 
      conversationId, 
      tenantId = session?.tenantId || 'tenant-amabile-barbarotti',
      historyDays = 15,
      page = 1,
      pageSize = 40,
      instanceId: reqInstId,
      token: reqToken,
      clientToken: reqClientToken
    } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const instanceId = reqInstId || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
    const instanceToken = reqToken || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
    const securityToken = reqClientToken || process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';

    const cutoffMs = historyDays > 0 ? Date.now() - (Number(historyDays) * 24 * 60 * 60 * 1000) : 0;

    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    let rawMessages: any[] = [];
    try {
      // Consulta histórico de mensagens diretamente na Z-API se disponível
      const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chat-messages/${cleanPhone}?page=${page}&pageSize=${pageSize}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          rawMessages = data;
        }
      }
    } catch {}

    // Formata mensagens da Z-API para o formato padrão do CRM
    let formattedMessages: any[] = rawMessages
      .filter((m: any) => m && (m.text || m.body || m.caption || m.message || (m.audio && m.audio.audioUrl) || (m.image && m.image.imageUrl) || (m.document && m.document.documentUrl)))
      .map((m: any, idx: number) => {
        const isFromMe = Boolean(m.fromMe);
        const textContent = m.text?.message || m.body || m.caption || m.message || (m.image ? '📷 [Foto]' : m.audio ? '🎙️ [Áudio]' : m.document ? '📄 [Documento]' : '');
        const timestamp = m.momment ? new Date(Number(m.momment)).toISOString() : (m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString());
        const msgId = m.id || m.zaapId || m.messageId || `hist-msg-${cleanPhone}-${idx}-${Date.now()}`;
        const mediaUrl = m.image?.imageUrl || m.audio?.audioUrl || m.document?.documentUrl;

        return {
          id: msgId,
          tenantId,
          conversationId: conversationId || `conv-zapi-${cleanPhone}`,
          senderType: isFromMe ? ('USER' as const) : ('CONTACT' as const),
          senderName: isFromMe ? 'Corretor' : 'Cliente',
          messageType: m.audio ? ('AUDIO' as const) : m.image ? ('IMAGE' as const) : m.document ? ('DOCUMENT' as const) : ('TEXT' as const),
          attachments: mediaUrl ? [{
            id: `att-${msgId}`,
            url: mediaUrl,
            fileName: m.document?.fileName || (m.image ? 'Foto.jpg' : 'Audio.ogg'),
            fileSize: 1024,
            mimeType: m.image ? 'image/jpeg' : m.audio ? 'audio/ogg' : 'application/pdf',
          }] : undefined,
          content: textContent,
          status: 'READ' as const,
          isInternalNote: false,
          timestamp,
        };
      })
      .filter(m => cutoffMs === 0 || new Date(m.timestamp).getTime() >= cutoffMs);

    // Se a Z-API Multi-Device não retorna histórico remoto antigo do aparelho, recupera apenas mensagens reais gravadas
    if (formattedMessages.length === 0) {
      const serverState = serverCRMStore.getState();
      const storedMsgs = serverState.messages.filter(m => 
        m.conversationId === (conversationId || `conv-zapi-${cleanPhone}`) ||
        (m as any).phone === cleanPhone
      ).filter(m => !m.id.startsWith('hist-') && !m.id.startsWith('initial-msg-'));

      if (storedMsgs.length > 0) {
        formattedMessages = storedMsgs;
      }
    }

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
