/**
 * Brokiva — WA Native Bridge (Store & Memory Injection)
 * Permite extração em tempo constante O(1) de Contatos, Histórico de Mensagens e Etiquetas
 * direto da memória interna do WhatsApp Web (WAWebCollections / Store / Webpack Modules).
 */
(function() {
  'use strict';

  if (window.__BROKIVA_WA_BRIDGE_LOADED__) return;
  window.__BROKIVA_WA_BRIDGE_LOADED__ = true;

  let Store = null;
  let isReady = false;

  // Busca e conecta aos módulos internos do WhatsApp Web
  function initStore() {
    try {
      if (window.Store && window.Store.Chat) {
        Store = window.Store;
        isReady = true;
        return true;
      }

      // 1. Tenta carregar via require global clássico do WA Web
      if (typeof window.require === 'function') {
        try {
          const Chat = window.require('WAWebChatCollection')?.ChatCollection;
          const Contact = window.require('WAWebContactCollection')?.ContactCollection;
          const Msg = window.require('WAWebMsgCollection')?.MsgCollection;
          const Label = window.require('WAWebLabelCollection')?.LabelCollection;

          if (Chat || Contact) {
            Store = {
              Chat: Chat || window.require('WAWebChatCollection'),
              Contact: Contact || window.require('WAWebContactCollection'),
              Msg: Msg || window.require('WAWebMsgCollection'),
              Label: Label || window.require('WAWebLabelCollection'),
            };
            window.Store = Store;
            isReady = true;
            return true;
          }
        } catch {}
      }

      // 2. Tenta extrair módulos via webpackChunkwhatsapp_web_client
      if (Array.isArray(window.webpackChunkwhatsapp_web_client)) {
        let webpackRequire = null;
        window.webpackChunkwhatsapp_web_client.push([
          [Math.random()],
          {},
          (r) => { webpackRequire = r; }
        ]);

        if (webpackRequire && webpackRequire.m) {
          const modules = Object.keys(webpackRequire.m);
          const found = {};

          for (const modId of modules) {
            try {
              const mod = webpackRequire(modId);
              if (!mod) continue;

              if (!found.Chat && (mod.ChatCollection || mod.default?.ChatCollection)) {
                found.Chat = mod.ChatCollection || mod.default.ChatCollection;
              }
              if (!found.Contact && (mod.ContactCollection || mod.default?.ContactCollection)) {
                found.Contact = mod.ContactCollection || mod.default.ContactCollection;
              }
              if (!found.Msg && (mod.MsgCollection || mod.default?.MsgCollection)) {
                found.Msg = mod.MsgCollection || mod.default.MsgCollection;
              }
              if (!found.Label && (mod.LabelCollection || mod.default?.LabelCollection)) {
                found.Label = mod.LabelCollection || mod.default.LabelCollection;
              }
              if (!found.ProfilePic && (mod.profilePic || mod.getProfilePicThumb)) {
                found.ProfilePic = mod;
              }
            } catch {}

            if (found.Chat && found.Contact) break;
          }

          if (found.Chat || found.Contact) {
            Store = found;
            window.Store = found;
            isReady = true;
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('[Brokiva Bridge] Tentativa de inicialização do Store:', err);
    }
    return false;
  }

  // Tenta conectar imediatamente e repete periodicamente até o WhatsApp carregar completamente
  initStore();
  const initInterval = setInterval(() => {
    if (initStore()) {
      clearInterval(initInterval);
      window.postMessage({ type: 'BROKIVA_BRIDGE_READY' }, '*');
    }
  }, 1000);

  setTimeout(() => clearInterval(initInterval), 60000); // 1 minuto de limite

  // -------------------------------------------------------------
  // FUNÇÕES DE EXTRAÇÃO NATIVA EM O(1)
  // -------------------------------------------------------------

  function getModels(collection) {
    if (!collection) return [];
    if (typeof collection.getModelsArray === 'function') return collection.getModelsArray();
    if (Array.isArray(collection._models)) return collection._models;
    if (Array.isArray(collection.models)) return collection.models;
    return [];
  }

  // 1. Extração de Etiquetas (WhatsApp Business Labels)
  function extractLabels() {
    const results = [];
    if (!Store || !Store.Label) return results;

    const labelModels = getModels(Store.Label);
    labelModels.forEach(lbl => {
      if (!lbl) return;
      results.push({
        id: String(lbl.id || lbl.__x_id || ''),
        name: String(lbl.name || lbl.__x_name || ''),
        hexColor: String(lbl.hexColor || lbl.__x_hexColor || lbl.color || '#3b82f6'),
        count: Number(lbl.count || lbl.__x_count || 0),
      });
    });

    return results;
  }

  // 2. Extração de Contatos da Agenda do Celular
  function extractContacts() {
    const results = [];
    if (!Store || !Store.Contact) return results;

    const contactModels = getModels(Store.Contact);
    contactModels.forEach(c => {
      if (!c) return;
      const jid = c.id?._serialized || c.id || '';
      if (!jid || jid.includes('@g.us') || jid.includes('@broadcast') || jid.includes('@newsletter')) {
        return;
      }

      const rawPhone = jid.replace(/@.*$/, '').replace(/\D/g, '');
      const name = c.name || c.__x_name || c.pushname || c.__x_pushname || c.formattedName || '';
      const isMyContact = Boolean(c.isMyContact || c.__x_isMyContact);
      const isBusiness = Boolean(c.isBusiness || c.__x_isBusiness);

      results.push({
        jid,
        phone: rawPhone,
        name: name.trim(),
        pushname: (c.pushname || c.__x_pushname || '').trim(),
        isMyContact,
        isBusiness,
        profilePicUrl: c.profilePicThumb?.img || c.profilePicThumb?.__x_img || null,
      });
    });

    return results;
  }

  // 3. Extração de Chats & Conversas com Etiquetas Nativas
  function extractChats() {
    const results = [];
    if (!Store || !Store.Chat) return results;

    const labelsList = extractLabels();
    const labelMap = new Map();
    labelsList.forEach(l => labelMap.set(l.id, l.name));

    const chatModels = getModels(Store.Chat);
    chatModels.forEach(chat => {
      if (!chat) return;
      const jid = chat.id?._serialized || chat.id || '';
      if (!jid || jid.includes('@g.us') || jid.includes('@broadcast') || jid.includes('@newsletter')) {
        return;
      }

      const rawPhone = jid.replace(/@.*$/, '').replace(/\D/g, '');
      const rawLabels = chat.labels || chat.__x_labels || [];
      const labelNames = [];

      if (Array.isArray(rawLabels)) {
        rawLabels.forEach(lid => {
          const sLid = String(lid);
          const name = labelMap.get(sLid) || sLid;
          if (name) labelNames.push(name);
        });
      }

      // Última mensagem
      const lastMsg = chat.lastReceivedKey?._serialized ? chat.msgs?.last() : null;
      let previewText = '';
      if (lastMsg) {
        previewText = lastMsg.body || lastMsg.__x_body || lastMsg.caption || lastMsg.__x_caption || '';
      }

      const timestamp = chat.t || chat.__x_t || 0;

      results.push({
        jid,
        phone: rawPhone,
        name: (chat.name || chat.__x_name || chat.formattedTitle || '').trim(),
        unreadCount: Number(chat.unreadCount || chat.__x_unreadCount || 0),
        labels: labelNames,
        lastMessagePreview: previewText,
        lastMessageTimestamp: timestamp ? timestamp * 1000 : Date.now(),
        isPinned: Boolean(chat.pin || chat.__x_pin),
      });
    });

    return results;
  }

  // 4. Extração de Mensagens de um Chat Específico em Memória
  function extractChatMessages(targetPhone, limit = 50) {
    const results = [];
    if (!Store || !Store.Chat) return results;

    const clean = String(targetPhone).replace(/\D/g, '');
    const chatModels = getModels(Store.Chat);
    const chat = chatModels.find(c => {
      const jid = c.id?._serialized || c.id || '';
      return jid.includes(clean);
    });

    if (!chat || !chat.msgs) return results;

    const msgModels = getModels(chat.msgs);
    const sliced = msgModels.slice(-limit);

    sliced.forEach(m => {
      if (!m) return;
      const isFromMe = Boolean(m.id?.fromMe || m.fromMe || m.__x_fromMe);
      const text = m.body || m.__x_body || m.caption || m.__x_caption || '';
      const type = m.type || m.__x_type || 'chat';
      const timestamp = (m.t || m.__x_t || 0) * 1000 || Date.now();

      let messageType = 'TEXT';
      if (type === 'audio' || type === 'ptt') messageType = 'AUDIO';
      else if (type === 'image') messageType = 'IMAGE';
      else if (type === 'document') messageType = 'DOCUMENT';
      else if (type === 'video') messageType = 'VIDEO';

      results.push({
        id: m.id?._serialized || m.id || `wa-msg-${Date.now()}-${Math.random()}`,
        fromMe: isFromMe,
        content: text,
        messageType,
        timestamp,
        mediaUrl: m.mediaData?.url || null,
        fileName: m.filename || m.__x_filename || null,
      });
    });

    return results;
  }

  // -------------------------------------------------------------
  // RECEPTOR DE MENSAGENS DO CONTENT SCRIPT
  // -------------------------------------------------------------
  window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'BROKIVA_PING_BRIDGE') {
      window.postMessage({
        type: 'BROKIVA_PONG_BRIDGE',
        isReady,
      }, '*');
      return;
    }

    if (event.data.type === 'BROKIVA_GET_ALL_DATA') {
      const labels = extractLabels();
      const contacts = extractContacts();
      const chats = extractChats();

      window.postMessage({
        type: 'BROKIVA_GET_ALL_DATA_RESPONSE',
        requestId: event.data.requestId,
        success: isReady,
        data: {
          labels,
          contacts,
          chats,
        }
      }, '*');
      return;
    }

    if (event.data.type === 'BROKIVA_GET_CHAT_MESSAGES') {
      const messages = extractChatMessages(event.data.phone, event.data.limit || 50);
      window.postMessage({
        type: 'BROKIVA_GET_CHAT_MESSAGES_RESPONSE',
        requestId: event.data.requestId,
        phone: event.data.phone,
        success: isReady,
        messages,
      }, '*');
    }
  });

  console.log('[Brokiva Bridge] WA Native Bridge carregado com sucesso.');
})();
