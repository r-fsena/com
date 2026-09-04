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

// Observa alterações no localStorage pela aba do CRM
window.addEventListener('storage', (e) => {
  if (e.key === 'vanguard_crm_contacts') {
    syncCrmContactsToStorage();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'BROKIVA_NEW_SYNCED_MESSAGES') {
    console.log('[Brokiva Extension] Enviando mensagens sincronizadas para a página do CRM:', request.data);
    window.postMessage({
      type: 'BROKIVA_EXTENSION_SYNC',
      data: request.data
    }, '*');
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
