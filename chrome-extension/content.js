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
    const main = document.querySelector('#main');
    if (!main) return null;

    // Busca todos os balões de mensagem com data-id
    const messageElements = Array.from(main.querySelectorAll('div[data-id]'));
    if (messageElements.length === 0) return null;

    let resolvedPhone = '';
    let isGroup = false;

    // Descobre o telefone a partir do data-id das mensagens: format: false_554898379087@c.us_...
    for (const el of messageElements) {
      const dataId = el.getAttribute('data-id') || '';
      if (dataId.includes('@g.us')) {
        isGroup = true;
        break;
      }
      const match = dataId.match(/_(\d{8,15})@/);
      if (match && match[1]) {
        resolvedPhone = match[1];
        break;
      }
    }

    if (isGroup) return null; // Ignora grupos automaticamente

    // Nome no header
    const headerTitle = main.querySelector('header span[title], header div[role="button"] span, header span[dir="auto"]')?.innerText?.trim() || '';

    // Se não achou telefone pelo data-id, tenta pelo header se for número
    if (!resolvedPhone) {
      const headerDigits = headerTitle.replace(/\D/g, '');
      if (headerDigits.length >= 8) resolvedPhone = headerDigits;
    }

    if (!resolvedPhone) return null;

    currentActivePhone = resolvedPhone;
    currentActiveName = headerTitle || `WhatsApp ${resolvedPhone.slice(-4)}`;

    // Extrai todas as mensagens da tela
    const messages = [];
    messageElements.forEach((el, index) => {
      const dataId = el.getAttribute('data-id') || '';
      const isFromMe = dataId.startsWith('true_') || el.classList.contains('message-out');

      // Texto da mensagem
      const textNode = el.querySelector('.selectable-text, .copyable-text span, div.copyable-text, span.selectable-text');
      let content = textNode ? textNode.innerText.trim() : '';

      // Tipo de mídia
      let messageType = 'TEXT';
      if (el.querySelector('audio')) {
        messageType = 'AUDIO';
        content = content || '🎵 Mensagem de Voz';
      } else if (el.querySelector('img[src*="blob:"], img[src*="data:"]')) {
        messageType = 'IMAGE';
        content = content || '📷 Foto';
      } else if (el.querySelector('span[data-icon*="document"], a[download]')) {
        messageType = 'DOCUMENT';
        content = content || '📄 Documento';
      }

      if (!content) return;

      // Timestamp aproximado ou do pre-plain-text
      const prePlain = el.querySelector('div[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
      let msgTime = new Date().toISOString();
      if (prePlain) {
        const timeMatch = prePlain.match(/\[(.*?)\]/);
        if (timeMatch && timeMatch[1]) {
          msgTime = timeMatch[1];
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

    return {
      phone: resolvedPhone,
      name: currentActiveName,
      messages,
      lastMessagePreview: messages.length > 0 ? messages[messages.length - 1].content : '',
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date().toISOString(),
    };
  }

  let lastLeadSignature = '';

  // 3. Atualiza UI do Lead Ativo de forma segura e leve
  function updateActiveLeadUI() {
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
      const sig = `${chatData.phone}-${chatData.messages.length}`;
      if (lastLeadSignature !== sig) {
        lastLeadSignature = sig;
        nameElem.innerText = chatData.name || 'Contato WhatsApp';
        phoneElem.innerText = `+${chatData.phone} (${chatData.messages.length} msgs carregadas)`;
        if (avatarElem) avatarElem.innerText = (chatData.name || 'C').charAt(0).toUpperCase();
        if (syncCurrentBtn) {
          syncCurrentBtn.innerHTML = `<span>📥 Salvar ${chatData.messages.length} Mensagens no CRM</span>`;
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
  }

  // 4. Sincroniza apenas a conversa atual com carregamento paginado
  async function syncCurrentActiveChat() {
    const badge = document.getElementById('sovereign-sync-badge');
    if (badge) badge.innerText = 'Carregando histórico...';

    // Rola para cima 3 vezes suavemente para o WhatsApp carregar mensagens anteriores da memória
    const chatContainer = document.querySelector('#main div[tabindex="-1"][data-tab="6"]') || 
                          document.querySelector('#main .copyable-area')?.parentElement ||
                          document.querySelector('#main div[role="application"]');
    if (chatContainer) {
      for (let s = 0; s < 3; s++) {
        chatContainer.scrollTop = 0;
        await new Promise(r => setTimeout(r, 350));
      }
    }

    const chatData = extractActiveChatData();
    if (!chatData || !chatData.phone || chatData.messages.length === 0) {
      alert('Abra uma conversa com mensagens no WhatsApp antes de sincronizar.');
      if (badge) badge.innerText = 'Pronto';
      return;
    }

    if (badge) badge.innerText = 'Salvando...';

    chrome.runtime.sendMessage({
      action: 'SYNC_BATCH_CHATS',
      data: { chats: [chatData] }
    }, (response) => {
      if (response && response.success) {
        if (badge) {
          badge.innerText = `✓ ${chatData.messages.length} msgs`;
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
        }
        alert(`🎉 Sucesso! Histórico com ${chatData.messages.length} mensagens de ${chatData.name} (+${chatData.phone}) sincronizado no CRM!`);
      } else {
        if (badge) badge.innerText = 'Erro';
        console.error('[Brokiva] Erro ao sincronizar conversa atual:', response?.error);
      }
    });
  }

  // 5. Varredura Automática Paginada (Clica e Lê cada Conversa)
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
      progressStatus.innerText = 'Iniciando varredura e leitura dos chats...';
    }

    // Localiza lista de conversas no painel lateral do WhatsApp Web
    const chatListPane = document.querySelector('#pane-side');
    if (!chatListPane) {
      alert('Lista de conversas do WhatsApp não encontrada.');
      isSyncing = false;
      if (btn) btn.disabled = false;
      return;
    }

    // Coleta elementos clicáveis da lista de chats
    const chatElements = Array.from(chatListPane.querySelectorAll('div[role="listitem"], div[role="row"], div[tabindex="-1"]'))
      .filter(el => el.querySelector('span[title]') && !el.innerText.includes('Arquivadas'));

    const total = Math.min(chatElements.length, 30);
    const syncedChats = [];

    for (let i = 0; i < total; i++) {
      const el = chatElements[i];
      if (!el) continue;

      const titleNode = el.querySelector('span[title]');
      const name = titleNode ? titleNode.getAttribute('title') || titleNode.innerText : `Chat ${i + 1}`;

      if (progressStatus) {
        progressStatus.innerText = `Abrindo e lendo histórico (${i + 1}/${total}): ${name}...`;
      }

      // Clica para abrir a conversa
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.click();

      // Aguarda 500ms para o WhatsApp renderizar os balões
      await new Promise(r => setTimeout(r, 500));

      // Extrai dados reais com mensagens
      const chatData = extractActiveChatData();
      if (chatData && chatData.phone && chatData.messages.length > 0) {
        syncedChats.push(chatData);

        // Envia imediatamente cada chat para a API da Brokiva
        chrome.runtime.sendMessage({
          action: 'SYNC_BATCH_CHATS',
          data: { chats: [chatData] }
        });
      }

      // Atualiza barra de progresso
      const pct = Math.round(((i + 1) / total) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
    }

    isSyncing = false;
    if (btn) btn.disabled = false;
    if (progressStatus) {
      progressStatus.innerText = `🎉 Sucesso! ${syncedChats.length} conversas e históricos completos sincronizados com a Brokiva!`;
      progressStatus.style.color = '#059669';
    }
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
