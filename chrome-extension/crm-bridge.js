/**
 * Brokiva CRM Bridge - Injeta mensagens sincronizadas da extensão diretamente na aba do CRM
 * e sincroniza catálogo de contatos com o background da extensão.
 */

function syncCrmContactsToStorage() {
  try {
    const raw = localStorage.getItem('vanguard_crm_contacts');
    if (raw) {
      const contacts = JSON.parse(raw);
      if (Array.isArray(contacts) && contacts.length > 0) {
        chrome.storage.local.set({ brokivaCrmContacts: contacts });
      }
    }
  } catch (e) {}
}

// Sincroniza ao inicializar a página e periodicamente
syncCrmContactsToStorage();
setInterval(syncCrmContactsToStorage, 5000);

// Pareamento Automático Não-Destrutivo com a Sessão Ativa do CRM
async function autoPairExtensionFromCrm() {
  try {
    const sessionRaw = localStorage.getItem('vanguard_auth_session');
    const tenantRaw = localStorage.getItem('vanguard_crm_current_tenant');
    if (!sessionRaw) return;

    const session = JSON.parse(sessionRaw);
    const tenant = tenantRaw ? JSON.parse(tenantRaw) : null;
    if (!session?.userEmail) return;

    // Checa se a extensão já tem token gravado
    const existing = await chrome.storage.local.get(['extensionSessionToken', 'brokerEmail']);
    // Pareia automaticamente se a extensão ainda não estiver autenticada
    if (!existing.extensionSessionToken) {
      console.log('[Brokiva Extension Bridge] Pareando extensão automaticamente com sessão do CRM:', session.userEmail);
      const res = await fetch('/api/v1/auth/extension-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.userEmail,
          name: session.userEmail.split('@')[0],
          tenantId: tenant?.id || 'tenant-amabile-barbarotti',
        }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        await chrome.storage.local.set({
          extensionSessionToken: data.token,
          brokerUserId: data.user.userId,
          brokerName: data.user.name,
          brokerEmail: data.user.email,
          tenantId: data.user.tenantId,
          tenantName: data.user.tenantName,
          crmUrl: window.location.origin,
          isPaired: true,
        });
        console.log('[Brokiva Extension Bridge] Extensão pareada com sucesso para:', data.user.name);
      }
    }
  } catch (err) {}
}

autoPairExtensionFromCrm();

// Observa alterações no localStorage pela aba do CRM
window.addEventListener('storage', (e) => {
  if (e.key === 'vanguard_crm_contacts') {
    syncCrmContactsToStorage();
  }
  if (e.key === 'vanguard_auth_session') {
    autoPairExtensionFromCrm();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'BROKIVA_NEW_SYNCED_MESSAGES') {
    console.log('[Brokiva Extension] Enviando mensagens sincronizadas para a página do CRM:', request.data);
    window.postMessage({
      type: 'BROKIVA_EXTENSION_SYNC',
      data: request.data
    }, window.location.origin);
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'GET_CRM_CONTACTS') {
    try {
      const raw = localStorage.getItem('vanguard_crm_contacts');
      const contacts = raw ? JSON.parse(raw) : [];
      sendResponse({ success: true, contacts });
    } catch (err) {
      sendResponse({ success: false, error: err.message, contacts: [] });
    }
    return false;
  }
});
