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
    await chrome.storage.local.remove(SESSION_KEYS);
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
  const actions = { PAIR_FROM_CRM: () => pairFromCrm(request.data, sender), OPEN_CRM_PAIRING: () => openPairing(request.data), UNPAIR: unpair };
  if (actions[request.action]) {
    actions[request.action]().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'SYNC_BATCH_CHATS') {
    handleBatchSync(request.data)
      .then(result => sendResponse({ success: true, result }))
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

async function handleBatchSync(data) {
  const config = await requireSession();
  const crmUrl = (config.crmUrl || DEFAULT_CRM_URL).replace(/\/+$/, '');
  
  const tenantId = config.tenantId;
  if (!data.context || data.context.tenantId !== tenantId || data.context.brokerUserId !== config.brokerUserId || data.context.crmUrl !== config.crmUrl) throw new Error('O contexto do CRM mudou. Inicie a sincronização novamente.');

  const endpoint = `${crmUrl}/api/v1/sync/extension-history`;

  const payload = {
    tenantId,
    brokerUserId: config.brokerUserId,
    brokerName: config.brokerName,
    chats: data.chats || [],
  };

  handleForwardLog({
    level: 'INFO',
    event: 'DISPATCHING_BATCH_SYNC',
    details: {
      tenantId,
      chatsCount: (data.chats || []).length,
      samplePhone: data.chats?.[0]?.phone,
      sampleName: data.chats?.[0]?.name,
      sampleMsgs: data.chats?.[0]?.messages?.length,
    }
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };
  if (config.extensionSessionToken) {
    headers['Authorization'] = `Bearer ${config.extensionSessionToken}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    handleForwardLog({
      level: 'ERROR',
      event: 'BATCH_SYNC_HTTP_ERROR',
      details: { status: response.status, errorText }
    });
    if (response.status === 401) await unpair();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  handleForwardLog({
    level: 'INFO',
    event: 'BATCH_SYNC_SUCCESS_ACK',
    details: result
  });

  const current = await chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl']);
  if (current.tenantId !== tenantId || current.brokerUserId !== config.brokerUserId || current.crmUrl !== crmUrl) return result;

  // Salva no storage local da extensão como lote recente para entrega resiliente ao CRM
  try {
    await chrome.storage.local.set({
      brokivaPendingCrmSync: {
        timestamp: Date.now(),
        tenantId,
        messages: result.resultMessages || [],
        contacts: result.resultContacts || [],
        conversations: result.resultConversations || [],
      }
    });
  } catch (err) {}

  // Notifica abas do CRM abertas para injetar as mensagens instantaneamente na tela
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!Array.isArray(tabs)) return;
      tabs.forEach(tab => {
        try {
          if (tab.url && new URL(tab.url).origin === crmUrl) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'BROKIVA_NEW_SYNCED_MESSAGES',
              data: {
                tenantId,
                messages: result.resultMessages || [],
                contacts: result.resultContacts || [],
                conversations: result.resultConversations || [],
              }
            }).catch(() => {});
          }
        } catch (_) {}
      });
    });
  } catch (err) {}

  return result;
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
