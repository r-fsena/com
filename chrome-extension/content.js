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

  // 1. Injeta a Sidebar do CRM no DOM com suporte a Login Próprio e Persistente
  function injectSidebar() {
    if (document.getElementById('sovereign-crm-root')) return;

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
                Brokiva <span style="font-size:10px; background:#3742AC; color:white; padding:1px 6px; border-radius:4px; margin-left:8px; font-weight:700;">v1.0.3</span>
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
      lower.includes('you blocked this contact')
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

  // 2. Extrai dados da conversa ativa no WhatsApp Web
  function extractActiveChatData() {
    const main = document.querySelector('#main');
    if (!main) {
      console.log('[Brokiva] #main não encontrado');
      return null;
    }

    // 1. Identifica nome e título no header do chat
    const headerTitleSpan = main.querySelector('header span[title], header div[role="button"] span, header span[dir="auto"]');
    const contactName = headerTitleSpan ? (headerTitleSpan.getAttribute('title') || headerTitleSpan.innerText).trim() : 'Contato WhatsApp';

    // 2. Busca mensagens por múltiplos seletores resilientes do WhatsApp Web
    let messageElements = Array.from(main.querySelectorAll(
      'div[data-testid="msg-container"], div.message-in, div.message-out, div[data-id], div[class*="message-"], div.copyable-text'
    ));

    // Fallback: seletor baseado em copyable-text ou selectable-text
    if (messageElements.length === 0) {
      const copyableNodes = Array.from(main.querySelectorAll('.copyable-text, [data-pre-plain-text], .selectable-text'));
      messageElements = copyableNodes.map(node => node.closest('div[role="row"]') || node.parentElement || node);
    }

    console.log(`[Brokiva] Encontrados ${messageElements.length} elementos de mensagem em #main`);

    // 3. Localiza telefone do contato e LID
    let resolvedPhone = '';
    let resolvedLid = '';

    // Método A: Busca telefone real no Header do WhatsApp Web (+55 (11) 99600-0862)
    const headerElement = main.querySelector('header');
    if (headerElement) {
      const headerText = headerElement.innerText || '';
      const phoneMatch = headerText.match(/\+?55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/) ||
                         headerText.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
      if (phoneMatch) {
        const cleanHeaderDigits = phoneMatch[0].replace(/\D/g, '');
        if (cleanHeaderDigits.length >= 10 && cleanHeaderDigits.length <= 13) {
          resolvedPhone = cleanHeaderDigits;
          console.log(`[Brokiva] Telefone extraído com sucesso do header: ${resolvedPhone}`);
        }
      }
    }

    // Método B: Atributos data-id em elementos de #main (suporta @c.us, @s.whatsapp.net e @lid)
    const allDataIdElements = main.querySelectorAll('[data-id]');
    for (const el of allDataIdElements) {
      const dataId = el.getAttribute('data-id') || '';
      if (dataId.includes('@g.us')) {
        console.log('[Brokiva] Grupo detectado, ignorando');
        return null;
      }
      if (!resolvedLid && dataId.includes('@lid')) {
        const lidMatch = dataId.match(/_(\d{8,18})@lid/) || dataId.match(/(\d{8,18})@lid/);
        if (lidMatch && lidMatch[1]) {
          resolvedLid = `${lidMatch[1]}@lid`;
        }
      }
      // Suporta tanto @c.us quanto @s.whatsapp.net
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

    // 4. Extrai balões de mensagem
    const messages = [];
    messageElements.forEach((el, index) => {
      if (!el) return;
      const container = (el.closest && (el.closest('[data-id]') || el.closest('div[role="row"]'))) || el;
      if (!container) return;

      const dataId = (container.getAttribute && container.getAttribute('data-id')) || 
                     (el.getAttribute && el.getAttribute('data-id')) || '';
      
      // Filtro 1: Ignora containers de aviso de sistema/criptografia do WhatsApp Web
      const isSystemContainer = Boolean(
        container.closest?.('[data-testid*="system"]') ||
        container.querySelector?.('span[data-icon="lock-small"], span[data-icon="lock"]') ||
        el.querySelector?.('span[data-icon="lock-small"], span[data-icon="lock"]') ||
        (container.getAttribute?.('class') || '').includes('system')
      );
      if (isSystemContainer) return;

      const prePlain = container.querySelector?.('[data-pre-plain-text]')?.getAttribute?.('data-pre-plain-text') || 
                       el.querySelector?.('[data-pre-plain-text]')?.getAttribute?.('data-pre-plain-text') || 
                       (container.getAttribute ? container.getAttribute('data-pre-plain-text') : '') || '';

      const hasCheckmark = Boolean(container.querySelector?.(
        'span[data-icon*="check"], span[data-icon="msg-time"], span[data-testid*="check"], span[aria-label*="Lida"], span[aria-label*="Entregue"], span[aria-label*="Enviada"], span[aria-label*="Read"], span[aria-label*="Delivered"], span[aria-label*="Sent"]'
      ));

      const hasMessageOutClass = Boolean(
        container?.classList?.contains?.('message-out') || 
        container?.closest?.('.message-out') || 
        (container?.getAttribute?.('class') || '').includes('message-out')
      );

      let isRightAligned = false;
      try {
        if (main?.getBoundingClientRect) {
          const mainRect = main.getBoundingClientRect();
          const targetBox = container.querySelector?.('.selectable-text') || container;
          if (targetBox?.getBoundingClientRect) {
            const boxRect = targetBox.getBoundingClientRect();
            const boxCenter = boxRect.left + (boxRect.width / 2);
            const mainCenter = mainRect.left + (mainRect.width / 2);
            if (boxCenter > mainCenter) {
              isRightAligned = true;
            }
          }
        }
      } catch (e) {}

      let isFromMe = false;
      if (dataId.startsWith('true_')) {
        isFromMe = true;
      } else if (dataId.startsWith('false_')) {
        // Se o data-id diz explicitamente false_, mas tem checkmark de envio, confia no checkmark
        isFromMe = hasCheckmark;
      } else {
        // Fallback quando não há data-id no container
        isFromMe = hasCheckmark || isRightAligned || hasMessageOutClass || prePlain.includes('Você:') || prePlain.includes('You:');
      }

      // Validação cruzada com checkmark: se tem checkmark de envio, é garantidamente do dono do WhatsApp
      if (hasCheckmark) {
        isFromMe = true;
      }

      const textNode = el.querySelector('.selectable-text, .copyable-text span, div.copyable-text, span.selectable-text, span[dir="ltr"]');
      let content = textNode ? textNode.innerText.trim() : (el.innerText || '').trim();

      // Limpa horários grudados no final
      content = content.replace(/\n\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i, '').trim();

      // Filtro 2: Ignora qualquer aviso de sistema (criptografia, mensagens temporárias, etc.)
      if (!content || isWhatsAppSystemMessage(content)) return;

      let messageType = 'TEXT';
      if (el.querySelector('audio')) {
        messageType = 'AUDIO';
        content = content || '🎵 Mensagem de Voz';
      } else if (el.querySelector('img[src*="blob:"], img[src*="data:"], div[data-testid="image-thumb"]')) {
        messageType = 'IMAGE';
        content = content || '📷 Foto';
      } else if (el.querySelector('span[data-icon*="document"], a[download]')) {
        messageType = 'DOCUMENT';
        content = content || '📄 Documento';
      }

      if (!content || isWhatsAppSystemMessage(content)) return;

      let msgTime = new Date().toISOString();
      if (prePlain) {
        const timeMatch = prePlain.match(/\[(.*?)\]/);
        if (timeMatch && timeMatch[1]) {
          const rawTime = timeMatch[1].trim();
          const brMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?[,\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
          if (brMatch) {
            const h = Number(brMatch[1]), m = Number(brMatch[2]), s = brMatch[3] ? Number(brMatch[3]) : 0;
            const d = Number(brMatch[4]), mo = Number(brMatch[5]) - 1;
            let y = Number(brMatch[6]);
            if (y < 100) y += 2000;
            const dt = new Date(y, mo, d, h, m, s);
            if (!isNaN(dt.getTime())) msgTime = dt.toISOString();
          } else {
            const dt = new Date(rawTime);
            if (!isNaN(dt.getTime())) msgTime = dt.toISOString();
          }
        }
      }

      messages.push({
        id: dataId || `wpp-ext-${resolvedPhone}-${index}`,
        content,
        fromMe: isFromMe,
        timestamp: msgTime,
        messageType,
      });
    });

    // Filtra mensagens finais garantindo ausência de avisos de sistema
    const validContentMsgs = messages.filter(m => m.content && !isWhatsAppSystemMessage(m.content));
    const lastMsg = validContentMsgs.length > 0 ? validContentMsgs[validContentMsgs.length - 1] : null;

    console.log(`[Brokiva] Extraídas ${validContentMsgs.length} mensagens válidas para ${contactName} (${resolvedPhone})`);

    return {
      phone: resolvedPhone,
      lid: resolvedLid || undefined,
      name: contactName,
      messages: validContentMsgs,
      lastMessagePreview: lastMsg ? lastMsg.content : '',
      lastMessageAt: lastMsg ? lastMsg.timestamp : new Date().toISOString(),
    };
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
    const candidates = main.querySelectorAll('div');
    for (const el of candidates) {
      if (el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return el;
        }
      }
    }
    return document.querySelector('#main div[tabindex="-1"]') ||
           document.querySelector('#main .copyable-area')?.parentElement ||
           document.querySelector('#main div[role="application"]');
  }

  async function deepScrollChatHistory(targetScrolls = 6, onProgress = null) {
    const scrollContainer = findChatScrollContainer();
    if (!scrollContainer) return;

    const badge = document.getElementById('sovereign-sync-badge');
    let lastCount = document.querySelectorAll('#main .copyable-text, #main [data-pre-plain-text], #main [data-id]').length;

    for (let i = 0; i < targetScrolls; i++) {
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

      if (badge) badge.innerText = `Lendo antigas (${i + 1}/${targetScrolls})...`;
      if (typeof onProgress === 'function') onProgress(i + 1, targetScrolls);

      await new Promise(r => setTimeout(r, 360));

      const currentCount = document.querySelectorAll('#main .copyable-text, #main [data-pre-plain-text], #main [data-id]').length;
      if (currentCount === lastCount && i >= 2) {
        break; // Topo da conversa atingido
      }
      lastCount = currentCount;
    }
  }

  async function extractPhoneFromContactDrawer() {
    try {
      const headerBtn = document.querySelector('#main header div[role="button"], #main header div[tabindex="0"], #main header span[title]');
      if (!headerBtn) return null;

      headerBtn.click();
      await new Promise(r => setTimeout(r, 450));

      const sidePanel = document.querySelector('div[tabindex="-1"] section, div[tabindex="-1"] aside, div[data-testid="contact-info-drawer"], div[data-testid="chat-info-drawer"]');
      let foundPhone = null;
      if (sidePanel) {
        const text = sidePanel.innerText || '';
        const phoneMatch = text.match(/\+?55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/) ||
                           text.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
        if (phoneMatch) {
          foundPhone = phoneMatch[0].replace(/\D/g, '');
        }
      }

      const closeBtn = document.querySelector('div[tabindex="-1"] span[data-icon="x"]')?.closest('button') ||
                       document.querySelector('div[tabindex="-1"] button[aria-label*="Fechar"], div[tabindex="-1"] button[aria-label*="Close"]') ||
                       document.querySelector('[data-testid="btn-closer"]');
      if (closeBtn) closeBtn.click();
      await new Promise(r => setTimeout(r, 150));

      return foundPhone;
    } catch (e) {
      return null;
    }
  }

  async function resolvePhoneFromCrmIfLid(contactName, phoneOrLid, allowDrawer = false) {
    if (!phoneOrLid) return '';
    const phoneStr = String(phoneOrLid);

    const isSynthetic = phoneStr.includes('554863562855') || phoneStr.startsWith('55486356');
    if (!isSynthetic && phoneStr.length >= 10 && phoneStr.length <= 13 && phoneStr.startsWith('55')) {
      return phoneStr;
    }

    // 1. Pergunta ao background worker (que consulta abas abertas do CRM e storage local)
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
        console.log(`[Brokiva] Telefone resolvido pelo CRM para ${contactName}: ${res.phone}`);
        return res.phone;
      }
    } catch (e) {}

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
            console.log(`[Brokiva] Telefone extraído do cache de contatos CRM para ${contactName}: ${clean}`);
            return clean;
          }
        }
      }
    } catch (e) {}

    // 3. Abre gaveta de contato do WhatsApp Web para ler o telefone oficial (somente quando explicitamente permitido)
    if (allowDrawer) {
      try {
        const drawerPhone = await extractPhoneFromContactDrawer();
        if (drawerPhone && typeof drawerPhone === 'string' && drawerPhone.length >= 10 && drawerPhone.length <= 13) {
          const fullPhone = drawerPhone.startsWith('55') ? drawerPhone : `55${drawerPhone}`;
          rememberLidPhone(phoneStr, fullPhone);
          console.log(`[Brokiva] Telefone extraído da gaveta lateral do WhatsApp Web para ${contactName}: ${fullPhone}`);
          return fullPhone;
        }
      } catch (e) {}
    }

    return isSynthetic ? (phoneStr.replace(/\D/g, '') || '') : phoneStr;
  }

  // 4. Sincroniza apenas a conversa atual com carregamento paginado
  async function syncCurrentActiveChat() {
    const badge = document.getElementById('sovereign-sync-badge');
    if (badge) badge.innerText = 'Carregando histórico...';

    logToConsoleAndCloudWatch('INFO', 'SYNC_SINGLE_START', 'Iniciando leitura da conversa aberta...');

    // Rola para cima profundamente para carregar todo o histórico anterior
    await deepScrollChatHistory(8);

    const chatData = extractActiveChatData();
    if (!chatData || !chatData.phone || chatData.messages.length === 0) {
      logToConsoleAndCloudWatch('WARN', 'SYNC_SINGLE_EMPTY', `Conversa sem mensagens ou não identificada. (Phone: ${chatData?.phone || 'n/d'}, Msgs: ${chatData?.messages?.length || 0})`);
      alert('Abra uma conversa com mensagens no WhatsApp antes de sincronizar.');
      if (badge) badge.innerText = 'Pronto';
      return;
    }

    // Se o telefone extraído for LID, consulta o CRM pelo nome do contato para casar o telefone real
    chatData.phone = await resolvePhoneFromCrmIfLid(chatData.name, chatData.phone, true);

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

    const candidateSpans = Array.from(pane.querySelectorAll('span[title], div[role="gridcell"] span[title], span[dir="auto"][title]'));
    const rows = [];
    const seenContainers = new Set();
    const seenKeys = new Set();
    const paneRect = pane.getBoundingClientRect();

    for (const span of candidateSpans) {
      const title = (span.getAttribute('title') || span.innerText || '').trim();
      if (!title || title.length < 1) continue;

      // Ignora itens de sistema e canais
      if (['Meta AI', 'Arquivadas', 'Comunidades', 'Canais', 'Status'].includes(title)) continue;
      if (title.includes('Você') || title.includes('WhatsApp')) continue;

      // Localiza o container da linha clicável
      const rowContainer = span.closest('div[role="listitem"], div[role="row"], div[role="gridcell"], div[data-testid="cell-frame-container"], div._ak8l') ||
                           span.parentElement?.parentElement;
      if (!rowContainer || seenContainers.has(rowContainer)) continue;

      // Ignora nós sem dimensão real
      const rect = span.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) continue;

      const rowRect = rowContainer.getBoundingClientRect();
      // Permite elementos no viewport do pane-side (com margem de tolerância)
      if (rowRect.bottom < (paneRect.top - 50) || rowRect.top > (paneRect.bottom + 100)) continue;

      seenContainers.add(rowContainer);

      const key = title.toLowerCase().trim();
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        rows.push({
          title,
          key,
          span,
          clickable: rowContainer
        });
      }
    }

    // Fallback: se não achou com span[title], tenta via seletores de gridcell
    if (rows.length === 0) {
      const gridcells = Array.from(pane.querySelectorAll('div[role="gridcell"], div[role="row"], div[data-testid="cell-frame-container"]'));
      for (const cell of gridcells) {
        const firstSpan = cell.querySelector('span[dir="auto"], span.x10l6tqk, span');
        const title = (firstSpan?.getAttribute('title') || firstSpan?.innerText || '').trim();
        if (!title || title.length < 2) continue;
        if (['Meta AI', 'Arquivadas', 'Comunidades', 'Canais'].includes(title)) continue;

        const key = title.toLowerCase().trim();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          rows.push({
            title,
            key,
            span: firstSpan || cell,
            clickable: cell
          });
        }
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

        // Rola o item para o centro da lista antes do clique
        try {
          nextRow.clickable.scrollIntoView({ block: 'center', behavior: 'auto' });
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {}

        // Dispara eventos de ponteiro/mouse para o WhatsApp Web abrir o chat
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
          try {
            nextRow.clickable.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
            nextRow.span.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
          } catch (e) {}
        });

        // Aguarda 750ms para o WhatsApp montar a conversa em #main
        await new Promise(r => setTimeout(r, 750));

        if (cancelSyncRequested) break;

        // CARREGAMENTO PROFUNDO: Rola para cima na conversa aberta para carregar mensagens antigas!
        updateSyncModalProgress({
          syncedCount: syncedChats.length,
          maxChats: MAX_TARGET_CHATS,
          contactName: currentName,
          actionText: 'Carregando mensagens anteriores...',
          totalMessages: totalMessagesSynced,
        });

        await deepScrollChatHistory(5, (step, total) => {
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
        let chatData = extractActiveChatData();
        if (!chatData || !chatData.messages || chatData.messages.length === 0) {
          await new Promise(r => setTimeout(r, 300));
          chatData = extractActiveChatData();
        }

        if (chatData) {
          chatData.phone = await resolvePhoneFromCrmIfLid(chatData.name, chatData.phone);
        }

        if (chatData && chatData.phone) {
          syncedChats.push(chatData);
          const msgsCount = chatData.messages ? chatData.messages.length : 0;
          totalMessagesSynced += msgsCount;

          logToConsoleAndCloudWatch('INFO', 'CHAT_INGEST_PAYLOAD', `Ingerindo ${msgsCount} msgs de ${chatData.name} (${chatData.phone})`);

          // Envia imediatamente cada chat para a API da Brokiva
          safeSendMessage({
            action: 'SYNC_BATCH_CHATS',
            data: { chats: [chatData] }
          });

          updateSyncModalProgress({
            syncedCount: syncedChats.length,
            maxChats: MAX_TARGET_CHATS,
            contactName: `${chatData.name} (${formatPhoneDisplay(chatData.phone)})`,
            actionText: `✓ ${msgsCount} mensagens sincronizadas`,
            totalMessages: totalMessagesSynced,
          });
        } else {
          logToConsoleAndCloudWatch('WARN', 'CHAT_NO_MSGS', `Chat ${currentName}: Não foi possível resolver identificador do contato`);
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
      progressStatus.innerText = `🎉 Sucesso! ${syncedChats.length} conversas e ${totalMessagesSynced.toLocaleString('pt-BR')} mensagens sincronizadas com a Brokiva!`;
      progressStatus.style.color = '#059669';
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
