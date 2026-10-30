document.addEventListener('DOMContentLoaded', async () => {
  const byId = id => document.getElementById(id);
  byId('versionBadge').textContent = `v${chrome.runtime.getManifest().version}`;
  async function render() {
    const config = await chrome.storage.local.get(['extensionSessionToken', 'extensionSessionExpiresAt', 'brokerName', 'tenantName', 'crmUrl', 'developerMode']);
    const connected = Boolean(config.extensionSessionToken && config.extensionSessionExpiresAt > Date.now() / 1000);
    byId('connectedView').style.display = connected ? 'block' : 'none';
    byId('loginView').style.display = connected ? 'none' : 'block';
    byId('brokerName').textContent = config.brokerName || '';
    byId('brokerTenant').textContent = config.tenantName || '';
    byId('brokerAvatar').textContent = (config.brokerName || 'B').split(' ').map(n => n[0]).slice(0, 2).join('');
    byId('crmUrlInput').value = config.crmUrl || 'https://crm.faithhubs.com';
    byId('developerModeToggle').checked = Boolean(config.developerMode);
    const status = await chrome.runtime.sendMessage({ action: 'IMPORT_STATUS' });
    byId('importStatus').textContent = status.pendingMessages ? `${status.pendingMessages} mensagens aguardam confirmação no CRM. ${status.lastError || ''}` : 'Nenhum envio pendente nesta conta.';
    byId('retryImportsBtn').disabled = !connected || !status.pendingMessages;
    byId('importReport').textContent = status.report ? `${status.report.totalMessages} mensagens confirmadas.\n` + status.report.issues.map(item => `${item.name}: ${item.reason}`).join('\n') : 'Nenhuma importação registrada nesta conta.';
    if (status.report?.audit) {
      byId('importReport').textContent += '\nUm item pode aparecer em mais de uma categoria; não some as pendências.';
      const formats = Object.entries(status.report.audit.unsupportedTypes || {}).filter(([, count]) => count > 0);
      if (formats.length) byId('importReport').textContent += '\nFormatos pendentes (suporte): ' + formats.map(([type, count]) => `${type}: ${count}`).join('; ');
    }
  }
  byId('retryImportsBtn').addEventListener('click', async () => {
    byId('retryImportsBtn').disabled = true;
    await chrome.runtime.sendMessage({ action: 'RETRY_IMPORTS' });
    await render();
  });
  byId('loginBtn').addEventListener('click', async () => {
    const result = await chrome.runtime.sendMessage({ action: 'OPEN_CRM_PAIRING', data: { crmUrl: byId('crmUrlInput').value } });
    if (!result.success) { byId('errorMsg').textContent = result.error; byId('errorMsg').style.display = 'block'; }
  });
  byId('logoutBtn').addEventListener('click', async () => { await chrome.runtime.sendMessage({ action: 'UNPAIR' }); await render(); });
  byId('openWaBtn').addEventListener('click', () => chrome.tabs.create({ url: 'https://web.whatsapp.com' }));
  byId('openCrmBtn').addEventListener('click', async () => {
    const config = await chrome.storage.local.get(['crmUrl']); chrome.tabs.create({ url: config.crmUrl || 'https://crm.faithhubs.com' });
  });
  byId('developerModeToggle').addEventListener('change', async () => chrome.storage.local.set({ developerMode: byId('developerModeToggle').checked }));
  chrome.storage.onChanged.addListener(() => render());
  await render();
});
