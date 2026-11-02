import { kickQualification } from '@/lib/lead-qualification-service';
import { recordCampaignStop } from '@/lib/campaigns';
import { recordCampaignReceipt, recordCampaignReply } from '@/lib/campaign-service';
import { enqueueAutomationEvent, runInternalJobs } from '@/lib/automations';
import { automationEnvironment } from '@/lib/automation-service';
import { webhookToken } from '@/lib/zapi-webhook-auth';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { readCRMState, mutateCRMState, mergeTenantState } from '@/lib/crm-repository';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';
import { serverCRMStore } from '@/lib/server-crm-store';
import { isWhatsAppChannelOrGroup, isWhatsAppSystemMessage, cleanLid, isLidIdentifier, arePhonesEquivalent, KNOWN_LID_PHONE_MAP, resolveKnownPhone } from '@/lib/whatsapp-filter';

export async function processZapiWebhookRequest(
  request: NextRequest,
  routeParams?: { tenantId?: string; instanceId?: string }
) {
  // Validação Resiliente de Segurança do Webhook Z-API
  const expectedToken = process.env.ZAPI_WEBHOOK_SECRET || '';
  const clientToken = request.headers.get('client-token') || request.headers.get('x-client-token') || request.nextUrl.searchParams.get('token');

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Payload JSON inválido' }, { status: 400 });
  }

  if (!expectedToken) return NextResponse.json({ error: 'Segredo do webhook não configurado.' }, { status: 503 });
  if (!clientToken) return NextResponse.json({ error: 'Token de webhook obrigatório.' }, { status: 401 });
  const instanceId = routeParams?.instanceId || body.instanceId || body.zaapId;
  if (!instanceId) return NextResponse.json({ error: 'Instância obrigatória.' }, { status: 400 });
  const expectedBuffer = Buffer.from(webhookToken(instanceId));
  const suppliedBuffer = Buffer.from(clientToken || '');
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return NextResponse.json({ error: 'Token do webhook ausente ou inválido.' }, { status: 401 });
  }
  let tenantId: string;
  try {
    tenantId = await ZapiCredentialsService.resolveWebhookTenant(instanceId);
    if ((routeParams?.tenantId && routeParams.tenantId !== tenantId) || (body.instanceId && body.instanceId !== instanceId)) {
      return NextResponse.json({ error: 'Instância e imobiliária incompatíveis.' }, { status: 403 });
    }
  } catch { return NextResponse.json({ error: 'Instância não autorizada.' }, { status: 403 }); }

  try {
    // 0.1 Tratamento do Webhook de Status de Mensagem (MessageStatusCallback - Oficial Z-API)
    // Mensagens normais (recebidas ou enviadas) NUNCA devem ser tratadas como status callback
    const isStatusCallback = Boolean(
      body.type === 'MessageStatusCallback' ||
      (Array.isArray(body.ids) && body.ids.length > 0 && !body.phone && !body.chatPhone && !body.chatId && !body.text && !body.message && !body.body && !body.audio && !body.image && !body.document)
    );

    if (isStatusCallback) {
      const statusRaw = String(body.status || '').toUpperCase();
      if (!['SENT', 'RECEIVED', 'READ', 'READ_BY_ME', 'PLAYED', 'ERROR', 'FAILED'].includes(statusRaw)) return NextResponse.json({ received: true, ignored: true, reason: 'Status de mensagem não reconhecido.' });
      let crmStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'DELIVERED';
      if (statusRaw === 'SENT') {
        crmStatus = 'SENT';
      } else if (statusRaw === 'RECEIVED') {
        crmStatus = 'DELIVERED';
      } else if (statusRaw === 'READ' || statusRaw === 'READ_BY_ME' || statusRaw === 'PLAYED') {
        crmStatus = 'READ';
      } else if (['ERROR', 'FAILED'].includes(statusRaw)) {
        crmStatus = 'FAILED';
      }

      const rawIds = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      const rank = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: -1 };
      let updatedCount = 0;
      await mutateCRMState(tenantId, current => {
        const updates = current.messages.filter(m => rawIds.includes(m.externalId || m.id)
          && current.conversations.some(c => c.id === m.conversationId && c.instanceId === instanceId)
          && (statusRaw !== 'READ_BY_ME' || m.senderType === 'CONTACT')
          && !(m.status === 'FAILED' && crmStatus === 'SENT')
          && (crmStatus === 'FAILED' ? ['PENDING', 'SENT'].includes(m.status) : rank[crmStatus] > rank[m.status])).map(m => ({ ...m, status: crmStatus }));
        updatedCount = updates.length;
        return mergeTenantState(tenantId, current, { messages: updates });
      });

      const campaignStatus = statusRaw === 'RECEIVED' ? 'DELIVERED' : statusRaw === 'READ' ? 'READ' : ['ERROR', 'FAILED'].includes(statusRaw) ? 'FAILED' : statusRaw === 'SENT' ? 'ACCEPTED' : '';
      if (campaignStatus) await recordCampaignReceipt(tenantId, instanceId, rawIds, campaignStatus);
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

    const KNOWN_CONNECTED_PHONES: string[] = [];
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
      [body.data?.fromMe, body.data?.isSentByMe, body.data?.sentByMe, body.data?.key?.fromMe].some(value => value === true || value === 'true') ||
      body.type === 'MessageSend' ||
      body.type === 'SentMessage' ||
      body.type === 'SentCallback' ||
      body.type === 'ReceivedCallbackSentByMe' ||
      body.type === 'SentByMe' ||
      body.event === 'on-message-send' ||
      body.event === 'on-message-sent' ||
      body.event === 'sent-by-me' ||
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
    const lidCandidates = [
      body.recipientLid,
      body.lid,
      body.chatId,
      body.to,
      body.key?.remoteJid,
      body.data?.key?.remoteJid,
      body.phone,
      body.recipientPhone
    ];

    for (const cand of lidCandidates) {
      if (cand && isLidIdentifier(cand)) {
        lid = cleanLid(cand);
        break;
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
        body.key?.remoteJid,
        body.data?.key?.remoteJid,
        body.data?.remoteJid,
        body.remoteJid,
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
        if (isLidIdentifier(cand)) {
          const known = resolveKnownPhone(cand);
          if (known) {
            realPhoneCandidate = known;
            break;
          }
          continue;
        }
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

    if (!realPhoneCandidate && lid) {
      const known = resolveKnownPhone(lid);
      if (known) realPhoneCandidate = known;
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
      const currentState = await readCRMState(tenantId);
      const resolved = currentState.contacts.find(c => c.lid && cleanLid(c.lid) === lid)?.phone?.replace(/\D/g, '');
      if (resolved) {
        cleanPhone = resolved;
      } else {
        // Tenta localizar contato por pushName/chatName se não tiver mapeamento
        const serverState = await readCRMState(tenantId);
        const targetName = (body.chatName || body.senderName || '').toLowerCase().trim();
        const contactByName = serverState.contacts.find(c =>
          c.name && targetName &&
          !c.name.startsWith('+') &&
          (c.name.toLowerCase().trim() === targetName || c.name.toLowerCase().includes(targetName) || targetName.includes(c.name.toLowerCase())) &&
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
    const messageId = String(body.messageId || body.id || body.zaapId || body.data?.key?.id || body.key?.id || body.message?.key?.id
      || `zmsg-${crypto.createHash('sha256').update(`${instanceId}:${JSON.stringify(body)}`).digest('hex')}`);

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
    let mediaType: 'text' | 'image' | 'audio' | 'document' | 'video' = 'text';
    let mediaUrl = '';

    if (body.text && body.text.message) {
      content = body.text.message;
    } else if (typeof body.text === 'string') {
      content = body.text;
    } else if (body.conversation) {
      content = typeof body.conversation === 'string' ? body.conversation : String(body.conversation);
    } else if (body.message?.conversation) {
      content = body.message.conversation;
    } else if (body.message?.message?.conversation) {
      content = body.message.message.conversation;
    } else if (body.message?.extendedTextMessage?.text) {
      content = body.message.extendedTextMessage.text;
    } else if (body.extendedTextMessage?.text) {
      content = body.extendedTextMessage.text;
    } else if (body.data?.message?.extendedTextMessage?.text) {
      content = body.data.message.extendedTextMessage.text;
    } else if (body.data?.message?.conversation) {
      content = body.data.message.conversation;
    } else if (body.data?.message) {
      content = typeof body.data.message === 'string' ? body.data.message : (body.data.message.message || body.data.message.conversation || body.data.message.text || '');
    } else if (body.data?.text) {
      content = typeof body.data.text === 'string' ? body.data.text : (body.data.text.message || '');
    } else if (body.image || body.viewOnceImage || (body.viewOnceMessage && body.viewOnceMessage.image)) {
      const imgObj = body.image || body.viewOnceImage || (body.viewOnceMessage && body.viewOnceMessage.image);
      mediaType = 'image';
      mediaUrl = typeof imgObj === 'string' ? imgObj : (imgObj.imageUrl || imgObj.url || imgObj.link || imgObj.thumbnailUrl || '');
      content = imgObj.caption || (isViewOnce ? '📷 Foto (Visualização Única)' : '📷 Imagem');
    } else if (body.video || body.viewOnceVideo || (body.viewOnceMessage && body.viewOnceMessage.video)) {
      const vidObj = body.video || body.viewOnceVideo || (body.viewOnceMessage && body.viewOnceMessage.video);
      mediaType = 'video';
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
      content = typeof body.message === 'string' ? body.message : (body.message.text || body.message.caption || JSON.stringify(body.message));
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

    // Confirma somente depois do commit. O recebimento não depende de abas abertas.
    if (cleanPhone && cleanPhone !== '0') {
      const currentAutomation = (await readCRMState(tenantId)).automation;
      // A temporary membership/configuration failure must not break message ingestion.
      // The event remains queued in the same committed snapshot for the worker.
      const automationEnv = currentAutomation?.rules.some(rule => rule.status === 'ACTIVE') ? await automationEnvironment(tenantId).catch(() => null) : null;
      await mutateCRMState(tenantId, serverState => {
        // Reentregas do provedor não incrementam não lidas nem alteram o resumo da conversa.
        if (serverState.messages.some(m => (m.externalId || m.id) === messageId)) return serverState;

        // Localiza contato existente por equivalência de telefone ou LID
        const existingContact = serverState.contacts.find(c =>
          (cleanPhone && arePhonesEquivalent(c.phone, cleanPhone)) ||
          (lid && c.lid && cleanLid(c.lid) === cleanLid(lid))
        );

        const legacyConvId = `conv-zapi-${cleanPhone}`;
        const canonicalConvId = serverState.conversations.some(c => c.id === legacyConvId && c.instanceId && c.instanceId !== instanceId)
          ? `conv-zapi-${instanceId}-${cleanPhone}` : legacyConvId;
        const existingConv = serverState.conversations.find(conv => (!conv.instanceId || conv.instanceId === instanceId) && (
          (existingContact && conv.contactId === existingContact.id) ||
          conv.id === canonicalConvId ||
          (cleanPhone && arePhonesEquivalent((conv.id + (conv.contactId || '')).replace(/\D/g, ''), cleanPhone))
        ));

        const targetConvId = existingConv ? existingConv.id : canonicalConvId;
        const targetContactId = existingContact ? existingContact.id : (existingConv?.contactId || `contact-zapi-${cleanPhone}`);

        // Extrai o carimbo de data/hora real em milissegundos enviado pela Z-API
        let messageTimestampIso = new Date().toISOString();
        const rawMoment = body.momment || body.timestamp || body.messageTimestamp || body.message?.messageTimestamp || body.data?.messageTimestamp;
        if (rawMoment) {
          let ms = Number(rawMoment);
          if (!isNaN(ms) && ms > 0) {
            if (ms < 10000000000) {
              ms = ms * 1000; // Converte segundos para milissegundos
            }
            if (ms > 946684800000 && ms < Date.now() + 86400000) {
              messageTimestampIso = new Date(ms).toISOString();
            }
          } else if (typeof rawMoment === 'string') {
            const parsed = new Date(rawMoment);
            if (!isNaN(parsed.getTime())) {
              messageTimestampIso = parsed.toISOString();
            }
          }
        }

        const isLatest = !existingConv || Date.parse(messageTimestampIso) >= (Date.parse(existingConv.lastMessageAt) || 0);
        let next = mergeTenantState(tenantId, serverState, {
          contacts: existingContact ? [{
            ...existingContact,
            lastClientInteractionAt: !fromMe && Date.parse(messageTimestampIso) > (Date.parse(existingContact.lastClientInteractionAt || '') || 0)
              ? messageTimestampIso : existingContact.lastClientInteractionAt,
            lastTeamInteractionAt: fromMe && Date.parse(messageTimestampIso) > (Date.parse(existingContact.lastTeamInteractionAt || '') || 0)
              ? messageTimestampIso : existingContact.lastTeamInteractionAt,
          }] : (cleanPhone && !isLidIdentifier(cleanPhone)) ? [{
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
            consentGiven: false,
            hasOptedOut: false,
            isPersonal: false,
            lastClientInteractionAt: fromMe ? undefined : messageTimestampIso,
            lastTeamInteractionAt: fromMe ? messageTimestampIso : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }] : [],
          conversations: [{
            ...existingConv,
            id: targetConvId,
            tenantId,
            instanceId,
            contactId: targetContactId,
            status: isLatest ? (fromMe ? 'PENDING_CLIENT' : 'PENDING_TEAM') : existingConv!.status,
            unreadCount: fromMe ? (isLatest ? 0 : existingConv?.unreadCount || 0) : ((existingConv?.unreadCount || 0) + 1),
            lastMessagePreview: isLatest ? content.substring(0, 100) : existingConv!.lastMessagePreview,
            lastMessageAt: isLatest ? messageTimestampIso : existingConv!.lastMessageAt,
            slaBreached: false,
            isPersonal: false,
            aiEnabled: fromMe && isLatest ? false : existingConv?.aiEnabled,
            humanTakeoverAt: fromMe && isLatest ? new Date().toISOString() : existingConv?.humanTakeoverAt,
            inactivityFollowupAt: fromMe && isLatest ? undefined : existingConv?.inactivityFollowupAt,
            autoFollowupCount: existingConv?.autoFollowupCount || 0,
          }],
          messages: [{
            id: messageId,
            externalId: messageId,
            tenantId,
            conversationId: targetConvId,
            senderType: fromMe ? 'USER' : 'CONTACT',
            senderName: fromMe ? (body.senderName || 'Corretor') : (existingContact?.name || senderName),
            messageType: (mediaType === 'audio' ? 'AUDIO' : mediaType === 'image' ? 'IMAGE' : mediaType === 'document' ? 'DOCUMENT' : mediaType === 'video' ? 'VIDEO' : 'TEXT') as any,
            content,
            attachments: mediaUrl ? [{
              id: `att-${messageId}`,
              url: mediaUrl,
              fileName: mediaType === 'audio' ? 'Audio.mp3' : mediaType === 'image' ? 'Foto.jpg' : mediaType === 'video' ? (body.video?.fileName || 'Video.mp4') : (content.replace(/^📄\s*/, '') || 'Documento.pdf'),
              fileSize: mediaType === 'video' ? (Number(body.video?.fileSize) || 0) : 1024,
              mimeType: mediaType === 'audio' ? 'audio/mpeg' : mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'application/pdf',
            }] : undefined,
            status: 'DELIVERED',
            isInternalNote: false,
            timestamp: messageTimestampIso,
          }],
        });
        next = recordCampaignStop(next, cleanPhone, content, fromMe, messageTimestampIso);
        if (!fromMe) {
          const event = { id: `message:${messageId}`, trigger: 'MESSAGE_RECEIVED' as const, contactId: targetContactId,
            occurredAt: messageTimestampIso, origin: 'WEBHOOK' as const };
          next = enqueueAutomationEvent(next, event);
          if (!existingContact) next = enqueueAutomationEvent(next, { ...event, id: `created:${targetContactId}`, trigger: 'LEAD_CREATED' });
        }
        return automationEnv ? runInternalJobs(next, automationEnv.company, automationEnv.members.map(member => member.id)) : next;
      });
      if (!fromMe && process.env.CAMPAIGNS_ENABLED === 'true') {
        const saved = (await readCRMState(tenantId)).messages.find(message => (message.externalId || message.id) === messageId);
        if (saved?.senderType === 'CONTACT') await recordCampaignReply(tenantId, instanceId, cleanPhone, saved.timestamp);
      }
    }

    await kickQualification(tenantId);
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
