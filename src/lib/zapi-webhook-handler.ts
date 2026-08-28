import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';
import { serverCRMStore } from '@/lib/server-crm-store';

export async function processZapiWebhookRequest(
  request: NextRequest,
  routeParams?: { tenantId?: string; instanceId?: string }
) {
  // Validação opcional de segurança
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

    // 1. Extração robusta de LID e Telefone Real do contato
    let lid = '';
    if (body.lid) {
      lid = String(body.lid).replace(/@.*$/, '').replace(/\D/g, '');
    } else if (String(body.phone || '').includes('@lid')) {
      lid = String(body.phone).replace(/@.*$/, '').replace(/\D/g, '');
    } else if (String(body.chatId || '').includes('@lid')) {
      lid = String(body.chatId).replace(/@.*$/, '').replace(/\D/g, '');
    }

    let realPhoneCandidate = body.chatPhone 
      || (!String(body.phone || '').includes('@lid') ? body.phone : '')
      || (!String(body.senderPhone || '').includes('@lid') ? body.senderPhone : '')
      || (!String(body.recipientPhone || '').includes('@lid') ? body.recipientPhone : '')
      || (!String(body.to || '').includes('@lid') ? body.to : '')
      || (!String(body.chatId || '').includes('@lid') ? body.chatId : '')
      || (!String(body.from || '').includes('@lid') ? body.from : '')
      || (body.data && (body.data.chatPhone || (!String(body.data.phone || '').includes('@lid') ? body.data.phone : '') || body.data.senderPhone))
      || '';

    let cleanPhone = String(realPhoneCandidate).replace(/@.*$/, '').replace(/\D/g, '');

    // Se chatPhone estiver presente com número completo
    if (body.chatPhone) {
      const p = String(body.chatPhone).replace(/\D/g, '');
      if (p.length >= 10 && !p.startsWith('1397')) cleanPhone = p;
    }

    // Se o telefone não começar com 55 e tiver 10 ou 11 dígitos (formato BR com DDD), normaliza com 55
    if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Se o telefone ainda estiver vazio mas temos um LID, busca no serverCRMStore pelo telefone real desse LID
    if (!cleanPhone && lid) {
      const serverState = serverCRMStore.getState();
      const existingContact = serverState.contacts?.find((c: any) => c.lid?.replace(/\D/g, '') === lid || c.phone?.replace(/\D/g, '') === lid);
      if (existingContact && existingContact.phone && !existingContact.phone.replace(/\D/g, '').startsWith('1397')) {
        cleanPhone = existingContact.phone.replace(/\D/g, '');
      } else {
        cleanPhone = lid;
      }
    }

    const fromMe = Boolean(body.fromMe || (body.data && body.data.fromMe) || false);
    const senderName = body.senderName 
      || body.chatName 
      || body.pushName 
      || body.name 
      || (fromMe ? 'Corretor' : `WhatsApp ${cleanPhone ? cleanPhone.slice(-4) : 'Cliente'}`);
    
    const senderPhoto = body.photo || body.senderPhoto || body.avatar || '';
    const messageId = body.messageId || body.id || body.zaapId || `zmsg-${Date.now()}`;

    // 2. Detecção de Visualização Única (View-Once)
    const isViewOnce = Boolean(
      body.isViewOnce || 
      body.viewOnce || 
      (body.image && body.image.viewOnce) || 
      (body.video && body.video.viewOnce) ||
      body.viewOnceMessage
    );

    // 3. Extrai o conteúdo do texto ou mídia
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
      content = `📍 Localização: ${loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`}`;
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

    // Se não há conteúdo real ou se for apenas evento de presença/status sem mensagem
    if (!content.trim()) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Evento de status/presença sem texto',
        status: 'SUCCESS',
      });
    }

    const tenantId = routeParams?.tenantId || 'tenant-amabile-barbarotti';
    const instanceId = routeParams?.instanceId || '3F8144490C66805B4E3FD64A35E2F2DC';

    // Se temos um telefone e conteúdo válido, registra no buffer global de eventos
    if (cleanPhone && cleanPhone !== '0') {
      const savedMsg = webhookStore.addMessage({
        id: messageId,
        tenantId,
        instanceId,
        phone: cleanPhone,
        senderName,
        senderPhoto,
        content,
        mediaType,
        mediaUrl,
        fromMe,
        timestamp: new Date().toISOString(),
      });

      // Atualiza também no serverCRMStore
      serverCRMStore.updateState({
        messages: [{
          id: messageId,
          tenantId,
          conversationId: `conv-zapi-${cleanPhone}`,
          senderType: fromMe ? 'USER' : 'CONTACT',
          senderName,
          messageType: (mediaType === 'audio' ? 'AUDIO' : mediaType === 'image' ? 'IMAGE' : mediaType === 'document' ? 'DOCUMENT' : 'TEXT') as any,
          content,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: new Date().toISOString(),
        }],
      });
    }

    return NextResponse.json({
      received: true,
      messageId,
      phone: cleanPhone,
      fromMe,
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
