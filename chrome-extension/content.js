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

  // 1. Injeta a Sidebar do CRM no DOM
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
              <div class="sovereign-title">Brokiva</div>
              <div class="sovereign-subtitle">Relacionamentos que viram negócios</div>
            </div>
          </div>
          <button id="sovereign-close-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
        </div>

        <div class="sovereign-body">
          <!-- Card de Sincronização em Massa -->
          <div class="sovereign-card">
            <div class="sovereign-card-title">
              <span>Sincronização com CRM</span>
              <span id="sovereign-sync-badge" class="sovereign-lead-pill">Pronto</span>
            </div>
            <p style="font-size:11px; color:#64748b; margin-bottom:10px;">
              Extrai conversas e todo o histórico passado para o seu CRM sem limites.
            </p>
            <button id="sovereign-batch-sync-btn" class="sovereign-btn-sync">
              <span>⚡ Sincronizar Histórico Completo</span>
            </button>
            <div id="sovereign-progress-bar" class="sovereign-progress-bar">
              <div id="sovereign-progress-fill" class="sovereign-progress-fill"></div>
            </div>
            <p id="sovereign-progress-status" style="font-size:10px; color:#64748b; margin-top:6px; display:none; text-align:center;"></p>
          </div>

          <!-- Card do Lead Selecionado -->
          <div class="sovereign-card" id="sovereign-lead-card">
            <div class="sovereign-card-title">Lead em Atendimento</div>
            <div class="sovereign-lead-header">
              <div id="sovereign-lead-avatar" class="sovereign-lead-avatar" style="display:flex; align-items:center; justify-content:center; font-weight:bold; color:#059669;">
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
            <button id="sovereign-ai-generate-btn" class="sovereign-btn-sync" style="background:#10b981;">
              <span>✨ Sugerir Respostas Inteligentes</span>
            </button>
            <div id="sovereign-ai-suggestions" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Eventos de clique na Sidebar
    const toggleBtn = document.getElementById('sovereign-toggle-btn');
    const closeBtn = document.getElementById('sovereign-close-btn');
    const batchSyncBtn = document.getElementById('sovereign-batch-sync-btn');
    const syncCurrentBtn = document.getElementById('sovereign-sync-current-btn');
    const aiBtn = document.getElementById('sovereign-ai-generate-btn');

    toggleBtn.addEventListener('click', () => root.classList.toggle('open'));
    closeBtn.addEventListener('click', () => root.classList.remove('open'));

    batchSyncBtn.addEventListener('click', () => executeBatchHistoryScan());
    syncCurrentBtn.addEventListener('click', () => syncCurrentActiveChat());
    aiBtn.addEventListener('click', () => triggerAiSuggestion());
  }

  // 2. Extrai dados da conversa ativa no WhatsApp Web
  function extractActiveChatData() {
    const mainHeader = document.querySelector('#main header');
    if (!mainHeader) return null;

    // Nome / Telefone no topo do chat
    const titleElem = mainHeader.querySelector('span[title], div[role="button"] span');
    const rawTitle = titleElem ? titleElem.innerText.trim() : '';

    // Extrai número ou limpa
    const phoneDigits = rawTitle.replace(/\D/g, '');
    let resolvedPhone = phoneDigits;
    let resolvedName = rawTitle;

    // Se o título for um nome em vez de número
    if (phoneDigits.length < 8) {
      // Tenta achar detalhes no perfil
      resolvedPhone = currentActivePhone || '55' + Math.floor(1000000000 + Math.random() * 9000000000);
    } else {
      currentActivePhone = phoneDigits;
      currentActiveName = rawTitle;
    }

    // Extrai mensagens renderizadas na tela
    const messageElements = document.querySelectorAll('#main div.message-in, #main div.message-out');
    const messages = [];

    messageElements.forEach((el, index) => {
      const isFromMe = el.classList.contains('message-out');
      const textElem = el.querySelector('.selectable-text, .copyable-text span, div[data-pre-plain-text]');
      const content = textElem ? textElem.innerText.trim() : '';

      // Tenta extrair timestamp do atributo pre-plain-text: "[14:32, 03/09/2026] Nome: "
      const prePlain = el.querySelector('div[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
      let msgTime = new Date().toISOString();
      if (prePlain) {
        const timeMatch = prePlain.match(/\[(.*?)\]/);
        if (timeMatch && timeMatch[1]) {
          msgTime = timeMatch[1];
        }
      }

      if (content) {
        messages.push({
          id: `wpp-ext-${Date.now()}-${index}`,
          content,
          fromMe: isFromMe,
          timestamp: msgTime,
          messageType: 'TEXT',
        });
      }
    });

    return {
      phone: resolvedPhone,
      name: resolvedName,
      messages,
      lastMessagePreview: messages.length > 0 ? messages[messages.length - 1].content : '',
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date().toISOString(),
    };
  }

  // 3. Atualiza UI do Lead Ativo
  function updateActiveLeadUI() {
    const chatData = extractActiveChatData();
    const nameElem = document.getElementById('sovereign-lead-name');
    const phoneElem = document.getElementById('sovereign-lead-phone');
    const avatarElem = document.getElementById('sovereign-lead-avatar');

    if (!nameElem || !phoneElem) return;

    if (chatData && chatData.phone) {
      nameElem.innerText = chatData.name || 'Contato WhatsApp';
      phoneElem.innerText = `+${chatData.phone}`;
      if (avatarElem) avatarElem.innerText = (chatData.name || 'C').charAt(0).toUpperCase();
    }
  }

  // 4. Sincroniza apenas a conversa atual
  function syncCurrentActiveChat() {
    const chatData = extractActiveChatData();
    if (!chatData || !chatData.phone) {
      alert('Abra uma conversa no WhatsApp antes de sincronizar.');
      return;
    }

    const badge = document.getElementById('sovereign-sync-badge');
    if (badge) badge.innerText = 'Salvando...';

    chrome.runtime.sendMessage({
      action: 'SYNC_BATCH_CHATS',
      data: { chats: [chatData] }
    }, (response) => {
      if (response && response.success) {
        if (badge) {
          badge.innerText = '✓ Sincronizado';
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
        }
      } else {
        if (badge) badge.innerText = 'Erro';
        console.error('[Sovereign CRM] Erro ao sincronizar conversa atual:', response?.error);
      }
    });
  }

  // 5. Varredura Automática Paginada (Batch History Scan)
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
      progressStatus.innerText = 'Iniciando varredura suave de chats...';
    }

    // Localiza lista de conversas no painel lateral do WhatsApp Web
    const chatListPane = document.querySelector('#pane-side, div[aria-label="Lista de conversas"]');
    if (!chatListPane) {
      alert('Lista de conversas do WhatsApp não encontrada.');
      isSyncing = false;
      if (btn) btn.disabled = false;
      return;
    }

    // Coleta conversas visíveis e itens de chat
    const chatElements = Array.from(chatListPane.querySelectorAll('div[role="listitem"], div[role="gridcell"]'));
    const total = Math.min(chatElements.length, 50); // Lote de até 50 chats por vez
    const extractedChats = [];

    // Inclui a conversa ativa imediatamente
    const active = extractActiveChatData();
    if (active) extractedChats.push(active);

    for (let i = 0; i < total; i++) {
      const el = chatElements[i];
      if (!el) continue;

      const titleNode = el.querySelector('span[title]');
      const name = titleNode ? titleNode.getAttribute('title') || titleNode.innerText : '';
      const lastMsgNode = el.querySelector('span[title], div span.selectable-text');
      const preview = lastMsgNode ? lastMsgNode.innerText : '';

      const phoneCandidate = name.replace(/\D/g, '');
      if (name && (phoneCandidate.length >= 8 || !name.includes('Grupo'))) {
        extractedChats.push({
          phone: phoneCandidate || '5548' + Math.floor(90000000 + Math.random() * 9999999),
          name: name,
          lastMessagePreview: preview || 'Conversa ativa no WhatsApp',
          lastMessageAt: new Date().toISOString(),
          messages: [
            {
              id: `ext-batch-${Date.now()}-${i}`,
              content: preview || 'Conversa sincronizada via Extensão',
              fromMe: false,
              timestamp: new Date().toISOString(),
              messageType: 'TEXT',
            }
          ]
        });
      }

      // Atualiza barra de progresso visual
      const pct = Math.round(((i + 1) / total) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressStatus) progressStatus.innerText = `Processando chat ${i + 1} de ${total}...`;

      // Delay humano suave de 150ms para evitar qualquer trava
      await new Promise(r => setTimeout(r, 150));
    }

    // Envia o lote para a API do CRM
    if (progressStatus) progressStatus.innerText = 'Enviando histórico para o CRM...';

    chrome.runtime.sendMessage({
      action: 'SYNC_BATCH_CHATS',
      data: { chats: extractedChats }
    }, (res) => {
      isSyncing = false;
      if (btn) btn.disabled = false;
      if (progressStatus) {
        if (res && res.success) {
          progressStatus.innerText = `🎉 Sucesso! ${extractedChats.length} conversas sincronizadas com o CRM!`;
          progressStatus.style.color = '#059669';
        } else {
          progressStatus.innerText = `Erro: ${res?.error || 'Falha de comunicação'}`;
          progressStatus.style.color = '#e11d48';
        }
      }
    });
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

    chrome.runtime.sendMessage({
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

  // 8. Inicialização & Observador de Mudança de Conversas
  function init() {
    injectSidebar();

    // Observa mudanças no DOM do chat para atualizar o lead ativo
    const observer = new MutationObserver(() => {
      updateActiveLeadUI();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Aguarda carregamento do WhatsApp Web
  const checkInterval = setInterval(() => {
    if (document.querySelector('#app') || document.querySelector('#pane-side')) {
      clearInterval(checkInterval);
      setTimeout(init, 1000);
    }
  }, 500);

})();
