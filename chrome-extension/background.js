/**
 * Background Service Worker - Brokiva CRM Sync
 */

const DEFAULT_CRM_URL = 'https://crm.faithhubs.com';
const DEFAULT_TENANT_ID = 'tenant-amabile-barbarotti';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['crmUrl', 'tenantId'], (res) => {
    if (!res.crmUrl) {
      chrome.storage.local.set({ crmUrl: DEFAULT_CRM_URL });
    }
    if (!res.tenantId) {
      chrome.storage.local.set({ tenantId: DEFAULT_TENANT_ID });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});

async function handleForwardLog(logData) {
  try {
    const config = await chrome.storage.local.get(['crmUrl', 'tenantId', 'brokerName']);
    const crmUrl = config.crmUrl || DEFAULT_CRM_URL;
    fetch(`${crmUrl}/api/v1/telemetry/extension-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        tenantId: config.tenantId || DEFAULT_TENANT_ID,
        brokerName: config.brokerName || 'Corretor',
        ...logData,
      }),
    }).catch(() => {});
  } catch {}
}

async function handleBatchSync(data) {
  const config = await chrome.storage.local.get(['crmUrl', 'tenantId', 'brokerUserId', 'brokerName']);
  const crmUrl = config.crmUrl || DEFAULT_CRM_URL;
  const tenantId = config.tenantId || DEFAULT_TENANT_ID;

  const endpoint = `${crmUrl}/api/v1/sync/extension-history`;

  const payload = {
    tenantId,
    brokerUserId: config.brokerUserId || undefined,
    brokerName: config.brokerName || 'Corretor',
    chats: data.chats || [],
  };

  handleForwardLog({
    level: 'INFO',
    event: 'DISPATCHING_BATCH_SYNC',
    details: {
      chatsCount: (data.chats || []).length,
      samplePhone: data.chats?.[0]?.phone,
      sampleName: data.chats?.[0]?.name,
      sampleMsgs: data.chats?.[0]?.messages?.length,
    }
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    handleForwardLog({
      level: 'ERROR',
      event: 'BATCH_SYNC_HTTP_ERROR',
      details: { status: response.status, errorText }
    });
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  handleForwardLog({
    level: 'INFO',
    event: 'BATCH_SYNC_SUCCESS_ACK',
    details: result
  });

  return result;
}

async function handleGetAiSuggestion(data) {
  const config = await chrome.storage.local.get(['crmUrl', 'brokerName']);
  const crmUrl = config.crmUrl || DEFAULT_CRM_URL;

  const endpoint = `${crmUrl}/api/v1/ai/copilot`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatHistory: data.chatHistory || [],
      brokerName: config.brokerName || 'Corretor',
      contactContext: data.contactContext || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha no Copiloto IA: HTTP ${response.status}`);
  }

  return await response.json();
}
