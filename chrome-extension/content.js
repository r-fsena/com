/**
 * Brokiva — Content Script for WhatsApp Web (web.whatsapp.com)
 * Scrapes messages, executes paginated batch sync, injects CRM sidebar and Copilot.
 */

(function() {
  'use strict';

  console.log('[Brokiva] Extension loaded on WhatsApp Web.');

  let isSyncing = false;
  let currentActivePhone = '';
  let currentActiveName = '';
  let currentBrokerName = 'Rafael Sena';

  try {
    chrome?.storage?.local?.get(['brokerName'], res => {
      if (res?.brokerName) currentBrokerName = res.brokerName;
    });
  } catch (e) {}

  // 1. Injeta a Sidebar do CRM no DOM com suporte a Login Próprio e Persistente
  function injectSidebar() {
    if (document.getElementById('sovereign-crm-root')) return;

    const extVersion = chrome?.runtime?.getManifest?.()?.version || '1.0.16';
    const root = document.createElement('div');
    root.id = 'sovereign-crm-root';
    root.innerHTML = `
      <div id="sovereign-toggle-btn" title="Abrir Brokiva">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>

      <div class="sovereign-panel">
        <div class="sovereign-header">
          <div class="sovereign-brand">
            <div class="sovereign-brand-icon">B</div>
            <div>
              <div class="sovereign-title" style="display:flex; align-items:center;">
                Brokiva <span style="font-size:10px; background:#3742AC; color:white; padding:1px 6px; border-radius:4px; margin-left:8px; font-weight:700;">v${extVersion}</span>
              </div>
              <div class="sovereign-subtitle">Relacionamentos que viram negócios</div>
            </div>
          </div>
          <button id="sovereign-close-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
        </div>

        <!-- Container do Perfil do Corretor Ativo -->
        <div id="sovereign-header-profile"></div>

        <!-- Conteúdo Dinâmico (Login ou Ferramentas de Sincronização) -->
        <div class="sovereign-body" id="sovereign-body-container"></div>
      </div>
    `;

    document.body.appendChild(root);

    // Eventos de toggle e fechar
    const toggleBtn = document.getElementById('sovereign-toggle-btn');
    const closeBtn = document.getElementById('sovereign-close-btn');
    toggleBtn?.addEventListener('click', () => root.classList.toggle('open'));
    closeBtn?.addEventListener('click', () => root.classList.remove('open'));

    // Renderiza conteúdo baseado na sessão da extensão
    renderSidebarContent();

    // Reage dinamicamente a mudanças de autenticação (ex: login via popup ou bridge)
    try {
      if (chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener((changes, area) => {
          try {
            if (!chrome?.runtime?.id) return;
            if (area === 'local' && (changes?.extensionSessionToken || changes?.brokerName)) {
              renderSidebarContent().catch(() => {});
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  function normalizeCrmUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return 'https://crm.faithhubs.com';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
  }

  // 1.1 Renderizador dinâmico de Login ou Ferramentas Ativas
  async function renderSidebarContent() {
    if (!chrome?.runtime?.id) return;
    try {
      const bodyContainer = document.getElementById('sovereign-body-container');
      const headerContainer = document.getElementById('sovereign-header-profile');
      if (!bodyContainer) return;

      const storage = await chrome.storage.local.get([
        'extensionSessionToken',
        'brokerName',
        'brokerEmail',
        'tenantName',
        'tenantId',
        'crmUrl'
      ]);

    const isConnected = Boolean(storage.extensionSessionToken && storage.brokerName);
    const crmUrl = storage.crmUrl || 'https://crm.faithhubs.com';
    const brokerName = storage.brokerName || 'Corretor';
    const tenantName = storage.tenantName || 'Amábile Barbarotti Imóveis';

    if (isConnected) {
      const initials = brokerName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'BR';
      if (headerContainer) {
        headerContainer.innerHTML = `
          <div class="sovereign-broker-bar">
            <div class="sovereign-broker-info">
              <div class="sovereign-broker-avatar">${initials}</div>
              <div style="min-width:0;">
                <div class="sovereign-broker-name">${brokerName}</div>
                <div class="sovereign-broker-tenant">${tenantName}</div>
              </div>
            </div>
            <button id="sovereign-btn-logout-sidebar" class="sovereign-btn-logout" title="Desconectar ou trocar de corretor">Sair</button>
          </div>
        `;
        document.getElementById('sovereign-btn-logout-sidebar')?.addEventListener('click', async () => {
          if (confirm('Deseja desconectar a extensão Brokiva deste corretor?')) {
            await chrome.storage.local.remove(['extensionSessionToken', 'brokerName', 'brokerUserId', 'brokerEmail']);
            await renderSidebarContent();
          }
        });
      }

      bodyContainer.innerHTML = `
        <!-- Card de Sincronização em Massa -->
        <div class="sovereign-card">
          <div class="sovereign-card-title">
            <span>Sincronização com CRM</span>
            <span id="sovereign-sync-badge" class="sovereign-lead-pill">Pronto</span>
          </div>
          <p style="font-size:11px; color:#64748b; margin-bottom:10px;">
            Extrai conversas e todo o histórico passado para o seu CRM sem limites.
          </p>
          <button id="sovereign-batch-sync-btn" class="sovereign-btn-sync" style="background:#3742AC;">
            <span>⚡ Sincronizar Histórico Completo</span>
          </button>
          <div id="sovereign-progress-bar" class="sovereign-progress-bar">
            <div id="sovereign-progress-fill" class="sovereign-progress-fill" style="background:#3742AC;"></div>
          </div>
          <p id="sovereign-progress-status" style="font-size:10px; color:#64748b; margin-top:6px; display:none; text-align:center;"></p>
        </div>

        <!-- Card do Lead Selecionado -->
        <div class="sovereign-card" id="sovereign-lead-card">
          <div class="sovereign-card-title">Lead em Atendimento</div>
          <div class="sovereign-lead-header">
            <div id="sovereign-lead-avatar" class="sovereign-lead-avatar" style="display:flex; align-items:center; justify-content:center; font-weight:bold; color:#3742AC; background:rgba(55,66,172,0.1);">
              ?
            </div>
            <div style="flex:1; min-width:0;">
              <div id="sovereign-lead-name" class="sovereign-lead-name truncate">Nenhum chat selecionado</div>
              <div id="sovereign-lead-phone" class="sovereign-lead-phone">Selecione uma conversa</div>
            </div>
          </div>

          <button id="sovereign-sync-current-btn" class="sovereign-btn-sync" style="background:#0f172a; margin-top:6px;">
            <span>📥 Salvar Histórico Desta Conversa</span>
          </button>
        </div>

        <!-- Card do Copiloto de IA -->
        <div class="sovereign-ai-card">
          <div class="sovereign-ai-badge">✦ Copiloto Brokiva IA</div>
          <p style="font-size:11px; color:#cbd5e1; margin-bottom:10px;">
            Analisa o momento do cliente e gera respostas persuasivas com 1 clique.
          </p>
          <button id="sovereign-ai-generate-btn" class="sovereign-btn-sync" style="background:#3742AC;">
            <span>✨ Sugerir Respostas Inteligentes</span>
          </button>
          <div id="sovereign-ai-suggestions" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;"></div>
        </div>

        <!-- Card de Logs & Telemetria CloudWatch -->
        <div class="sovereign-card" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1;">
          <div class="sovereign-card-title" style="color:#94a3b8; display:flex; justify-content:space-between;">
            <span>CloudWatch Logs (Extensão)</span>
            <span id="sovereign-logs-count" style="font-size:10px; color:#34d399;">● Ativo</span>
          </div>
          <div id="sovereign-live-logs" style="font-family:monospace; font-size:10px; max-height:130px; overflow-y:auto; background:#020617; padding:8px; border-radius:8px; color:#e2e8f0; display:flex; flex-direction:column; gap:4px; border:1px solid #1e293b;">
            <div style="color:#64748b;">[Aguardando comando...]</div>
          </div>
        </div>
      `;

      // Conecta botões das ferramentas
      document.getElementById('sovereign-batch-sync-btn')?.addEventListener('click', () => executeBatchHistoryScan());
      document.getElementById('sovereign-sync-current-btn')?.addEventListener('click', () => syncCurrentActiveChat());
      document.getElementById('sovereign-ai-generate-btn')?.addEventListener('click', () => triggerAiSuggestion());

      // Atualiza lead ativo se houver conversa aberta
      updateActiveLeadUI();
    } else {
      if (headerContainer) headerContainer.innerHTML = '';
      bodyContainer.innerHTML = `
        <div class="sovereign-login-card">
          <div class="sovereign-login-badge">✦ Conexão Segura Brokiva</div>
          <div class="sovereign-login-title">Identifique-se no CRM</div>
          <div class="sovereign-login-desc">
            Conecte sua conta de corretor para sincronizar leads e ativar o Copiloto de IA sem interrupções.
          </div>

          <div id="sovereign-sidebar-error" class="sovereign-login-error"></div>

          <div class="sovereign-field">
            <label class="sovereign-label">Imobiliária / Espaço:</label>
            <select id="sovereign-sidebar-tenant" class="sovereign-select">
              <option value="tenant-amabile-barbarotti" selected>Amábile Barbarotti Imóveis</option>
            </select>
          </div>

          <div class="sovereign-field">
            <label class="sovereign-label">Seu Nome ou E-mail:</label>
            <input type="text" id="sovereign-sidebar-broker" class="sovereign-input" value="Rafael Sena" placeholder="Ex: Rafael Sena ou rafael@faithhubs.com">
          </div>

          <div class="sovereign-field">
            <label class="sovereign-label">Servidor do CRM:</label>
            <input type="text" id="sovereign-sidebar-crm-url" class="sovereign-input" value="${normalizeCrmUrl(crmUrl)}" placeholder="https://crm.faithhubs.com">
          </div>

          <button id="sovereign-sidebar-login-btn" class="sovereign-btn-login">
            <span>✦ Conectar ao Brokiva CRM</span>
          </button>
        </div>
      `;

      // Busca catálogo de imobiliárias para o select através do background worker (isento de CORS)
      safeSendMessage({ action: 'GET_TENANTS', data: { crmUrl: normalizeCrmUrl(crmUrl) } }, (resp) => {
        const data = resp?.result;
        const select = document.getElementById('sovereign-sidebar-tenant');
        if (select && data && data.success && Array.isArray(data.tenants)) {
          select.innerHTML = data.tenants.map(t => 
            `<option value="${t.id}" ${t.id === (storage.tenantId || 'tenant-amabile-barbarotti') ? 'selected' : ''}>${t.name}</option>`
          ).join('');
        }
      });

      // Listener de login da sidebar
      document.getElementById('sovereign-sidebar-login-btn')?.addEventListener('click', async () => {
        const errorEl = document.getElementById('sovereign-sidebar-error');
        const loginBtn = document.getElementById('sovereign-sidebar-login-btn');
        const tenantSelect = document.getElementById('sovereign-sidebar-tenant');
        const brokerInput = document.getElementById('sovereign-sidebar-broker');
        const urlInput = document.getElementById('sovereign-sidebar-crm-url');

        if (errorEl) errorEl.style.display = 'none';
        const targetUrl = normalizeCrmUrl(urlInput?.value || crmUrl);
        const tenantId = tenantSelect?.value || 'tenant-amabile-barbarotti';
        const brokerVal = brokerInput?.value?.trim() || '';

        if (!brokerVal) {
          if (errorEl) {
            errorEl.textContent = 'Informe seu nome ou e-mail de corretor.';
            errorEl.style.display = 'block';
          }
          return;
        }

        if (loginBtn) {
          loginBtn.disabled = true;
          loginBtn.innerText = 'Conectando ao Brokiva...';
        }

        // Executa autenticação através do background worker para evitar bloqueio de CORS do WhatsApp Web
        safeSendMessage({
          action: 'EXTENSION_LOGIN',
          data: { email: brokerVal, name: brokerVal, tenantId, crmUrl: targetUrl }
        }, async (resp) => {
          if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerText = '✦ Conectar ao Brokiva CRM';
          }

          const data = resp?.result;
          if (resp && resp.success && data && data.success && data.token && data.user) {
            await chrome.storage.local.set({
              extensionSessionToken: data.token,
              brokerUserId: data.user.userId,
              brokerName: data.user.name,
              brokerEmail: data.user.email,
              tenantId: data.user.tenantId,
              tenantName: data.user.tenantName,
              crmUrl: targetUrl,
              isPaired: true,
            });
            await renderSidebarContent();
          } else {
            if (errorEl) {
              const err = data?.error || resp?.error || 'Falha na autenticação do corretor.';
              errorEl.textContent = err;
              errorEl.style.display = 'block';
            }
          }
        });
      });
    }
  } catch (e) {}
}

  function safeSendMessage(payload, callback) {
    try {
      if (!chrome?.runtime?.id) {
        if (callback) callback(null);
        return;
      }
      chrome.runtime.sendMessage(payload, (res) => {
        if (chrome.runtime.lastError) {
          if (callback) callback(null);
          return;
        }
        if (callback) callback(res);
      });
    } catch (e) {
      if (callback) callback(null);
    }
  }

  // Registrador de Telemetria e Logs para a UI e CloudWatch
  function logToConsoleAndCloudWatch(level, event, message, details = {}) {
    const timeStr = new Date().toLocaleTimeString();
    console.log(`[Brokiva CloudWatch][${level}] ${event}: ${message}`, details);

    // Atualiza container visual de logs na Sidebar
    const container = document.getElementById('sovereign-live-logs');
    if (container) {
      const line = document.createElement('div');
      line.style.color = level === 'ERROR' ? '#f43f5e' : level === 'WARN' ? '#f59e0b' : '#38bdf8';
      line.innerText = `[${timeStr}] ${message}`;
      container.appendChild(line);
      container.scrollTop = container.scrollHeight;
    }

    // Envia evento de log para o background despachar ao CloudWatch
    safeSendMessage({
      action: 'LOG_EVENT',
      data: {
        level,
        event,
        details: { message, ...details }
      }
    });
  }

  // 1.1 Filtro de mensagens do sistema, criptografia e avisos automáticos do WhatsApp
  function isWhatsAppSystemMessage(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    return (
      lower.includes('criptografia de ponta a ponta') ||
      lower.includes('end-to-end encrypt') ||
      lower.includes('cifrado de extremo a extremo') ||
      lower.includes('somente as pessoas que fazem parte da conversa') ||
      (lower.includes('mensagens e ligações') && lower.includes('protegidas')) ||
      (lower.includes('mensagens e ligacoes') && lower.includes('protegidas')) ||
      (lower.includes('mensagens e chamadas') && lower.includes('protegidas')) ||
      (lower.includes('messages and calls') && lower.includes('encrypted')) ||
      (lower.includes('clique para saber mais') && (lower.includes('cripto') || lower.includes('protegid') || lower.includes('conversa'))) ||
      lower.includes('protegidas com a criptografia') ||
      lower.includes('ninguém fora desta conversa') ||
      lower.includes('ninguem fora desta conversa') ||
      lower.includes('no one outside of this chat') ||
      lower.includes('mensagens temporárias') ||
      lower.includes('mensagens temporarias') ||
      lower.includes('disappearing messages') ||
      lower.includes('mensajes temporales') ||
      lower.includes('código de segurança') ||
      lower.includes('codigo de seguranca') ||
      lower.includes('security code') ||
      lower.includes('conta comercial oficial') ||
      (lower.includes('esta conversa é com') && lower.includes('conta comercial')) ||
      (lower.includes('esta conversa e com') && lower.includes('conta comercial')) ||
      lower.includes('official business account') ||
      lower.includes('esta empresa usa o serviço seguro da meta') ||
      lower.includes('esta empresa usa o servico seguro da meta') ||
      lower.includes('você bloqueou este contato') ||
      lower.includes('voce bloqueou este contato') ||
      lower.includes('você desbloqueou este contato') ||
      lower.includes('voce desbloqueou este contato') ||
      lower.includes('you blocked this contact') ||
      lower.includes('clique para carregar') ||
      lower.includes('clique aqui para carregar') ||
      lower.includes('carregar mensagens mais antigas') ||
      lower.includes('carregar conversas mais antigas') ||
      lower.includes('carregar mensagens anteriores') ||
      lower.includes('use o whatsapp no seu celular para ver mensagens') ||
      lower.includes('use whatsapp on your phone to see older messages') ||
      lower.includes('click to load older messages')
    );
  }

  // Mapeamento em memória e persistente de WhatsApp LID <-> Telefone Canônico
  const inMemoryLidPhoneMap = new Map();

  try {
    chrome.storage.local.get(['brokiva_lid_phone_map'], (res) => {
      if (res?.brokiva_lid_phone_map) {
        Object.entries(res.brokiva_lid_phone_map).forEach(([l, p]) => {
          inMemoryLidPhoneMap.set(l, p);
        });
      }
    });
  } catch (e) {}

  function rememberLidPhone(lid, phone) {
    if (!lid || !phone) return;
    const cleanL = String(lid).replace(/@.*$/, '').replace(/\D/g, '');
    const cleanP = String(phone).replace(/\D/g, '');
    if (cleanL && cleanP && cleanP.length >= 8 && cleanP.length <= 13) {
      inMemoryLidPhoneMap.set(cleanL, cleanP);
      try {
        chrome.storage.local.get(['brokiva_lid_phone_map'], (res) => {
          const map = res?.brokiva_lid_phone_map || {};
          map[cleanL] = cleanP;
          chrome.storage.local.set({ brokiva_lid_phone_map: map });
        });
      } catch (e) {}
    }
  }

  function formatPhoneDisplay(raw) {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 14) return `LID ${digits}`;
    if (digits.length === 11) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `+55 (${digits.slice(0, 2)}) 9${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.startsWith('55') && digits.length === 13) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    if (digits.startsWith('55') && digits.length === 12) return `+55 (${digits.slice(2, 4)}) 9${digits.slice(4, 8)}-${digits.slice(8)}`;
    return `+${digits}`;
  }

  // 1.2 Utilitário de detecção de Grupos, Canais e Comunidades
  function isWhatsAppChannelOrGroup(target) {
    if (!target) return false;
    const rawCombined = `${target.phone || ''} ${target.id || ''} ${target.lid || ''} ${target.name || ''}`.toLowerCase();

    if (
      rawCombined.includes('@newsletter') ||
      rawCombined.includes('newsletter') ||
      rawCombined.includes('@g.us') ||
      rawCombined.includes('-group') ||
      rawCombined.includes('@broadcast') ||
      rawCombined.includes('@temp')
    ) {
      return true;
    }

    // Se possui indicação explícita de LID ou campo lid, é um contato individual 1:1
    if (rawCombined.includes('@lid') || target.lid) {
      return false;
    }

    const phoneDigits = String(target.phone || '').replace(/\D/g, '');
    if (phoneDigits === '0' || (phoneDigits.length > 0 && phoneDigits.length < 8)) return true;

    const nameLower = (target.name || '').toLowerCase().trim();
    if (
      nameLower.startsWith('grupo ') ||
      nameLower.startsWith('grupo:') ||
      nameLower.startsWith('comunidade ') ||
      nameLower.startsWith('canal ') ||
      nameLower.startsWith('avisos ') ||
      nameLower === 'meta ai' ||
      nameLower === 'arquivadas' ||
      nameLower === 'canais' ||
      nameLower === 'comunidades' ||
      nameLower === 'status' ||
      nameLower === 'notícias'
    ) {
      return true;
    }

    return false;
  }

  // 1.3 Detecta se uma linha visível no painel lateral é grupo ou canal antes do clique
  function isRowGroupOrChannel(rowContainer, spanTitle) {
    if (!rowContainer) return false;
    const title = (spanTitle || '').trim().toLowerCase();

    // Palavras reservadas do sistema
    const systemTitles = ['meta ai', 'arquivadas', 'comunidades', 'canais', 'status', 'avisos', 'whatsapp', 'você', 'notícias'];
    if (systemTitles.some(st => title === st || title.startsWith(st))) return true;

    // Ícones característicos de grupo, comunidade ou canal
    const groupOrChannelIcon = rowContainer.querySelector(
      'span[data-icon="default-group"], span[data-icon="community"], span[data-icon="newsletter"], span[data-icon="channel"], span[data-icon="announcement"], span[data-icon="broadcast"], span[data-icon*="group"], span[data-icon*="newsletter"], span[data-icon*="community"]'
    );
    if (groupOrChannelIcon) return true;

    // Avatar do WhatsApp com URL de grupo ou canal
    const avatarImg = rowContainer.querySelector('img[src]');
    if (avatarImg) {
      const src = (avatarImg.getAttribute('src') || '').toLowerCase();
      if (src.includes('g.us') || src.includes('newsletter') || src.includes('broadcast') || src.includes('group')) {
        return true;
      }
    }

    // Atributos aria-label que indicam grupo
    const ariaLabel = (rowContainer.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('grupo') || ariaLabel.includes('comunidade') || ariaLabel.includes('canal') || ariaLabel.includes('newsletter')) {
      return true;
    }

    return false;
  }

  // 1.35 Converte avatar do contato em Data URL base64 autônomo (CORS-safe e persistente no CRM)
  async function getContactAvatarDataUrl(imgElementOrSrc) {
    if (!imgElementOrSrc) return '';
    const src = typeof imgElementOrSrc === 'string' ? imgElementOrSrc : (imgElementOrSrc.getAttribute('src') || '');
    if (!src) return '';

    // Ignora silhueta padrão / placeholder SVG do WhatsApp
    if (src.includes('data:image/svg+xml') || src.includes('default-user')) {
      return '';
    }

    if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/png') || src.startsWith('data:image/webp')) {
      return src;
    }

    // 1. Canvas direto se o elemento <img> do DOM já estiver renderizado
    if (typeof imgElementOrSrc !== 'string' && imgElementOrSrc && imgElementOrSrc.tagName === 'IMG' && imgElementOrSrc.complete && imgElementOrSrc.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        const size = Math.min(imgElementOrSrc.naturalWidth, 128);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElementOrSrc, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl && dataUrl.startsWith('data:image/jpeg') && dataUrl.length > 100) {
          return dataUrl;
        }
      } catch (e) {}
    }

    // 2. Fetch direto do blob no contexto do content script (mesma origem web.whatsapp.com)
    if (src.startsWith('blob:')) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } catch (e) {}
    }

    // 3. Background worker via CONVERT_IMAGE_TO_DATA_URL (com host_permissions de *.whatsapp.net)
    try {
      const bgResp = await new Promise(resolve => {
        safeSendMessage({ action: 'CONVERT_IMAGE_TO_DATA_URL', data: { url: src } }, resp => resolve(resp));
      });
      if (bgResp && bgResp.success && bgResp.dataUrl) {
        return bgResp.dataUrl;
      }
    } catch (e) {}

    return '';
  }

  // 1.4 Detecta se a conversa atualmente aberta no #main é um grupo ou canal
  function isCurrentChatGroupOrChannel() {
    const main = document.querySelector('#main');
    if (!main) return false;

    const header = main.querySelector('header');
    if (header) {
      const headerText = (header.innerText || '').toLowerCase();
      if (
        headerText.includes('participantes') ||
        headerText.includes('participante') ||
        headerText.includes('dados do grupo') ||
        headerText.includes('dados da comunidade') ||
        headerText.includes('canal oficial') ||
        headerText.includes('seguidores') ||
        headerText.includes('somente admins') ||
        headerText.includes('clique aqui para ver os dados do grupo') ||
        (headerText.includes('você') && headerText.includes('+'))
      ) {
        return true;
      }

      const icon = header.querySelector(
        'span[data-icon="default-group"], span[data-icon="newsletter"], span[data-icon="community"], span[data-icon="channel"], span[data-icon="announcement"], span[data-icon*="group"], span[data-icon*="newsletter"]'
      );
      if (icon) return true;

      const avatarImg = header.querySelector('img[src]');
      if (avatarImg) {
        const src = (avatarImg.getAttribute('src') || '').toLowerCase();
        if (src.includes('g.us') || src.includes('newsletter') || src.includes('broadcast')) {
          return true;
        }
      }
    }

    // Amostra rápida de data-ids para verificar JIDs de grupo ou canal
    const sampleElements = Array.from(main.querySelectorAll('[data-id]')).slice(0, 10);
    for (const el of sampleElements) {
      const dId = el.getAttribute('data-id') || '';
      if (dId.includes('@g.us') || dId.includes('@newsletter') || dId.includes('@broadcast') || dId.includes('@temp')) {
        return true;
      }
    }

    return false;
  }

  // 1.5 Aguarda confirmação ativa de troca de conversa no #main (evita contaminação entre chats)
  async function waitForChatToOpen(expectedTitle, previousTitle, timeoutMs = 3500) {
    const start = Date.now();
    const cleanStr = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    const normExpected = cleanStr(expectedTitle);
    const normPrev = cleanStr(previousTitle);

    while (Date.now() - start < timeoutMs) {
      const main = document.querySelector('#main');
      if (main) {
        const headerSpan = main.querySelector('header span[title], header div[role="button"] span, header span[dir="auto"]');
        const rawTitle = (headerSpan ? (headerSpan.getAttribute('title') || headerSpan.innerText) : '').trim();
        const currentTitle = cleanStr(rawTitle);

        // 1. Checa se o título é igual ou contém o esperado (ou as primeiras palavras coincidem)
        const firstExpectedWord = normExpected.split(' ')[0];
        const matchesExpected = currentTitle && normExpected && (
          currentTitle === normExpected ||
          normExpected.includes(currentTitle) ||
          currentTitle.includes(normExpected) ||
          (firstExpectedWord.length >= 3 && currentTitle.startsWith(firstExpectedWord))
        );

        // 2. Ou se comprovadamente mudou em relação ao chat anterior
        const changedFromPrev = normPrev && currentTitle && currentTitle !== normPrev;

        // 3. Fallback: Se decorreu mais de 1.2s e o #main já tem balões de mensagens renderizados
        const elapsed = Date.now() - start;
        const hasMessages = main.querySelectorAll('div[data-id], div[role="row"]').length > 0;

        if (matchesExpected || (changedFromPrev && currentTitle.length >= 2) || (elapsed >= 1200 && hasMessages && currentTitle.length >= 2)) {
          // Pequena pausa para garantir que o Virtual DOM montou as mensagens da nova conversa
          await new Promise(r => setTimeout(r, 250));
          return true;
        }
      }
      await new Promise(r => setTimeout(r, 120));
    }
    return false;
  }

  // 2. Extrai dados da conversa ativa no WhatsApp Web (Blindada contra duplicações e grupos)
  function extractActiveChatData(accumulatedMessagesMap = null) {
    const main = document.querySelector('#main');
    if (!main) {
      console.log('[Brokiva] #main não encontrado');
      return null;
    }

    // Filtro Imediato: Se for grupo ou canal, descarta
    if (isCurrentChatGroupOrChannel()) {
      console.log('[Brokiva] Grupo ou Canal detectado no #main, ignorando extração.');
      return null;
    }

    // 1. Identifica nome e título no header do chat (ignora status como online, visto por último, etc.)
    let contactName = '';
    const headerSpans = Array.from(main.querySelectorAll('header span[title], header div[data-testid="conversation-info-header"] span, header div[role="button"] span[title], header span[dir="auto"]'));
    for (const s of headerSpans) {
      const t = (s.getAttribute('title') || s.innerText || '').trim();
      const lower = t.toLowerCase();
      if (
        t &&
        t.length >= 1 &&
        !lower.includes('online') &&
        !lower.includes('visto por último') &&
        !lower.includes('last seen') &&
        !lower.includes('clique aqui') &&
        !lower.includes('dados do') &&
        !lower.includes('typing') &&
        !lower.includes('digitando')
      ) {
        contactName = t;
        break;
      }
    }
    if (!contactName) {
      contactName = 'Contato WhatsApp';
    }

    // 2. Localiza telefone do contato e LID
    let resolvedPhone = '';
    let resolvedLid = '';

    // Método A: Busca telefone real no Header do WhatsApp Web
    const headerElement = main.querySelector('header');
    if (headerElement) {
      const headerText = headerElement.innerText || '';
      const phoneMatch = headerText.match(/\+?55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/) ||
                         headerText.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
      if (phoneMatch) {
        const cleanHeaderDigits = phoneMatch[0].replace(/\D/g, '');
        if (cleanHeaderDigits.length >= 10 && cleanHeaderDigits.length <= 13) {
          resolvedPhone = cleanHeaderDigits;
        }
      }
    }

    // Método B: Atributos data-id em elementos de #main
    const allDataIdElements = main.querySelectorAll('[data-id]');
    for (const el of allDataIdElements) {
      const dataId = el.getAttribute('data-id') || '';
      if (dataId.includes('@g.us') || dataId.includes('@newsletter') || dataId.includes('@broadcast')) {
        return null;
      }
      if (!resolvedLid && dataId.includes('@lid')) {
        const lidMatch = dataId.match(/_(\d{8,18})@lid/) || dataId.match(/(\d{8,18})@lid/);
        if (lidMatch && lidMatch[1]) {
          resolvedLid = `${lidMatch[1]}@lid`;
        }
      }
      if (!resolvedPhone && (dataId.includes('@c.us') || dataId.includes('@s.whatsapp.net'))) {
        const phoneMatch = dataId.match(/_(\d{10,15})@(c\.us|s\.whatsapp\.net)/) ||
                           dataId.match(/(\d{10,15})@(c\.us|s\.whatsapp\.net)/);
        if (phoneMatch && phoneMatch[1]) {
          resolvedPhone = phoneMatch[1];
        }
      }
    }

    // Método C: Avatar no header (img src com u=telefone)
    if (!resolvedPhone) {
      const avatarImg = main.querySelector('header img[src]');
      if (avatarImg) {
        const src = avatarImg.getAttribute('src') || '';
        const match = src.match(/u=(\d{8,15})%40/) || src.match(/(\d{10,14})/);
        if (match && match[1] && match[1].length <= 13) resolvedPhone = match[1];
      }
    }

    // Método D: Se o próprio nome do contato for número
    if (!resolvedPhone) {
      const digits = contactName.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 13) {
        resolvedPhone = digits;
      }
    }

    // Se tiver LID, tenta recuperar o telefone canônico do mapa ou usa o LID temporariamente
    if (resolvedLid) {
      const pureL = resolvedLid.replace(/@.*$/, '').replace(/\D/g, '');
      if (!resolvedPhone && pureL) {
        const fromMap = inMemoryLidPhoneMap.get(pureL);
        if (fromMap) {
          resolvedPhone = fromMap;
        }
      }
      if (resolvedPhone && resolvedPhone.length <= 13) {
        rememberLidPhone(pureL, resolvedPhone);
      } else if (!resolvedPhone) {
        resolvedPhone = pureL;
      }
    }

    currentActivePhone = resolvedPhone;
    currentActiveName = contactName;

    // Extrai avatar do contato no cabeçalho
    const headerAvatarImg = main.querySelector('header img[src]');
    let avatarUrl = headerAvatarImg ? (headerAvatarImg.getAttribute('src') || '') : '';

    // Se um mapa acumulado foi passado (ex: vindo de deepScrollChatHistory), usa-o; caso contrário, faz coleta do DOM atual
    const messagesMap = (accumulatedMessagesMap && accumulatedMessagesMap.size > 0)
      ? accumulatedMessagesMap
      : new Map();

    if (messagesMap.size === 0) {
      harvestDomMessages(messagesMap, resolvedPhone);
    }

    const validContentMsgs = Array.from(messagesMap.values())
      .filter(m => m.content && !isWhatsAppSystemMessage(m.content));

    // Ordenação estritamente cronológica: da mensagem mais antiga para a mais recente
    validContentMsgs.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (isNaN(tA) || isNaN(tB)) return 0;
      return tA - tB;
    });

    const lastMsg = validContentMsgs.length > 0 ? validContentMsgs[validContentMsgs.length - 1] : null;

    console.log(`[Brokiva] Extraídas ${validContentMsgs.length} mensagens limpas e deduplicadas para ${contactName} (${resolvedPhone})`);

    return {
      phone: resolvedPhone,
      lid: resolvedLid || undefined,
      name: contactName,
      avatarUrl: avatarUrl || undefined,
      messages: validContentMsgs,
      lastMessagePreview: lastMsg ? lastMsg.content : '',
      lastMessageAt: lastMsg ? lastMsg.timestamp : new Date().toISOString(),
    };
  }

  // Coleta balões de mensagem do DOM de #main e insere em um Map deduplicado
  function harvestDomMessages(messagesMap, fallbackPhone = '') {
    const main = document.querySelector('#main');
    if (!main) return;

    const rawBubbleElements = Array.from(main.querySelectorAll('div.message-in, div.message-out, div[role="row"]'));
    const uniqueRootContainers = [];
    const seenContainers = new Set();

    for (const el of rawBubbleElements) {
      const bubble = (el.classList?.contains('message-in') || el.classList?.contains('message-out'))
        ? el
        : (el.querySelector?.('.message-in, .message-out') || el);

      if (seenContainers.has(bubble)) continue;
      seenContainers.add(bubble);

      // Descarta avisos de sistema e containers de data/hora no topo
      const isSystemContainer = Boolean(
        bubble.closest?.('[data-testid*="system"]') ||
        bubble.querySelector?.('span[data-icon="lock-small"], span[data-icon="lock"]') ||
        (bubble.getAttribute?.('class') || '').includes('system')
      );
      if (isSystemContainer) continue;

      uniqueRootContainers.push(bubble);
    }

    // Tenta encontrar uma data de referência no chat caso as mensagens iniciais sejam áudios ou anexos
    let lastKnownDateIso = '';
    const dateSpans = Array.from(main.querySelectorAll('div[data-testid*="system"] span, div[role="row"] span[dir="auto"], span.selectable-text'));
    for (const sp of dateSpans) {
      const spText = (sp.innerText || '').trim().toUpperCase();
      const dMatch = spText.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
      if (dMatch) {
        const d = Number(dMatch[1]), mo = Number(dMatch[2]) - 1;
        let y = Number(dMatch[3]);
        if (y < 100) y += 2000;
        const dt = new Date(y, mo, d, 12, 0, 0);
        if (!isNaN(dt.getTime())) {
          lastKnownDateIso = dt.toISOString();
          break;
        }
      } else if (spText === 'ONTEM' || spText === 'YESTERDAY') {
        const dt = new Date();
        dt.setDate(dt.getDate() - 1);
        lastKnownDateIso = dt.toISOString();
        break;
      }
    }

    uniqueRootContainers.forEach((container, index) => {
      // 1. Localiza nó com data-id ESTRITAMENTE associado à mensagem (não busca em ancestrais fora de [role="row"])
      let actualDataId = '';
      if (container.hasAttribute?.('data-id')) {
        actualDataId = container.getAttribute('data-id') || '';
      } else {
        const childWithId = container.querySelector?.('[data-id]');
        if (childWithId) {
          actualDataId = childWithId.getAttribute('data-id') || '';
        } else {
          const parentRow = container.closest?.('div[role="row"]');
          if (parentRow && parentRow.hasAttribute?.('data-id')) {
            actualDataId = parentRow.getAttribute('data-id') || '';
          }
        }
      }

      if (actualDataId.includes('@g.us') || actualDataId.includes('@newsletter') || actualDataId.includes('@broadcast')) {
        return;
      }

      // Validação estrita de ID de mensagem do WhatsApp
      // Deve ter o padrão exato: (true|false)_[remotoJid]_[hashUnico]
      const isRealMsgKey = Boolean(
        actualDataId &&
        /^(true|false)_[^@]+@(c\.us|s\.whatsapp\.net|lid)_[A-Za-z0-9\.\-_]+$/i.test(actualDataId)
      );

      const rawDataId = isRealMsgKey ? actualDataId : '';
      const isDataIdFromMe = isRealMsgKey && rawDataId.startsWith('true_');
      const isDataIdFromContact = isRealMsgKey && rawDataId.startsWith('false_');

      // 2. Extração de texto isolando citação/resposta anterior (Quote) e metadados de hora
      const clone = container.cloneNode(true);

      // Remove blocos de citação (para não contaminar com "Você: [msg anterior]")
      clone.querySelectorAll(
        '[data-testid="quoted-message"], .quoted-mention, [data-testid*="quote"], div[aria-label*="Citação"], div[aria-label*="Quoted"], div._amk4, div._amk6, div._amkb'
      ).forEach(el => el.remove());

      // Remove carimbos de hora, todos os SVGs, títulos de ícones (tail-out, tail-in, ic-fast-forward) e metadados
      clone.querySelectorAll(
        'svg, span[data-icon], div[data-icon], [data-testid="msg-meta"], [data-testid*="time"], div._amjz, div.x1rg5ohu, span.x1rg5ohu'
      ).forEach(el => el.remove());

      // Remove pílulas e balões de reações para não tratar emojis como fotos ou texto fantasma
      clone.querySelectorAll(
        '[data-testid*="reaction"], [aria-label*="reaç" i], [aria-label*="reaction" i], div._amkw, div._amkx, span.x1i10hfl'
      ).forEach(el => el.remove());

      // 1. Identificação de Tipo de Mídia (Vídeo, Documento, Imagem, Áudio PTT)
      const hasVideo = Boolean(
        container.querySelector('video, span[data-icon*="video"], div[data-testid="video-thumb"], button[aria-label*="vídeo" i]')
      );
      const hasDoc = Boolean(
        container.querySelector('span[data-icon*="document"], a[download], [data-testid="document-thumb"], span[data-icon="media-document"]')
      );
      // Imagem ESTRITA: deve possuir container de mídia oficial do WhatsApp ou imagem blob real.
      // NUNCA usar img[src*="data:"] pois no WhatsApp Web todos os emojis e reações são data-URLs!
      const hasImg = !hasVideo && Boolean(
        container.querySelector('div[data-testid="image-thumb"], div[data-testid="media-image"], div[data-testid="image-wrapper"]') ||
        container.querySelector('img[src*="blob:"]:not(.emoji):not([data-plain-text]):not([data-testid*="avatar"])')
      );
      // Áudio ESTRITO: NUNCA usar seletores genéricos como 'Reproduzir', 'Play' ou 'ic-fast-forward'!
      // No WhatsApp Web, mensagens de voz PTT possuem player dedicado ou waveform.
      const hasAudio = !hasVideo && !hasDoc && !hasImg && Boolean(
        container.querySelector('audio, [data-testid="audio-player"], [data-testid="ptt-waveform"], span[data-icon="ptt-play"], span[data-icon="ptt-pause"], span[data-icon="audio-play"], span[data-icon="audio-pause"], button[aria-label*="mensagem de voz" i], button[aria-label*="voice message" i]')
      );

      // 2. Extração ESTRITA de texto digitado pelo usuário
      // No WhatsApp Web, NENHUM metadado de áudio, documento ou hora fica dentro de span.selectable-text!
      const selectableSpan = clone.querySelector('span.selectable-text, .selectable-text');
      let userTypedText = selectableSpan ? selectableSpan.innerText.trim() : '';

      // 3. Sanitização do texto digitado
      if (userTypedText) {
        userTypedText = userTypedText
          // Remove horários residuais colados no final (ex: " 14:32", "\n14:32", " 2:30 PM", " 14:32✓")
          .replace(/[\s\u00a0\u200e\u200f\n\r]+(\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?)\s*$/i, '')
          // Remove tamanhos de arquivo residuais (ex: " (42 KB)", " 42 KB", "1.2 MB", etc.)
          .replace(/\s*\(\s*\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\s*\)/gi, '')
          .replace(/\b\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\b/gi, '')
          // Remove velocidades de reprodução de áudio (ex: "1,0x", "1.5x", "2x")
          .replace(/\b\d([.,]\d)?[xX]\b/g, '')
          // Remove nomes de ícones do WhatsApp Web (tail-out, tail-in, ic-fast-forward)
          .replace(/\b(tail-in|tail-out|ic-fast-forward|fast-forward)\b/gi, '')
          // Limpa múltiplos espaços
          .replace(/\s{2,}/g, ' ')
          .trim();

        // Se começar com cabeçalho "Você:" ou "You:", remove
        userTypedText = userTypedText.replace(/^(Você|Voce|You)\s*[:\n]+/i, '').trim();

        // Se após a limpeza for apenas um horário ou ruído, zera
        if (/^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i.test(userTypedText) || userTypedText.length === 0) {
          userTypedText = '';
        }
      }

      // 4. Determinação final de messageType e content LIMPO (SEM tamanhos, SEM durações, SEM ruído técnico)
      let messageType = 'TEXT';
      let content = '';

      // Regra de ouro: Se o usuário digitou texto real e não há vídeo, documento ou imagem anexada,
      // é 100% uma mensagem de TEXTO! Mensagens de voz no WhatsApp NUNCA têm texto digitado.
      if (userTypedText && !hasDoc && !hasVideo && !hasImg) {
        messageType = 'TEXT';
        content = userTypedText;
      } else if (hasAudio && !userTypedText) {
        messageType = 'AUDIO';
        content = '🎵 Mensagem de Voz';
      } else if (hasDoc) {
        messageType = 'DOCUMENT';
        // Para documento: extrai apenas o nome real do arquivo (ex: "Contrato.pdf"), NUNCA o tamanho
        const nameEl = container.querySelector('span[title*="."], span.x10l6tqk[title], a[download]');
        let rawFileName = (nameEl?.getAttribute('title') || nameEl?.innerText || '').trim();
        // Remove menções de tamanho e quebras do nome
        rawFileName = rawFileName
          .replace(/\s*\(\s*\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\s*\)/gi, '')
          .replace(/\b\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\b/gi, '')
          .replace(/[\n\r]+/g, ' ')
          .trim();

        if (rawFileName && !/^\d+([.,]\d+)?\s*(KB|MB|GB|B)$/i.test(rawFileName) && rawFileName.length > 2) {
          content = `📄 ${rawFileName}`;
        } else {
          content = userTypedText || '📄 Documento';
        }
      } else if (hasVideo) {
        messageType = 'VIDEO';
        content = userTypedText || '🎥 Vídeo';
      } else if (hasImg) {
        messageType = 'IMAGE';
        content = userTypedText || '📷 Foto';
      } else {
        messageType = 'TEXT';
        content = userTypedText;
      }

      // Descarta mensagens puramente vazias, avisos de sistema ou fotos fantasmas sem imagem real
      if (!content || isWhatsAppSystemMessage(content)) return;
      if ((content === '📷 Foto' || content === 'Foto') && !hasImg) return;

      // Validação final de segurança: impede que qualquer string que seja puramente tamanho de arquivo ou ruído seja enviada
      if (
        /^\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)$/i.test(content) ||
        /^\(\s*\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\s*\)$/i.test(content) ||
        /^\d{1,2}:\d{2}\s+(\d[.,]\d[xX]|\dx)$/i.test(content) ||
        content === 'tail-out' || content === 'tail-in' || content === 'ic-fast-forward'
      ) {
        return;
      }

      // 5. Identificação estrita de autoria (Você / Corretor vs Cliente)
      const prePlainNode = container.hasAttribute?.('data-pre-plain-text') ? container :
                           (container.querySelector?.('[data-pre-plain-text]') || container.closest?.('[data-pre-plain-text]'));
      const rawPrePlain = prePlainNode ? (prePlainNode.getAttribute('data-pre-plain-text') || '') : '';
      const cleanPrePlain = rawPrePlain.replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, ' ').trim();

      const isMessageOut = Boolean(
        container.classList?.contains?.('message-out') ||
        container.querySelector?.('.message-out') ||
        container.closest?.('.message-out')
      );

      const isMessageIn = Boolean(
        container.classList?.contains?.('message-in') ||
        container.querySelector?.('.message-in') ||
        container.closest?.('.message-in')
      );

      const hasOutgoingCheckmark = Boolean(container.querySelector(
        'span[data-icon="msg-dblcheck"], span[data-icon="msg-check"], span[data-icon="msg-time"], span[data-testid*="check"]'
      ));

      const isPrePlainFromMe = Boolean(
        /(?:\[.*?\]\s*)?(?:você|voce|you)\s*:/i.test(cleanPrePlain) ||
        /\b(você|voce|you)\b/i.test(cleanPrePlain) ||
        (currentBrokerName && cleanPrePlain.toLowerCase().includes(currentBrokerName.toLowerCase() + ':'))
      );

      let hasOutgoingBg = false;
      try {
        const bg = window.getComputedStyle(container).backgroundColor || '';
        if (bg.includes('217, 253, 211') || bg.includes('0, 92, 75') || bg.includes('217, 253') || bg.includes('0, 92')) {
          hasOutgoingBg = true;
        }
      } catch (e) {}

      // Determinação de autoria: marcadores de envio do corretor têm precedência definitiva
      let isFromMe = false;
      if (isDataIdFromMe) {
        isFromMe = true;
      } else if (isMessageOut) {
        isFromMe = true;
      } else if (isPrePlainFromMe) {
        isFromMe = true;
      } else if (hasOutgoingCheckmark) {
        isFromMe = true;
      } else if (hasOutgoingBg) {
        isFromMe = true;
      } else if (isDataIdFromContact) {
        isFromMe = false;
      } else if (isMessageIn) {
        isFromMe = false;
      } else {
        isFromMe = false;
      }

      // 6. Extração de Data e Hora
      let msgTime = '';
      if (cleanPrePlain) {
        const timeMatch = cleanPrePlain.match(/\[(.*?)\]/);
        if (timeMatch && timeMatch[1]) {
          const rawTime = timeMatch[1].trim();
          // Caso 1: 24-horas [14:04, 10/09/2024]
          const brMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?[,\s]+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
          if (brMatch) {
            let h = Number(brMatch[1]), m = Number(brMatch[2]), s = brMatch[3] ? Number(brMatch[3]) : 0;
            const d = Number(brMatch[4]), mo = Number(brMatch[5]) - 1;
            let y = Number(brMatch[6]);
            if (y < 100) y += 2000;
            const dt = new Date(y, mo, d, h, m, s);
            if (!isNaN(dt.getTime())) {
              msgTime = dt.toISOString();
              lastKnownDateIso = msgTime;
            }
          } else {
            // Caso 2: 12-horas com AM/PM [2:04 PM, 9/10/2024]
            const usMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)[,\s]+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/i);
            if (usMatch) {
              let h = Number(usMatch[1]), m = Number(usMatch[2]), s = usMatch[3] ? Number(usMatch[3]) : 0;
              const isPm = usMatch[4].toUpperCase() === 'PM';
              if (isPm && h < 12) h += 12;
              if (!isPm && h === 12) h = 0;
              const mo = Number(usMatch[5]) - 1, d = Number(usMatch[6]);
              let y = Number(usMatch[7]);
              if (y < 100) y += 2000;
              const dt = new Date(y, mo, d, h, m, s);
              if (!isNaN(dt.getTime())) {
                msgTime = dt.toISOString();
                lastKnownDateIso = msgTime;
              }
            } else {
              const dt = new Date(rawTime);
              if (!isNaN(dt.getTime())) {
                msgTime = dt.toISOString();
                lastKnownDateIso = msgTime;
              }
            }
          }
        }
      }

      // Se não veio no prePlain (comum em áudios e anexos), extrai o horário do balão e herda a data de referência
      if (!msgTime) {
        const timeMatch = (container.innerText || '').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (timeMatch) {
          const base = lastKnownDateIso ? new Date(lastKnownDateIso) : new Date();
          base.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
          msgTime = base.toISOString();
        } else {
          msgTime = lastKnownDateIso || new Date().toISOString();
        }
      }

      // Deduplicação estrita: insere no Map
      // Se for chave nativa do WhatsApp (única por mensagem), usa-a.
      // Se não for chave nativa, usa conteúdo + horário + remetente + índice para NUNCA colapsar mensagens diferentes
      const effectiveDataId = isRealMsgKey ? rawDataId : '';
      const uniqueMsgKey = effectiveDataId || `${content}_${msgTime.slice(0, 19)}_${isFromMe ? '1' : '0'}_${index}`;
      if (!messagesMap.has(uniqueMsgKey)) {
        const p = fallbackPhone || currentActivePhone || 'chat';
        messagesMap.set(uniqueMsgKey, {
          id: effectiveDataId || `wpp-ext-${p}-${messagesMap.size}-${Date.now()}`,
          content,
          fromMe: isFromMe,
          timestamp: msgTime,
          messageType,
        });
      }
    });
  }

  let lastLeadSignature = '';

  // 3. Atualiza UI do Lead Ativo de forma segura e leve
  function updateActiveLeadUI() {
    try {
      const main = document.querySelector('#main');
      const nameElem = document.getElementById('sovereign-lead-name');
      const phoneElem = document.getElementById('sovereign-lead-phone');
      const avatarElem = document.getElementById('sovereign-lead-avatar');
      const syncCurrentBtn = document.getElementById('sovereign-sync-current-btn');

      if (!nameElem || !phoneElem) return;

      if (!main) {
        if (lastLeadSignature !== 'none') {
          lastLeadSignature = 'none';
          nameElem.innerText = 'Nenhum chat selecionado';
          phoneElem.innerText = 'Abra uma conversa no WhatsApp';
          if (avatarElem) avatarElem.innerText = '?';
          if (syncCurrentBtn) syncCurrentBtn.innerHTML = `<span>📥 Salvar Histórico Desta Conversa</span>`;
        }
        return;
      }

      const chatData = extractActiveChatData();
      if (chatData && chatData.phone) {
        const phoneStr = String(chatData.phone);
        const isLidOnly = phoneStr.length >= 14;
        const msgCount = (chatData.messages && chatData.messages.length) || 0;
        const sig = `${phoneStr}-${msgCount}`;

        if (lastLeadSignature !== sig) {
          lastLeadSignature = sig;
          nameElem.innerText = chatData.name || 'Contato WhatsApp';
          phoneElem.innerText = isLidOnly 
            ? `Identificando telefone (${msgCount} msgs carregadas)...`
            : `${formatPhoneDisplay(phoneStr)} (${msgCount} msgs carregadas)`;
          if (avatarElem) avatarElem.innerText = (chatData.name || 'C').charAt(0).toUpperCase();
          if (syncCurrentBtn) {
            syncCurrentBtn.innerHTML = `<span>📥 Salvar ${msgCount} Mensagens no CRM</span>`;
          }

          // Se o identificador for um LID, resolve para o telefone real em segundo plano e atualiza a UI
          if (isLidOnly) {
            resolvePhoneFromCrmIfLid(chatData.name, phoneStr, false)
              .then(realPhone => {
                try {
                  if (realPhone && typeof realPhone === 'string' && realPhone.length <= 13) {
                    chatData.phone = realPhone;
                    currentActivePhone = realPhone;
                    const pElem = document.getElementById('sovereign-lead-phone');
                    if (pElem) {
                      const updatedCount = (chatData.messages && chatData.messages.length) || 0;
                      pElem.innerText = `${formatPhoneDisplay(realPhone)} (${updatedCount} msgs carregadas)`;
                    }
                  }
                } catch (e) {}
              })
              .catch(() => {});
          }
        }
      } else {
        const headerTitle = main.querySelector('header span[title], header div[role="button"] span, header span[dir="auto"]')?.innerText?.trim() || '';
        if (headerTitle && lastLeadSignature !== headerTitle) {
          lastLeadSignature = headerTitle;
          nameElem.innerText = headerTitle;
          phoneElem.innerText = 'Conversa aberta (clique abaixo para ler mensagens)';
          if (avatarElem) avatarElem.innerText = headerTitle.charAt(0).toUpperCase();
        }
      }
    } catch (e) {
      // Falha silenciosa para não poluir o console durante transições de tela
    }
  }

  function findChatScrollContainer() {
    const main = document.querySelector('#main');
    if (!main) return null;

    // 1. Busca a partir de uma mensagem real existente no chat (método mais preciso do DOM)
    const msg = main.querySelector('div.message-in, div.message-out, div[role="row"]');
    if (msg) {
      let curr = msg.parentElement;
      while (curr && curr !== main) {
        if (curr.scrollHeight > curr.clientHeight && curr.clientHeight > 150) {
          const style = window.getComputedStyle(curr);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return curr;
          }
        }
        curr = curr.parentElement;
      }
      // Se nenhum tiver overflow auto/scroll explícito, pega o primeiro ancestral com scrollHeight > clientHeight
      curr = msg.parentElement;
      while (curr && curr !== main) {
        if (curr.scrollHeight > curr.clientHeight && curr.clientHeight > 150) {
          return curr;
        }
        curr = curr.parentElement;
      }
    }

    // 2. Fallbacks diretos conhecidos do WhatsApp Web
    const directScroll = main.querySelector('div[tabindex="-1"][data-tab], div.copyable-area > div[tabindex="-1"], div[role="application"]');
    if (directScroll && directScroll.scrollHeight > directScroll.clientHeight) {
      return directScroll;
    }

    return document.querySelector('#main div[tabindex="-1"]') ||
           document.querySelector('#main .copyable-area')?.parentElement ||
           document.querySelector('#main div[role="application"]');
  }

  // Detecta e clica automaticamente em botões/banners de "Clique para carregar conversas mais antigas"
  async function checkAndClickLoadMoreButton() {
    try {
      const main = document.querySelector('#main');
      if (!main) return false;

      // Procura botões, links ou banners interativos de carregamento de histórico
      const candidates = Array.from(main.querySelectorAll(
        'button, div[role="button"], span[role="button"], div[data-testid*="banner"], div[data-testid*="system"], div[data-testid*="load"]'
      ));

      for (const el of candidates) {
        const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase().trim();
        if (
          (text.includes('clique') && (text.includes('carregar') || text.includes('antig') || text.includes('anterior') || text.includes('baixar'))) ||
          (text.includes('carregar') && (text.includes('mensagem') || text.includes('conversa') || text.includes('antig') || text.includes('anterior'))) ||
          (text.includes('load') && text.includes('older') && text.includes('message')) ||
          (text.includes('click') && text.includes('load'))
        ) {
          console.log('[Brokiva] Botão/Banner de carregamento de histórico detectado:', text);
          const clickTarget = el.closest('button, div[role="button"], span[role="button"]') || el;
          clickTarget.click();
          clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  async function deepScrollChatHistory(targetScrolls = 25, onProgress = null) {
    const main = document.querySelector('#main');
    const scrollContainer = findChatScrollContainer();
    const accumulatedMessages = new Map();
    if (!scrollContainer || !main) {
      harvestDomMessages(accumulatedMessages);
      return accumulatedMessages;
    }

    const badge = document.getElementById('sovereign-sync-badge');

    // 1. Coleta inicial das mensagens mais recentes visíveis agora (hoje)
    harvestDomMessages(accumulatedMessages);
    let lastCount = accumulatedMessages.size;
    let unchangedAttempts = 0;

    for (let i = 0; i < targetScrolls; i++) {
      // Rola o container para o topo absoluto
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

      // Força a primeira mensagem visível a entrar no topo do viewport para disparar o IntersectionObserver do WhatsApp
      const firstRow = main.querySelector('div.message-in, div.message-out, div[role="row"]');
      if (firstRow) {
        try {
          firstRow.scrollIntoView({ block: 'start', behavior: 'instant' });
        } catch (e) {}
      }

      // Dispara evento de roda do mouse (wheel) para cima
      const wheelEvt = new WheelEvent('wheel', {
        deltaY: -1200,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
        view: window,
      });
      scrollContainer.dispatchEvent(wheelEvt);
      if (firstRow) firstRow.dispatchEvent(wheelEvt);

      // Detecta e clica automaticamente em "Clique aqui para carregar conversas mais antigas"
      const clickedLoadMore = await checkAndClickLoadMoreButton();
      if (clickedLoadMore) {
        if (badge) badge.innerText = `Baixando antigas (${i + 1}/${targetScrolls})...`;
        await new Promise(r => setTimeout(r, 1200));
      }

      if (badge) badge.innerText = `Lendo antigas (${i + 1}/${targetScrolls})...`;
      if (typeof onProgress === 'function') onProgress(i + 1, targetScrolls);

      // Aguarda 900ms para o WhatsApp buscar no IndexedDB e renderizar os nós no DOM
      await new Promise(r => setTimeout(r, 900));

      // Se houver spinner/loader ativo no topo, aguarda mais 500ms
      const loader = main.querySelector('[data-testid="chat-history-loader"], [role="progressbar"], span[data-icon="refresh"]');
      if (loader) {
        await new Promise(r => setTimeout(r, 500));
      }

      // Coleta mensagens da página atual no DOM e adiciona ao acumulador
      harvestDomMessages(accumulatedMessages);

      const currentCount = accumulatedMessages.size;
      if (currentCount === lastCount) {
        unchangedAttempts++;
        // Só encerra precocemente se já acumulou um bom volume (>= 15 msgs) E teve 4 tentativas sem novidade,
        // OU se já tentou pelo menos 8 rolagens
        if (unchangedAttempts >= 4 && (currentCount >= 15 || i >= 8)) {
          console.log(`[Brokiva] Início da conversa atingido após ${i + 1} rolagens (${currentCount} msgs).`);
          break;
        }
      } else {
        unchangedAttempts = 0;
        lastCount = currentCount;
      }
    }

    // Retorna a rolagem para o final para restaurar a visualização natural e capturar mensagens de hoje
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

    const allRows = Array.from(main.querySelectorAll('div.message-in, div.message-out, div[role="row"]'));
    const lastRow = allRows.length > 0 ? allRows[allRows.length - 1] : null;
    if (lastRow) {
      try {
        lastRow.scrollIntoView({ block: 'end', behavior: 'instant' });
      } catch (e) {}
    }

    await new Promise(r => setTimeout(r, 350));
    harvestDomMessages(accumulatedMessages);

    return accumulatedMessages;
  }

  async function extractPhoneFromContactDrawer() {
    try {
      const main = document.querySelector('#main');
      if (!main) return null;

      // O botão clicável do cabeçalho que abre a gaveta de dados do contato
      const titleSpan = main.querySelector('header span[title], header div[data-testid="conversation-info-header"] span, header span[dir="auto"]');
      const headerBtn = titleSpan?.closest('div[role="button"], div[tabindex="0"]') || titleSpan;
      if (!headerBtn) return null;

      headerBtn.click();

      let foundPhone = null;
      // Aguarda até 900ms a gaveta lateral montar no DOM
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 110));
        const sidePanel = document.querySelector(
          'div[tabindex="-1"] section, div[tabindex="-1"] aside, div[data-testid="contact-info-drawer"], div[data-testid="chat-info-drawer"], div[tabindex="-1"] div[role="region"]'
        );
        if (sidePanel) {
          const text = sidePanel.innerText || '';
          const phoneMatch = text.match(/\+?55\s?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/) ||
                             text.match(/\+?\d{1,3}\s?\(?\d{2,3}\)?\s?\d{4,5}[-\s]?\d{4}/) ||
                             text.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
          if (phoneMatch) {
            foundPhone = phoneMatch[0].replace(/\D/g, '');
            if (foundPhone.length >= 10) break;
          }
        }
      }

      // Fecha a gaveta lateral
      const closeBtn = document.querySelector('div[tabindex="-1"] span[data-icon="x"]')?.closest('button') ||
                       document.querySelector('div[tabindex="-1"] button[aria-label*="Fechar"], div[tabindex="-1"] button[aria-label*="Close"]') ||
                       document.querySelector('[data-testid="btn-closer"]');
      if (closeBtn) closeBtn.click();
      await new Promise(r => setTimeout(r, 120));

      return foundPhone;
    } catch (e) {
      return null;
    }
  }

  async function resolvePhoneFromCrmIfLid(contactName, phoneOrLid, allowDrawer = false) {
    const phoneStr = String(phoneOrLid || '').trim();

    // Se já é um telefone canônico brasileiro válido
    const isSynthetic = phoneStr.includes('554863562855') || phoneStr.startsWith('55486356');
    if (!isSynthetic && phoneStr.length >= 10 && phoneStr.length <= 13 && phoneStr.startsWith('55')) {
      return phoneStr;
    }

    // 1. Abre gaveta de contato do WhatsApp Web para ler o telefone oficial da agenda
    if (allowDrawer) {
      try {
        const drawerPhone = await extractPhoneFromContactDrawer();
        if (drawerPhone && typeof drawerPhone === 'string' && drawerPhone.length >= 8) {
          const fullPhone = (drawerPhone.startsWith('55') || drawerPhone.length > 11) ? drawerPhone : `55${drawerPhone}`;
          if (phoneStr) rememberLidPhone(phoneStr, fullPhone);
          console.log(`[Brokiva] Telefone extraído da gaveta lateral do WhatsApp Web para "${contactName}": ${fullPhone}`);
          return fullPhone;
        }
      } catch (e) {}
    }

    // 2. Consulta cache local diretamente no storage sincronizado pelo crm-bridge
    try {
      const storage = await chrome.storage.local.get(['brokivaCrmContacts']);
      const list = storage.brokivaCrmContacts || [];
      if (Array.isArray(list) && contactName) {
        const norm = String(contactName).toLowerCase().trim();
        const found = list.find(c => c && c.name && String(c.name).toLowerCase().trim() === norm);
        if (found && found.phone) {
          const clean = String(found.phone).replace(/\D/g, '');
          if (clean.length >= 10 && clean.length <= 13) {
            console.log(`[Brokiva] Telefone extraído do cache de contatos CRM para "${contactName}": ${clean}`);
            return clean;
          }
        }
      }
    } catch (e) {}

    // 3. Pergunta ao background worker (que consulta abas abertas do CRM e storage local)
    try {
      const res = await new Promise(resolve => {
        safeSendMessage({
          action: 'RESOLVE_CONTACT_BY_NAME',
          data: { name: contactName, lid: phoneStr }
        }, resp => {
          resolve(resp?.result);
        });
      });
      if (res && res.phone && typeof res.phone === 'string') {
        console.log(`[Brokiva] Telefone resolvido pelo CRM para "${contactName}": ${res.phone}`);
        return res.phone;
      }
    } catch (e) {}

    // 4. Se tiver LID numérico, usa o LID
    if (phoneStr && phoneStr.length >= 8) {
      return isSynthetic ? (phoneStr.replace(/\D/g, '') || '') : phoneStr;
    }

    // 5. Fallback final determinístico: se o contato não tem telefone exposto nem LID,
    // gera identificador numérico único para NUNCA descartar a conversa
    if (contactName && contactName !== 'Contato WhatsApp') {
      let hash = 0;
      for (let i = 0; i < contactName.length; i++) {
        hash = ((hash << 5) - hash) + contactName.charCodeAt(i);
        hash |= 0;
      }
      const cleanHash = String(Math.abs(hash)).padStart(8, '0').slice(0, 8);
      return `5500${cleanHash}`;
    }

    return '';
  }

  // 4. Sincroniza apenas a conversa atual com carregamento paginado
  async function syncCurrentActiveChat() {
    if (isCurrentChatGroupOrChannel()) {
      alert('Grupos, canais e comunidades não são importados para o CRM como leads comerciais.');
      return;
    }

    const badge = document.getElementById('sovereign-sync-badge');
    if (badge) badge.innerText = 'Carregando histórico...';

    logToConsoleAndCloudWatch('INFO', 'SYNC_SINGLE_START', 'Iniciando leitura da conversa aberta...');

    // Rola para cima profundamente para carregar todo o histórico anterior (até 25 páginas)
    const accumulatedMap = await deepScrollChatHistory(25, (step, total) => {
      if (badge) badge.innerText = `Lendo antigas (${step}/${total})...`;
    });

    const chatData = extractActiveChatData(accumulatedMap);
    if (!chatData || !chatData.phone || chatData.messages.length === 0) {
      logToConsoleAndCloudWatch('WARN', 'SYNC_SINGLE_EMPTY', `Conversa sem mensagens ou não identificada. (Phone: ${chatData?.phone || 'n/d'}, Msgs: ${chatData?.messages?.length || 0})`);
      alert('Abra uma conversa individual com mensagens no WhatsApp antes de sincronizar.');
      if (badge) badge.innerText = 'Pronto';
      return;
    }

    // Garante extração e conversão da foto de perfil em Data URL base64 autônomo
    const headerImg = document.querySelector('#main header img[src]');
    if (headerImg) {
      try {
        const avatarDataUrl = await getContactAvatarDataUrl(headerImg);
        if (avatarDataUrl) {
          chatData.avatarUrl = avatarDataUrl;
        }
      } catch (e) {}
    }

    // Se o telefone extraído for LID, consulta o CRM pelo nome do contato para casar o telefone real
    chatData.phone = await resolvePhoneFromCrmIfLid(chatData.name, chatData.phone, true);

    if (isWhatsAppChannelOrGroup({ phone: chatData.phone, name: chatData.name, lid: chatData.lid })) {
      alert('Este chat foi identificado como grupo ou canal e não será importado para o CRM.');
      if (badge) badge.innerText = 'Ignorado';
      return;
    }

    logToConsoleAndCloudWatch('INFO', 'SYNC_SINGLE_EXTRACTED', `Lidas ${chatData.messages.length} mensagens de ${chatData.name} (${chatData.phone})`);
    if (badge) badge.innerText = 'Salvando...';

    safeSendMessage({
      action: 'SYNC_BATCH_CHATS',
      data: { chats: [chatData] }
    }, (response) => {
      if (response && response.success) {
        logToConsoleAndCloudWatch('INFO', 'SYNC_SINGLE_SUCCESS', `✓ Sucesso! ${chatData.messages.length} msgs enviadas para Brokiva`);
        if (badge) {
          badge.innerText = `✓ ${chatData.messages.length} msgs`;
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
        }
        alert(`🎉 Sucesso! Histórico com ${chatData.messages.length} mensagens de ${chatData.name} (+${chatData.phone}) sincronizado no CRM!`);
      } else {
        logToConsoleAndCloudWatch('ERROR', 'SYNC_SINGLE_FAILED', `Falha ao sincronizar: ${response?.error || 'Erro desconhecido'}`);
        if (badge) badge.innerText = 'Erro';
        console.error('[Brokiva] Erro ao sincronizar conversa atual:', response?.error);
      }
    });
  }

  // Helper: Encontra o container real de rolagem da lista de conversas (#pane-side)
  function findPaneSideScrollContainer() {
    const pane = document.querySelector('#pane-side');
    if (!pane) return null;
    if (pane.scrollHeight > pane.clientHeight) return pane;
    
    // Fallback caso o container de rolagem seja um filho interno
    const children = pane.querySelectorAll('div');
    for (const child of children) {
      if (child.scrollHeight > child.clientHeight && child.clientHeight > 100) {
        const style = window.getComputedStyle(child);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return child;
        }
      }
    }
    return pane;
  }

  // Helper: Obtém as linhas de conversas visíveis no DOM virtual do WhatsApp
  function getVisibleChatRows() {
    const pane = findPaneSideScrollContainer() || document.querySelector('#pane-side');
    if (!pane) return [];

    const rows = [];
    const seenContainers = new Set();
    const seenKeys = new Set();
    const paneRect = pane.getBoundingClientRect();

    // Localiza os contêineres principais de cada linha de chat na lista virtual
    const rawRowContainers = Array.from(pane.querySelectorAll('div[role="row"], div[data-testid="cell-frame-container"], div[role="listitem"]'));

    for (const container of rawRowContainers) {
      const rowContainer = container.getAttribute('role') === 'row' ? container : (container.closest('div[role="row"]') || container);
      if (seenContainers.has(rowContainer)) continue;

      // Validação de visibilidade no viewport
      const rowRect = rowContainer.getBoundingClientRect();
      if (rowRect.height === 0 || rowRect.width === 0) continue;
      if (rowRect.bottom < (paneRect.top - 50) || rowRect.top > (paneRect.bottom + 100)) continue;

      // Busca o span do NOME do contato dentro desta linha específica
      // O nome do contato no WhatsApp Web fica dentro de cell-frame-title ou é o span[dir="auto"] principal superior
      const allSpansInRow = Array.from(rowContainer.querySelectorAll(
        'div[data-testid="cell-frame-title"] span[title], ' +
        'div[data-testid="cell-frame-title"] span[dir="auto"], ' +
        'span[dir="auto"][title], ' +
        'span[title], ' +
        'span[dir="auto"]'
      ));

      let contactTitleSpan = null;
      let contactTitle = '';

      for (const span of allSpansInRow) {
        const rawT = (span.getAttribute('title') || span.innerText || '').trim();
        const lowerT = rawT.toLowerCase();

        // Ignora status de mensagens, ícones, datas e horas
        if (
          !rawT ||
          rawT.length < 1 ||
          lowerT === 'lida' ||
          lowerT === 'entregue' ||
          lowerT === 'enviada' ||
          lowerT === 'pendente' ||
          lowerT === 'read' ||
          lowerT === 'delivered' ||
          lowerT === 'sent' ||
          /^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i.test(rawT) ||
          /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(rawT)
        ) {
          continue;
        }

        contactTitleSpan = span;
        contactTitle = rawT;
        break;
      }

      if (!contactTitleSpan || !contactTitle) continue;

      // Ignora itens de sistema, canais e grupos
      if (isRowGroupOrChannel(rowContainer, contactTitle)) continue;

      const rowImg = rowContainer.querySelector('img[src]');
      const rowAvatarSrc = (rowImg && !rowImg.getAttribute('src')?.includes('data:image/svg')) ? rowImg.getAttribute('src') : '';

      seenContainers.add(rowContainer);

      const key = contactTitle.toLowerCase().trim();
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        rows.push({
          title: contactTitle,
          key,
          span: contactTitleSpan,
          clickable: rowContainer,
          rowImg: rowImg || null,
          rowAvatarSrc: rowAvatarSrc || ''
        });
      }
    }

    return rows;
  }

  // ==========================================================================
  // CONTROLE DO MODAL DE SINCRONIZAÇÃO EM MASSA (OVERLAY FULL-SCREEN COM BLUR)
  // ==========================================================================
  let cancelSyncRequested = false;

  function ensureSyncModalExists() {
    let overlay = document.getElementById('brokiva-sync-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'brokiva-sync-overlay';
      overlay.innerHTML = `
        <div class="brokiva-sync-modal">
          <div class="brokiva-modal-glow"></div>
          
          <div class="brokiva-modal-icon-wrap" id="brokiva-modal-icon">
            <div class="brokiva-spinner-ring" id="brokiva-modal-spinner"></div>
            <svg class="brokiva-icon-sync" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </div>

          <h2 class="brokiva-modal-title" id="brokiva-modal-title">Sincronizando com a Brokiva CRM</h2>
          <p class="brokiva-modal-subtitle" id="brokiva-modal-subtitle">
            Importando histórico completo de conversas e mensagens com segurança...
          </p>

          <div class="brokiva-stats-grid">
            <div class="brokiva-stat-card">
              <span class="brokiva-stat-label">Conversas</span>
              <span class="brokiva-stat-val" id="brokiva-stat-chats">0</span>
            </div>
            <div class="brokiva-stat-card">
              <span class="brokiva-stat-label">Mensagens Salvas</span>
              <span class="brokiva-stat-val highlight" id="brokiva-stat-msgs">0</span>
            </div>
            <div class="brokiva-stat-card">
              <span class="brokiva-stat-label">Progresso</span>
              <span class="brokiva-stat-val" id="brokiva-stat-pct">0%</span>
            </div>
          </div>

          <div class="brokiva-current-lead-card" id="brokiva-current-lead-card">
            <div class="brokiva-lead-badge-pulse" id="brokiva-lead-pulse"></div>
            <div class="brokiva-lead-info">
              <div class="brokiva-lead-name" id="brokiva-lead-name">Iniciando conexão...</div>
              <div class="brokiva-lead-action" id="brokiva-lead-action">Aguardando varredura</div>
            </div>
          </div>

          <div class="brokiva-progress-track">
            <div class="brokiva-progress-bar" id="brokiva-modal-progress-bar" style="width: 0%;"></div>
          </div>

          <div class="brokiva-modal-footer" id="brokiva-modal-footer">
            <div class="brokiva-security-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Sincronização direta e segura</span>
            </div>
            <button type="button" id="brokiva-cancel-sync-btn" class="brokiva-cancel-btn">
              Cancelar Sincronização
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cancelBtn = overlay.querySelector('#brokiva-cancel-sync-btn');
      cancelBtn?.addEventListener('click', () => {
        cancelSyncRequested = true;
        const actionEl = document.getElementById('brokiva-lead-action');
        if (actionEl) actionEl.innerText = 'Interrompendo e finalizando sincronização...';
        if (cancelBtn) cancelBtn.disabled = true;
      });
    }
    return overlay;
  }

  function openSyncModal(maxChats) {
    cancelSyncRequested = false;
    const overlay = ensureSyncModalExists();
    overlay.classList.add('active');

    const titleEl = document.getElementById('brokiva-modal-title');
    const subtitleEl = document.getElementById('brokiva-modal-subtitle');
    const statChats = document.getElementById('brokiva-stat-chats');
    const statMsgs = document.getElementById('brokiva-stat-msgs');
    const statPct = document.getElementById('brokiva-stat-pct');
    const leadName = document.getElementById('brokiva-lead-name');
    const leadAction = document.getElementById('brokiva-lead-action');
    const bar = document.getElementById('brokiva-modal-progress-bar');
    const iconWrap = document.getElementById('brokiva-modal-icon');
    const footer = document.getElementById('brokiva-modal-footer');

    if (titleEl) titleEl.innerText = 'Sincronizando com a Brokiva CRM';
    if (subtitleEl) subtitleEl.innerText = 'Importando histórico completo de conversas e mensagens com segurança...';
    if (statChats) statChats.innerText = `0 / ${maxChats}`;
    if (statMsgs) statMsgs.innerText = '0';
    if (statPct) statPct.innerText = '0%';
    if (leadName) leadName.innerText = 'Iniciando varredura no WhatsApp Web...';
    if (leadAction) leadAction.innerText = 'Preparando lista de conversas...';
    if (bar) bar.style.width = '0%';

    if (iconWrap) {
      iconWrap.style.borderColor = '#334155';
      iconWrap.style.color = '#38bdf8';
      iconWrap.innerHTML = `
        <div class="brokiva-spinner-ring" id="brokiva-modal-spinner"></div>
        <svg class="brokiva-icon-sync" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
      `;
    }

    if (footer) {
      footer.innerHTML = `
        <div class="brokiva-security-tag">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Sincronização direta e segura</span>
        </div>
        <button type="button" id="brokiva-cancel-sync-btn" class="brokiva-cancel-btn">
          Cancelar Sincronização
        </button>
      `;
      const cancelBtn = footer.querySelector('#brokiva-cancel-sync-btn');
      cancelBtn?.addEventListener('click', () => {
        cancelSyncRequested = true;
        const actionEl = document.getElementById('brokiva-lead-action');
        if (actionEl) actionEl.innerText = 'Interrompendo e finalizando sincronização...';
        if (cancelBtn) cancelBtn.disabled = true;
      });
    }
  }

  function updateSyncModalProgress({ syncedCount, maxChats, contactName, actionText, totalMessages }) {
    const statChats = document.getElementById('brokiva-stat-chats');
    const statMsgs = document.getElementById('brokiva-stat-msgs');
    const statPct = document.getElementById('brokiva-stat-pct');
    const leadName = document.getElementById('brokiva-lead-name');
    const leadAction = document.getElementById('brokiva-lead-action');
    const bar = document.getElementById('brokiva-modal-progress-bar');

    const pct = Math.min(100, Math.round(((syncedCount || 0) / maxChats) * 100));

    if (statChats && syncedCount !== undefined) statChats.innerText = `${syncedCount} / ${maxChats}`;
    if (statMsgs && totalMessages !== undefined) statMsgs.innerText = `${totalMessages.toLocaleString('pt-BR')}`;
    if (statPct) statPct.innerText = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;
    if (leadName && contactName) leadName.innerText = contactName;
    if (leadAction && actionText) leadAction.innerText = actionText;
  }

  function finishSyncModal({ totalChats, totalMessages }) {
    const titleEl = document.getElementById('brokiva-modal-title');
    const subtitleEl = document.getElementById('brokiva-modal-subtitle');
    const statChats = document.getElementById('brokiva-stat-chats');
    const statMsgs = document.getElementById('brokiva-stat-msgs');
    const statPct = document.getElementById('brokiva-stat-pct');
    const leadName = document.getElementById('brokiva-lead-name');
    const leadAction = document.getElementById('brokiva-lead-action');
    const bar = document.getElementById('brokiva-modal-progress-bar');
    const iconWrap = document.getElementById('brokiva-modal-icon');
    const footer = document.getElementById('brokiva-modal-footer');

    if (titleEl) titleEl.innerText = '🎉 Sincronização Concluída!';
    if (subtitleEl) subtitleEl.innerText = `${totalChats} conversas e ${totalMessages.toLocaleString('pt-BR')} mensagens importadas com sucesso!`;
    if (statChats) statChats.innerText = `${totalChats}`;
    if (statMsgs) statMsgs.innerText = `${totalMessages.toLocaleString('pt-BR')}`;
    if (statPct) statPct.innerText = '100%';
    if (bar) bar.style.width = '100%';
    if (leadName) leadName.innerText = 'Processo concluído com êxito';
    if (leadAction) leadAction.innerText = 'Histórico sincronizado e pronto no CRM.';

    if (iconWrap) {
      iconWrap.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      iconWrap.style.borderColor = '#10b981';
      iconWrap.style.color = '#10b981';
    }

    if (footer) {
      footer.innerHTML = `
        <button type="button" id="brokiva-close-modal-btn" class="brokiva-done-btn">
          Concluir e Fechar
        </button>
      `;
      const closeBtn = footer.querySelector('#brokiva-close-modal-btn');
      closeBtn?.addEventListener('click', closeSyncModal);
    }

    // Auto fecha após 5 segundos
    setTimeout(() => {
      closeSyncModal();
    }, 5000);
  }

  function closeSyncModal() {
    const overlay = document.getElementById('brokiva-sync-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  // 5. Varredura Automática Paginada com Carregamento Profundo e Tela de Bloqueio
  async function executeBatchHistoryScan() {
    if (isSyncing) return;
    isSyncing = true;

    const btn = document.getElementById('sovereign-batch-sync-btn');
    const progressBar = document.getElementById('sovereign-progress-bar');
    const progressFill = document.getElementById('sovereign-progress-fill');
    const progressStatus = document.getElementById('sovereign-progress-status');

    if (btn) btn.disabled = true;
    if (progressBar) progressBar.style.display = 'block';
    if (progressStatus) {
      progressStatus.style.display = 'block';
      progressStatus.innerText = 'Iniciando varredura e rolagem das conversas...';
    }

    const MAX_TARGET_CHATS = 50; // Limite de conversas para sincronizar
    let totalMessagesSynced = 0;

    // Abre a tela de carregamento (modal com blur) cobrindo o WhatsApp Web
    openSyncModal(MAX_TARGET_CHATS);

    logToConsoleAndCloudWatch('INFO', 'BATCH_SCAN_INITIATED', 'Varredura em lote profunda iniciada');

    const scrollContainer = findPaneSideScrollContainer() || document.querySelector('#pane-side');
    if (!scrollContainer) {
      logToConsoleAndCloudWatch('WARN', 'NO_PANE_SIDE', 'Container #pane-side não encontrado');
      closeSyncModal();
      alert('Nenhum chat visível no WhatsApp Web. Certifique-se de que o WhatsApp Web está aberto.');
      isSyncing = false;
      if (btn) btn.disabled = false;
      return;
    }

    // Rola suavemente para o topo antes de iniciar para garantir a varredura a partir do início
    try {
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      await new Promise(r => setTimeout(r, 450));
    } catch (e) {}

    const processedChatKeys = new Set();
    const syncedChats = [];
    let consecutiveScrollsWithoutNew = 0;
    let totalAttempts = 0;

    while (syncedChats.length < MAX_TARGET_CHATS && consecutiveScrollsWithoutNew < 5) {
      if (cancelSyncRequested) {
        logToConsoleAndCloudWatch('INFO', 'BATCH_SCAN_CANCELLED', 'Sincronização cancelada pelo corretor');
        break;
      }

      const visibleRows = getVisibleChatRows();
      // Localiza a próxima conversa visível que ainda não foi sincronizada nesta rodada
      const nextRow = visibleRows.find(r => !processedChatKeys.has(r.key));

      if (nextRow) {
        consecutiveScrollsWithoutNew = 0;
        processedChatKeys.add(nextRow.key);
        totalAttempts++;

        const currentName = nextRow.title;

        updateSyncModalProgress({
          syncedCount: syncedChats.length,
          maxChats: MAX_TARGET_CHATS,
          contactName: currentName,
          actionText: 'Abrindo conversa...',
          totalMessages: totalMessagesSynced,
        });

        if (progressStatus) {
          progressStatus.innerText = `Lendo chat ${totalAttempts} (${syncedChats.length} salvos): ${currentName}...`;
        }

        logToConsoleAndCloudWatch('DEBUG', 'OPENING_CHAT', `Abrindo chat (${syncedChats.length + 1}/${MAX_TARGET_CHATS}): ${currentName}`);

        const headerTitleEl = document.querySelector('#main header span[title], #main header div[role="button"] span, #main header span[dir="auto"]');
        const previousHeaderTitle = (headerTitleEl ? (headerTitleEl.getAttribute('title') || headerTitleEl.innerText) : '').trim();

        // Rola o item para o centro da lista antes do clique
        try {
          nextRow.clickable.scrollIntoView({ block: 'center', behavior: 'auto' });
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {}

        // Dispara cliques nativos e eventos de ponteiro/mouse para o WhatsApp Web abrir o chat
        try { nextRow.clickable.click(); } catch (e) {}
        try { nextRow.span.click(); } catch (e) {}
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
          try {
            nextRow.clickable.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
            nextRow.span.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
          } catch (e) {}
        });

        // Aguarda confirmação ativa de abertura do chat para evitar contaminação
        const transitionOk = await waitForChatToOpen(currentName, previousHeaderTitle, 3500);
        if (!transitionOk) {
          logToConsoleAndCloudWatch('WARN', 'CHAT_OPEN_TIMEOUT', `Chat "${currentName}" demorou a responder ou não abriu. Pulando para evitar contaminação.`);
          continue;
        }

        if (cancelSyncRequested) break;

        // Se o chat aberto for grupo ou canal, ignora imediatamente
        if (isCurrentChatGroupOrChannel()) {
          logToConsoleAndCloudWatch('INFO', 'GROUP_OR_CHANNEL_IGNORED', `Chat "${currentName}" identificado como grupo ou canal no #main. Pulando.`);
          continue;
        }

        // CARREGAMENTO PROFUNDO: Rola para cima na conversa aberta para carregar mensagens antigas!
        updateSyncModalProgress({
          syncedCount: syncedChats.length,
          maxChats: MAX_TARGET_CHATS,
          contactName: currentName,
          actionText: 'Carregando mensagens anteriores...',
          totalMessages: totalMessagesSynced,
        });

        const accumulatedMap = await deepScrollChatHistory(15, (step, total) => {
          updateSyncModalProgress({
            syncedCount: syncedChats.length,
            maxChats: MAX_TARGET_CHATS,
            contactName: currentName,
            actionText: `Carregando histórico anterior (${step}/${total})...`,
            totalMessages: totalMessagesSynced,
          });
        });

        if (cancelSyncRequested) break;

        // Extrai dados completos da conversa aberta com todo o histórico acumulado
        let chatData = extractActiveChatData(accumulatedMap);
        if (!chatData || !chatData.messages || chatData.messages.length === 0) {
          await new Promise(r => setTimeout(r, 350));
          chatData = extractActiveChatData(accumulatedMap);
        }

        if (chatData) {
          // Garante foto de perfil via header ou item da lista lateral convertido para base64 autônomo
          const headerImg = document.querySelector('#main header img[src]');
          const targetImgOrSrc = (headerImg && headerImg.getAttribute('src')) ? headerImg : (nextRow?.rowImg || nextRow?.rowAvatarSrc || chatData.avatarUrl);
          if (targetImgOrSrc) {
            try {
              const avatarDataUrl = await getContactAvatarDataUrl(targetImgOrSrc);
              if (avatarDataUrl) {
                chatData.avatarUrl = avatarDataUrl;
              }
            } catch (e) {}
          }
          chatData.phone = await resolvePhoneFromCrmIfLid(chatData.name, chatData.phone, true);
        }

        if (chatData && chatData.phone && !isWhatsAppChannelOrGroup({ phone: chatData.phone, name: chatData.name, lid: chatData.lid })) {
          syncedChats.push(chatData);
          const msgsCount = chatData.messages ? chatData.messages.length : 0;
          totalMessagesSynced += msgsCount;

          logToConsoleAndCloudWatch('INFO', 'CHAT_INGEST_PAYLOAD', `Ingerindo ${msgsCount} msgs de ${chatData.name} (${chatData.phone})`);

          // Envia imediatamente cada chat para a API da Brokiva e aguarda confirmação do backend
          await new Promise((resolve) => {
            safeSendMessage({
              action: 'SYNC_BATCH_CHATS',
              data: { chats: [chatData] }
            }, (res) => {
              if (res && res.success) {
                logToConsoleAndCloudWatch('INFO', 'CHAT_SAVED_OK', `✓ Chat ${chatData.name} salvo com sucesso no CRM`);
              } else {
                logToConsoleAndCloudWatch('ERROR', 'CHAT_SAVE_FAIL', `Falha ao salvar ${chatData.name}: ${res?.error || 'sem resposta'}`);
              }
              resolve(res);
            });
          });

          updateSyncModalProgress({
            syncedCount: syncedChats.length,
            maxChats: MAX_TARGET_CHATS,
            contactName: `${chatData.name} (${formatPhoneDisplay(chatData.phone)})`,
            actionText: `✓ ${msgsCount} mensagens sincronizadas`,
            totalMessages: totalMessagesSynced,
          });
        } else {
          logToConsoleAndCloudWatch('WARN', 'CHAT_SKIPPED', `Chat "${currentName}": Ignorado (grupo, canal ou sem identificador válido)`);
        }

        // Atualiza barra de progresso na sidebar
        const pct = Math.min(100, Math.round((syncedChats.length / MAX_TARGET_CHATS) * 100));
        if (progressFill) progressFill.style.width = `${pct}%`;

        // Pausa breve entre conversas
        await new Promise(r => setTimeout(r, 200));

      } else {
        // Todas as conversas visíveis no viewport atual já foram processadas.
        // Rola o #pane-side para baixo para forçar a montagem do próximo lote virtual
        const pane = findPaneSideScrollContainer() || document.querySelector('#pane-side');
        if (!pane) break;

        const prevScrollTop = pane.scrollTop;
        const scrollStep = Math.max(320, Math.round(pane.clientHeight * 0.75));

        updateSyncModalProgress({
          syncedCount: syncedChats.length,
          maxChats: MAX_TARGET_CHATS,
          contactName: 'Rolando lista de conversas...',
          actionText: 'Buscando próximas conversas do WhatsApp...',
          totalMessages: totalMessagesSynced,
        });

        if (progressStatus) {
          progressStatus.innerText = `Rolando conversas para baixo (${syncedChats.length} lidos)...`;
        }

        pane.scrollTop += scrollStep;
        pane.dispatchEvent(new Event('scroll', { bubbles: true }));
        pane.dispatchEvent(new WheelEvent('wheel', { deltaY: scrollStep, bubbles: true }));

        // Aguarda a janela virtual do React/WhatsApp montar os novos elementos
        await new Promise(r => setTimeout(r, 700));

        const currentScrollTop = pane.scrollTop;
        const isAtBottom = (pane.scrollTop + pane.clientHeight) >= (pane.scrollHeight - 20);

        if (Math.abs(currentScrollTop - prevScrollTop) < 5 || isAtBottom) {
          consecutiveScrollsWithoutNew++;
          logToConsoleAndCloudWatch('DEBUG', 'SCROLL_BOTTOM_CHECK', `Atingiu fim de rolagem ou repetição (tentativa ${consecutiveScrollsWithoutNew}/5)`);
        }
      }
    }

    isSyncing = false;
    if (btn) btn.disabled = false;
    if (progressFill) progressFill.style.width = '100%';
    if (progressStatus) {
      if (syncedChats.length === 0) {
        progressStatus.innerText = `⚠️ Nenhuma conversa 1:1 elegível encontrada na lista. (Grupos e canais foram ignorados).`;
        progressStatus.style.color = '#e11d48';
      } else {
        progressStatus.innerText = `🎉 Sucesso! ${syncedChats.length} conversas e ${totalMessagesSynced.toLocaleString('pt-BR')} mensagens sincronizadas com a Brokiva!`;
        progressStatus.style.color = '#059669';
      }
    }

    finishSyncModal({
      totalChats: syncedChats.length,
      totalMessages: totalMessagesSynced,
    });

    logToConsoleAndCloudWatch('INFO', 'BATCH_SCAN_COMPLETE', `Varredura profunda finalizada: ${syncedChats.length} chats e ${totalMessagesSynced} mensagens sincronizadas`);
  }

  // 6. Copiloto de IA: Sugere e insere resposta com 1 clique no WhatsApp Web
  function triggerAiSuggestion() {
    const chatData = extractActiveChatData();
    if (!chatData || chatData.messages.length === 0) {
      alert('Abra uma conversa com histórico para o Copiloto analisar.');
      return;
    }

    const suggestionsContainer = document.getElementById('sovereign-ai-suggestions');
    if (suggestionsContainer) {
      suggestionsContainer.innerHTML = '<p style="font-size:11px; color:#94a3b8; text-align:center;">Analisando momento comercial...</p>';
    }

    const formattedHistory = chatData.messages.slice(-10).map(m => ({
      sender: m.fromMe ? 'BROKER' : 'CLIENT',
      text: m.content,
    }));

    safeSendMessage({
      action: 'GET_AI_SUGGESTION',
      data: {
        chatHistory: formattedHistory,
        contactContext: { name: chatData.name, phone: chatData.phone }
      }
    }, (res) => {
      if (!suggestionsContainer) return;
      suggestionsContainer.innerHTML = '';

      if (res && res.success && res.result?.data?.responseOptions) {
        const options = res.result.data.responseOptions;
        options.forEach(opt => {
          const item = document.createElement('div');
          item.className = 'sovereign-ai-reply';
          item.innerText = opt.text || opt;
          item.addEventListener('click', () => insertTextIntoWhatsAppInput(opt.text || opt));
          suggestionsContainer.appendChild(item);
        });
      } else {
        // Sugestão padrão de fallback comercial
        const defaultOptions = [
          `Olá ${chatData.name}, tudo bem? Separei algumas opções exclusivas dentro do seu perfil. Posso te enviar o material?`,
          `Perfeito! Quando seria um bom momento para conversarmos rapidamente ou agendarmos uma visita?`,
          `Com certeza! Consigo condições especiais direto com a construtora para essa unidade.`
        ];
        defaultOptions.forEach(text => {
          const item = document.createElement('div');
          item.className = 'sovereign-ai-reply';
          item.innerText = text;
          item.addEventListener('click', () => insertTextIntoWhatsAppInput(text));
          suggestionsContainer.appendChild(item);
        });
      }
    });
  }

  // 7. Insere texto automaticamente no campo de digitação do WhatsApp Web
  function insertTextIntoWhatsAppInput(text) {
    const inputField = document.querySelector('#main footer div[contenteditable="true"][data-tab="10"]') ||
                       document.querySelector('#main footer div[contenteditable="true"]');
    if (!inputField) {
      alert('Campo de mensagem do WhatsApp não encontrado.');
      return;
    }

    inputField.focus();
    document.execCommand('insertText', false, text);
    inputField.dispatchEvent(new Event('change', { bubbles: true }));

    // Feedback visual
    const root = document.getElementById('sovereign-crm-root');
    if (root) root.classList.remove('open');
  }

  // 8. Inicialização Segura (Sem loops no DOM)
  function init() {
    injectSidebar();

    // Verificação periódica segura a cada 1.5s sem travar o navegador
    setInterval(updateActiveLeadUI, 1500);
  }

  // Aguarda carregamento do WhatsApp Web
  const checkInterval = setInterval(() => {
    if (document.querySelector('#app') || document.querySelector('#pane-side')) {
      clearInterval(checkInterval);
      setTimeout(init, 1000);
    }
  }, 500);

})();
