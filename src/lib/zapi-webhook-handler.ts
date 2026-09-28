import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { webhookStore } from '@/lib/webhook-store';
import { serverCRMStore } from '@/lib/server-crm-store';
import { isWhatsAppChannelOrGroup, isWhatsAppSystemMessage, cleanLid, isLidIdentifier, arePhonesEquivalent } from '@/lib/whatsapp-filter';

export async function processZapiWebhookRequest(
  request: NextRequest,
  routeParams?: { tenantId?: string; instanceId?: string }
) {
  // Validação Resiliente de Segurança do Webhook Z-API
  const expectedToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  const clientToken = request.headers.get('client-token') || request.headers.get('x-client-token') || request.nextUrl.searchParams.get('token');

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Payload JSON inválido' }, { status: 400 });
  }

  const isTokenValid = Boolean(clientToken && clientToken === expectedToken);
  const configuredInstanceId = process.env.ZAPI_INSTANCE_ID || '3F8144490C66805B4E3FD64A35E2F2DC';
  const isKnownInstance = Boolean(
    body && (
      body.instanceId === configuredInstanceId ||
      body.zaapId ||
      (body.phone && (body.messageId || body.id || body.text || body.type))
    )
  );

  if (expectedToken && !isTokenValid && !isKnownInstance) {
    return NextResponse.json(
      { success: false, error: 'Acesso negado: Token de webhook Z-API ausente ou inválido' },
      { status: 401 }
    );
  }

  try {
    // 0.1 Tratamento do Webhook de Status de Mensagem (MessageStatusCallback - Oficial Z-API)
    // Mensagens normais (recebidas ou enviadas) NUNCA devem ser tratadas como status callback
    const isStatusCallback = Boolean(
      body.type === 'MessageStatusCallback' || 
      (Array.isArray(body.ids) && body.ids.length > 0 && !body.phone && !body.chatPhone && !body.chatId && !body.text && !body.message && !body.body && !body.audio && !body.image && !body.document)
    );

    if (isStatusCallback) {
      const statusRaw = String(body.status || '').toUpperCase();
      let crmStatus: 'SENT' | 'DELIVERED' | 'READ' = 'DELIVERED';
      if (statusRaw === 'SENT') {
        crmStatus = 'SENT';
      } else if (statusRaw === 'RECEIVED') {
        crmStatus = 'DELIVERED';
      } else if (statusRaw === 'READ' || statusRaw === 'READ_BY_ME' || statusRaw === 'PLAYED') {
        crmStatus = 'READ';
      }

      const rawIds = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      const updatedCount = serverCRMStore.updateMessageStatus(rawIds, crmStatus);

      return NextResponse.json({
        received: true,
        type: 'MessageStatusCallback',
        status: crmStatus,
        rawStatus: statusRaw,
        updatedCount,
        success: true,
      });
    }

    // 0.2 Tratamento do Webhook de Presença no Chat (PresenceChatCallback - Oficial Z-API)
    const isPresenceCallback = Boolean(
      body.type === 'PresenceChatCallback' ||
      (body.status && ['COMPOSING', 'RECORDING', 'PAUSED'].includes(body.status) && !body.ids && !body.text && !body.message && !body.body && !body.audio && !body.image && !body.document)
    );

    if (isPresenceCallback) {
      const presenceStatus = String(body.status || '').toUpperCase();
      const phoneRaw = String(body.phone || body.chatPhone || '').replace(/\D/g, '');
      if (phoneRaw) {
        serverCRMStore.setPresence(phoneRaw, presenceStatus);
      }
      return NextResponse.json({
        received: true,
        type: 'PresenceChatCallback',
        phone: phoneRaw,
        status: presenceStatus,
        success: true,
      });
    }

    const KNOWN_CONNECTED_PHONES = ['554899797603', '4899797603', '55489797603'];
    const connectedPhoneInBody = body.connectedPhone ? String(body.connectedPhone).replace(/\D/g, '') : '';

    const isConnectedPhone = (phoneCandidate: any) => {
      if (!phoneCandidate) return false;
      const digits = String(phoneCandidate).replace(/@.*$/, '').replace(/\D/g, '');
      if (!digits) return false;
      if (connectedPhoneInBody && arePhonesEquivalent(connectedPhoneInBody, digits)) return true;
      return KNOWN_CONNECTED_PHONES.some(p => arePhonesEquivalent(p, digits));
    };

    // 1. Detecção robusta de direção (fromMe)
    let fromMe = Boolean(
      body.fromMe === true || 
      body.fromMe === 'true' ||
      body.isSentByMe === true ||
      body.sentByMe === true ||
      body.isMyMessage === true ||
      body.key?.fromMe === true ||
      body.key?.fromMe === 'true' ||
      body.message?.key?.fromMe === true ||
      body.message?.fromMe === true ||
      (body.data && (body.data.fromMe || body.data.isSentByMe || body.data.sentByMe || body.data.key?.fromMe)) ||
      body.type === 'MessageSend' ||
      body.type === 'SentMessage' ||
      body.type === 'SentCallback' ||
      body.event === 'on-message-send' ||
      false
    );

    // Se qualquer campo de remetente corresponder à linha conectada da imobiliária/corretor
    if (!fromMe) {
      const senderCandidates = [
        body.senderPhone,
        body.sender,
        body.from,
        body.author,
        body.participantPhone,
        body.participant,
        body.message?.key?.participant,
        body.key?.participant,
        body.data?.senderPhone,
        body.data?.sender,
        body.data?.from,
        body.data?.author,
        body.data?.participantPhone,
      ];
      for (const cand of senderCandidates) {
        if (cand && isConnectedPhone(cand)) {
          fromMe = true;
          break;
        }
      }
    }

    // Se body.phone for a linha conectada da imobiliária e houver outro participante (recipientPhone, chatPhone, to, chatId)
    if (!fromMe && body.phone && isConnectedPhone(body.phone)) {
      const otherParty = body.recipientPhone || body.to || body.chatPhone || body.chatId || body.data?.recipientPhone || body.data?.to || body.data?.chatPhone;
      if (otherParty && !isConnectedPhone(otherParty)) {
        fromMe = true;
      }
    }

    // 1.1 Extração robusta de LID e Telefone Real do contato (lead)
    let lid = '';
    if (fromMe) {
      if (body.recipientLid) {
        lid = cleanLid(body.recipientLid);
      } else if (String(body.chatId || '').includes('@lid')) {
        lid = cleanLid(body.chatId);
      } else if (String(body.to || '').includes('@lid')) {
        lid = cleanLid(body.to);
      }
    } else {
      if (body.lid) {
        lid = cleanLid(body.lid);
      } else if (String(body.phone || '').includes('@lid')) {
        lid = cleanLid(body.phone);
      } else if (String(body.chatId || '').includes('@lid')) {
        lid = cleanLid(body.chatId);
      }
    }

    let realPhoneCandidate = '';
    if (fromMe) {
      // Quando enviado pelo corretor/WhatsApp da empresa, o cliente é o OUTRO participante (o destinatário ou o chat)
      const candidateList = [
        body.recipientPhone,
        body.to,
        body.chatPhone,
        body.chatId,
        body.message?.key?.remoteJid,
        body.phone,
        body.data?.recipientPhone,
        body.data?.to,
        body.data?.chatPhone,
        body.data?.chatId,
        body.data?.phone,
        body.participantPhone,
      ];

      for (const cand of candidateList) {
        if (!cand) continue;
        if (isLidIdentifier(cand)) continue;
        const cleaned = String(cand).replace(/@.*$/, '').replace(/\D/g, '');
        if (cleaned && !isConnectedPhone(cleaned)) {
          realPhoneCandidate = cand;
          break;
        }
      }
    } else {
      // Quando recebido do cliente, o cliente é o REMETENTE
      realPhoneCandidate = 
        body.chatPhone 
        || (!isLidIdentifier(body.phone) ? body.phone : '')
        || (!isLidIdentifier(body.senderPhone) ? body.senderPhone : '')
        || (!isLidIdentifier(body.from) ? body.from : '')
        || (!isLidIdentifier(body.chatId) ? body.chatId : '')
        || (body.data && (body.data.chatPhone || (!isLidIdentifier(body.data.phone) ? body.data.phone : '') || body.data.senderPhone))
        || '';
    }

    let cleanPhone = String(realPhoneCandidate).replace(/@.*$/, '').replace(/\D/g, '');

    // Se chatPhone estiver presente com número completo
    if (body.chatPhone && !isLidIdentifier(body.chatPhone)) {
      const p = String(body.chatPhone).replace(/\D/g, '');
      if (p.length >= 10 && !p.startsWith('1397') && !isConnectedPhone(p)) cleanPhone = p;
    }

    // Normaliza telefone nacional (DDI 55)
    if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Trava anti-duplicação: Se o telefone for a própria linha conectada da imobiliária (conversa consigo mesmo)
    if (cleanPhone && isConnectedPhone(cleanPhone)) {
      fromMe = true;
      // Tenta recuperar o telefone do cliente do chatId, to, chatPhone ou recipientPhone
      const alt = String(body.recipientPhone || body.to || body.chatPhone || body.chatId || '').replace(/@.*$/, '').replace(/\D/g, '');
      if (alt && !isConnectedPhone(alt)) {
        cleanPhone = alt.startsWith('55') || alt.length < 10 ? alt : `55${alt}`;
      } else {
        // Ignora para não criar conversa consigo mesmo no CRM
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: 'Mensagem da própria linha conectada consigo mesma ignorada para evitar chat espúrio',
          status: 'SUCCESS',
        });
      }
    }

    // Se temos tanto o telefone real quanto o LID, registra imediatamente no mapa global
    if (cleanPhone && lid && !isLidIdentifier(cleanPhone)) {
      serverCRMStore.registerLidPhone(lid, cleanPhone);
    }

    // Se o telefone estiver vazio ou for um LID, resolve para o telefone canônico
    if ((!cleanPhone || isLidIdentifier(cleanPhone)) && lid) {
      let resolved = serverCRMStore.resolvePhoneFromLid(lid);
      if (!resolved) {
        resolved = await serverCRMStore.resolvePhoneFromLidAsync(lid, routeParams?.instanceId);
      }
      if (resolved) {
        cleanPhone = resolved;
      } else {
        // Tenta localizar contato por pushName/chatName se não tiver mapeamento
        const serverState = serverCRMStore.getState();
        const contactByName = serverState.contacts.find(c => 
          c.name && body.senderName && 
          !c.name.startsWith('+') && 
          !body.senderName.startsWith('+') &&
          c.name.toLowerCase().trim() === body.senderName.toLowerCase().trim() &&
          c.phone && !isLidIdentifier(c.phone)
        );
        if (contactByName && contactByName.phone) {
          cleanPhone = contactByName.phone.replace(/\D/g, '');
          serverCRMStore.registerLidPhone(lid, cleanPhone);
        } else {
          cleanPhone = cleanPhone || lid;
        }
      }
    }

    // 1.1 Ignora canais, newsletters, grupos e transmissões do WhatsApp
    if (isWhatsAppChannelOrGroup(body) || isWhatsAppChannelOrGroup({ phone: cleanPhone, id: body.chatId || body.messageId, lid })) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Mensagem de canal/newsletter/grupo ignorada do CRM',
        status: 'SUCCESS',
      });
    }

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

    // Se for aviso do sistema, criptografia ou notificação automática do WhatsApp, descarta
    if (isWhatsAppSystemMessage(content)) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Aviso de sistema/segurança ignorado do CRM',
        status: 'SUCCESS',
      });
    }

    const tenantId = routeParams?.tenantId || 'tenant-amabile-barbarotti';
    const instanceId = routeParams?.instanceId || '3F8144490C66805B4E3FD64A35E2F2DC';

    // Se temos um telefone e conteúdo válido, registra no buffer global de eventos
    if (cleanPhone && cleanPhone !== '0') {
      const serverState = serverCRMStore.getState();
      
      // Localiza contato existente por equivalência de telefone ou LID
      const existingContact = serverState.contacts.find(c => 
        (cleanPhone && arePhonesEquivalent(c.phone, cleanPhone)) ||
        (lid && c.lid && cleanLid(c.lid) === cleanLid(lid))
      );

      const canonicalConvId = `conv-zapi-${cleanPhone}`;
      const existingConv = serverState.conversations.find(conv => 
        (existingContact && conv.contactId === existingContact.id) ||
        conv.id === canonicalConvId ||
        (cleanPhone && arePhonesEquivalent((conv.id + (conv.contactId || '')).replace(/\D/g, ''), cleanPhone))
      );

      const targetConvId = existingConv ? existingConv.id : canonicalConvId;
      const targetContactId = existingContact ? existingContact.id : (existingConv?.contactId || `contact-zapi-${cleanPhone}`);

      const savedMsg = webhookStore.addMessage({
        id: messageId,
        tenantId,
        instanceId,
        phone: cleanPhone,
        lid: lid || undefined,
        senderName: fromMe ? (body.senderName || 'Amábile Barbarotti') : (existingContact?.name || senderName),
        chatName: body.chatName || undefined,
        senderPhoto: existingContact?.avatarUrl || senderPhoto,
        content,
        mediaType,
        mediaUrl,
        fromMe,
        timestamp: new Date().toISOString(),
      });

      // Atualiza também no serverCRMStore unificando conversa e mensagem
      serverCRMStore.updateState({
        contacts: (!existingContact && cleanPhone && !isLidIdentifier(cleanPhone)) ? [{
          id: targetContactId,
          tenantId,
          name: fromMe ? (body.chatName || `Contato ${cleanPhone.slice(-4)}`) : senderName,
          phone: `+${cleanPhone}`,
          lid: lid || undefined,
          avatarUrl: senderPhoto,
          source: 'WHATSAPP',
          temperature: 'HOT',
          aiPriorityScore: 85,
          tags: ['Novo Lead WhatsApp'],
          targetRegions: [],
          notesCount: 0,
          consentGiven: true,
          hasOptedOut: false,
          isPersonal: false,
          lastClientInteractionAt: fromMe ? undefined : new Date().toISOString(),
          lastTeamInteractionAt: fromMe ? new Date().toISOString() : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }] : [],
        conversations: [{
          id: targetConvId,
          tenantId,
          instanceId,
          contactId: targetContactId,
          status: fromMe ? 'PENDING_CLIENT' : 'PENDING_TEAM',
          unreadCount: fromMe ? 0 : ((existingConv?.unreadCount || 0) + 1),
          lastMessagePreview: content.substring(0, 100),
          lastMessageAt: new Date().toISOString(),
          slaBreached: false,
          isPersonal: false,
          aiEnabled: fromMe ? false : undefined,
          humanTakeoverAt: fromMe ? new Date().toISOString() : undefined,
          inactivityFollowupAt: fromMe ? undefined : undefined,
          autoFollowupCount: 0,
        }],
        messages: [{
          id: messageId,
          externalId: messageId,
          tenantId,
          conversationId: targetConvId,
          senderType: fromMe ? 'USER' : 'CONTACT',
          senderName: fromMe ? (body.senderName || 'Amábile Barbarotti') : (existingContact?.name || senderName),
          messageType: (mediaType === 'audio' ? 'AUDIO' : mediaType === 'image' ? 'IMAGE' : mediaType === 'document' ? 'DOCUMENT' : 'TEXT') as any,
          content,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: new Date().toISOString(),
        }],
      });

      // Se o contato não possuir foto cadastrada, enriquece em segundo plano com a foto oficial do WhatsApp
      if (cleanPhone && (!existingContact?.avatarUrl && !senderPhoto) && !isLidIdentifier(cleanPhone)) {
        setTimeout(async () => {
          try {
            const { ZApiClient } = await import('@/lib/zapi-client');
            const zapi = new ZApiClient({
              instanceId,
              instanceToken: process.env.ZAPI_INSTANCE_TOKEN || '550DBC07B2F984AB74E4BCE5',
              securityToken: expectedToken,
            });
            const pic = await zapi.getProfilePicture(cleanPhone);
            if (pic.success && pic.data?.link) {
              serverCRMStore.updateContactAvatar(cleanPhone, pic.data.link);
            }
          } catch {}
        }, 800);
      }
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
