/**
 * Brokiva — Content Script for WhatsApp Web (web.whatsapp.com)
 * Scrapes messages, executes paginated batch sync, injects CRM sidebar and Copilot.
 */

(function() {
  'use strict';

  if (!globalThis.BrokivaImport) return;
  console.log('[Brokiva] Extension loaded on WhatsApp Web.');

  let isSyncing = false;
  let currentActivePhone = '';
  let currentActiveName = '';
  let currentBrokerName = 'Rafael Sena';

  // Injeta o WA Native Bridge no contexto MAIN para acesso de alta performance ao Store
  function injectNativeBridge() {
    try {
      if (document.getElementById('brokiva-wa-bridge-script')) return;
      const script = document.createElement('script');
      script.id = 'brokiva-wa-bridge-script';
      script.src = chrome.runtime.getURL('wa-bridge.js');
      script.type = 'text/javascript';
      (document.head || document.documentElement).appendChild(script);
      console.log('[Brokiva] Native Bridge script injetado com sucesso.');
    } catch (err) {
      console.warn('[Brokiva] Falha ao injetar Native Bridge:', err);
    }
  }
  injectNativeBridge();

  // Helper para consultar o Native Bridge via postMessage
  function queryNativeStore(type, payload = {}, timeoutMs = 2500) {
    return new Promise((resolve) => {
      const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      let resolved = false;

      const handler = (event) => {
        if (event.source !== window || event.origin !== location.origin || !event.data || event.data.requestId !== requestId || event.data.type !== `${type}_RESPONSE`) return;
        resolved = true;
        window.removeEventListener('message', handler);
        resolve(event.data);
      };

      window.addEventListener('message', handler);

      window.postMessage({
        type,
        requestId,
        ...payload,
      }, '*');

      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('message', handler);
          resolve({ success: false, timeout: true });
        }
      }, timeoutMs);
    });
  }

  try {
    chrome?.storage?.local?.get(['brokerName'], res => {
      if (res?.brokerName) currentBrokerName = res.brokerName;
    });
  } catch (e) {}

  // 1. Injeta a Sidebar do CRM no DOM com suporte a Login Próprio e Persistente
  function injectSidebar() {
    if (document.getElementById('sovereign-crm-root')) return;

    let extVersion = '1.0.58';
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
        extVersion = chrome.runtime.getManifest()?.version || '1.0.58';
      }
    } catch (_) {
      // Contexto da extensão anterior invalidado após reload no Chrome
      return;
    }
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
              <div class="sovereign-title">
                Brokiva <span id="sovereign-version-badge" class="sovereign-version-badge" title="Versão da extensão (Clique 5x para alternar Diagnóstico)">v${extVersion}</span>
              </div>
              <div class="sovereign-subtitle">Relacionamentos que viram negócios</div>
            </div>
          </div>
          <button id="sovereign-close-btn" class="sovereign-close-btn" title="Fechar barra lateral">✕</button>
        </div>

        <!-- Container do Perfil do Corretor Ativo -->
        <div id="sovereign-header-profile"></div>

        <!-- Conteúdo Dinâmico (Login ou Ferramentas de Sincronização) -->
        <div class="sovereign-body" id="sovereign-body-container"></div>
      </div>
    `;

    document.body.appendChild(root);

    // Controle de Expansão/Recuo com Compressão Fluida da Tela do WhatsApp
    const toggleBtn = document.getElementById('sovereign-toggle-btn');
    const closeBtn = document.getElementById('sovereign-close-btn');

    function setSidebarState(isOpen) {
      const waApp = document.getElementById('app') || document.querySelector('#app');
      if (isOpen) {
        root.classList.add('open');
        document.body.classList.add('sovereign-layout-compressed');
        if (waApp) {
          waApp.style.setProperty('width', 'calc(100vw - 380px)', 'important');
          waApp.style.setProperty('max-width', 'calc(100vw - 380px)', 'important');
          waApp.style.setProperty('transition', 'width 0.32s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
        }
        if (toggleBtn) {
          toggleBtn.title = 'Recolher Brokiva CRM';
          toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        }
      } else {
        root.classList.remove('open');
        document.body.classList.remove('sovereign-layout-compressed');
        if (waApp) {
          waApp.style.removeProperty('width');
          waApp.style.removeProperty('max-width');
        }
        if (toggleBtn) {
          toggleBtn.title = 'Abrir Brokiva CRM (Expandir Menu)';
          toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
        }
      }

      // Notifica componentes virtuais do WhatsApp Web para reajuste imediato e suave
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    }

    // Persistência e Arraste Vertical do Botão Toggle (Memória de Sessão)
    let savedTop = localStorage.getItem('brokiva_toggle_btn_top');
    if (savedTop && toggleBtn) {
      const topNum = parseFloat(savedTop);
      if (!isNaN(topNum)) {
        const maxTop = Math.max(10, window.innerHeight - 60);
        const clampedTop = Math.min(Math.max(10, topNum), maxTop);
        toggleBtn.style.top = clampedTop + 'px';
      }
    }

    let isDragging = false;
    let hasDragged = false;
    let startClientY = 0;
    let startTopPx = 24;

    toggleBtn?.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      hasDragged = false;
      startClientY = e.clientY;
      startTopPx = parseFloat(toggleBtn.style.top || '24') || toggleBtn.offsetTop || 24;
      toggleBtn.style.cursor = 'grabbing';
      try { toggleBtn.setPointerCapture?.(e.pointerId); } catch (_) {}
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging || !toggleBtn) return;
      const deltaY = e.clientY - startClientY;
      if (Math.abs(deltaY) > 5) {
        hasDragged = true;
      }
      if (hasDragged) {
        const maxTop = Math.max(10, window.innerHeight - 56);
        const newTop = Math.min(Math.max(10, startTopPx + deltaY), maxTop);
        toggleBtn.style.top = newTop + 'px';
      }
    });

    function finishDrag() {
      if (!isDragging) return;
      isDragging = false;
      if (toggleBtn) toggleBtn.style.cursor = 'grab';
      if (hasDragged && toggleBtn) {
        const finalTop = Math.round(parseFloat(toggleBtn.style.top || '24'));
        localStorage.setItem('brokiva_toggle_btn_top', String(finalTop));
        try {
          if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
            chrome.storage.local.set({ brokiva_toggle_btn_top: finalTop });
          }
        } catch (_) {}
      }
    }

    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    // Redimensionamento de tela mantém o botão sempre visível dentro da janela
    window.addEventListener('resize', () => {
      if (!toggleBtn) return;
      const currentTop = parseFloat(toggleBtn.style.top || '24');
      const maxTop = Math.max(10, window.innerHeight - 60);
      if (currentTop > maxTop) {
        toggleBtn.style.top = maxTop + 'px';
        localStorage.setItem('brokiva_toggle_btn_top', String(maxTop));
      }
    });

    toggleBtn?.addEventListener('click', (e) => {
      if (hasDragged) {
        e.stopImmediatePropagation();
        hasDragged = false;
        return;
      }
      const isCurrentlyOpen = root.classList.contains('open');
      setSidebarState(!isCurrentlyOpen);
    });

    closeBtn?.addEventListener('click', () => {
      setSidebarState(false);
    });

    // Alternar modo desenvolvedor/diagnóstico ao clicar 5x no badge de versão
    let badgeClickCount = 0;
    let badgeClickTimer = null;
    document.getElementById('sovereign-version-badge')?.addEventListener('click', async () => {
      badgeClickCount++;
      clearTimeout(badgeClickTimer);
      badgeClickTimer = setTimeout(() => { badgeClickCount = 0; }, 2500);
      if (badgeClickCount >= 5) {
        badgeClickCount = 0;
        const current = await chrome.storage.local.get(['developerMode']);
        const nextVal = !current.developerMode;
        await chrome.storage.local.set({ developerMode: nextVal });
        alert(nextVal ? "🛠️ Modo Diagnóstico e Telemetria Ativado!" : "🔒 Modo Diagnóstico Desativado (Padrão de Produção).");
      }
    });

    // Renderiza conteúdo baseado na sessão da extensão
    renderSidebarContent();

    // Reage dinamicamente a mudanças de autenticação (ex: login via popup ou bridge)
    try {
      if (chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener((changes, area) => {
          try {
            if (!chrome?.runtime?.id) return;
            if (area === 'local' && (changes?.extensionSessionToken || changes?.brokerName || changes?.developerMode)) {
              renderSidebarContent().catch(() => {});
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  function showImportReport(report, context) {
    const box = document.getElementById('sovereign-import-result');
    if (!box) return;
    if (!report || !BrokivaImport.sameContext(report.context, context)) { box.textContent = ''; box.hidden = true; return; }
    box.textContent = `Última importação: ${report.totalMessages || 0} mensagens confirmadas.\n` + (report.issues || []).map(issue => `${issue.name}: ${issue.reason}`).join('\n');
    if (report.audit) {
      box.textContent += '\nUm item pode aparecer em mais de uma categoria; não some as pendências.';
      const formats = Object.entries(report.audit.unsupportedTypes || {}).filter(([, count]) => count > 0);
      if (formats.length) {
        const details = document.createElement('details');
        const summary = document.createElement('summary'); summary.textContent = 'Formatos pendentes — detalhes para suporte';
        const text = document.createElement('p'); text.textContent = formats.map(([type, count]) => `${type}: ${count}`).join('; ');
        details.append(summary, text); box.append(details);
      }
    }
    box.hidden = false;
  }

  function normalizeCrmUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return 'https://crm.faithhubs.com';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.extensionSessionToken || changes.tenantId)) renderSidebarContent();
    if (area === 'local' && changes.brokivaLastImportReport) chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl']).then(context => showImportReport(changes.brokivaLastImportReport.newValue, context));
  });
  // 1.1 Renderizador dinâmico de Login ou Ferramentas Ativas
  async function renderSidebarContent() {
    if (!chrome?.runtime?.id) return;
    try {
      const bodyContainer = document.getElementById('sovereign-body-container');
      const headerContainer = document.getElementById('sovereign-header-profile');
      if (!bodyContainer) return;

      const storage = await chrome.storage.local.get([
        'extensionSessionToken',
        'extensionSessionExpiresAt',
        'brokerName',
        'brokerUserId',
        'brokivaLastImportReport',
        'brokerEmail',
        'tenantName',
        'tenantId',
        'crmUrl',
        'developerMode'
      ]);

      const isDeveloperMode = Boolean(storage.developerMode);

    const isConnected = Boolean(storage.extensionSessionToken && storage.extensionSessionExpiresAt > Date.now() / 1000 && storage.brokerName);
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
                <div class="sovereign-broker-tenant">
                  <span class="sovereign-pulse-dot"></span>
                  <span>${tenantName}</span>
                </div>
              </div>
            </div>
            <button id="sovereign-btn-logout-sidebar" class="sovereign-btn-logout" title="Desconectar ou trocar de corretor">Sair</button>
          </div>
        `;
        document.getElementById('sovereign-btn-logout-sidebar')?.addEventListener('click', async () => {
          if (confirm('Deseja desconectar a extensão Brokiva deste corretor?')) {
            await chrome.runtime.sendMessage({ action: 'UNPAIR' });
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
            Escolha o modo de importação de conversas para o CRM:
          </p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div>
              <button id="sovereign-batch-sync-recent-btn" class="sovereign-btn-sync" style="background:#3742AC;">
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:5px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Sincronizar Recentes (Ativos)</span>
              </button>
              <p style="font-size:10px; color:#64748b; margin-top:3px; margin-left:2px; line-height:1.3;">
                ⚡ Atualiza rapidamente os chats ativos no topo da lista (dia a dia).
              </p>
            </div>

            <div>
              <button id="sovereign-batch-sync-full-btn" class="sovereign-btn-sync" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border:1px solid #334155;">
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:5px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> Importar Lista de Conversas</span>
              </button>
              <p style="font-size:10px; color:#64748b; margin-top:3px; margin-left:2px; line-height:1.3;">
                Percorre a lista aberta sem corte de data. Confira também as conversas arquivadas e os filtros do WhatsApp.
              </p>
            </div>
          </div>
          <div id="sovereign-progress-bar" class="sovereign-progress-bar">
            <div id="sovereign-progress-fill" class="sovereign-progress-fill" style="background:#3742AC;"></div>
          </div>
          <p id="sovereign-progress-status" style="font-size:10px; color:#64748b; margin-top:6px; display:none; text-align:center;"></p>
          <div id="sovereign-import-result" role="status" hidden style="white-space:pre-wrap;font-size:11px;color:#475569;margin-top:10px;max-height:180px;overflow:auto"></div>
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
            <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Salvar Histórico Desta Conversa</span>
          </button>
${isDeveloperMode ? `
          <button id="sovereign-diagnostic-btn" class="sovereign-btn-sync" style="background:#475569; margin-top:6px;">
            <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:5px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Diagnosticar Conversa (Passo a Passo)</span>
          </button>
` : ""}
        </div>

        <!-- Card da Brok.ia -->
        <div class="sovereign-ai-card">
          <div class="sovereign-ai-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:3px;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Brok.ia</div>
          <p style="font-size:11px; color:#cbd5e1; margin-bottom:10px;">
            Analisa o momento do cliente e gera respostas persuasivas com 1 clique.
          </p>
          <button id="sovereign-ai-generate-btn" class="sovereign-btn-sync" style="background:#3742AC;">
            <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:5px;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Sugerir Respostas Inteligentes</span>
          </button>
          <div id="sovereign-ai-suggestions" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;"></div>
        </div>

${isDeveloperMode ? `
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
` : ""}
      `;

      showImportReport(storage.brokivaLastImportReport, storage);

      // Conecta botões das ferramentas
      document.getElementById('sovereign-batch-sync-recent-btn')?.addEventListener('click', () => executeBatchHistoryScan({ mode: 'RECENT' }));
      document.getElementById('sovereign-batch-sync-full-btn')?.addEventListener('click', () => executeBatchHistoryScan({ mode: 'FULL' }));
      document.getElementById('sovereign-batch-sync-btn')?.addEventListener('click', () => executeBatchHistoryScan({ mode: 'FULL' }));
      document.getElementById('sovereign-sync-current-btn')?.addEventListener('click', () => syncCurrentActiveChat());
      if (isDeveloperMode) {
        document.getElementById('sovereign-diagnostic-btn')?.addEventListener('click', () => runStepByStepDiagnostic());
      }
      document.getElementById('sovereign-ai-generate-btn')?.addEventListener('click', () => triggerAiSuggestion());

      // Atualiza lead ativo se houver conversa aberta
      updateActiveLeadUI();
    } else {
      if (headerContainer) headerContainer.innerHTML = '';
      bodyContainer.innerHTML = `
        <div class="sovereign-login-card">
          <div class="sovereign-login-title">Conectar ao CRM</div>
          <p class="sovereign-login-desc">Entre com e-mail e senha no CRM e pareie a extensão com a imobiliária desejada.</p>
          <button id="sovereign-sidebar-login-btn" class="sovereign-btn-login">Entrar e parear no CRM</button>
        </div>`;
      document.getElementById('sovereign-sidebar-login-btn')?.addEventListener('click', () => {
        safeSendMessage({ action: 'OPEN_CRM_PAIRING', data: { crmUrl } }, response => {
          if (!response?.success) alert(response?.error || 'Não foi possível abrir o CRM.');
        });
      });

    }
  } catch (e) {}
}

  function safeSendMessage(payload, callback) {
    try {
      if (!chrome?.runtime?.id) {
        if (callback) callback({ success: false, error: 'Contexto da extensão invalidado após atualização. Por favor, recarregue esta página do WhatsApp Web (F5).' });
        return;
      }
      chrome.runtime.sendMessage(payload, (res) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || 'Falha na comunicação com o worker da extensão';
          if (callback) callback({ success: false, error: `${errMsg}. Recarregue a página do WhatsApp Web (F5).` });
          return;
        }
        if (callback) callback(res || { success: false, error: 'Resposta vazia do worker' });
      });
    } catch (e) {
      if (callback) callback({ success: false, error: e?.message || 'Falha na execução do script da extensão' });
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

  function isWhatsAppSyntheticOrInvalidPhone(raw) {
    if (!raw) return true;
    const digits = String(raw).replace(/\D/g, '');
    if (!digits || digits.length < 10) return true;
    if (digits.length > 15) return true;
    if (digits.startsWith('4400') || digits.startsWith('5500')) return true; // Hashes / IDs sintéticos
    if (digits.startsWith('55') && digits.slice(2, 4) === '00') return true; // DDD 00 inválido
    if (String(raw).includes('@lid')) return true;
    return false;
  }

  function formatPhoneDisplay(raw) {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (isWhatsAppSyntheticOrInvalidPhone(digits)) {
      if (digits.startsWith('4400') || digits.startsWith('5500')) return `ID ${digits}`;
      return `LID ${digits}`;
    }
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
  function chatHeaderTitle(main) {
    const exact = main?.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (exact) return (exact.getAttribute('title') || exact.innerText || '').normalize('NFKC').trim();
    const candidates = Array.from(main?.querySelectorAll('header span[title], header span[dir="auto"]') || []);
    const title = candidates.find(el => !el.closest('#brokiva-header-sync-btn, #sovereign-crm-root') && (el.getAttribute('title') || el.innerText || '').trim());
    return (title?.getAttribute('title') || title?.innerText || '').normalize('NFKC').trim();
  }
  function activeChatIdentity() {
    const main = document.querySelector('#main');
    const title = chatHeaderTitle(main);
    const ids = Array.from(main?.querySelectorAll('[data-id]') || []).map(el => el.getAttribute('data-id'));
    const jids = new Set(ids.map(id => BrokivaImport.messageIdentity(id)?.jid).filter(Boolean));
    const anchors = new Set(ids.filter(id => BrokivaImport.messageIdentity(id) || /^[a-f0-9]{16,128}$/i.test(id)));
    if (jids.size > 1) throw new Error('Foram encontradas mensagens de conversas diferentes. Leitura interrompida.');
    return { main, title, anchors, jid: Array.from(jids)[0] || '' };
  }
  function assertActiveChat(expected) {
    const current = activeChatIdentity();
    const sameHeader = current.main && current.title === expected.title;
    const nativeMatch = current.jid && current.jid === expected.jid;
    const anchoredMatch = !current.jid && expected.verifiedByDrawer && [...current.anchors].some(id => expected.anchors.has(id));
    if (!sameHeader || (!nativeMatch && !anchoredMatch)) throw new Error('A conversa mudou ou perdeu a continuidade durante a leitura. Reabra o contato e tente novamente.');
    expected.anchors = current.anchors;
  }
  async function waitForChatToOpen(row, previous, timeoutMs = 10000) {
    const start = Date.now();
    let stable = '';
    while (Date.now() - start < timeoutMs) {
      const current = activeChatIdentity();
      const expectedTitle = row.title.normalize('NFKC').trim();
      const selected = row.clickable.getAttribute('aria-selected') === 'true' || Boolean(row.clickable.querySelector('[aria-selected="true"]'));
      const changedMessages = [...current.anchors].some(id => !previous.anchors.has(id));
      const identityMatches = row.jid && current.jid ? current.jid === row.jid
        : (previous.title !== expectedTitle || changedMessages || selected);
      if (current.title === expectedTitle && current.anchors.size && identityMatches) {
        const signature = `${current.title}:${current.jid}:${[...current.anchors].slice(0, 2).join(':')}`;
        if (stable === signature) return current;
        stable = signature;
      } else stable = '';
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Não foi possível confirmar a abertura da conversa selecionada. Tente novamente.');
  }

  // Extrai Etiquetas do WhatsApp Business em um elemento de linha da lista lateral
  function extractLabelsFromRowElement(rowContainer) {
    if (!rowContainer) return [];
    const labels = new Set();

    try {
      const explicitEls = rowContainer.querySelectorAll(
        '[data-testid*="label" i], [aria-label*="etiqueta" i], [aria-label*="label" i], span[title*="etiqueta" i], [title*="label" i]'
      );
      explicitEls.forEach(el => {
        const raw = (el.getAttribute('title') || el.getAttribute('aria-label') || el.innerText || '').trim();
        const clean = raw.replace(/^(etiqueta|label):\s*/i, '').trim();
        if (clean && clean.length >= 2 && clean.length <= 40 && !clean.includes('\n')) {
          labels.add(clean);
        }
      });

      // Badges visuais com cor de preenchimento (pills do WhatsApp Business)
      const badges = rowContainer.querySelectorAll('div[data-testid="cell-frame-secondary"] span, div[data-testid="cell-frame-title"] ~ div span');
      badges.forEach(b => {
        const bg = window.getComputedStyle ? window.getComputedStyle(b).backgroundColor : '';
        const text = (b.getAttribute('title') || b.innerText || '').trim();
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && text && text.length >= 2 && text.length <= 30 && !/^\d+$/.test(text)) {
          const lower = text.toLowerCase();
          if (lower !== 'lida' && lower !== 'entregue' && lower !== 'enviada' && lower !== 'read' && lower !== 'delivered') {
            labels.add(text);
          }
        }
      });
    } catch (e) {}

    return Array.from(labels);
  }

  // Extrai Etiquetas do WhatsApp Business no cabeçalho da conversa aberta (#main header)
  function extractLabelsFromMainHeader() {
    const labels = new Set();
    const header = document.querySelector('#main header');
    if (!header) return [];

    try {
      const explicitEls = header.querySelectorAll(
        '[data-testid*="label" i], [aria-label*="etiqueta" i], [aria-label*="label" i], [title*="etiqueta" i], [title*="label" i]'
      );
      explicitEls.forEach(el => {
        const raw = (el.getAttribute('title') || el.getAttribute('aria-label') || el.innerText || '').trim();
        const clean = raw.replace(/^(etiqueta|label):\s*/i, '').trim();
        if (clean && clean.length >= 2 && clean.length <= 40 && !clean.includes('\n')) {
          labels.add(clean);
        }
      });

      // Tags/pills visíveis no header
      const pills = header.querySelectorAll('div[role="button"] span, header span[dir="auto"]');
      pills.forEach(p => {
        const txt = (p.getAttribute('title') || p.innerText || '').trim();
        const lower = txt.toLowerCase();
        if (
          txt &&
          txt.length >= 2 &&
          txt.length <= 35 &&
          !txt.includes('\n') &&
          !lower.includes('online') &&
          !lower.includes('visto por') &&
          !lower.includes('last seen') &&
          !lower.includes('digitando') &&
          !lower.includes('typing') &&
          !lower.includes('dados do') &&
          !lower.includes('clique aqui') &&
          txt !== currentActiveName
        ) {
          const bg = window.getComputedStyle ? window.getComputedStyle(p).backgroundColor : '';
          const parentBg = p.parentElement && window.getComputedStyle ? window.getComputedStyle(p.parentElement).backgroundColor : '';
          const hasBg = (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
                        (parentBg && parentBg !== 'rgba(0, 0, 0, 0)' && parentBg !== 'transparent');
          const hasTagSvg = Boolean(p.querySelector('svg') || p.parentElement?.querySelector('svg'));
          if (hasBg || hasTagSvg) {
            labels.add(txt);
          }
        }
      });
    } catch (e) {}

    return Array.from(labels);
  }

  // 2. Extrai dados da conversa ativa no WhatsApp Web (Blindada contra duplicações, grupos e tags do Business)
  function extractActiveChatData(accumulatedMessagesMap = null, rowLabels = []) {
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

    const contactName = chatHeaderTitle(main) || 'Contato WhatsApp';

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

    // Método C: Avatar no header (APENAS se tiver parâmetro explícito 'u=telefone@c.us')
    if (!resolvedPhone) {
      const avatarImg = main.querySelector('header img[src]');
      if (avatarImg) {
        const src = avatarImg.getAttribute('src') || '';
        const match = src.match(/[?&]u=(\d{10,15})%40c\.us/i) || src.match(/[?&]u=(\d{10,15})@c\.us/i);
        if (match && match[1]) resolvedPhone = match[1];
      }
    }

    // Método D: Se o próprio nome do contato for número
    if (!resolvedPhone) {
      const digits = contactName.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 13 && !isWhatsAppSyntheticOrInvalidPhone(digits)) {
        resolvedPhone = digits;
      }
    }

    // Se tiver LID, tenta recuperar o telefone canônico do mapa ou usa o LID temporariamente
    if (resolvedLid) {
      const pureL = resolvedLid.replace(/@.*$/, '').replace(/\D/g, '');
      if (!resolvedPhone && pureL) {
        const fromMap = inMemoryLidPhoneMap.get(pureL);
        if (fromMap && !isWhatsAppSyntheticOrInvalidPhone(fromMap)) {
          resolvedPhone = fromMap;
        }
      }
      if (resolvedPhone && resolvedPhone.length <= 13 && !isWhatsAppSyntheticOrInvalidPhone(resolvedPhone)) {
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
      const orderTracker = { orderedKeys: [], seenKeys: new Set(), knownAnchorDateIso: '' };
      harvestDomMessages(messagesMap, resolvedPhone, orderTracker, 'INIT');
      calibratePhysicalChatSequence(orderTracker.orderedKeys, messagesMap);
      messagesMap._orderedKeys = orderTracker.orderedKeys;
    }

    // Constrói array de mensagens na ordem física real calibrada
    let validContentMsgs = [];
    if (messagesMap._orderedKeys && messagesMap._orderedKeys.length > 0) {
      validContentMsgs = messagesMap._orderedKeys
        .map(k => messagesMap.get(k))
        .filter(m => m && m.content);
    } else {
      validContentMsgs = Array.from(messagesMap.values())
        .filter(m => m.content);
    }

    // 1. Ordenação estritamente cronológica preservando a sequência unificada do chat
    validContentMsgs.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (!isNaN(tA) && !isNaN(tB) && tA !== tB) return tA - tB;
      const ordA = a.domOrder !== undefined ? a.domOrder : 0;
      const ordB = b.domOrder !== undefined ? b.domOrder : 0;
      return ordA - ordB;
    });

    const lastMsg = validContentMsgs.length > 0 ? validContentMsgs[validContentMsgs.length - 1] : null;

    // Extrai Etiquetas do WhatsApp Business
    const headerLabels = extractLabelsFromMainHeader();
    const combinedLabels = Array.from(new Set([...headerLabels, ...(rowLabels || [])])).filter(Boolean);

    console.log(`[Brokiva] Extraídas ${validContentMsgs.length} mensagens e ${combinedLabels.length} etiquetas para ${contactName} (${resolvedPhone})`);

    return {
      phone: resolvedPhone,
      lid: resolvedLid || undefined,
      name: contactName,
      avatarUrl: avatarUrl || undefined,
      tags: combinedLabels,
      labels: combinedLabels,
      messages: validContentMsgs,
      lastMessagePreview: lastMsg ? lastMsg.content : '',
      lastMessageAt: lastMsg ? lastMsg.timestamp : new Date().toISOString(),
    };
  }

  // Identifica se uma conversa é antiga/inativa (última mensagem > 60 dias ou ano anterior) e adiciona tag de Reativação
  function checkAndTagOldChat(chatData) {
    if (!chatData) return false;
    let isOld = false;

    let lastTime = 0;
    if (chatData.lastMessageAt) {
      const dt = new Date(chatData.lastMessageAt);
      if (!isNaN(dt.getTime())) lastTime = dt.getTime();
    }
    if (!lastTime && chatData.messages && chatData.messages.length > 0) {
      const lastMsg = chatData.messages[chatData.messages.length - 1];
      if (lastMsg && lastMsg.timestamp) {
        const dt = new Date(lastMsg.timestamp);
        if (!isNaN(dt.getTime())) lastTime = dt.getTime();
      }
    }

    const now = new Date();
    if (lastTime > 0) {
      const lastDate = new Date(lastTime);
      const diffDays = (now.getTime() - lastTime) / (1000 * 60 * 60 * 24);
      const isPrevYear = lastDate.getFullYear() < now.getFullYear();
      if (diffDays >= 60 || isPrevYear) {
        isOld = true;
      }
    }

    if (isOld) {
      const tag = 'Base Antiga / Reativação';
      chatData.tags = Array.from(new Set([...(chatData.tags || []), tag]));
      chatData.labels = Array.from(new Set([...(chatData.labels || []), tag]));
    }

    return isOld;
  }

    // Utilitário para converter divisores de data do WhatsApp Web em português e inglês para objeto Date real
  function parsePortugueseWhatsAppDate(text, fallbackYear = new Date().getFullYear()) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim().toUpperCase().replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length > 35) return null;

    const now = new Date();
    const currentYear = now.getFullYear();

    if (clean === 'HOJE' || clean === 'TODAY') {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    if (clean === 'ONTEM' || clean === 'YESTERDAY') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }

    const weekdays = {
      'DOMINGO': 0, 'SEGUNDA-FEIRA': 1, 'TERÇA-FEIRA': 2, 'QUARTA-FEIRA': 3,
      'QUINTA-FEIRA': 4, 'SEXTA-FEIRA': 5, 'SÁBADO': 6,
      'SEGUNDA': 1, 'TERCA': 2, 'TERÇA': 2, 'QUARTA': 3, 'QUINTA': 4, 'SEXTA': 5, 'SABADO': 6,
      'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };
    for (const [wName, wDay] of Object.entries(weekdays)) {
      if (clean === wName) {
        const d = new Date(now);
        const currentDay = d.getDay();
        let diff = currentDay - wDay;
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() - diff);
        d.setHours(12, 0, 0, 0);
        return d;
      }
    }

    const months = {
      'JANEIRO': 0, 'FEVEREIRO': 1, 'MARÇO': 2, 'MARCO': 2, 'ABRIL': 3,
      'MAIO': 4, 'JUNHO': 5, 'JULHO': 6, 'AGOSTO': 7,
      'SETEMBRO': 8, 'OUTUBRO': 9, 'NOVEMBRO': 10, 'DEZEMBRO': 11,
      'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'MAY': 4, 'JUNE': 5,
      'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11,
      'JAN': 0, 'FEV': 1, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'APR': 3, 'MAI': 4,
      'JUN': 5, 'JUL': 6, 'AGO': 7, 'AUG': 7, 'SET': 8, 'SEP': 8, 'OUT': 9, 'OCT': 9,
      'NOV': 10, 'DEZ': 11, 'DEC': 11
    };

    // Formato PT: 28 DE SETEMBRO [DE 2026]
    const mMatch = clean.match(/^(\d{1,2})\s+DE\s+([A-ZÇ]+)(?:\s+DE\s+(\d{2,4}))?$/);
    if (mMatch) {
      const day = Number(mMatch[1]);
      const monthName = mMatch[2];
      let year = mMatch[3] ? Number(mMatch[3]) : fallbackYear;
      if (year < 100) year += 2000;
      if (year > currentYear) year = currentYear;
      if (months[monthName] !== undefined) {
        let dt = new Date(year, months[monthName], day, 12, 0, 0);
        if (!mMatch[3] && dt.getTime() > now.getTime() + 60000) {
          year = currentYear - 1;
          dt = new Date(year, months[monthName], day, 12, 0, 0);
        }
        if (!isNaN(dt.getTime())) return dt;
      }
    }

    // Formato EN: SEPTEMBER 28[, 2026] ou 28 SEPTEMBER 2026
    const enMatch1 = clean.match(/^([A-Z]+)\s+(\d{1,2})(?:,?\s+(\d{2,4}))?$/);
    if (enMatch1 && months[enMatch1[1]] !== undefined) {
      const monthName = enMatch1[1];
      const day = Number(enMatch1[2]);
      let year = enMatch1[3] ? Number(enMatch1[3]) : fallbackYear;
      if (year < 100) year += 2000;
      if (year > currentYear) year = currentYear;
      let dt = new Date(year, months[monthName], day, 12, 0, 0);
      if (!enMatch1[3] && dt.getTime() > now.getTime() + 60000) {
        year = currentYear - 1;
        dt = new Date(year, months[monthName], day, 12, 0, 0);
      }
      if (!isNaN(dt.getTime())) return dt;
    }

    // Exige que a linha seja estritamente uma data numérica (evita casar com menções no meio de propostas comerciais)
    const numMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?$/);
    if (numMatch) {
      const day = Number(numMatch[1]);
      const month = Number(numMatch[2]) - 1;
      let year = numMatch[3] ? Number(numMatch[3]) : fallbackYear;
      if (year < 100) year += 2000;
      if (year > currentYear) year = currentYear;
      let dt = new Date(year, month, day, 12, 0, 0);
      if (!numMatch[3] && dt.getTime() > now.getTime() + 60000) {
        year = currentYear - 1;
        dt = new Date(year, month, day, 12, 0, 0);
      }
      if (!isNaN(dt.getTime())) return dt;
    }

    return null;
  }

  const PT_MONTH_NAMES = {
    'JAN': 0, 'JANEIRO': 0, 'FEV': 1, 'FEVEREIRO': 1, 'MAR': 2, 'MARÇO': 2, 'MARCO': 2,
    'ABR': 3, 'ABRIL': 3, 'MAI': 4, 'MAIO': 4, 'JUN': 5, 'JUNHO': 5,
    'JUL': 6, 'JULHO': 6, 'AGO': 7, 'AGOSTO': 7, 'SET': 8, 'SETEMBRO': 8,
    'OUT': 9, 'OUTUBRO': 9, 'NOV': 10, 'NOVEMBRO': 10, 'DEZ': 11, 'DEZEMBRO': 11
  };

    // Parser Universal de Timestamps do WhatsApp Web (suporta dias da semana em PT e EN, datas com/sem ano, por extenso, relativos como 'ontem', US, etc.)
  function parseWhatsAppTimestamp(rawPre) {
    if (typeof rawPre !== 'string') return null;
    const raw = rawPre.replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, ' ');
    const hour = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\s*(AM|PM))?\b/i);
    const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const numeric = raw.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})\b/);
    if (!hour || (!iso && !numeric)) return null;
    let year, month, day;
    if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
    else {
      const language = (document.documentElement.lang || 'pt-BR').toLowerCase();
      const monthFirst = language === 'en-us' || language === 'en';
      year = Number(numeric[3]); if (year < 100) year += 2000;
      day = Number(numeric[monthFirst ? 2 : 1]); month = Number(numeric[monthFirst ? 1 : 2]);
    }
    let h = Number(hour[1]);
    if (hour[4]) { if (h > 12) return null; h = h % 12 + (hour[4].toUpperCase() === 'PM' ? 12 : 0); }
    const date = new Date(year, month - 1, day, h, Number(hour[2]), Number(hour[3] || 0));
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function extractDateFromPrePlain(rawPre) {
    const dt = parseWhatsAppTimestamp(rawPre);
    if (dt) {
      const d = new Date(dt.getTime());
      d.setHours(12, 0, 0, 0);
      return d;
    }
    return null;
  }

    // Extrai data pura (Date com meio-dia) de divisor de sistema ou nó legítimo
  function extractDateFromSystemDivider(el) {
    if (!el) return null;
    // Se for balão de mensagem, nunca é divisor de data
    if (el.classList?.contains('message-in') || el.classList?.contains('message-out')) return null;
    if (el.querySelector?.('.message-in, .message-out')) return null;
    if (el.hasAttribute?.('data-id') || el.querySelector?.('[data-id]')) return null;
    if (el.querySelector?.('[data-pre-plain-text]')) return null;

    // Busca nó folha com texto curto
    const textDirect = (el.innerText || '').trim();
    if (textDirect && textDirect.length <= 35) {
      const parsed = parsePortugueseWhatsAppDate(textDirect);
      if (parsed) return parsed;
    }

    // Busca spans ou divs filhos imediatos (ex: pílulas centrais do WhatsApp Web)
    const candidates = el.querySelectorAll('span, div');
    for (const c of candidates) {
      if (c.children.length === 0) {
        const txt = (c.innerText || '').trim();
        if (txt && txt.length <= 35) {
          const parsed = parsePortugueseWhatsAppDate(txt);
          if (parsed) return parsed;
        }
      }
    }
    return null;
  }

  // Helper retrocompatível
  function isGenuinSystemDateDivider(el) {
    return extractDateFromSystemDivider(el) !== null;
  }

  // Resolve a data exata de um balão inspecionando EXCLUSIVAMENTE divisores de sistema legítimos no DOM
  function getContextualDateForContainer(container, currentWalkingDateIso = '', knownAnchorDateIso = '') {
    const parentRow = container.closest?.('div[role="row"]') || container;

    // 1. Procura para trás por divisores de data do sistema ou data-pre-plain-text válidos
    let curr = parentRow.previousElementSibling;
    let stepsBack = 0;
    while (curr && stepsBack < 80) {
      const preNode = curr.querySelector?.('[data-pre-plain-text]') || (curr.hasAttribute?.('data-pre-plain-text') ? curr : null);
      if (preNode) {
        const rawPre = preNode.getAttribute('data-pre-plain-text') || '';
        const dt = extractDateFromPrePlain(rawPre);
        if (dt) return dt;
      }

      const divDate = extractDateFromSystemDivider(curr);
      if (divDate) return divDate;

      curr = curr.previousElementSibling;
      stepsBack++;
    }

    // NOTA CRÍTICA: NUNCA procura para a frente (para baixo no chat) por divisores de data,
    // pois isso atribuiria datas do futuro a mensagens anteriores!

    if (currentWalkingDateIso) {
      const parsed = new Date(currentWalkingDateIso);
      if (!isNaN(parsed.getTime())) {
        const d = new Date(parsed.getTime());
        d.setHours(12, 0, 0, 0);
        return d;
      }
    }

    if (knownAnchorDateIso) {
      const parsed = new Date(knownAnchorDateIso);
      if (!isNaN(parsed.getTime())) {
        const d = new Date(parsed.getTime());
        d.setHours(12, 0, 0, 0);
        return d;
      }
    }

    // Fallback provisório (será estritamente calibrado pelo Backward Sweep baseado na ordem física)
    const def = new Date();
    def.setHours(12, 0, 0, 0);
    return def;
  }

  /**
   * Mescla um lote de chaves na lista ordenada de chaves com base em sobreposição (overlap) de nós
   * ou na direção do scroll, preservando a ordem física rigorosa de cima para baixo do WhatsApp Web.
   */
  function mergeBatchIntoOrderTracker(orderTracker, currentBatchKeys, scrollDirection) {
    if (!orderTracker) return;
    if (!orderTracker.orderedKeys) orderTracker.orderedKeys = [];
    if (!orderTracker.seenKeys) orderTracker.seenKeys = new Set();

    const { orderedKeys, seenKeys } = orderTracker;

    if (orderedKeys.length === 0) {
      for (const k of currentBatchKeys) {
        if (!seenKeys.has(k)) {
          orderedKeys.push(k);
          seenKeys.add(k);
        }
      }
      return;
    }

    // Procura nó coincidente (overlap) entre o lote atual e as chaves conhecidas
    let matchIdxInBatch = -1;
    let matchIdxInOrder = -1;

    for (let b = 0; b < currentBatchKeys.length; b++) {
      const k = currentBatchKeys[b];
      const ordIdx = orderedKeys.indexOf(k);
      if (ordIdx !== -1) {
        matchIdxInBatch = b;
        matchIdxInOrder = ordIdx;
        break;
      }
    }

    if (matchIdxInBatch !== -1) {
      // Itens antes do nó de sobreposição estão fisicamente ACIMA na tela
      const beforeItems = [];
      for (let b = 0; b < matchIdxInBatch; b++) {
        const k = currentBatchKeys[b];
        if (!seenKeys.has(k)) {
          beforeItems.push(k);
          seenKeys.add(k);
        }
      }
      if (beforeItems.length > 0) {
        orderedKeys.splice(matchIdxInOrder, 0, ...beforeItems);
        matchIdxInOrder += beforeItems.length;
      }

      // Itens depois do nó de sobreposição estão fisicamente ABAIXO na tela
      let insertPos = matchIdxInOrder + 1;
      for (let b = matchIdxInBatch + 1; b < currentBatchKeys.length; b++) {
        const k = currentBatchKeys[b];
        if (!seenKeys.has(k)) {
          orderedKeys.splice(insertPos, 0, k);
          seenKeys.add(k);
          insertPos++;
        } else {
          const pos = orderedKeys.indexOf(k);
          if (pos >= insertPos) insertPos = pos + 1;
        }
      }
    } else {
      // Sem sobreposição visível: decide pela direção do scroll
      if (scrollDirection === 'UP') {
        const newItems = [];
        for (const k of currentBatchKeys) {
          if (!seenKeys.has(k)) {
            newItems.push(k);
            seenKeys.add(k);
          }
        }
        orderedKeys.unshift(...newItems);
      } else {
        for (const k of currentBatchKeys) {
          if (!seenKeys.has(k)) {
            orderedKeys.push(k);
            seenKeys.add(k);
          }
        }
      }
    }
  }

    /**
   * Calibra monotonicamente e cronologicamente todos os timestamps das mensagens
   * usando a ordem física estrita do DOM do WhatsApp como fonte absoluta da verdade.
   * 
   * 1. Âncoras Rígidas: Mensagens que vieram de data-pre-plain-text com data completa
   *    ou divisores explícitos são âncoras inegociáveis.
   * 2. Backward Sweep: Propaga datas do futuro para o passado quando há salto de dia.
   * 3. Forward Sweep: Garante timestamps estritamente crescentes (+10ms no mesmo minuto).
   */
  function calibratePhysicalChatSequence(orderedKeys, messagesMap) {
    if (!orderedKeys || orderedKeys.length === 0 || !messagesMap) return;

    const msgs = orderedKeys.map(k => messagesMap.get(k)).filter(Boolean);
    if (msgs.length === 0) return;

    msgs.forEach((message, index) => { message.domOrder = index; });
  }

  function sourceMessageId(id) { return String(id).replace(/^(?:true|false)_[^_]+_/, ''); }
  function noteMessageIssue(messages, reason, id) {
    messages._messageIssues ||= new Map();
    const key = sourceMessageId(id);
    const reasons = messages._messageIssues.get(key) || new Set();
    reasons.add(reason); messages._messageIssues.set(key, reasons);
    messages._issues ||= new Set(); messages._issues.add(reason);
  }
  function resolveMessageIssues(messages, id) {
    const reasons = messages._messageIssues?.get(sourceMessageId(id));
    if (!reasons) return;
    messages._messageIssues.delete(sourceMessageId(id));
    for (const reason of reasons) {
      if (![...messages._messageIssues.values()].some(pending => pending.has(reason))) messages._issues?.delete(reason);
    }
  }
  function mergeNativeMessages(messages, native, identity, tracker) {
    if (!native.success || native.jid !== identity.jid || !Array.isArray(native.messages)) return;
    const bySource = new Map([...messages.values()].map(message => [sourceMessageId(message.id), message]));
    for (const message of native.messages) {
      const key = BrokivaImport.messageIdentity(message.id);
      if (!key || key.jid !== identity.jid || key.fromMe !== message.fromMe || !Number.isFinite(Date.parse(message.timestamp))) continue;
      const sourceId = sourceMessageId(message.id);
      const previous = bySource.get(sourceId);
      // Não publica outra autoria para uma mensagem já enviada nos checkpoints.
      if (previous && previous.fromMe !== message.fromMe) {
        noteMessageIssue(messages, 'MESSAGE_METADATA_CONFLICT', message.id); continue;
      }
      const old = messages.get(message.id);
      const merged = { ...old, ...message, content: message.content || old?.content || `[${message.messageType}]`,
        mediaUrl: message.mediaUrl || old?.mediaUrl, timestampEstimated: false, hasPrePlain: true };
      messages.set(message.id, merged); bySource.set(sourceId, merged);
      resolveMessageIssues(messages, message.id);
      if (!tracker.seenKeys.has(message.id)) { tracker.seenKeys.add(message.id); tracker.orderedKeys.push(message.id); }
    }
  }
  function buildImportAudit(messages, native = {}) {
    const values = [...messages.values()];
    const countIssue = reason => [...(messages._messageIssues?.values() || [])].filter(reasons => reasons.has(reason)).length;
    const files = values.filter(message => ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER'].includes(message.messageType));
    return {
      unconfirmedAuthors: countIssue('AUTHOR_UNCONFIRMED'), unreadableBubbles: countIssue('UNREADABLE_MESSAGE'),
      estimatedDates: values.filter(message => message.timestampEstimated).length,
      filesNotImported: files.filter(message => !message.mediaUrl || message.mediaIsPreview).length,
      previewOnly: files.filter(message => message.mediaIsPreview).length,
      nativeUnreadable: native.unreadable || 0, nativeReasons: native.unreadableReasons || {}, unsupportedTypes: native.unsupportedTypes || {},
    };
  }

  function harvestDomMessages(messagesMap, fallbackPhone = '', orderTracker = null, scrollDirection = 'INIT') {
    const main = document.querySelector('#main');
    if (!main) return;

    // Coleta todos os elementos do chat em ordem cronológica de cima para baixo
    // Evita duplicidade entre div[role="row"] que já contenha balões filhos específicos (.message-in / .message-out)
    const allCandidates = Array.from(main.querySelectorAll('div[data-id], div.message-in, div.message-out, div[role="row"], div[data-testid*="system"], div[data-testid*="msg-container"]'));
    const uniqueElements = [];
    const seenElements = new Set();

    for (const el of allCandidates) {
      if (el.getAttribute('role') === 'row' && el.querySelector('.message-in, .message-out')) {
        continue;
      }
      const bubble = el.closest('[data-testid^="conv-msg-"]') || el.querySelector('[data-testid^="conv-msg-"]') || (el.matches('.message-in, .message-out') ? el : (el.querySelector('.message-in, .message-out') || el));
      if (seenElements.has(bubble)) continue;
      seenElements.add(bubble);
      uniqueElements.push(bubble);
    }

    let currentWalkingDateIso = '';
    let lastSeenValidTimeMs = 0;
    let lastDeterminedFromMe = null;

    // Pré-carrega uma data inicial do topo se houver divisor de data legítimo no DOM atual
    for (const el of uniqueElements) {
      const d = extractDateFromSystemDivider(el);
      if (d) {
        currentWalkingDateIso = d.toISOString();
        if (orderTracker && !orderTracker.knownAnchorDateIso) {
          orderTracker.knownAnchorDateIso = currentWalkingDateIso;
        }
        break;
      }
    }

    const currentBatchKeys = [];

    uniqueElements.forEach((element, index) => {
      // 1. Verifica se este elemento é um divisor de data do sistema no fluxo do chat
      const isSystemDateContainer = Boolean(
        !element.classList?.contains('message-in') &&
        !element.classList?.contains('message-out') &&
        !element.querySelector?.('.message-in, .message-out') &&
        !element.hasAttribute?.('data-id') &&
        !element.querySelector?.('[data-id]') &&
        (element.getAttribute?.('data-testid')?.includes('system') || element.getAttribute?.('data-testid')?.includes('date') || !element.querySelector?.('[data-pre-plain-text]'))
      );

      if (isSystemDateContainer) {
        const text = (element.innerText || '').trim();
        if (text && text.length <= 25) {
          const parsed = parsePortugueseWhatsAppDate(text);
          if (parsed) {
            currentWalkingDateIso = parsed.toISOString();
            return;
          }
        }
      }

      // 2. Determina o container do balão de mensagem e row pai
      const container = (element.classList?.contains('message-in') || element.classList?.contains('message-out'))
        ? element
        : (element.querySelector?.('.message-in, .message-out') || element);
      const parentRow = container.closest?.('div[role="row"]') || container;

      // Localiza nó com data-id associado à mensagem
      let actualDataId = '';
      const idEl = container.hasAttribute?.('data-id')
        ? container
        : (container.closest?.('[data-id]') || container.querySelector?.('[data-id]') || (parentRow && parentRow.hasAttribute?.('data-id') ? parentRow : parentRow?.querySelector?.('[data-id]')));
      if (idEl?.getAttribute) {
        actualDataId = (idEl.getAttribute('data-id') || '').trim();
      }

      if (actualDataId.includes('@g.us') || actualDataId.includes('@newsletter') || actualDataId.includes('@broadcast')) {
        return;
      }

      // Validação resiliente de ID de mensagem do WhatsApp
      const isDataIdFromMe = actualDataId.startsWith('true_');
      const isDataIdFromContact = actualDataId.startsWith('false_');
      const isRawMessageKey = /^[a-f0-9]{16,128}$/i.test(actualDataId) && idEl?.getAttribute('data-testid') === `conv-msg-${actualDataId}`;
      const isRealMsgKey = isDataIdFromMe || isDataIdFromContact || isRawMessageKey;
      const rawDataId = isRealMsgKey ? actualDataId : '';

      const structuredNodes = Array.from(container.querySelectorAll('.selectable-text, [data-testid="msg-text"]'))
        .filter(node => !node.closest('[data-testid*="quote"], .quoted-mention') && !node.parentElement?.closest('.selectable-text'));
      const structuredText = structuredNodes.map(node => {
        const copy = node.cloneNode(true);
        copy.querySelectorAll('[data-testid*="quote"], .quoted-mention').forEach(node => node.remove());
        copy.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
        copy.querySelectorAll('img[alt]').forEach(img => img.replaceWith(document.createTextNode(img.getAttribute('alt'))));
        return copy.innerText || copy.textContent || '';
      }).join('\n').trim();

      // 3. Extração de texto isolando citação/resposta anterior (Quote) e metadados de hora
      const clone = container.cloneNode(true);

      // Remove blocos de citação (para não contaminar com "Você: [msg anterior]")
      clone.querySelectorAll(
        '[data-testid="quoted-message"], .quoted-mention, [data-testid*="quote"], div[aria-label*="Citação"], div[aria-label*="Quoted"], div._amk4, div._amk6, div._amkb'
      ).forEach(el => el.remove());

      // Remove carimbos de hora, todos os SVGs, títulos de ícones e metadados
      clone.querySelectorAll(
        'svg, span[data-icon], div[data-icon], [data-testid="msg-meta"], [data-testid*="time"], div._amjz'
      ).forEach(el => el.remove());

      // Remove botões de player de áudio e controles de velocidade (1,0×, 1.5×, 2×)
      clone.querySelectorAll(
        'button, [data-testid="audio-player"], [data-testid="ptt-waveform"], audio, span[data-icon="ptt-play"], span[data-icon="ptt-pause"], span[data-icon="audio-play"], span[data-icon="audio-pause"]'
      ).forEach(el => el.remove());

      // Remove nós folha que contêm exclusivamente horários (ex: "14:53", "12:59", "22:24✓") ou velocidades
      clone.querySelectorAll('span, div, button').forEach(el => {
        if (el.children.length === 0) {
          const t = (el.innerText || '').trim();
          if (
            /^(\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?)([\s\u200e\u200f]*[✓✔︎]?)*$/i.test(t) ||
            /^\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]?\s*$/i.test(t)
          ) {
            el.remove();
          }
        }
      });

      // Remove pílulas e balões de reações
      clone.querySelectorAll(
        '[data-testid*="reaction"], [aria-label*="reaç" i], [aria-label*="reaction" i], div._amkw, div._amkx'
      ).forEach(el => el.remove());

      // 4. Identificação de Tipo de Mídia (no clone limpo, sem contaminação de citações)
      const hasVideo = Boolean(
        clone.querySelector('video, span[data-icon*="video"], div[data-testid="video-thumb"], button[aria-label*="vídeo" i]')
      );
      const hasDoc = Boolean(
        clone.querySelector('span[data-icon*="document"], a[download], [data-testid="document-thumb"], span[data-icon="media-document"]')
      );
      const hasImg = !hasVideo && Boolean(
        clone.querySelector('div[data-testid="image-thumb"], div[data-testid="media-image"], div[data-testid="image-wrapper"]') ||
        clone.querySelector('img[src*="blob:"]:not(.emoji):not([data-plain-text]):not([data-testid*="avatar"])')
      );
      const isVoiceOrAudio = Boolean(
        clone.querySelector('audio, [data-testid="audio-player"], [data-testid="ptt-waveform"], span[data-icon="ptt-play"], span[data-icon="ptt-pause"], span[data-icon="audio-play"], span[data-icon="audio-pause"], button[aria-label*="mensagem de voz" i], button[aria-label*="voice message" i], button[aria-label*="áudio" i]') ||
        container.querySelector('audio, [data-testid="audio-player"]')
      );
      const hasAudio = !hasVideo && !hasDoc && !hasImg && isVoiceOrAudio;

      // 5. Extração de texto digitado pelo usuário
      const textNode = clone.querySelector('span._ao3e, span.selectable-text, .selectable-text, .copyable-text span, div.copyable-text span, div.copyable-text, span[dir="ltr"], span[dir="auto"]');
      let userTypedText = (textNode ? textNode.innerText : clone.innerText) || '';
      userTypedText = userTypedText.trim();

      if (userTypedText) {
        userTypedText = userTypedText
          // Remove horários colados no final
          .replace(/(?:\s*|[\u00a0\u200e\u200f\n\r]*)(\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?)([\s\u200e\u200f]*[✓✔︎]?)*$/i, '')
          // Remove tamanhos de arquivo residuais
          .replace(/\s*\(\s*\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\s*\)/gi, '')
          .replace(/\b\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\b/gi, '')
          // Remove velocidades de reprodução de áudio em qualquer formato (1,0×, 1.5×, 2x, etc.)
          .replace(/\b\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]\b/gi, '')
          // Remove nomes de ícones do WhatsApp Web
          .replace(/\b(tail-in|tail-out|ic-fast-forward|fast-forward)\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        // Limpeza de contatos compartilhados do WhatsApp Web
        if (userTypedText.includes('contatoVer todos') || userTypedText.includes('e 1 outro contato')) {
          userTypedText = userTypedText.replace(/e\s+\d+\s+outro\s+contato/gi, '').replace(/Ver\s+todos/gi, '').trim();
          userTypedText = '👤 Contato compartilhado: ' + userTypedText;
        }

        // Se sobrou apenas velocidade de reprodução ou número curto com multiplicador
        if (/^\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]?$/i.test(userTypedText)) {
          userTypedText = '';
        }

        if (userTypedText.startsWith('Você:') || userTypedText.startsWith('You:')) {
          userTypedText = userTypedText.replace(/^(Você|Voce|You)\s*[:\n]+/i, '').trim();
        }

        if (/^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i.test(userTypedText) || userTypedText.length === 0) {
          userTypedText = '';
        }
      }

      // 6. Determinação de messageType, content e captura de mídias/thumbnails
      let messageType = 'TEXT';
      let content = '';
      let mediaUrl = '';
      let fileName = '';

      const isUrlMessage = userTypedText && /^(https?:\/\/[^\s]+)$/i.test(userTypedText.trim());

      if (isUrlMessage && !hasVideo && !hasImg) {
        messageType = 'TEXT';
        content = userTypedText.trim();
      } else if (userTypedText && !hasDoc && !hasVideo && !hasImg) {
        messageType = 'TEXT';
        content = userTypedText;
      } else if ((hasAudio || isVoiceOrAudio) && (!userTypedText || /^\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]?$/i.test(userTypedText))) {
        messageType = 'AUDIO';
        content = '🎵 Mensagem de Voz';
        fileName = 'Audio.ogg';
      } else if (hasDoc) {
        messageType = 'DOCUMENT';
        const nameEl = container.querySelector('span[title*="."], span.x10l6tqk[title], a[download]');
        let rawFileName = (nameEl?.getAttribute('title') || nameEl?.innerText || '').trim();
        rawFileName = rawFileName
          .replace(/\s*\(\s*\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\s*\)/gi, '')
          .replace(/\b\d+([.,]\d+)?\s*(KB|MB|GB|B|bytes?)\b/gi, '')
          .replace(/[\n\r]+/g, ' ')
          .trim();

        if (rawFileName && !/^\d+([.,]\d+)?\s*(KB|MB|GB|B)$/i.test(rawFileName) && rawFileName.length > 2) {
          fileName = rawFileName;
          content = `📄 ${rawFileName}`;
        } else {
          fileName = 'Documento.pdf';
          content = userTypedText || '📄 Documento';
        }

        const linkEl = container.querySelector('a[href]');
        if (linkEl && linkEl.href && linkEl.href.startsWith('http')) {
          mediaUrl = linkEl.href;
        }
      } else if (hasVideo) {
        messageType = 'VIDEO';
        content = userTypedText || '🎥 Vídeo';
        fileName = 'Video.mp4';
      } else if (hasImg) {
        messageType = 'IMAGE';
        content = userTypedText || '📷 Foto';
        fileName = 'Foto.jpg';

        // Captura thumbnail de imagem diretamente para visualização no CRM
        const imgEl = container.querySelector('div[data-testid="image-thumb"] img, div[data-testid="media-image"] img, img[src*="blob:"]:not(.emoji), img[src*="data:image"]:not(.emoji)');
        if (imgEl) {
          const src = imgEl.getAttribute('src') || imgEl.src || '';
          if (src.startsWith('data:image')) {
            mediaUrl = src;
          } else if (imgEl.complete && imgEl.naturalWidth > 0) {
            try {
              const canvas = document.createElement('canvas');
              const maxDim = 400;
              let w = imgEl.naturalWidth, h = imgEl.naturalHeight;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imgEl, 0, 0, w, h);
              mediaUrl = canvas.toDataURL('image/jpeg', 0.8);
            } catch (e) {
              if (src.startsWith('http')) mediaUrl = src;
            }
          } else if (src.startsWith('http')) {
            mediaUrl = src;
          }
        }
      } else {
        messageType = 'TEXT';
        content = userTypedText;
      }

      if (structuredText) {
        content = structuredText;
        if (!hasImg && !hasVideo && !hasDoc && !hasAudio) messageType = 'TEXT';
      }
      if (!content) {
        if (isRealMsgKey) noteMessageIssue(messagesMap, 'UNREADABLE_MESSAGE', rawDataId);
        return;
      }
      if (!isRealMsgKey) {
        messagesMap._issues ||= new Set();
        messagesMap._issues.add('MESSAGE_ID_UNAVAILABLE');
        return;
      }

      // 7. Identificação de autoria (Você / Corretor vs Cliente) com múltiplos níveis de confirmação
      const prePlainNode = container.hasAttribute?.('data-pre-plain-text') ? container :
                           (container.querySelector?.('[data-pre-plain-text]') || parentRow.querySelector?.('[data-pre-plain-text]') || container.closest?.('[data-pre-plain-text]'));
      const rawPrePlain = prePlainNode ? (prePlainNode.getAttribute('data-pre-plain-text') || '') : '';
      const cleanPrePlain = rawPrePlain.replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, ' ').trim();

      const isMessageOut = Boolean(
        container.classList?.contains?.('message-out') ||
        container.querySelector?.('.message-out') ||
        container.closest?.('.message-out') ||
        parentRow.classList?.contains?.('message-out') ||
        parentRow.querySelector?.('.message-out')
      );

      const isMessageIn = Boolean(
        container.classList?.contains?.('message-in') ||
        container.querySelector?.('.message-in') ||
        container.closest?.('.message-in') ||
        parentRow.classList?.contains?.('message-in') ||
        parentRow.querySelector?.('.message-in')
      );

      const hasTailOut = Boolean(
        container.querySelector?.('[data-icon*="tail-out"]') ||
        parentRow.querySelector?.('[data-icon*="tail-out"]')
      );

      const hasTailIn = Boolean(
        container.querySelector?.('[data-icon*="tail-in"]') ||
        parentRow.querySelector?.('[data-icon*="tail-in"]')
      );

      const hasOutgoingCheckmark = Boolean(
        container.querySelector?.('span[data-icon*="check"], span[data-icon*="dblcheck"], span[data-icon="msg-time"], span[data-testid*="check"], span[data-testid*="status"]') ||
        parentRow.querySelector?.('span[data-icon*="check"], span[data-icon*="dblcheck"], span[data-icon="msg-time"], span[data-testid*="check"]')
      );

      const isPrePlainFromMe = Boolean(
        /(?:\[.*?\]\s*)?(?:você|voce|you)\s*:/i.test(cleanPrePlain) ||
        /\b(você|voce|you)\b/i.test(cleanPrePlain) ||
        (currentBrokerName && cleanPrePlain.toLowerCase().includes(currentBrokerName.toLowerCase() + ':'))
      );

      let hasOutgoingBg = false;
      try {
        const bgCandidates = [container, parentRow, container.firstElementChild];
        for (const el of bgCandidates) {
          if (!el) continue;
          const bg = window.getComputedStyle(el).backgroundColor || '';
          if (bg.includes('217, 253, 211') || bg.includes('0, 92, 75') || bg.includes('217, 253') || bg.includes('0, 92')) {
            hasOutgoingBg = true;
            break;
          }
        }
      } catch (e) {}

      // Verificação visual geométrica (mensagens de saída ficam alinhadas à direita do chat)
      let isVisuallyRightAligned = false;
      try {
        const rowRect = parentRow.getBoundingClientRect();
        const boxRect = container.getBoundingClientRect();
        if (rowRect.width > 200 && boxRect.width > 50) {
          const rightDist = rowRect.right - boxRect.right;
          const leftDist = boxRect.left - rowRect.left;
          if (rightDist < 140 && leftDist > 60) {
            isVisuallyRightAligned = true;
          }
        }
      } catch (e) {}

      let isFromMe = false;
      if (isDataIdFromMe) {
        isFromMe = true;
      } else if (isDataIdFromContact) {
        isFromMe = false;
      } else if (hasTailOut) {
        isFromMe = true;
      } else if (hasTailIn) {
        isFromMe = false;
      } else if (isMessageOut) {
        isFromMe = true;
      } else if (isMessageIn) {
        isFromMe = false;
      } else if (isPrePlainFromMe) {
        isFromMe = true;
      } else if (hasOutgoingCheckmark) {
        isFromMe = true;
      } else if (hasOutgoingBg) {
        isFromMe = true;
      } else if (isVisuallyRightAligned) {
        isFromMe = true;
      } else if (lastDeterminedFromMe !== null && !isMessageIn && !hasTailIn) {
        // Herança de cluster sequencial (ex: foto de comprovante enviada em sequência imediata a uma mensagem do corretor)
        isFromMe = lastDeterminedFromMe;
      } else {
        isFromMe = false;
      }

      lastDeterminedFromMe = isFromMe;

      // 8. Extração e Resolução Robusta de Data e Hora com Garantia de Ordem Monotônica
      let msgTime = '';
      let isHardPrePlainDate = false;
      if (cleanPrePlain) {
        const dt = parseWhatsAppTimestamp(cleanPrePlain);
        if (dt) {
          msgTime = dt.toISOString();
          currentWalkingDateIso = msgTime;
          lastSeenValidTimeMs = dt.getTime();
          isHardPrePlainDate = true;
        }
      }

      if (!msgTime) {
        // Extrai hora explícita EXCLUSIVAMENTE do rodapé de metadados do balão (msg-meta / _amjz)
        // JAMAIS lê container.innerText nem span de conteúdo, evitando que menções a horas no texto corrompam o envio
        const metaEl = container.querySelector('[data-testid="msg-meta"], div._amjz, [data-testid*="time"], span[data-testid*="msg-time"]');
        let foundHour = null;
        let foundMin = null;

        if (metaEl) {
          const cleanCand = (metaEl.innerText || '').replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, ' ');
          const m = cleanCand.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
          if (m) {
            foundHour = Number(m[1]);
            foundMin = Number(m[2]);
          }
        }

        // Se ainda não achou no metaEl, busca nós folha minúsculos que contenham puramente horário no rodapé
        if (foundHour === null) {
          const leafSpans = Array.from(container.querySelectorAll('span, div')).filter(el => el.children.length === 0);
          for (const sp of leafSpans) {
            const txt = (sp.innerText || '').trim();
            const m = txt.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
            if (m) {
              foundHour = Number(m[1]);
              foundMin = Number(m[2]);
              break;
            }
          }
        }

        const contextualDate = getContextualDateForContainer(container, currentWalkingDateIso);
        if (foundHour !== null && foundMin !== null) {
          const d = new Date(contextualDate.getTime());
          d.setHours(foundHour, foundMin, 0, 0);

          // PROTEÇÃO CONTRA MENSAGENS NO FUTURO (Tolerância para pequenos desvios de relógio)
          if (d.getTime() > Date.now() + 300000) {
            if (d.getTime() > Date.now() + 43200000) {
              d.setDate(d.getDate() - 1);
            } else {
              d.setTime(Date.now());
            }
          }
          msgTime = d.toISOString();
        } else if (lastSeenValidTimeMs > 0) {
          msgTime = new Date(lastSeenValidTimeMs + 1000).toISOString();
        } else {
          msgTime = contextualDate.toISOString();
        }
      }

      let identity = BrokivaImport.messageIdentity(rawDataId);
      if (!identity && isRawMessageKey && messagesMap._identity?.jid) {
        const sender = cleanPrePlain.replace(/^.*?\]\s*/, '').replace(/:\s*$/, '').trim();
        const tailOut = Boolean(container.querySelector('[data-icon="tail-out"]'));
        const tailIn = Boolean(container.querySelector('[data-icon="tail-in"]'));
        const checked = Boolean(container.querySelector('[data-testid="msg-meta"] [data-icon*="check"]'));
        const explicit = tailOut || checked ? true : tailIn ? false : null;
        identity = BrokivaImport.rawMessageIdentity(rawDataId, messagesMap._identity.jid, sender, messagesMap._identity.title, currentBrokerName, explicit);
      }
      if (!identity) { noteMessageIssue(messagesMap, isRawMessageKey ? 'AUTHOR_UNCONFIRMED' : 'MESSAGE_ID_UNAVAILABLE', rawDataId); return; }
      const uniqueMsgKey = identity.id;
      resolveMessageIssues(messagesMap, rawDataId);
      const isTimestampEstimated = !isHardPrePlainDate;
      currentWalkingDateIso = msgTime;
      lastSeenValidTimeMs = Date.parse(msgTime) || lastSeenValidTimeMs;

      currentBatchKeys.push(uniqueMsgKey);

      if (!messagesMap.has(uniqueMsgKey)) {
        messagesMap.set(uniqueMsgKey, {
          id: identity.id,
          content,
          fromMe: identity.fromMe,
          timestamp: msgTime,
          timestampEstimated: isTimestampEstimated,
          hasPrePlain: isHardPrePlainDate,
          // Toda imagem obtida deste balão vem do elemento de prévia, mesmo com URL HTTPS.
          mediaIsPreview: messageType === 'IMAGE' && Boolean(mediaUrl),
          messageType,
          mediaUrl: mediaUrl || undefined,
          fileName: fileName || undefined,
          domOrder: index,
        });
      } else {
        const existing = messagesMap.get(uniqueMsgKey);
        if (mediaUrl && !existing.mediaUrl) existing.mediaUrl = mediaUrl;
        if (fileName && !existing.fileName) existing.fileName = fileName;
        if (isHardPrePlainDate && !existing.hasPrePlain) {
          existing.timestamp = msgTime;
          existing.hasPrePlain = true;
          existing.timestampEstimated = false;
        }
      }
    });

    // 10. Atualiza o Rastreador de Ordem Física Global (orderTracker)
    if (orderTracker && currentBatchKeys.length > 0) {
      mergeBatchIntoOrderTracker(orderTracker, currentBatchKeys, scrollDirection);
    }
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

      // Injeta botão de sincronização rápida no topo da conversa aberta
      if (main && !document.getElementById('brokiva-header-sync-btn')) {
        const headerElem = main.querySelector('header');
        if (headerElem && !isCurrentChatGroupOrChannel()) {
          const topSyncBtn = document.createElement('button');
          topSyncBtn.id = 'brokiva-header-sync-btn';
          topSyncBtn.type = 'button';
          topSyncBtn.title = 'Importar mensagens disponíveis desta conversa no CRM Brokiva';
          topSyncBtn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Sincronizar Histórico</span>
          `;
          topSyncBtn.setAttribute('style', `
            display: inline-flex;
            align-items: center;
            background: #3742AC;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            margin-left: auto;
            margin-right: 12px;
            z-index: 99;
            transition: background 0.15s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          `);
          topSyncBtn.addEventListener('mouseenter', () => { topSyncBtn.style.background = '#283182'; });
          topSyncBtn.addEventListener('mouseleave', () => { topSyncBtn.style.background = '#3742AC'; });
          topSyncBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            topSyncBtn.disabled = true;
            topSyncBtn.style.opacity = '0.7';
            topSyncBtn.innerHTML = `<span>⏳ Lendo histórico...</span>`;
            let outcome;
            try {
              outcome = await syncCurrentActiveChat();
            } finally {
              topSyncBtn.disabled = false;
              topSyncBtn.style.opacity = '1';
              topSyncBtn.innerHTML = `<span>${outcome?.complete ? "✓ Importação conferida" : "Consultar pendências"}</span>`;
              setTimeout(() => {
                const b = document.getElementById('brokiva-header-sync-btn');
                if (b) {
                  b.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Sincronizar Histórico</span>
                  `;
                }
              }, 4000);
            }
          });
          const lastHeaderChild = headerElem.querySelector('div:last-child') || headerElem;
          lastHeaderChild.parentNode.insertBefore(topSyncBtn, lastHeaderChild);
        }
      }

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
        const headerTitle = chatHeaderTitle(main);
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

    // 1. Contêineres de scroll diretos conhecidos do WhatsApp Web
    const directCandidates = [
      main.querySelector('div.copyable-area > div[tabindex="-1"]'),
      main.querySelector('div[tabindex="-1"][data-tab]'),
      main.querySelector('div[data-testid="conversation-panel-messages"]'),
      main.querySelector('div[role="application"]'),
    ];
    for (const cand of directCandidates) {
      if (cand && cand.scrollHeight > cand.clientHeight && cand.clientHeight > 100) {
        return cand;
      }
    }

    // 2. Busca a partir de uma mensagem real existente no chat (método mais preciso do DOM)
    const msg = main.querySelector('div[data-id], div.message-in, div.message-out, div[role="row"]');
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

    return document.querySelector('#main div[tabindex="-1"]') ||
           document.querySelector('#main .copyable-area')?.parentElement ||
           document.querySelector('#main div[role="application"]');
  }

  // Detecta e clica automaticamente em botões/banners de "Clique para carregar conversas mais antigas"
  async function checkAndClickLoadMoreButton() {
    const main = document.querySelector('#main');
    if (!main) return false;
    for (const button of main.querySelectorAll('button, [role="button"], [data-testid*="history"], [data-testid*="load"]')) {
      if (button.closest('.message-in, .message-out, [data-id], [data-testid^="conv-msg-"]')) continue;
      const text = (button.innerText || button.getAttribute('aria-label') || '').trim();
      if (text.length > 180 || !/^(?:clique (?:aqui |neste aviso )?para (?:carregar|baixar)|carregar (?:mais |as )?(?:mensagens|conversas)|load (?:more|older) messages|click (?:here )?to load)/i.test(text)) continue;
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') continue;
      button.click(); return true;
    }
    return false;
  }

  async function deepScrollChatHistory(_legacyLimit, onProgress = null, checkpoint = null, expectedIdentity = null) {
    const identity = expectedIdentity || activeChatIdentity();
    if (!identity.jid) throw new Error('WhatsApp ainda não disponibilizou a identidade das mensagens. Aguarde o carregamento e tente novamente.');
    const main = identity.main;
    const scroller = findChatScrollContainer();
    const messages = new Map();
    messages._identity = identity;
    const tracker = { orderedKeys: [], seenKeys: new Set(), knownAnchorDateIso: '' };
    const wait = () => new Promise(resolve => setTimeout(resolve, 750));
    let olderAttempts = 0, olderRequestedAt = 0, previousCount = 0;
    const capture = direction => {
      assertActiveChat(identity);
      harvestDomMessages(messages, identity.jid, tracker, direction);
      if (messages.size > previousCount) { previousCount = messages.size; olderAttempts = 0; }
      return `${messages.size}:${Array.from(main.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id')).join('|')}`;
    };
    if (!scroller) {
      capture('INIT');
      messages._coverage = { complete: false, reason: 'NO_SCROLL_CONTAINER' };
    } else {
      // Desce com sobreposição antes de subir: saltar ao fundo pode pular páginas virtualizadas.
      for (let step = 0; step < 800; step++) {
        capture('DOWN');
        if (cancelSyncRequested) break;
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 3) break;
        const previous = scroller.scrollTop;
        scroller.scrollTop += Math.max(50, scroller.clientHeight * 0.65);
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await wait();
        if (Math.abs(scroller.scrollTop - previous) < 1) break;
      }
      messages._coverage = await BrokivaImport.walkHistory({
        cancelled: () => cancelSyncRequested,
        assertChat: () => assertActiveChat(identity),
        capture: () => capture('UP'),
        atStart: () => scroller.scrollTop <= 3,
        startConfirmed: () => Boolean(main.querySelector('[data-testid="chat-history-start"], [data-testid="conversation-start"]')),
        loading: () => Boolean(main.querySelector('[data-testid="chat-history-loader"], [role="progressbar"], [aria-busy="true"]')) || (olderRequestedAt > 0 && Date.now() - olderRequestedAt < 20000),
        moveUp: async () => {
          scroller.scrollTop -= Math.max(50, scroller.clientHeight * 0.65);
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          if (scroller.scrollTop <= 3 && olderAttempts < 2 && (!olderRequestedAt || Date.now() - olderRequestedAt >= 20000)) {
            if (await checkAndClickLoadMoreButton()) { olderAttempts++; olderRequestedAt = Date.now(); }
          }
        }, wait,
        checkpoint: checkpoint ? () => checkpoint(messages) : undefined,
      }, { onProgress });
    }
    assertActiveChat(identity);
    // O Store é apenas complemento do que está carregado; nunca prova de histórico completo.
    const native = await queryNativeStore('BROKIVA_GET_CHAT_MESSAGES', { jid: identity.jid }, 2500);
    mergeNativeMessages(messages, native, identity, tracker);
    calibratePhysicalChatSequence(tracker.orderedKeys, messages);
    messages._orderedKeys = tracker.orderedKeys;
    messages._identity = identity;
    messages._audit = buildImportAudit(messages, native);
    if (messages._audit.estimatedDates) { messages._issues ||= new Set(); messages._issues.add('TIMESTAMP_ESTIMATED'); }
    if (messages._audit.filesNotImported) { messages._issues ||= new Set(); messages._issues.add('MEDIA_FILE_UNAVAILABLE'); }
    if (messages._audit.previewOnly) { messages._issues ||= new Set(); messages._issues.add('MEDIA_PREVIEW_ONLY'); }
    if (native.unreadable) { messages._issues ||= new Set(); messages._issues.add('NATIVE_UNREADABLE'); }
    if (messages._issues?.size) {
      const reasons = new Set(messages._coverage?.complete ? [] : String(messages._coverage?.reason || '').split(', ').filter(Boolean));
      messages._issues.forEach(reason => reasons.add(reason));
      messages._coverage = { complete: false, reason: [...reasons].join(', ') };
    }
    return messages;
  }

  async function extractContactDetailsFromDrawer() {
    try {
      const main = document.querySelector('#main');
      if (!main) return null;

      // O botão clicável do cabeçalho que abre a gaveta de dados do contato
      const headerClickable = main.querySelector('[data-testid="conversation-info-header-chat-title"]') || main.querySelector('header [data-testid="conversation-info-header"]') ||
                              main.querySelector('header div[role="button"]') ||
                              main.querySelector('header div[tabindex="0"]') ||
                              main.querySelector('header span[title]')?.closest('div[role="button"]') ||
                              main.querySelector('header span[title]') ||
                              main.querySelector('header');
      if (!headerClickable) return null;

      if (!document.querySelector('[data-testid="contact-info-drawer"], [data-testid="chat-info-drawer"]')) headerClickable.click();

      let foundPhone = null;
      let foundPushName = null;
      let foundLabels = [];

      // Aguarda até 1200ms a gaveta lateral montar no DOM
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 120));
        const sidePanel = document.querySelector(
          '[data-testid="contact-info-drawer"], [data-testid="chat-info-drawer"], [role="region"][aria-label*="Dados do contato" i], [role="region"][aria-label*="Contact info" i]'
        );
        if (sidePanel) {
          const text = sidePanel.innerText || '';

          // Só aceita campos inteiros de telefone no painel identificado, nunca números no texto da conversa.
          const candidates = Array.from(sidePanel.querySelectorAll('a[href^="tel:"], [data-testid*="phone"], span[dir="auto"]'))
            .map(node => node.getAttribute('href')?.replace(/^tel:/, '') || node.innerText || '')
            .filter(text => /^\+?[\d\s().-]{8,25}$/.test(text.trim()))
            .map(text => text.replace(/\D/g, ''))
            .filter(phone => phone.length >= 8 && phone.length <= 15);
          const unique = [...new Set(candidates)];
          if (unique.length === 1) foundPhone = unique[0];

          // 2. Busca pushName (~ Nome)
          if (!foundPushName) {
            const pushMatch = text.match(/~\s*([^\n\r]+)/);
            if (pushMatch && pushMatch[1]) {
              foundPushName = pushMatch[1].trim();
            }
          }

          // 3. Busca Etiquetas / Labels no WhatsApp Business
          const labelElements = sidePanel.querySelectorAll(
            '[data-testid*="label" i], [aria-label*="etiqueta" i], [aria-label*="label" i], span[title*="Etiqueta" i]'
          );
          labelElements.forEach(el => {
            const labelText = (el.getAttribute('title') || el.getAttribute('aria-label') || el.innerText || '').trim();
            const clean = labelText.replace(/^(etiqueta|label):\s*/i, '').trim();
            if (clean && clean.length >= 2 && clean.length <= 40 && !clean.includes('\n')) {
              if (!foundLabels.includes(clean)) foundLabels.push(clean);
            }
          });

          // Também verifica seções de texto que contêm "Etiquetas"
          const headings = Array.from(sidePanel.querySelectorAll('span, div, h2, h3'));
          const etiquetasHeading = headings.find(h => {
            const t = (h.innerText || '').trim().toLowerCase();
            return t === 'etiquetas' || t === 'labels';
          });
          if (etiquetasHeading) {
            const container = etiquetasHeading.closest('div[role="button"]') || etiquetasHeading.parentElement?.parentElement;
            if (container) {
              const chipSpans = container.querySelectorAll('span[dir="auto"], span[title], div[role="button"] span');
              chipSpans.forEach(s => {
                const txt = (s.getAttribute('title') || s.innerText || '').trim();
                const lower = txt.toLowerCase();
                if (txt && txt.length >= 2 && txt.length <= 40 && lower !== 'etiquetas' && lower !== 'labels' && !txt.includes('\n')) {
                  if (!foundLabels.includes(txt)) foundLabels.push(txt);
                }
              });
            }
          }

          if (foundPhone) break;
        }
      }

      // Fecha a gaveta lateral
      const closeBtn = document.querySelector('[data-testid="drawer-right"] [data-testid="btn-closer"]') || document.querySelector('[data-testid="drawer-right"] [aria-label="Fechar"]') || document.querySelector('div[tabindex="-1"] span[data-icon="x"]')?.closest('button') ||
                       document.querySelector('header button[aria-label*="Fechar" i], header button[aria-label*="Close" i]') ||
                       document.querySelector('div[tabindex="-1"] button[aria-label*="Fechar" i], div[tabindex="-1"] button[aria-label*="Close" i]') ||
                       document.querySelector('[data-testid="btn-closer"]');
      if (closeBtn) closeBtn.click();
      await new Promise(r => setTimeout(r, 150));

      return { phone: foundPhone, pushName: foundPushName, labels: foundLabels };
    } catch (e) {
      return null;
    }
  }

  const extractPhoneFromContactDrawer = extractContactDetailsFromDrawer;

  async function resolvePhoneFromCrmIfLid(contactName, phoneStr, forceDrawer = false, details = {}) {
    const jid = BrokivaImport.canonicalJid(phoneStr);
    let phone = String(phoneStr || '').replace(/@.*$/, '').replace(/\D/g, '');
    const isLid = jid.endsWith('@lid') || isWhatsAppSyntheticOrInvalidPhone(phone);
    if (forceDrawer || isLid || !phone) {
      const drawer = await extractContactDetailsFromDrawer().catch(() => null);
      if (drawer) {
        if (drawer.labels) details.labels = drawer.labels;
        const verified = String(drawer.phone || '').replace(/\D/g, '');
        if (verified && !isWhatsAppSyntheticOrInvalidPhone(verified)) phone = verified;
      }
    }
    if (!phone || isWhatsAppSyntheticOrInvalidPhone(phone)) return '';
    if (jid.endsWith('@lid') && phone === jid.split('@')[0]) return '';
    return phone;
  }

  // 4. Sincroniza apenas a conversa atual com carregamento paginado
  // Os envios passam pela fila durável do worker e pelo recibo do CRM.
  async function importContext() {
    const context = await chrome.storage.local.get(['tenantId', 'brokerUserId', 'crmUrl']);
    if (!context.tenantId || !context.brokerUserId) throw new Error('Entre e pareie no CRM antes de iniciar a leitura.');
    return context;
  }
  async function dispatchSyncBatchChats(chats, context) {
    if (!context) throw new Error('O contexto da leitura não foi confirmado.');
    return chrome.runtime.sendMessage({ action: 'SYNC_BATCH_CHATS', data: { chats, context } });
  }
  function describeCoverage(coverage, audit = {}) {
    const counted = (count, fallback, label) => count ? `${label}: ${count}.` : fallback;
    const nativeLabels = { ENCRYPTED_MESSAGE: 'ainda não descriptografados', NATIVE_IDENTITY_INVALID: 'sem identidade/autoria verificável',
      NATIVE_DATE_INVALID: 'sem data verificável', NATIVE_TYPE_UNSUPPORTED: 'em formatos ainda não suportados', NATIVE_EMPTY_TEXT: 'sem texto legível',
      NATIVE_CONTENT_INVALID: 'com conteúdo não interpretável', NATIVE_READ_ERROR: 'com falha de leitura' };
    const nativeDetails = Object.entries(audit.nativeReasons || {}).filter(([, count]) => count > 0)
      .map(([reason, count]) => `${count} ${nativeLabels[reason] || 'pendentes'}`).join('; ');
    const reasons = {
      AVAILABLE_START: 'Início do histórico disponível confirmado.',
      UNCONFIRMED_BOUNDARY: 'O WhatsApp não confirmou o início do histórico disponível.',
      NO_SCROLL_CONTAINER: 'Não foi possível percorrer o histórico anterior.',
      TIME_LIMIT: 'O limite de tempo de leitura foi atingido. Releia a conversa para continuar a conferência.',
      STEP_LIMIT: 'O limite de etapas de leitura foi atingido.',
      CANCELLED: 'Leitura interrompida pelo usuário.',
      TIMESTAMP_ESTIMATED: counted(audit.estimatedDates, 'Algumas mensagens não têm data verificável e precisam ser relidas.', 'Mensagens sem data verificável, não enviadas'),
      MEDIA_FILE_UNAVAILABLE: counted(audit.filesNotImported, 'Há mídias cujo arquivo original não foi importado; somente o registro da mensagem foi salvo.', 'Mídias sem arquivo original importado (o registro pode estar salvo)'),
      MEDIA_PREVIEW_ONLY: counted(audit.previewOnly, 'Algumas imagens possuem apenas miniatura; o arquivo original não foi importado.', 'Imagens com apenas miniatura'),
      NATIVE_UNREADABLE: audit.nativeUnreadable ? `Itens do WhatsApp não interpretados: ${audit.nativeUnreadable}${nativeDetails ? ` (${nativeDetails})` : ''}.` : 'O WhatsApp disponibilizou itens que não puderam ser interpretados.',
      UNREADABLE_MESSAGE: counted(audit.unreadableBubbles, 'Há balões sem conteúdo legível.', 'Balões sem conteúdo legível'),
      MESSAGE_ID_UNAVAILABLE: 'Há balões sem identificador verificável.',
      AUTHOR_UNCONFIRMED: counted(audit.unconfirmedAuthors, 'Há mensagens cuja autoria não pôde ser confirmada.', 'Mensagens sem autoria confirmada'),
      MESSAGE_METADATA_CONFLICT: 'A autoria divergiu entre as fontes; essa mensagem precisa de conferência.',
    };
    return String(coverage?.reason || 'UNCONFIRMED_BOUNDARY').split(', ').map(reason => reasons[reason] || 'Uma parte do histórico precisa ser conferida.').join(' ');
  }
  async function readAndImportActiveChat(context, labels = [], expectedRow = null) {
    const identity = activeChatIdentity();
    if (!identity.title || !identity.anchors.size) throw new Error('A conversa e suas mensagens ainda não foram carregadas.');
    const details = {};
    const phone = await resolvePhoneFromCrmIfLid(identity.title, identity.jid, !identity.jid || identity.jid.endsWith('@lid'), details);
    if (!identity.jid && phone) { identity.jid = `${phone}@c.us`; identity.verifiedByDrawer = true; }
    assertActiveChat(identity);
    if (expectedRow?.jid && BrokivaImport.canonicalJid(expectedRow.jid) !== identity.jid) throw new Error('O contato aberto não corresponde ao item da lista.');
    if (!phone) throw new Error('Telefone da conversa não confirmado. Abra os dados do contato e tente novamente.');
    const base = { phone, name: identity.title, labels: [...new Set([...labels, ...(details.labels || [])])], ...(identity.jid.endsWith('@lid') ? { lid: identity.jid } : {}) };
    const persisted = new Set();
    const confirmed = new Set();
    const save = async (messages, final = false) => {
      const readable = Array.from(messages.values()).filter(message => !message.timestampEstimated && (final || !persisted.has(message.id)));
      if (!readable.length) return;
      const response = await dispatchSyncBatchChats([{ ...base, messages: readable }], context);
      (response.confirmedIds || []).forEach(id => confirmed.add(id));
      if (response.queued) readable.forEach(message => persisted.add(message.id));
      if (!response.success) {
        const error = new Error(response.error || 'Envio pendente de confirmação.');
        error.importResponse = { ...response, confirmedMessages: confirmed.size };
        throw error;
      }
    };
    let messages;
    try {
      messages = await deepScrollChatHistory(null, step => {
        const badge = document.getElementById('sovereign-sync-badge');
        if (badge) badge.innerText = `Lendo histórico: ${messagesReadLabel(step)}...`;
      }, map => save(map), identity);
      assertActiveChat(identity);
      const readableCount = Array.from(messages.values()).filter(message => !message.timestampEstimated).length;
      if (!readableCount) throw new Error('Nenhuma mensagem com ID e data verificável foi disponibilizada. Leitura pendente.');
      await save(messages, true);
      return { response: { success: true, confirmedMessages: confirmed.size }, chat: base, audit: messages._audit,
        coverage: { ...messages._coverage, reason: describeCoverage(messages._coverage, messages._audit) } };
    } catch (error) {
      if (error.importResponse) return { response: error.importResponse, chat: base, coverage: { complete: false, reason: 'Envio interrompido; lotes preservados na fila local.' } };
      // Uma troca de conversa ou interrupção pode ocorrer depois de checkpoints já confirmados.
      if (confirmed.size) return { response: { success: true, confirmedMessages: confirmed.size }, chat: base, coverage: { complete: false, reason: error.message } };
      throw error;
    }
  }
  const messagesReadLabel = step => `${step} etapas`;
  async function syncCurrentActiveChat() {
    if (isSyncing) return { complete: false };
    isSyncing = true; cancelSyncRequested = false;
    let badge = document.getElementById('sovereign-sync-badge');
    const startedAt = Date.now();
    let context;
    try {
      if (badge) badge.innerText = 'Conferindo contato...';
      if (isCurrentChatGroupOrChannel()) throw new Error('Selecione uma conversa individual.');
      context = await importContext();
      const { response, chat, coverage, audit } = await readAndImportActiveChat(context);
      badge = document.getElementById('sovereign-sync-badge');
      const saved = response.confirmedMessages || 0;
      const complete = response.success && coverage?.complete;
      if (badge) badge.innerText = complete ? `✓ ${saved} confirmadas` : `${saved} confirmadas • revisar pendências`;
      const issues = [
        ...(!coverage?.complete ? [{ name: chat.name, reason: coverage?.reason || 'Leitura incompleta.' }] : []),
        ...(!response.success ? [{ name: chat.name, reason: response.error || 'Envio pendente.' }] : []),
      ];
      await chrome.storage.local.set({ brokivaLastImportReport: { context, mode: 'SINGLE', startedAt, finishedAt: Date.now(), totalChats: saved ? 1 : 0, totalMessages: saved, issues, audit } }).catch(() => {});
      if (badge) badge.title = issues.map(issue => issue.reason).join(' ');
      alert(`${saved} mensagens confirmadas no CRM para ${chat.name}.` +
        (response.pendingMessages ? `\n${response.pendingMessages} mensagens guardadas na fila local. Entre no CRM e use Retomar envios no popup.` : '') +
        (!coverage?.complete ? '\nLeitura parcial. Consulte os motivos e quantidades em “Última importação”, na barra da Brokiva. Repetir a leitura pode não recuperar itens que o WhatsApp ainda não disponibilizou.' : '') +
        (!response.success ? `\n${response.error}` : ''));
      return { complete, saved };
    } catch (error) {
      badge = document.getElementById('sovereign-sync-badge');
      if (badge) { badge.innerText = 'Importação pendente'; badge.title = error.message; }
      await chrome.storage.local.set({ brokivaLastImportReport: { context, mode: 'SINGLE', startedAt, finishedAt: Date.now(), totalChats: 0, totalMessages: 0, issues: [{ name: chatHeaderTitle(document.querySelector('#main')) || 'Conversa', reason: error.message }] } }).catch(() => {});
      alert(`Importação pendente: ${error.message}`);
      return { complete: false };
    } finally { isSyncing = false; }
  }

  // 4.1 Diagnóstico passo a passo e isolado da conversa ativa com cópia automática para o clipboard
  async function runStepByStepDiagnostic() {
    const main = document.querySelector('#main');
    if (!main) {
      alert('Abra a conversa de Amabile Barbarotti antes de executar o diagnóstico.');
      return;
    }

    const badge = document.getElementById('sovereign-sync-badge');
    if (badge) badge.innerText = 'Diagnosticando...';
    logToConsoleAndCloudWatch('INFO', 'DIAGNOSTIC_START', 'Iniciando diagnóstico isolado da conversa...');

    // ETAPA 1: Identificação do Cabeçalho e Contato
    let contactName = '';
    const headerSpans = Array.from(main.querySelectorAll('header span[title], header div[data-testid="conversation-info-header"] span, header span[dir="auto"]'));
    for (const s of headerSpans) {
      const t = (s.getAttribute('title') || s.innerText || '').trim();
      const lower = t.toLowerCase();
      if (t && !lower.includes('online') && !lower.includes('visto por último') && !lower.includes('digitando') && !lower.includes('dados do')) {
        contactName = t;
        break;
      }
    }

    let resolvedPhone = '';
    let resolvedLid = '';
    const headerText = main.querySelector('header')?.innerText || '';
    const phoneMatch = headerText.match(/\+?55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/) || headerText.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
    if (phoneMatch) resolvedPhone = phoneMatch[0].replace(/\D/g, '');

    const dataIdEls = Array.from(main.querySelectorAll('[data-id]'));
    for (const el of dataIdEls) {
      const dId = el.getAttribute('data-id') || '';
      if (!resolvedPhone && (dId.includes('@c.us') || dId.includes('@s.whatsapp.net'))) {
        const m = dId.match(/_(\d{10,15})@(c\.us|s\.whatsapp\.net)/);
        if (m) resolvedPhone = m[1];
      }
      if (!resolvedLid && dId.includes('@lid')) {
        const lm = dId.match(/_(\d{8,18})@lid/);
        if (lm) resolvedLid = lm[1] + '@lid';
      }
    }

    // ETAPA 2: Rolagem e Detecção de Histórico Pregresso
    const initialRows = main.querySelectorAll('div[role="row"], div.message-in, div.message-out').length;
    let foundLoadMoreBtn = false;
    const loadMoreBtn = Array.from(main.querySelectorAll('button, div[role="button"], span')).find(el => {
      const txt = (el.innerText || '').toLowerCase();
      return txt.includes('carregar mensagens') || txt.includes('conversas mais antigas') || txt.includes('clique aqui para carregar');
    });
    if (loadMoreBtn) {
      foundLoadMoreBtn = true;
      loadMoreBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    const accumulatedMap = await deepScrollChatHistory(2, (s, t) => {
      if (badge) badge.innerText = `Lendo antigas (${s}/${t})...`;
    });
    const postScrollRows = main.querySelectorAll('div[role="row"], div.message-in, div.message-out').length;

    // ETAPA 3: Extração Detalhada e Estatísticas
    const chatData = extractActiveChatData(accumulatedMap);
    if (chatData && (!chatData.phone || chatData.phone.length < 10)) {
      if (badge) badge.innerText = 'Lendo telefone...';
      const resolved = await resolvePhoneFromCrmIfLid(chatData.name, chatData.phone || resolvedPhone, true);
      if (resolved && resolved.length >= 10) {
        chatData.phone = resolved;
        resolvedPhone = resolved;
      }
    }
    const msgs = chatData?.messages || [];

    let countVoce = 0;
    let countCliente = 0;
    let countAudio = 0;
    let countDoc = 0;
    let countImg = 0;
    let countText = 0;

    msgs.forEach(m => {
      if (m.fromMe) countVoce++; else countCliente++;
      if (m.messageType === 'AUDIO') countAudio++;
      else if (m.messageType === 'DOCUMENT') countDoc++;
      else if (m.messageType === 'IMAGE') countImg++;
      else countText++;
    });

    const sampleList = msgs.slice(-12).map((m, idx) => {
      const remetente = m.fromMe ? 'Você (Corretor)' : `${chatData?.name || 'Cliente'}`;
      let preview = m.content || '';
      if (m.messageType === 'IMAGE') {
        preview = m.mediaUrl ? '📷 Foto com miniatura pronta para visualização' : '📷 Foto enviada no WhatsApp';
      } else if (preview.length > 55) {
        preview = preview.slice(0, 55) + '...';
      }
      let horaFormatada = 'sem data';
      if (m.timestamp) {
        try {
          const d = new Date(m.timestamp);
          const dia = String(d.getDate()).padStart(2, '0');
          const mes = String(d.getMonth() + 1).padStart(2, '0');
          const hora = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          horaFormatada = `${dia}/${mes} ${hora}:${min}`;
        } catch (e) {
          horaFormatada = m.timestamp.slice(11, 16);
        }
      }
      return `  [${horaFormatada}] ${remetente} (${m.messageType}): "${preview}"`;
    });

    const report = [
      '====================================================',
      '🔍 RELATÓRIO DE DIAGNÓSTICO ISOLADO (BROKIVA)',
      '====================================================',
      `👤 Contato Aberto: ${chatData?.name || contactName || 'N/D'}`,
      `📱 Telefone Detectado: ${chatData?.phone ? '+' + chatData.phone : (resolvedPhone ? '+' + resolvedPhone : 'Não identificado')}`,
      `🆔 LID: ${chatData?.lid || resolvedLid || 'Nenhum'}`,
      `📄 Botão "Carregar antigas": ${foundLoadMoreBtn ? 'SIM (detectado e acionado)' : 'NÃO presente no DOM'}`,
      `📊 Balões no DOM: ${initialRows} antes do scroll | ${postScrollRows} após scroll (+${postScrollRows - initialRows})`,
      `💬 Total de Mensagens Extraídas: ${msgs.length}`,
      `   - Enviadas por Você: ${countVoce}`,
      `   - Enviadas por Amabile: ${countCliente}`,
      `   - Tipos: ${countText} Texto, ${countAudio} Áudio, ${countImg} Foto, ${countDoc} Documento`,
      '----------------------------------------------------',
      'ÚLTIMAS MENSAGENS MAPEADAS:',
      ...sampleList,
      '===================================================='
    ].join('\n');

    console.log(report);
    logToConsoleAndCloudWatch('INFO', 'DIAGNOSTIC_COMPLETED', `Diagnóstico concluído: ${msgs.length} msgs`);

    // Abre janela modal visual no WhatsApp com o relatório pronto e botão de cópia
    showDiagnosticModal(report, msgs.length, chatData?.name || contactName);

    if (badge) badge.innerText = `✓ ${msgs.length} msgs`;
  }

  // Janela modal elegante sobreposta no WhatsApp Web exibindo o relatório do diagnóstico
  function showDiagnosticModal(reportText, count, contactName) {
    let modal = document.getElementById('brokiva-diag-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'brokiva-diag-modal';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.75); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div style="background:white; width:680px; max-width:92vw; max-height:88vh; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden;">
        <div style="background:#3742AC; color:white; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:16px; font-weight:800;">🔍 Relatório de Diagnóstico — ${contactName || 'Contato'}</div>
            <div style="font-size:11px; opacity:0.85;">${count} mensagens identificadas no histórico</div>
          </div>
          <button id="brokiva-diag-close" style="background:none; border:none; color:white; font-size:24px; cursor:pointer; line-height:1;">✕</button>
        </div>
        <div style="padding:16px 20px; flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
          <p style="font-size:12px; color:#475569; margin:0; font-weight:600;">
            O texto abaixo foi gerado em tempo real da conversa ativa. Clique no botão verde abaixo para copiar:
          </p>
          <textarea id="brokiva-diag-text" readonly style="width:100%; height:330px; font-family:monospace; font-size:11px; padding:12px; border:1.5px solid #cbd5e1; border-radius:10px; background:#f8fafc; color:#0f172a; resize:none; outline:none; white-space:pre;"></textarea>
        </div>
        <div style="padding:12px 20px; background:#f1f5f9; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:#64748b;">Dica: Você também pode selecionar o texto e dar Cmd+C</span>
          <button id="brokiva-diag-copy" style="background:#16a34a; color:white; border:none; border-radius:8px; padding:10px 20px; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px;">
            📋 Copiar Relatório
          </button>
        </div>
      </div>
    `;

    const textarea = modal.querySelector('#brokiva-diag-text');
    textarea.value = reportText;
    textarea.focus();
    textarea.select();

    modal.querySelector('#brokiva-diag-close').onclick = () => modal.remove();
    modal.querySelector('#brokiva-diag-copy').onclick = () => {
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      try { navigator.clipboard.writeText(reportText); } catch (e) {}
      const copyBtn = modal.querySelector('#brokiva-diag-copy');
      copyBtn.innerText = '✓ Copiado com Sucesso!';
      copyBtn.style.background = '#059669';
    };
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

      const rowJid = BrokivaImport.canonicalJid(decodeURIComponent([rowContainer.getAttribute('data-id'), rowContainer.getAttribute('data-jid'), rowAvatarSrc].filter(Boolean).join(' ')));
      const position = rowContainer.getAttribute('aria-rowindex') || Math.round((rowRect.top - paneRect.top + pane.scrollTop) / 2);
      const key = rowJid || `row:${position}:${contactTitle}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        // Extrai snippet da última mensagem e indicador de envio da lista lateral (#pane-side)
        const secEl = rowContainer.querySelector('div[data-testid="last-msg-status"], div[data-testid="cell-frame-secondary"] span[title], div[data-testid="cell-frame-secondary"] span[dir="auto"], div[data-testid="cell-frame-secondary"]');
        const rowPreview = (secEl?.getAttribute('title') || secEl?.innerText || '').trim();
        const hasOutgoingCheck = Boolean(rowContainer.querySelector('span[data-icon*="status-"], span[data-testid*="status-"], [data-icon="status-dblcheck"], [data-icon="status-check"], [data-icon="status-time"]') || /^(você|voce|you)\s*:/i.test(rowPreview));

        // Extrai data/horário canônico visível no card da conversa na lista lateral (#pane-side)
        let rowDateText = '';

        // 1. Procura primeiro se há atributo title ou aria-label com data completa DD/MM/AAAA no card da conversa
        const titleNodes = Array.from(rowContainer.querySelectorAll('[title*="/"], [aria-label*="/"], div._ak8i, span[title]'));
        for (const el of titleNodes) {
          const rawAttr = el.getAttribute('title') || el.getAttribute('aria-label') || '';
          const match = rawAttr.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/);
          if (match) {
            rowDateText = match[1];
            break;
          }
        }

        // 2. Se não achou data completa com ano no title, varre os textos visíveis
        if (!rowDateText) {
          const dateCandidates = Array.from(rowContainer.querySelectorAll('div._ak8i, span[dir="auto"], div[data-testid="cell-frame-title"] + div, div[data-testid="cell-frame-secondary"] span'));
          for (const el of dateCandidates) {
            const t = (el.innerText || '').trim();
            if (
              /^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i.test(t) ||
              /^(ontem|yesterday|hoje|today)$/i.test(t) ||
              /^\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?$/.test(t) ||
              /^(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/i.test(t)
            ) {
              rowDateText = t;
              break;
            }
          }
        }

        const rowLabels = extractLabelsFromRowElement(rowContainer);

        rows.push({
          title: contactTitle,
          jid: rowJid,
          key,
          span: contactTitleSpan,
          clickable: rowContainer,
          rowImg: rowImg || null,
          rowAvatarSrc: rowAvatarSrc || '',
          rowPreview,
          rowDateText,
          isOutgoing: hasOutgoingCheck,
          labels: rowLabels,
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
            Lendo as mensagens disponíveis e conferindo a gravação de cada lote...
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

  function openSyncModal(maxChats, syncMode = 'FULL') {
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

    if (titleEl) {
      titleEl.innerText = syncMode === 'RECENT'
        ? '⚡ Sincronizando Conversas Recentes'
        : '🌐 Sincronizando Importar Lista de Conversas';
    }
    if (subtitleEl) {
      subtitleEl.innerText = syncMode === 'RECENT'
        ? 'Lendo as conversas mais ativas no topo da lista para rápida atualização...'
        : 'Varrendo todo o histórico do WhatsApp. Conversas antigas serão catalogadas para reativação...';
    }
    if (statChats) statChats.innerText = (!maxChats || maxChats === Infinity) ? '0 conversas' : `0 / ${maxChats}`;
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

    const isUnlimited = !maxChats || maxChats === Infinity;

    if (statChats && syncedCount !== undefined) {
      statChats.innerText = isUnlimited ? `${syncedCount} ${syncedCount === 1 ? 'conversa' : 'conversas'}` : `${syncedCount} / ${maxChats}`;
    }
    if (statMsgs && totalMessages !== undefined) statMsgs.innerText = `${totalMessages.toLocaleString('pt-BR')}`;

    if (isUnlimited) {
      const pane = findPaneSideScrollContainer() || document.querySelector('#pane-side');
      let scrollPct = 0;
      if (pane && pane.scrollHeight > pane.clientHeight) {
        scrollPct = Math.min(98, Math.max(5, Math.round(((pane.scrollTop + pane.clientHeight) / pane.scrollHeight) * 100)));
      } else {
        scrollPct = Math.min(95, Math.max(5, (syncedCount || 0) * 2));
      }
      if (statPct) statPct.innerText = `${scrollPct}% rolado`;
      if (bar) bar.style.width = `${scrollPct}%`;
    } else {
      const pct = Math.min(100, Math.round(((syncedCount || 0) / maxChats) * 100));
      if (statPct) statPct.innerText = `${pct}%`;
      if (bar) bar.style.width = `${pct}%`;
    }

    if (leadName && contactName) leadName.innerText = contactName;
    if (leadAction && actionText) leadAction.innerText = actionText;
  }

  function finishSyncModal({ totalChats, totalMessages, issues = [], cancelled = false }) {
    const set = (id, text) => { const element = document.getElementById(id); if (element) element.innerText = text; };
    const complete = !issues.length && !cancelled;
    set('brokiva-modal-title', complete ? 'Importação confirmada' : 'Importação com pendências');
    set('brokiva-modal-subtitle', `${totalChats} conversas e ${totalMessages} mensagens confirmadas no CRM.`);
    set('brokiva-stat-chats', String(totalChats)); set('brokiva-stat-msgs', String(totalMessages));
    set('brokiva-stat-pct', complete ? 'Conferido' : 'Parcial');
    set('brokiva-lead-name', cancelled ? 'Leitura interrompida pelo usuário' : complete ? 'Histórico disponível conferido' : 'Confira as pendências');
    set('brokiva-lead-action', issues.map(item => `${item.name}: ${item.reason}`).join('\n') || 'Envios confirmados pelo CRM.');
    const footer = document.getElementById('brokiva-modal-footer');
    if (footer) {
      footer.innerHTML = '<button type="button" id="brokiva-close-modal-btn" class="brokiva-done-btn">Fechar resumo</button>';
      footer.querySelector('button').addEventListener('click', closeSyncModal);
    }
  }

  function closeSyncModal() {
    const overlay = document.getElementById('brokiva-sync-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  // 5. Varredura Automática Paginada com Carregamento Profundo e Tela de Bloqueio
  async function executeBatchHistoryScan(options = {}) {
    if (isSyncing) return;
    isSyncing = true; cancelSyncRequested = false;
    const mode = options.mode || 'FULL';
    const limit = mode === 'RECENT' ? 60 : Infinity;
    const report = { startedAt: Date.now(), mode, totalChats: 0, totalMessages: 0, issues: [], cancelled: false };
    const buttons = ['sovereign-batch-sync-recent-btn', 'sovereign-batch-sync-full-btn', 'sovereign-batch-sync-btn'].map(id => document.getElementById(id)).filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    openSyncModal(limit, mode);
    let context;
    try {
      context = await importContext();
      await chrome.runtime.sendMessage({ action: 'RETRY_IMPORTS' });
      const pane = findPaneSideScrollContainer() || document.querySelector('#pane-side');
      if (!pane) throw new Error('Lista de conversas não encontrada. Abra o WhatsApp Web e tente novamente.');
      pane.scrollTop = 0; pane.dispatchEvent(new Event('scroll', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 750));
      const visited = new Set();
      let bottomStable = 0;
      let listFinished = false;
      for (let step = 0; step < 4000 && visited.size < limit; step++) {
        if (cancelSyncRequested) break;
        const currentContext = await importContext();
        if (!BrokivaImport.sameContext(context, currentContext)) throw new Error('O ambiente mudou. Retome a importação na conta original.');
        const row = getVisibleChatRows().find(candidate => !visited.has(candidate.key));
        if (row) {
          visited.add(row.key); bottomStable = 0;
          updateSyncModalProgress({ syncedCount: report.totalChats, maxChats: limit, totalMessages: report.totalMessages, contactName: row.title, actionText: 'Abrindo e conferindo a conversa...' });
          try {
            const previous = activeChatIdentity();
            row.clickable.click();
            await waitForChatToOpen(row, previous);
            const result = await readAndImportActiveChat(context, row.labels, row);
            const saved = result.response.confirmedMessages || 0;
            report.totalMessages += saved;
            if (result.response.success) report.totalChats++;
            if (!result.coverage?.complete) report.issues.push({ name: row.title, reason: `Leitura parcial: ${result.coverage?.reason || 'limite não confirmado'}` });
            if (!result.response.success) {
              report.issues.push({ name: row.title, reason: `${result.response.pendingMessages || 0} mensagens pendentes na fila. ${result.response.error || ''}` });
              break; // Não acumula mais dados durante falha de envio, sessão ou quota.
            }
          } catch (error) {
            report.issues.push({ name: row.title, reason: error.message });
          }
          await chrome.storage.local.set({ brokivaLastImportReport: { ...report, context } });
        } else {
          const previous = pane.scrollTop;
          const before = getVisibleChatRows().map(row => row.key).join('|');
          pane.scrollTop += Math.max(50, pane.clientHeight * 0.65);
          pane.dispatchEvent(new Event('scroll', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 1000));
          const after = getVisibleChatRows().map(row => row.key).join('|');
          const atBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 3;
          bottomStable = atBottom && Math.abs(previous - pane.scrollTop) < 2 && before === after ? bottomStable + 1 : 0;
          if (bottomStable >= 6) { listFinished = true; break; }
        }
      }
      if (mode === 'FULL' && !listFinished && !cancelSyncRequested) report.issues.push({ name: 'Lista de conversas', reason: 'Varredura interrompida antes de conferir o final da lista.' });
      if (mode === 'FULL') report.issues.push({ name: 'Escopo', reason: 'A lista visível pode excluir conversas arquivadas, bloqueadas por filtros ou não disponibilizadas pelo WhatsApp. Confira essas listas separadamente.' });
    } catch (error) { report.issues.push({ name: 'Importação', reason: error.message }); }
    finally {
      report.cancelled = cancelSyncRequested; report.finishedAt = Date.now();
      isSyncing = false; buttons.forEach(button => { button.disabled = false; });
      await chrome.storage.local.set({ brokivaLastImportReport: { ...report, context } }).catch(() => {});
      finishSyncModal(report);
    }
  }

  // 6. Brok.ia: Sugere e insere resposta com 1 clique no WhatsApp Web
  function triggerAiSuggestion() {
    const chatData = extractActiveChatData();
    if (!chatData || chatData.messages.length === 0) {
      alert('Abra uma conversa com histórico para a Brok.ia analisar.');
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
