import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';

export const dynamic = 'force-dynamic';

/**
 * Ingestão de Webhooks da Z-API com suporte a mensagens em tempo real
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string; instanceId: string } }
) {
  const { tenantId, instanceId } = params;

  try {
    const body = await request.json();

    // Extrai os campos flexivelmente de qualquer formato de evento da Z-API
    const phone = body.phone || body.sender || body.from || body.chatId || (body.data && body.data.phone) || '';
    const senderName = body.senderName || body.chatName || body.pushName || body.name || `WhatsApp ${phone.slice(-4)}`;
    const fromMe = Boolean(body.fromMe || (body.data && body.data.fromMe) || false);
    const messageId = body.messageId || body.id || body.zaapId || `zmsg-${Date.now()}`;
    
    // Extrai o conteúdo do texto ou mídia
    let content = '';
    let mediaType: 'text' | 'image' | 'audio' | 'document' = 'text';
    let mediaUrl = '';

    if (body.text && body.text.message) {
      content = body.text.message;
    } else if (typeof body.text === 'string') {
      content = body.text;
    } else if (body.image) {
      mediaType = 'image';
      mediaUrl = body.image.imageUrl || body.image.url || '';
      content = body.image.caption || '📷 Imagem recebida';
    } else if (body.audio) {
      mediaType = 'audio';
      mediaUrl = body.audio.audioUrl || body.audio.url || '';
      content = '🎵 Áudio gravado';
    } else if (body.document) {
      mediaType = 'document';
      mediaUrl = body.document.documentUrl || body.document.url || '';
      content = body.document.fileName || '📄 Documento recebido';
    } else if (body.message) {
      content = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
    } else if (body.body) {
      content = String(body.body);
    } else {
      content = 'Mensagem recebida pelo WhatsApp';
    }

    // Se temos um telefone e conteúdo válido, registra no buffer de eventos em tempo real
    if (phone && phone !== '0') {
      webhookStore.addMessage({
        id: messageId,
        tenantId: tenantId || 'tenant-vanguard-01',
        instanceId: instanceId || '3F1B67FC8139425171C79ED390C0144C',
        phone,
        senderName,
        content,
        mediaType,
        mediaUrl,
        fromMe,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      received: true,
      messageId,
      phone,
      contentPreview: content.substring(0, 30),
      status: 'SUCCESS',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao processar webhook Z-API', message: err.message },
      { status: 500 }
    );
  }
}

// Suporte a GET para verificação rápida de webhook
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; instanceId: string } }
) {
  return NextResponse.json({
    status: 'ACTIVE',
    endpoint: `/api/v1/webhooks/zapi/${params.tenantId}/${params.instanceId}`,
    ready: true,
  });
}
