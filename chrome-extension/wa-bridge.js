/**
 * Brokiva — WA Native Bridge (Store & Memory Injection)
 * Permite leitura de Contatos, Histórico de Mensagens e Etiquetas
 * direto da memória interna do WhatsApp Web (WAWebCollections / Store / Webpack Modules).
 */
(function() {
  'use strict';

  if (window.__BROKIVA_WA_BRIDGE_LOADED__) return;
  window.__BROKIVA_WA_BRIDGE_LOADED__ = true;

  let Store = null;
  let isReady = false;
  const isCollection = value => Boolean(value && typeof value !== 'function' &&
    (typeof value.getModelsArray === 'function' || Array.isArray(value.models) || Array.isArray(value._models)));

  // Busca e conecta aos módulos internos do WhatsApp Web
  function initStore() {
    try {
      // Os módulos *Collection antigos podem exportar classes, sem os dados da sessão.
      if (typeof window.require === 'function') {
        try {
          const collections = window.require('WAWebCollections');
          if (isCollection(collections?.Chat)) {
            Store = collections;
            isReady = true;
            return true;
          }
        } catch {}
      }
      if (isCollection(window.Store?.Chat)) {
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

          if (isCollection(Chat)) {
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

          if (isCollection(found.Chat)) {
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
  // FUNÇÕES DE EXTRAÇÃO NATIVA
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
  function canonicalJid(value) {
    if (value && typeof value === 'object') value = value._serialized || value.$1 ||
      (value.user && value.server ? `${value.user}@${value.server}` : '');
    const match = String(value || '').match(/^(\d+)@(c\.us|s\.whatsapp\.net|lid)$/);
    return match ? `${match[1]}@${match[2] === 's.whatsapp.net' ? 'c.us' : match[2]}` : '';
  }
  function phoneJid(value) {
    const jid = canonicalJid(value);
    if (!jid.endsWith('@lid')) return jid;
    try {
      // Mapeamento local do próprio WhatsApp; nunca relaciona LID e telefone por nome.
      return canonicalJid(window.require('WAWebLidMigrationUtils').toPn(value));
    } catch { return ''; }
  }
  function extractChatMessages(targetJid) {
    const messages = [];
    const jid = canonicalJid(targetJid);
    let unreadable = 0;
    const unreadableReasons = {}, unsupportedTypes = Object.create(null);
    const unread = reason => { unreadable++; unreadableReasons[reason] = (unreadableReasons[reason] || 0) + 1; };
    if (!jid || !Store?.Chat) return { jid, messages, unreadable };
    const candidates = getModels(Store.Chat).filter(chat => canonicalJid(chat.id) === jid || phoneJid(chat.id) === jid);
    if (candidates.length !== 1) return { jid, messages, unreadable, coverage: 'LOADED_CACHE_ONLY' };
    const chat = candidates[0];
    const chatJid = canonicalJid(chat.id);
    for (const message of getModels(chat?.msgs)) {
      try {
        const type = message.type || message.__x_type || 'chat';
        if (['e2e_notification', 'notification_template', 'gp2', 'revoked', 'protocol'].includes(type)) continue;
        if (type === 'ciphertext') { unread('ENCRYPTED_MESSAGE'); continue; }
        const sourceKey = message.id || message.__x_id;
        const serialized = typeof sourceKey === 'string' ? sourceKey : sourceKey?._serialized || sourceKey?.$1 || '';
        const serializedMatch = serialized.match(/^(true|false)_([^_]+)_([^_]+)(?:_(?:in|out))?$/);
        const directions = [sourceKey?.fromMe, message.fromMe, message.__x_fromMe,
          ...(serializedMatch ? [serializedMatch[1] === 'true'] : [])].filter(value => typeof value === 'boolean');
        const rawId = sourceKey?.id || serializedMatch?.[3] || (typeof sourceKey === 'string' && /^[a-f0-9]{16,128}$/i.test(sourceKey) ? sourceKey : '');
        const remotes = [sourceKey?.remote, serializedMatch?.[2]].filter(value => value != null);
        if (!rawId || typeof rawId !== 'string' || /[\s_]/.test(rawId) || !directions.length || new Set(directions).size !== 1 ||
            (serializedMatch && serializedMatch[3] !== rawId) ||
            remotes.some(remote => ![chatJid, jid].includes(canonicalJid(remote)))) { unread('NATIVE_IDENTITY_INVALID'); continue; }
        const id = `${directions[0]}_${jid}_${rawId}`;
        const rawTime = Number(message.t || message.__x_t || 0);
        const time = rawTime < 1e12 ? rawTime * 1000 : rawTime;
        if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(new Date(time).getTime())) { unread('NATIVE_DATE_INVALID'); continue; }
        const types = { chat: 'TEXT', audio: 'AUDIO', ptt: 'AUDIO', image: 'IMAGE', document: 'DOCUMENT', video: 'VIDEO', sticker: 'STICKER', location: 'LOCATION' };
        const messageType = types[type];
        if (!messageType) { unread('NATIVE_TYPE_UNSUPPORTED'); const safeType = /^[a-z_]{1,40}$/.test(type) ? type : 'unknown'; unsupportedTypes[safeType] = (unsupportedTypes[safeType] || 0) + 1; continue; }
        const content = message.body || message.__x_body || message.caption || message.__x_caption || '';
        if (typeof content !== 'string') { unread('NATIVE_CONTENT_INVALID'); continue; }
        if (!content && messageType === 'TEXT') { unread('NATIVE_EMPTY_TEXT'); continue; }
        // Blobs locais e URLs de arquivos cifrados não são anexos utilizáveis no CRM.
        messages.push({ id, fromMe: directions[0], content, messageType, timestamp: new Date(time).toISOString(), fileName: message.filename || message.__x_filename || undefined });
      } catch { unread('NATIVE_READ_ERROR'); }
    }
    return { jid, messages, unreadable, unreadableReasons, unsupportedTypes, coverage: 'LOADED_CACHE_ONLY' };
  }

  // -------------------------------------------------------------
  // RECEPTOR DE MENSAGENS DO CONTENT SCRIPT
  // -------------------------------------------------------------
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin || !event.data || !event.data.type) return;
    initStore();

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
      const data = extractChatMessages(event.data.jid);
      window.postMessage({
        type: 'BROKIVA_GET_CHAT_MESSAGES_RESPONSE',
        requestId: event.data.requestId,
        success: isReady,
        ...data,
      }, '*');
    }
  });

  console.log('[Brokiva Bridge] WA Native Bridge carregado com sucesso.');
})();
