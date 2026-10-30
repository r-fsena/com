/** Funções compartilhadas pelo coletor, worker e testes. Sem acesso à rede ou ao DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrokivaImport = api;
})(typeof self !== 'undefined' ? self : globalThis, () => {
  'use strict';
  function canonicalJid(value) {
    const match = String(value || '').match(/(\d+)@(c\.us|s\.whatsapp\.net|lid)/);
    return match ? `${match[1]}@${match[2] === 's.whatsapp.net' ? 'c.us' : match[2]}` : '';
  }
  function messageIdentity(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(/^(true|false)_([^_]+)_(.+)$/);
    const jid = match && canonicalJid(match[2]);
    return jid ? { id: value, jid, fromMe: match[1] === 'true' } : null;
  }
  const normalizedName = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  function rawMessageIdentity(rawId, jid, sender, contactName, brokerName, explicitDirection = null) {
    if (!/^[a-f0-9]{16,128}$/i.test(rawId) || !canonicalJid(jid)) return null;
    const name = normalizedName(sender);
    const incoming = name && name === normalizedName(contactName);
    const outgoing = name && (name === normalizedName(brokerName) || ['voce', 'you'].includes(name));
    if (incoming && outgoing) return null;
    let fromMe = incoming ? false : outgoing ? true : explicitDirection;
    if (typeof fromMe !== 'boolean') return null;
    if (typeof explicitDirection === 'boolean' && (incoming || outgoing) && fromMe !== explicitDirection) return null;
    return messageIdentity(`${fromMe}_${canonicalJid(jid)}_${rawId}`);
  }
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  function chunkChats(chats, maxMessages = 150, maxBytes = 384 * 1024) {
    if (!Array.isArray(chats) || !chats.length) throw new Error('Nenhuma conversa para importar.');
    const chunks = [];
    for (const chat of chats) {
      if (!chat.phone || !Array.isArray(chat.messages) || !chat.messages.length) throw new Error('Conversa sem identificação ou sem mensagens lidas.');
      const seen = new Map();
      const messages = [];
      for (const raw of chat.messages) {
        if (raw.timestampEstimated) throw new Error('Data da mensagem não confirmada no WhatsApp. Releia a conversa.');
        if (typeof raw.id !== 'string' || !raw.id || typeof raw.fromMe !== 'boolean' || !Number.isFinite(Date.parse(raw.timestamp))) throw new Error('Mensagem sem ID, direção ou data verificável. Releia a conversa.');
        const identity = messageIdentity(raw.id);
        if (!identity || identity.fromMe !== raw.fromMe || (identity.jid.endsWith('@lid') ? canonicalJid(chat.lid) !== identity.jid : identity.jid.split('@')[0] !== String(chat.phone).replace(/\D/g, ''))) throw new Error('Mensagem e contato não correspondem à mesma conversa.');
        const message = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== null && value !== undefined));
        const prior = seen.get(message.id);
        if (prior && (prior.content !== message.content || prior.fromMe !== message.fromMe)) throw new Error('ID de mensagem conflitante. Importação interrompida.');
        if (!prior) messages.push(message);
        seen.set(message.id, message);
      }
      const metadata = Object.fromEntries(Object.entries(chat).filter(([key, value]) => key !== 'messages' && value !== null && value !== undefined));
      let part = [];
      for (const message of messages) {
        const candidate = { ...metadata, messages: [...part, message] };
        if (part.length && (part.length >= maxMessages || bytes(candidate) > maxBytes)) {
          chunks.push([{ ...metadata, messages: part }]); part = [];
        }
        if (bytes({ ...metadata, messages: [message] }) > maxBytes) throw new Error('Uma mensagem ou foto excede o limite do lote. Nenhum dado deste envio foi descartado.');
        part.push(message);
      }
      if (part.length) chunks.push([{ ...metadata, messages: part }]);
    }
    return chunks;
  }
  function verifyReceipt(result, item) {
    const expected = item.payload.chats.flatMap(chat => chat.messages.map(m => m.id));
    const ids = result?.receipt?.messageIds;
    if (result?.success !== true || result.tenantId !== item.context.tenantId || result.receipt?.protocol !== 2 || result.receipt.batchId !== item.id || !Array.isArray(ids) || ids.length !== expected.length || new Set(ids).size !== expected.length || expected.some(id => !ids.includes(id))) {
      throw new Error('O CRM não confirmou todas as mensagens deste lote. O envio permanece pendente; confira a atualização do backend.');
    }
    return expected.length;
  }
  function sameContext(a, b) {
    return a?.tenantId === b?.tenantId && a?.brokerUserId === b?.brokerUserId && a?.crmUrl === b?.crmUrl;
  }
  /** Cada passo preserva sobreposição do viewport; estabilidade sem prova de início é parcial. */
  async function walkHistory(adapter, options = {}) {
    const maxSteps = options.maxSteps || 1600;
    const maxDurationMs = options.maxDurationMs || 20 * 60 * 1000;
    const start = Date.now();
    let stable = 0;
    for (let step = 0; step < maxSteps; step++) {
      if (adapter.cancelled()) return { complete: false, reason: 'CANCELLED', steps: step };
      if (Date.now() - start >= maxDurationMs) return { complete: false, reason: 'TIME_LIMIT', steps: step };
      adapter.assertChat();
      const before = await adapter.capture();
      if (step % 20 === 0 && adapter.checkpoint) await adapter.checkpoint();
      if (adapter.atStart() && adapter.startConfirmed() && !adapter.loading()) return { complete: true, reason: 'AVAILABLE_START', steps: step };
      await adapter.moveUp();
      await adapter.wait();
      adapter.assertChat();
      const after = await adapter.capture();
      const stopped = adapter.atStart() && before === after && !adapter.loading();
      stable = stopped ? stable + 1 : 0;
      if (stable >= (options.stableAttempts || 8)) return { complete: false, reason: 'UNCONFIRMED_BOUNDARY', steps: step + 1 };
      options.onProgress?.(step + 1, maxSteps);
    }
    return { complete: false, reason: 'STEP_LIMIT', steps: maxSteps };
  }
  /** Busca páginas anteriores e, uma vez, pede dados ao telefone. Resposta vazia não prova início. */
  async function recoverEarlierHistory(adapter, options = {}) {
    const started = Date.now(), maxPages = options.maxPages || 200;
    const maxDurationMs = options.maxDurationMs || 20 * 60 * 1000;
    let phoneStatus = 'NOT_REQUESTED', idle = 0, added = 0;
    for (let page = 0; page < maxPages; page++) {
      if (adapter.cancelled()) return { complete: false, reason: 'CANCELLED', phoneStatus, pages: page, added };
      if (Date.now() - started >= maxDurationMs) return { complete: false, reason: 'TIME_LIMIT', phoneStatus, pages: page, added };
      adapter.assertChat();
      const response = await adapter.load();
      if (adapter.cancelled()) return { complete: false, reason: 'CANCELLED', phoneStatus, pages: page, added };
      if (Date.now() - started >= maxDurationMs) return { complete: false, reason: 'TIME_LIMIT', phoneStatus, pages: page, added };
      adapter.assertChat();
      if (!response.success) return { complete: false, reason: response.timeout ? 'NATIVE_HISTORY_TIMEOUT' : 'NATIVE_HISTORY_UNAVAILABLE', phoneStatus, pages: page, added };
      const fresh = await adapter.apply(response);
      adapter.assertChat();
      if (fresh > 0) {
        added += fresh; idle = 0;
        await adapter.checkpoint(); adapter.onProgress?.(page + 1); await adapter.wait();
        continue;
      }
      if (phoneStatus === 'NOT_REQUESTED') {
        const request = await adapter.requestPhone();
        adapter.assertChat();
        phoneStatus = request.status || 'UNAVAILABLE';
        if (!request.success) return { complete: false, reason: 'PHONE_HISTORY_UNCONFIRMED', phoneStatus, pages: page + 1, added };
        if (!['REQUESTED', 'ALREADY_REQUESTED'].includes(phoneStatus)) return { complete: false, reason: 'PHONE_HISTORY_UNAVAILABLE', phoneStatus, pages: page + 1, added };
      }
      if (++idle >= (options.phoneWaitAttempts || 15)) return { complete: false, reason: 'PHONE_HISTORY_WAIT', phoneStatus, pages: page + 1, added };
      adapter.onProgress?.(page + 1); await adapter.wait();
    }
    return { complete: false, reason: 'STEP_LIMIT', phoneStatus, pages: maxPages, added };
  }
  return { canonicalJid, messageIdentity, rawMessageIdentity, bytes, chunkChats, verifyReceipt, sameContext, walkHistory, recoverEarlierHistory };
});
