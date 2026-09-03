/**
 * Brokiva CRM Bridge - Injeta mensagens sincronizadas da extensão diretamente na aba do CRM
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'BROKIVA_NEW_SYNCED_MESSAGES') {
    console.log('[Brokiva Extension] Enviando mensagens sincronizadas para a página do CRM:', request.data);
    window.postMessage({
      type: 'BROKIVA_EXTENSION_SYNC',
      data: request.data
    }, '*');
    sendResponse({ success: true });
  }
});
