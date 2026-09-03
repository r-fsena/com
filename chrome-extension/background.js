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

  if (request.action === 'GET_AI_SUGGESTION') {
    handleGetAiSuggestion(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
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
