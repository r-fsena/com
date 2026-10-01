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

// Pareamento Automático Dinâmico com a Sessão Ativa e Tenant Selecionado no CRM
async function autoPairExtensionFromCrm() {
  try {
    const sessionRaw = localStorage.getItem('vanguard_auth_session');
    const tenantRaw = localStorage.getItem('vanguard_crm_current_tenant');
    if (!sessionRaw) return;

    const session = JSON.parse(sessionRaw);
    const tenant = tenantRaw ? JSON.parse(tenantRaw) : null;
    if (!session?.userEmail) return;

    const currentTenantId = tenant?.id || (session.userEmail === 'rafael@faithhubs.com' ? 'tenant-1790857269847' : 'tenant-amabile-barbarotti');
    const currentBrokerEmail = session.userEmail.toLowerCase().trim();

    // Checa credenciais salvas na extensão
    const existing = await chrome.storage.local.get(['extensionSessionToken', 'brokerEmail', 'tenantId', 'crmUrl']);

    // Re-pareia se ainda não autenticada OU se o usuário mudou de tenant no CRM ou trocou de login
    const needsRePair = !existing.extensionSessionToken ||
                        existing.tenantId !== currentTenantId ||
                        existing.brokerEmail !== currentBrokerEmail ||
                        existing.crmUrl !== window.location.origin;

    if (needsRePair) {
      console.log('[Brokiva Extension Bridge] Sincronizando extensão com sessão/tenant ativo:', currentBrokerEmail, currentTenantId);
      const res = await fetch('/api/v1/auth/extension-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.userEmail,
          name: session.userEmail.split('@')[0],
          tenantId: currentTenantId,
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
        console.log('[Brokiva Extension Bridge] ✓ Extensão pareada com sucesso para:', data.user.name, '| Tenant:', data.user.tenantId);
      }
    }
  } catch (err) {
    console.warn('[Brokiva Extension Bridge] Aviso no auto-pareamento:', err);
  }
}

autoPairExtensionFromCrm();
setInterval(autoPairExtensionFromCrm, 4000);

// Observa se há lote de sincronização pendente entregue pela extensão em segundo plano
let lastDeliveredSyncTime = 0;
async function checkPendingExtensionSync() {
  try {
    const data = await chrome.storage.local.get(['brokivaPendingCrmSync']);
    const pending = data.brokivaPendingCrmSync;
    if (pending && pending.timestamp && pending.timestamp > lastDeliveredSyncTime) {
      // Se tiver sido concluída nas últimas 4 horas
      if (Date.now() - pending.timestamp < 14400000) {
        lastDeliveredSyncTime = pending.timestamp;
        console.log('[Brokiva Extension Bridge] Entregando sincronização pendente para a tela do CRM:', {
          contatos: pending.contacts?.length || 0,
          conversas: pending.conversations?.length || 0,
          mensagens: pending.messages?.length || 0,
        });
        window.postMessage({
          type: 'BROKIVA_EXTENSION_SYNC',
          data: pending
        }, window.location.origin);
      }
    }
  } catch (e) {}
}

checkPendingExtensionSync();
setInterval(checkPendingExtensionSync, 3000);
window.addEventListener('focus', checkPendingExtensionSync);

// Observa alterações no localStorage pela aba do CRM
window.addEventListener('storage', (e) => {
  if (e.key === 'vanguard_crm_contacts') {
    syncCrmContactsToStorage();
  }
  if (e.key === 'vanguard_auth_session' || e.key === 'vanguard_crm_current_tenant') {
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
