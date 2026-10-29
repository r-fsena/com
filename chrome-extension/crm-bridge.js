/** Pareamento explícito, renovação de sessão e notificações restritas à imobiliária de origem. */
let pairing = false;
let explicitPairing = new URLSearchParams(location.search).get('pairExtension') === '1';
const clearKeys = ['extensionSessionToken', 'extensionSessionExpiresAt', 'brokerUserId', 'brokerName', 'brokerEmail', 'tenantId', 'tenantName', 'isPaired', 'brokivaCrmContacts', 'brokivaPendingCrmSync', 'brokiva_lid_phone_map'];

async function pairFromAuthenticatedCrm() {
  if (pairing || document.visibilityState !== 'visible') return;
  pairing = true;
  try {
    const existing = await chrome.storage.local.get(['crmUrl', 'brokerUserId', 'tenantId', 'extensionSessionExpiresAt', 'isPaired']);
    const sessionRes = await fetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' });
    if (sessionRes.status === 401) {
      if (existing.crmUrl === location.origin) await chrome.storage.local.remove(clearKeys);
      return;
    }
    if (!sessionRes.ok) return;
    const { user } = await sessionRes.json();
    let selectedTenant = user.tenantId;
    if (user.isSuperAdmin) {
      try { selectedTenant = JSON.parse(localStorage.getItem('vanguard_crm_current_tenant') || '{}').id || user.tenantId; } catch {}
    }
    const sameContext = existing.crmUrl === location.origin && existing.brokerUserId === user.userId && existing.tenantId === selectedTenant;
    // Outra aba ou uma troca de tenant nunca altera silenciosamente o destino da extensão.
    if (!sameContext && !explicitPairing) return;
    if (!explicitPairing && !existing.isPaired) return;
    if (sameContext && existing.extensionSessionExpiresAt > Date.now() / 1000 + 120) return;
    const response = await fetch('/api/v1/auth/extension-login', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: selectedTenant }) });
    const data = await response.json();
    if (!response.ok || !data.success) return;
    await chrome.runtime.sendMessage({ action: 'PAIR_FROM_CRM', data: { token: data.token, expiresAt: data.expiresAt, user: data.user } });
    if (explicitPairing) {
      const url = new URL(location.href); url.searchParams.delete('pairExtension'); history.replaceState(null, '', url); explicitPairing = false;
    }
  } catch (error) { console.warn('[Brokiva] Não foi possível renovar o pareamento.', error.message); }
  finally { pairing = false; }
}

async function activeContext() {
  const response = await fetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) return null;
  const { user } = await response.json();
  let tenantId = user.tenantId;
  if (user.isSuperAdmin) { try { tenantId = JSON.parse(localStorage.getItem('vanguard_crm_current_tenant') || '{}').id || tenantId; } catch {} }
  return { userId: user.userId, tenantId };
}
async function deliver(data) {
  const context = await activeContext();
  if (!context || data.tenantId !== context.tenantId) return;
  window.postMessage({ type: 'BROKIVA_EXTENSION_SYNC', data }, location.origin);
}
let lastDelivered = 0;
async function refresh() {
  await pairFromAuthenticatedCrm();
  const config = await chrome.storage.local.get(['crmUrl', 'tenantId', 'brokerUserId', 'isPaired', 'brokivaPendingCrmSync']);
  if (config.crmUrl !== location.origin || !config.isPaired) return;
  const context = await activeContext();
  if (!context || context.tenantId !== config.tenantId || context.userId !== config.brokerUserId) return;
  try {
    const contacts = JSON.parse(localStorage.getItem('vanguard_crm_contacts') || '[]');
    await chrome.storage.local.set({ brokivaCrmContacts: contacts.filter(c => c.tenantId === context.tenantId) });
  } catch {}
  const pending = config.brokivaPendingCrmSync;
  if (pending?.timestamp > lastDelivered && pending.tenantId === context.tenantId && Date.now() - pending.timestamp < 14400000) {
    await deliver(pending); lastDelivered = pending.timestamp;
  }
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'BROKIVA_NEW_SYNCED_MESSAGES') {
    deliver(request.data).then(() => sendResponse({ success: true })); return true;
  }
  if (request.action === 'GET_CRM_CONTACTS') {
    activeContext().then(context => {
      const contacts = JSON.parse(localStorage.getItem('vanguard_crm_contacts') || '[]');
      sendResponse({ success: true, contacts: contacts.filter(c => c.tenantId === context?.tenantId && c.tenantId === request.tenantId) });
    }).catch(() => sendResponse({ success: false, contacts: [] })); return true;
  }
});
refresh().catch(() => {});
setInterval(() => refresh().catch(() => {}), 30000);
window.addEventListener('focus', () => refresh().catch(() => {}));
