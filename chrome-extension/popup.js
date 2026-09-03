document.addEventListener('DOMContentLoaded', () => {
  const crmUrlInput = document.getElementById('crmUrl');
  const tenantIdInput = document.getElementById('tenantId');
  const brokerNameInput = document.getElementById('brokerName');
  const saveBtn = document.getElementById('saveBtn');
  const openPortalBtn = document.getElementById('openPortalBtn');
  const statusMsg = document.getElementById('statusMsg');

  // Carrega configs salvas
  chrome.storage.local.get(['crmUrl', 'tenantId', 'brokerName'], (res) => {
    if (res.crmUrl) crmUrlInput.value = res.crmUrl;
    if (res.tenantId) tenantIdInput.value = res.tenantId;
    if (res.brokerName) brokerNameInput.value = res.brokerName;
  });

  // Salva configs
  saveBtn.addEventListener('click', () => {
    const crmUrl = crmUrlInput.value.trim() || 'https://crm.faithhubs.com';
    const tenantId = tenantIdInput.value.trim() || 'tenant-amabile-barbarotti';
    const brokerName = brokerNameInput.value.trim() || 'Corretor';

    chrome.storage.local.set({ crmUrl, tenantId, brokerName }, () => {
      statusMsg.style.display = 'block';
      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 3000);
    });
  });

  // Abre portal do CRM
  openPortalBtn.addEventListener('click', () => {
    const url = crmUrlInput.value.trim() || 'https://crm.faithhubs.com';
    chrome.tabs.create({ url });
  });
});
