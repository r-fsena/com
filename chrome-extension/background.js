importScripts('import-core.js');
/**
 * Background Service Worker - Brokiva CRM Sync
 */

const DEFAULT_CRM_URL = 'https://crm.faithhubs.com';
const SESSION_KEYS = ['extensionSessionToken', 'extensionSessionExpiresAt', 'tenantId', 'tenantName', 'brokerUserId', 'brokerName', 'brokerEmail', 'isPaired', 'brokivaCrmContacts', 'brokivaPendingCrmSync', 'brokiva_lid_phone_map'];
function crmOrigin(raw = DEFAULT_CRM_URL) {
  const url = new URL(raw);
  if (url.origin !== 'https://crm.faithhubs.com' && url.origin !== 'http://localhost:3000') throw new Error('Servidor do CRM não autorizado.');
  return url.origin;
}
async function requireSession() {
  const config = await chrome.storage.local.get(['crmUrl', 'extensionSessionToken', 'extensionSessionExpiresAt', 'tenantId', 'brokerUserId', 'brokerName', 'brokerEmail']);
  if (!config.extensionSessionToken || (!Number.isFinite(config.extensionSessionExpiresAt) || config.extensionSessionExpiresAt <= Date.now() / 1000) || !config.tenantId || !config.brokerUserId) {
    await chrome.storage.local.remove(['extensionSessionToken', 'extensionSessionExpiresAt', 'isPaired']);
    throw new Error('Sessão expirada. Entre e pareie novamente pelo CRM.');
  }
  config.crmUrl = crmOrigin(config.crmUrl);
  return config;
}
async function unpair() { await chrome.storage.local.remove(SESSION_KEYS); return { success: true }; }
async function openPairing(data) {
  const origin = crmOrigin(data?.crmUrl || DEFAULT_CRM_URL);
  await chrome.tabs.create({ url: `${origin}/?pairExtension=1` });
  return { success: true };
}
async function pairFromCrm(data, sender) {
  if (!sender.tab?.url) throw new Error('Pareamento permitido apenas na aba autenticada do CRM.');
  const origin = crmOrigin(sender.tab.url);
  if (!data?.token || !data.user?.tenantId || !data.user?.userId || data.expiresAt <= Date.now() / 1000) throw new Error('Sessão inválida.');
  // Confirma o token no servidor, sem confiar no payload da página.
  const response = await fetch(`${origin}/api/v1/auth/session`, { headers: { Authorization: `Bearer ${data.token}` } });
  if (!response.ok) throw new Error('Não foi possível verificar a sessão.');
  const { user } = await response.json();
  const previous = await chrome.storage.local.get(['crmUrl', 'tenantId', 'brokerUserId']);
  if (previous.crmUrl !== origin || previous.tenantId !== user.tenantId || previous.brokerUserId !== user.userId) await unpair();
  await chrome.storage.local.set({ crmUrl: origin, extensionSessionToken: data.token, extensionSessionExpiresAt: user.expiresAt,
    brokerUserId: user.userId, brokerName: user.userName, brokerEmail: user.userEmail,
    tenantId: user.tenantId, tenantName: data.user.tenantName || user.tenantId, isPaired: true });
  void retryImports().catch(() => {});
  return { success: true };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['crmUrl', 'tenantId'], (res) => {
    if (!res.crmUrl) {
      chrome.storage.local.set({ crmUrl: DEFAULT_CRM_URL });
    }
    chrome.storage.local.get(['extensionSessionExpiresAt'], current => { if (!current.extensionSessionExpiresAt) unpair(); });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const actions = { RETRY_IMPORTS: () => retryImports(true), IMPORT_STATUS: importStatus, PAIR_FROM_CRM: () => pairFromCrm(request.data, sender), OPEN_CRM_PAIRING: () => openPairing(request.data), UNPAIR: unpair };
  if (actions[request.action]) {
    actions[request.action]().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'SYNC_BATCH_CHATS') {
    handleBatchSync(request.data)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Mantém porta aberta para resposta assíncrona
  }

  if (request.action === 'LOG_EVENT') {
    handleForwardLog(request.data);
    return false;
  }

  if (request.action === 'GET_AI_SUGGESTION') {
    handleGetAiSuggestion(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'RESOLVE_CONTACT_BY_NAME') {
    handleResolveContact(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'CONVERT_IMAGE_TO_DATA_URL') {
    convertUrlToDataUrl(request.data?.url)
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }


});

async function convertUrlToDataUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    return '';
  }
}

async function handleForwardLog(logData) {
  try {
    const config = await requireSession();
    const crmUrl = config.crmUrl || DEFAULT_CRM_URL;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (config.extensionSessionToken) {
      headers['Authorization'] = `Bearer ${config.extensionSessionToken}`;
    }
    fetch(`${crmUrl}/api/v1/telemetry/extension-logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        timestamp: Date.now(),
        tenantId: config.tenantId,
        brokerName: config.brokerName || 'Corretor',
        ...logData,
      }),
    }).catch(() => {});
  } catch {}
}

const OUTBOX_KEY = 'brokivaImportOutboxV2';
let importLock = Promise.resolve();
function serialImport(task) {
  const result = importLock.then(task, task);
  importLock = result.catch(() => {});
  return result;
}
async function importStatus() {
  const config = await chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl', OUTBOX_KEY, 'brokivaLastImportReport']);
  const items = (config[OUTBOX_KEY] || []).filter(item => BrokivaImport.sameContext(item.context, config));
  return { success: true, report: BrokivaImport.sameContext(config.brokivaLastImportReport?.context, config) ? config.brokivaLastImportReport : null, pendingBatches: items.length, pendingMessages: items.reduce((n, item) => n + item.payload.chats.reduce((total, chat) => total + chat.messages.length, 0), 0), lastError: items.find(item => item.error)?.error || '' };
}
async function sendPendingImports(force = false) {
  let queue = (await chrome.storage.local.get([OUTBOX_KEY]))[OUTBOX_KEY] || [];
  const config = await requireSession();
  const results = new Map();
  for (const item of queue.slice()) {
    if (!BrokivaImport.sameContext(item.context, config) || (!force && item.nextAttemptAt > Date.now())) continue;
    const current = await chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl']);
    if (!BrokivaImport.sameContext(item.context, current)) break;
    try {
      const response = await fetch(`${config.crmUrl}/api/v1/sync/extension-history`, {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': config.tenantId, Authorization: `Bearer ${config.extensionSessionToken}` },
        body: JSON.stringify(item.payload),
      });
      if (!response.ok) {
        if (response.status === 401) await chrome.storage.local.remove(['extensionSessionToken', 'extensionSessionExpiresAt', 'isPaired']);
        throw new Error(`CRM HTTP ${response.status}. Lote preservado para nova tentativa.`);
      }
      const result = await response.json();
      BrokivaImport.verifyReceipt(result, item);
      queue = queue.filter(candidate => candidate.id !== item.id);
      // Se o worker parar depois do commit remoto, repetir é seguro pelo ID original.
      await chrome.storage.local.set({ [OUTBOX_KEY]: queue });
      results.set(item.id, result);
      const active = await chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl']);
      if (BrokivaImport.sameContext(item.context, active)) {
        const pending = { timestamp: Date.now(), tenantId: config.tenantId, messages: result.resultMessages || [], contacts: result.resultContacts || [], conversations: result.resultConversations || [] };
        // A notificação à tela é opcional; o recibo de gravação já foi validado.
        await chrome.storage.local.set({ brokivaPendingCrmSync: pending }).catch(() => {});
        chrome.tabs.query({}, tabs => (tabs || []).forEach(tab => {
          try { if (new URL(tab.url).origin === config.crmUrl) chrome.tabs.sendMessage(tab.id, { action: 'BROKIVA_NEW_SYNCED_MESSAGES', data: pending }).catch(() => {}); } catch {}
        }));
      }
    } catch (error) {
      item.attempts = (item.attempts || 0) + 1;
      item.error = error.message;
      item.nextAttemptAt = Date.now() + Math.min(300000, 5000 * 2 ** Math.min(item.attempts, 6));
      await chrome.storage.local.set({ [OUTBOX_KEY]: queue });
      break; // Preserva ordem e evita uma sequência de erros durante indisponibilidade.
    }
  }
  return results;
}
function retryImports(force = false) {
  return serialImport(async () => { await sendPendingImports(force); return importStatus(); });
}
async function handleBatchSync(data) {
  return serialImport(async () => {
    // Identidade é fixada no início da leitura; nunca se adota a conta que apareceu depois.
    const config = await chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl', OUTBOX_KEY]);
    config.crmUrl = crmOrigin(config.crmUrl);
    if (!config.tenantId || !config.brokerUserId || !BrokivaImport.sameContext(data.context, config)) throw new Error('O contexto do CRM mudou. Refaça o pareamento na conta original.');
    const chunks = BrokivaImport.chunkChats(data.chats);
    const items = chunks.map(chats => {
      const id = crypto.randomUUID();
      const context = { tenantId: config.tenantId, brokerUserId: config.brokerUserId, crmUrl: config.crmUrl };
      return { id, context, createdAt: Date.now(), payload: { protocol: 2, batchId: id, tenantId: config.tenantId, chats } };
    });
    const queue = [...(config[OUTBOX_KEY] || []), ...items];
    if (BrokivaImport.bytes(queue) > 6 * 1024 * 1024) throw new Error('A fila local está cheia. Retome os envios pendentes antes de ler mais conversas.');
    await chrome.storage.local.set({ [OUTBOX_KEY]: queue });
    let results = new Map();
    try { results = await sendPendingImports(); } catch {}
    const remaining = (await chrome.storage.local.get([OUTBOX_KEY]))[OUTBOX_KEY] || [];
    const pendingIds = new Set(remaining.map(item => item.id));
    const confirmedMessages = items.filter(item => !pendingIds.has(item.id)).reduce((n, item) => n + item.payload.chats.reduce((sum, c) => sum + c.messages.length, 0), 0);
    return { success: items.every(item => !pendingIds.has(item.id)), queued: true, confirmedMessages,
      confirmedIds: items.filter(item => !pendingIds.has(item.id)).flatMap(item => item.payload.chats.flatMap(chat => chat.messages.map(message => message.id))),
      pendingMessages: items.reduce((n, item) => n + item.payload.chats.reduce((sum, c) => sum + c.messages.length, 0), 0) - confirmedMessages,
      error: remaining.find(item => items.some(own => own.id === item.id))?.error || 'Entre no CRM para retomar os envios pendentes.',
      results: Array.from(results.values()) };
  });
}
chrome.alarms?.onAlarm.addListener(alarm => { if (alarm.name === 'brokiva-import-retry') void retryImports().catch(() => {}); });
if (chrome.alarms) {
  chrome.alarms.create('brokiva-import-retry', { periodInMinutes: 1 });
  void retryImports().catch(() => {});
}

async function handleGetAiSuggestion(data) {
  const config = await requireSession();
  const crmUrl = config.crmUrl || DEFAULT_CRM_URL;

  const endpoint = `${crmUrl}/api/v1/ai/copilot`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.extensionSessionToken) {
    headers['Authorization'] = `Bearer ${config.extensionSessionToken}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chatHistory: data.chatHistory || [],
      brokerName: config.brokerName || 'Corretor',
      contactContext: data.contactContext || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha na Brok.ia: HTTP ${response.status}`);
  }

  return await response.json();
}

async function handleResolveContact({ name, lid }) {
  const config = await requireSession();
  const crmUrl = config.crmUrl;
  const normName = name ? name.toLowerCase().trim() : '';
  const cleanL = lid ? String(lid).replace(/@.*$/, '').replace(/\D/g, '') : '';

  // 1. Checa mapa persistente de LID <-> Telefone
  try {
    const storage = await chrome.storage.local.get(['brokiva_lid_phone_map', 'brokivaCrmContacts']);
    const lidMap = storage.brokiva_lid_phone_map || {};
    if (cleanL && lidMap[cleanL]) {
      const p = lidMap[cleanL];
      return { phone: p, lid: cleanL, name: name || 'Contato' };
    }

    // 2. Checa contatos sincronizados pelo crm-bridge por LID ou Nome
    const cached = (storage.brokivaCrmContacts || []).filter(c => c.tenantId === config.tenantId);
    if (Array.isArray(cached) && cached.length > 0) {
      if (cleanL) {
        const foundByLid = cached.find(c => (c.lid && c.lid.replace(/\D/g, '') === cleanL) || (c.phone && c.phone.replace(/\D/g, '') === cleanL));
        if (foundByLid && foundByLid.phone) {
          const clean = foundByLid.phone.replace(/\D/g, '');
          if (clean.length >= 10 && clean.length <= 13) {
            return { phone: clean, lid: cleanL, name: foundByLid.name || name };
          }
        }
      }

      if (normName) {
        const found = cached.find(c => c.name && c.name.toLowerCase().trim() === normName);
        if (found && found.phone) {
          const clean = found.phone.replace(/\D/g, '');
          if (clean.length >= 10 && clean.length <= 13) {
            return { phone: clean, lid: found.lid || lid, name: found.name };
          }
        }
      }
    }
  } catch (e) {}

  // 2. Consulta abas ativas do CRM via crm-bridge
  try {
    const tabs = await new Promise(r => chrome.tabs.query({}, r));
    for (const tab of tabs) {
      if (tab.url && new URL(tab.url).origin === crmUrl) {
        try {
          const res = await new Promise(r => {
            chrome.tabs.sendMessage(tab.id, { action: 'GET_CRM_CONTACTS', tenantId: config.tenantId }, resp => {
              if (chrome.runtime.lastError) r(null);
              else r(resp);
            });
          });
          if (res && Array.isArray(res.contacts)) {
            chrome.storage.local.set({ brokivaCrmContacts: res.contacts });
            const found = res.contacts.filter(c => c.tenantId === config.tenantId).find(c => c.name && c.name.toLowerCase().trim() === normName);
            if (found && found.phone) {
              const clean = found.phone.replace(/\D/g, '');
              if (clean.length >= 10 && clean.length <= 13) {
                return { phone: clean, lid: found.lid || lid, name: found.name };
              }
            }
          }
        } catch (err) {}
      }
    }
  } catch (err) {}

  return null;
}
