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

  // Validação de Segurança do Webhook (Client-Token)
  const expectedToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN;
  const clientToken = request.headers.get('client-token') || request.nextUrl.searchParams.get('token');

  if (expectedToken && clientToken && clientToken !== expectedToken) {
    return NextResponse.json(
      { success: false, error: 'Acesso negado: Token de webhook Z-API inválido' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Extrai o telefone de forma limpa (removendo @lid, @c.us, @s.whatsapp.net)
    let rawPhone = body.phone || body.recipientPhone || body.to || body.senderPhone || body.chatId || body.sender || body.from || (body.data && (body.data.phone || body.data.recipientPhone || body.data.senderPhone)) || '';
    
    // Se o telefone vier no formato JID / LID (ex: 38247304564788@lid ou 55489999@c.us)
    let cleanPhone = String(rawPhone).replace(/@.*$/, '').replace(/\D/g, '');
    
    // Se cleanPhone estiver vazio mas houver chatPhone
    if (!cleanPhone && body.chatPhone) {
      cleanPhone = String(body.chatPhone).replace(/\D/g, '');
    }

    const fromMe = Boolean(body.fromMe || (body.data && body.data.fromMe) || false);
    const senderName = body.senderName || body.chatName || body.pushName || body.name || (fromMe ? 'Corretor' : `WhatsApp ${cleanPhone ? cleanPhone.slice(-4) : 'Cliente'}`);
    const senderPhoto = body.photo || body.senderPhoto || body.avatar || '';
    const messageId = body.messageId || body.id || body.zaapId || `zmsg-${Date.now()}`;
    
    // Detecção de Visualização Única (View-Once)
    const isViewOnce = Boolean(
      body.isViewOnce || 
      body.viewOnce || 
      (body.image && body.image.viewOnce) || 
      (body.video && body.video.viewOnce) ||
      body.viewOnceMessage
    );

    // Extrai o conteúdo do texto ou mídia
    let content = '';
    let mediaType: 'text' | 'image' | 'audio' | 'document' = 'text';
    let mediaUrl = '';

    if (body.text && body.text.message) {
      content = body.text.message;
    } else if (typeof body.text === 'string') {
      content = body.text;
    } else if (body.image || body.viewOnceImage || (body.viewOnceMessage && body.viewOnceMessage.image)) {
      const imgObj = body.image || body.viewOnceImage || (body.viewOnceMessage && body.viewOnceMessage.image);
      mediaType = 'image';
      mediaUrl = typeof imgObj === 'string' ? imgObj : (imgObj.imageUrl || imgObj.url || imgObj.link || imgObj.thumbnailUrl || '');
      content = imgObj.caption || (isViewOnce ? '📷 Foto (Visualização Única)' : '📷 Imagem');
    } else if (body.video || body.viewOnceVideo || (body.viewOnceMessage && body.viewOnceMessage.video)) {
      const vidObj = body.video || body.viewOnceVideo || (body.viewOnceMessage && body.viewOnceMessage.video);
      mediaType = 'document';
      mediaUrl = typeof vidObj === 'string' ? vidObj : (vidObj.videoUrl || vidObj.url || vidObj.link || '');
      content = vidObj.caption || (isViewOnce ? '🎥 Vídeo (Visualização Única)' : '🎥 Vídeo');
    } else if (body.audio || body.voice || body.ptt) {
      const audObj = body.audio || body.voice || body.ptt;
      mediaType = 'audio';
      mediaUrl = typeof audObj === 'string' ? audObj : (audObj.audioUrl || audObj.url || audObj.link || '');
      content = '🎵 Mensagem de voz / Áudio';
    } else if (body.location || body.liveLocation) {
      const loc = body.location || body.liveLocation;
      content = `📍 Localização compartilhada: ${loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`}`;
    } else if (body.contact || body.vcard || body.contacts) {
      const cnt = body.contact || (body.contacts && body.contacts[0]) || {};
      content = `📇 Contato: ${cnt.displayName || cnt.name || 'Contato recebido'}`;
    } else if (body.document || body.file) {
      const docObj = body.document || body.file;
      mediaType = 'document';
      mediaUrl = typeof docObj === 'string' ? docObj : (docObj.documentUrl || docObj.url || docObj.link || '');
      content = docObj.fileName || docObj.title || '📄 Documento recebido';
    } else if (body.sticker) {
      mediaType = 'image';
      mediaUrl = typeof body.sticker === 'string' ? body.sticker : (body.sticker.stickerUrl || body.sticker.url || '');
      content = '🌟 Figurinha';
    } else if (body.message) {
      content = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
    } else if (body.body) {
      content = String(body.body);
    } else if (isViewOnce) {
      content = '📷 Foto (Visualização Única)';
    }

    // Se não há conteúdo real ou se for apenas evento de status/presença/entrega, não cria balão de mensagem
    if (!content.trim()) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Evento de status/presença sem texto de mensagem',
        status: 'SUCCESS',
      });
    }

    // Se temos um telefone e conteúdo válido, registra no buffer de eventos em tempo real
    if (cleanPhone && cleanPhone !== '0') {
      webhookStore.addMessage({
        id: messageId,
        tenantId: tenantId || 'tenant-amabile-barbarotti',
        instanceId: instanceId || '3F1B67FC8139425171C79ED390C0144C',
        phone: cleanPhone,
        senderName,
        senderPhoto,
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
      phone: cleanPhone,
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
