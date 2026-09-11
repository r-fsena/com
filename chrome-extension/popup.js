document.addEventListener('DOMContentLoaded', async () => {
  const connectedView = document.getElementById('connectedView');
  const loginView = document.getElementById('loginView');
  const brokerNameEl = document.getElementById('brokerName');
  const brokerTenantEl = document.getElementById('brokerTenant');
  const brokerAvatarEl = document.getElementById('brokerAvatar');
  const errorMsg = document.getElementById('errorMsg');

  const tenantSelect = document.getElementById('tenantSelect');
  const brokerInput = document.getElementById('brokerInput');
  const crmUrlInput = document.getElementById('crmUrlInput');

  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const openWaBtn = document.getElementById('openWaBtn');
  const openCrmBtn = document.getElementById('openCrmBtn');
  const developerModeToggle = document.getElementById('developerModeToggle');

  const versionBadge = document.getElementById('versionBadge');
  if (versionBadge && chrome.runtime?.getManifest) {
    versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  const DEFAULT_CRM_URL = 'https://crm.faithhubs.com';

  function normalizeCrmUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return DEFAULT_CRM_URL;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
  }

  async function renderState() {
    const config = await chrome.storage.local.get([
      'developerMode',
      'extensionSessionToken',
      'brokerName',
      'brokerEmail',
      'tenantName',
      'tenantId',
      'crmUrl'
    ]);

    const isConnected = Boolean(config.extensionSessionToken && config.brokerName);

    if (developerModeToggle) {
      developerModeToggle.checked = Boolean(config.developerMode);
    }

    if (isConnected) {
      connectedView.style.display = 'block';
      loginView.style.display = 'none';

      const displayName = config.brokerName || 'Corretor';
      brokerNameEl.textContent = displayName;
      const tenantDisplayName = config.tenantName || 'Amábile Barbarotti Imóveis';
      brokerTenantEl.innerHTML = `<span class="pulse-dot"></span> <span>${tenantDisplayName}</span>`;

      const initials = displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      brokerAvatarEl.textContent = initials || 'BR';
    } else {
      connectedView.style.display = 'none';
      loginView.style.display = 'block';

      if (config.crmUrl) crmUrlInput.value = config.crmUrl;
      if (config.brokerName) brokerInput.value = config.brokerName;

      // Busca catálogo de imobiliárias
      try {
        const crmUrl = config.crmUrl || DEFAULT_CRM_URL;
        const res = await fetch(`${crmUrl}/api/v1/auth/extension-login`);
        const data = await res.json();
        if (data.success && Array.isArray(data.tenants)) {
          tenantSelect.innerHTML = data.tenants.map(t => 
            `<option value="${t.id}" ${t.id === (config.tenantId || 'tenant-amabile-barbarotti') ? 'selected' : ''}>${t.name}</option>`
          ).join('');
        }
      } catch {}
    }
  }

  // Executa login
  loginBtn.addEventListener('click', async () => {
    errorMsg.style.display = 'none';
    const crmUrl = normalizeCrmUrl(crmUrlInput.value);
    const tenantId = tenantSelect.value;
    const brokerIdent = brokerInput.value.trim();

    if (!brokerIdent) {
      errorMsg.textContent = 'Informe seu nome ou e-mail de corretor.';
      errorMsg.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Conectando...';

    try {
      const res = await fetch(`${crmUrl}/api/v1/auth/extension-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: brokerIdent,
          name: brokerIdent,
          tenantId,
        }),
      });

      const data = await res.json();

      if (data.success && data.token && data.user) {
        await chrome.storage.local.set({
          extensionSessionToken: data.token,
          brokerUserId: data.user.userId,
          brokerName: data.user.name,
          brokerEmail: data.user.email,
          tenantId: data.user.tenantId,
          tenantName: data.user.tenantName,
          crmUrl,
          isPaired: true,
        });
        await renderState();
      } else {
        errorMsg.textContent = data.error || 'Não foi possível conectar ao CRM.';
        errorMsg.style.display = 'block';
      }
    } catch (err) {
      errorMsg.textContent = 'Falha de conexão com o servidor do CRM.';
      errorMsg.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '✦ Conectar Extensão';
    }
  });

  // Logout da extensão
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove([
      'extensionSessionToken',
      'brokerName',
      'brokerUserId',
      'brokerEmail'
    ]);
    await renderState();
  });

  // Abrir WhatsApp Web
  openWaBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://web.whatsapp.com' });
  });

  // Abrir CRM
  openCrmBtn.addEventListener('click', async () => {
    const config = await chrome.storage.local.get(['crmUrl']);
    chrome.tabs.create({ url: config.crmUrl || DEFAULT_CRM_URL });
  });

  developerModeToggle?.addEventListener('change', async () => {
    await chrome.storage.local.set({ developerMode: developerModeToggle.checked });
  });

  await renderState();
});
