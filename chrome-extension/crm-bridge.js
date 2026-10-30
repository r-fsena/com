/** Pareamento explícito, renovação de sessão e notificações restritas à imobiliária de origem. */
let pairing = false;
let bridgeStopped = false;
let refreshing = false;
let refreshInterval;
const bridgeAbort = new AbortController();

function stopBridge() {
  if (bridgeStopped) return;
  bridgeStopped = true;
  bridgeAbort.abort();
  clearInterval(refreshInterval);
  window.removeEventListener('focus', requestRefresh);
  try { chrome.runtime.onMessage.removeListener(onBridgeMessage); } catch {}
  if (document.body && !document.getElementById('brokiva-crm-reload-notice')) {
    const notice = document.createElement('div');
    notice.id = 'brokiva-crm-reload-notice'; notice.setAttribute('role', 'alert');
    notice.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:360px;padding:16px;border-radius:12px;background:#312e81;color:white;font:14px system-ui;box-shadow:0 4px 20px #0004';
    const text = document.createElement('p');
    text.textContent = 'A Brokiva foi atualizada. Recarregue esta aba do CRM para renovar a conexão. Seus envios pendentes serão preservados.';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Recarregar CRM';
    button.style.cssText = 'margin-top:8px;padding:8px 12px;border:0;border-radius:6px;cursor:pointer';
    button.addEventListener('click', () => location.reload());
    notice.append(text, button); document.body.append(notice);
  }
}
function bridgeAvailable() {
  if (bridgeStopped) return false;
  try { if (chrome.runtime?.id) return true; } catch {}
  stopBridge(); return false;
}
function handleBridgeError(error) {
  if (bridgeStopped) return;
  if (/extension context invalidated/i.test(String(error?.message || error)) || !bridgeAvailable()) { stopBridge(); return; }
  console.warn('[Brokiva] Não foi possível renovar o pareamento.', error.message);
}
function crmFetch(url, options = {}) {
  const signal = AbortSignal.any([bridgeAbort.signal, AbortSignal.timeout(15000)]);
  return fetch(url, { ...options, signal });
}
function selectedCrmTenant(user) {
  if (user.isSuperAdmin) {
    try { return JSON.parse(localStorage.getItem('vanguard_crm_current_tenant') || '{}').id || user.tenantId; } catch {}
  }
  return user.tenantId;
}
let explicitPairing = new URLSearchParams(location.search).get('pairExtension') === '1';
const clearKeys = ['extensionSessionToken', 'extensionSessionExpiresAt', 'brokerUserId', 'brokerName', 'brokerEmail', 'tenantId', 'tenantName', 'isPaired', 'brokivaCrmContacts', 'brokivaPendingCrmSync', 'brokiva_lid_phone_map'];

async function pairFromAuthenticatedCrm() {
  if (!bridgeAvailable() || pairing || document.visibilityState !== 'visible') return;
  pairing = true;
  try {
    const existing = await chrome.storage.local.get(['crmUrl', 'brokerUserId', 'tenantId', 'extensionSessionExpiresAt', 'isPaired']);
    if (!bridgeAvailable()) return;
    const sessionRes = await crmFetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' });
    if (!bridgeAvailable()) return;
    if (sessionRes.status === 401) {
      if (existing.crmUrl === location.origin) await chrome.storage.local.remove(clearKeys);
      return;
    }
    if (!sessionRes.ok) return;
    const { user } = await sessionRes.json();
    if (!bridgeAvailable()) return;
    const selectedTenant = selectedCrmTenant(user);
    const sameContext = existing.crmUrl === location.origin && existing.brokerUserId === user.userId && existing.tenantId === selectedTenant;
    // Outra aba ou uma troca de tenant nunca altera silenciosamente o destino da extensão.
    if (!sameContext && !explicitPairing) return;
    // Expiração preserva a identidade; sair da extensão remove identidade e exige pareamento explícito.
    if (sameContext && existing.isPaired && existing.extensionSessionExpiresAt > Date.now() / 1000 + 120) return;
    const response = await crmFetch('/api/v1/auth/extension-login', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: selectedTenant }) });
    const data = await response.json();
    if (!bridgeAvailable() || !response.ok || !data.success || selectedCrmTenant(user) !== selectedTenant) return;
    const paired = await chrome.runtime.sendMessage({ action: 'PAIR_FROM_CRM', data: { token: data.token, expiresAt: data.expiresAt, user: data.user } });
    if (!bridgeAvailable()) return;
    if (!paired?.success) throw new Error(paired?.error || 'O serviço da extensão não confirmou o pareamento.');
    if (explicitPairing) {
      const url = new URL(location.href); url.searchParams.delete('pairExtension'); history.replaceState(null, '', url); explicitPairing = false;
    }
  } catch (error) { handleBridgeError(error); }
  finally { pairing = false; }
}

async function activeContext() {
  if (!bridgeAvailable()) return null;
  const response = await crmFetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' });
  if (!bridgeAvailable() || !response.ok) return null;
  const { user } = await response.json();
  if (!bridgeAvailable()) return null;
  return { userId: user.userId, tenantId: selectedCrmTenant(user) };
}
async function deliver(data) {
  const context = await activeContext();
  if (!bridgeAvailable() || !context || data.tenantId !== context.tenantId) return;
  window.postMessage({ type: 'BROKIVA_EXTENSION_SYNC', data }, location.origin);
}
let lastDelivered = 0;
async function refresh() {
  if (!bridgeAvailable() || refreshing) return;
  refreshing = true;
  try {
    await pairFromAuthenticatedCrm();
    if (!bridgeAvailable()) return;
    const config = await chrome.storage.local.get(['crmUrl', 'tenantId', 'brokerUserId', 'isPaired', 'brokivaPendingCrmSync']);
    if (!bridgeAvailable() || config.crmUrl !== location.origin || !config.isPaired) return;
    const context = await activeContext();
    if (!context || context.tenantId !== config.tenantId || context.userId !== config.brokerUserId) return;
    try {
      const contacts = JSON.parse(localStorage.getItem('vanguard_crm_contacts') || '[]');
      if (!bridgeAvailable()) return;
      await chrome.storage.local.set({ brokivaCrmContacts: contacts.filter(c => c.tenantId === context.tenantId) });
    } catch (error) { handleBridgeError(error); }
    if (!bridgeAvailable()) return;
    const pending = config.brokivaPendingCrmSync;
    if (pending?.timestamp > lastDelivered && pending.tenantId === context.tenantId && Date.now() - pending.timestamp < 14400000) {
      await deliver(pending); lastDelivered = pending.timestamp;
    }
  } catch (error) { handleBridgeError(error); }
  finally { refreshing = false; }
}
function onBridgeMessage(request, sender, sendResponse) {
  if (!bridgeAvailable()) return false;
  if (request.action === 'BROKIVA_NEW_SYNCED_MESSAGES') {
    deliver(request.data).then(() => { if (bridgeAvailable()) sendResponse({ success: true }); }).catch(error => { handleBridgeError(error); if (bridgeAvailable()) sendResponse({ success: false }); }); return true;
  }
  if (request.action === 'GET_CRM_CONTACTS') {
    activeContext().then(context => {
      if (!bridgeAvailable()) return;
      const contacts = JSON.parse(localStorage.getItem('vanguard_crm_contacts') || '[]');
      sendResponse({ success: true, contacts: contacts.filter(c => c.tenantId === context?.tenantId && c.tenantId === request.tenantId) });
    }).catch(error => { handleBridgeError(error); if (bridgeAvailable()) sendResponse({ success: false, contacts: [] }); }); return true;
  }
}
function requestRefresh() { void refresh().catch(handleBridgeError); }
if (bridgeAvailable()) {
  chrome.runtime.onMessage.addListener(onBridgeMessage);
  requestRefresh();
  refreshInterval = setInterval(requestRefresh, 30000);
  window.addEventListener('focus', requestRefresh);
}
