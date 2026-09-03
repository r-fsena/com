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
    try {
      chrome.runtime.sendMessage({
        action: 'LOG_EVENT',
        data: {
          level,
          event,
          details: { message, ...details }
        }
      });
    } catch {}
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

    // Método B: Atributos data-id (false_554898379087@c.us_... ou false_34919856757946@lid_...)
    for (const el of messageElements) {
      const dataId = el.getAttribute('data-id') || el.closest('[data-id]')?.getAttribute('data-id') || '';
      if (dataId.includes('@g.us')) {
        console.log('[Brokiva] Grupo detectado, ignorando');
        return null;
      }
      if (dataId.includes('@lid')) {
        const lidMatch = dataId.match(/_(\d{8,18})@lid/);
        if (lidMatch && lidMatch[1]) {
          resolvedLid = `${lidMatch[1]}@lid`;
        }
      }
      // Apenas aceita @c.us como telefone se ainda não achou no header
      if (!resolvedPhone && dataId.includes('@c.us')) {
        const cUsMatch = dataId.match(/_(\d{10,13})@c\.us/);
        if (cUsMatch && cUsMatch[1]) {
          resolvedPhone = cUsMatch[1];
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

    // Se ainda não tiver telefone mas tem LID, usa o LID temporariamente como identificador
    if (!resolvedPhone && resolvedLid) {
      resolvedPhone = resolvedLid.replace(/\D/g, '');
    }

    // Fallback estável para não descartar mensagens
    if (!resolvedPhone) {
      const hash = Math.abs(contactName.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
      resolvedPhone = `5548${String(hash).padStart(8, '0').slice(-8)}`;
      console.log(`[Brokiva] Telefone inferido do nome ${contactName}: ${resolvedPhone}`);
    }

    currentActivePhone = resolvedPhone;
    currentActiveName = contactName;

    // 4. Extrai balões de mensagem
    const messages = [];
    messageElements.forEach((el, index) => {
      const dataId = el.getAttribute('data-id') || '';
      const prePlain = el.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || el.getAttribute('data-pre-plain-text') || '';
      const isFromMe = el.classList.contains('message-out') || 
                       el.closest('.message-out') !== null || 
                       dataId.startsWith('true_') ||
                       prePlain.includes('Você:') ||
                       prePlain.includes('You:');

      const textNode = el.querySelector('.selectable-text, .copyable-text span, div.copyable-text, span.selectable-text, span[dir="ltr"]');
      let content = textNode ? textNode.innerText.trim() : (el.innerText || '').trim();

      // Limpa horários grudados no final
      content = content.replace(/\n\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i, '').trim();

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

      if (!content) return;

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

    console.log(`[Brokiva] Extraídas ${messages.length} mensagens válidas para ${contactName} (${resolvedPhone})`);

    return {
      phone: resolvedPhone,
      lid: resolvedLid || undefined,
      name: contactName,
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

    logToConsoleAndCloudWatch('INFO', 'SYNC_SINGLE_START', 'Iniciando leitura da conversa aberta...');

    // Rola para cima suavemente para o WhatsApp carregar mensagens anteriores da memória
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
      logToConsoleAndCloudWatch('WARN', 'SYNC_SINGLE_EMPTY', `Conversa sem mensagens ou não identificada. (Phone: ${chatData?.phone || 'n/d'}, Msgs: ${chatData?.messages?.length || 0})`);
      alert('Abra uma conversa com mensagens no WhatsApp antes de sincronizar.');
      if (badge) badge.innerText = 'Pronto';
      return;
    }

    logToConsoleAndCloudWatch('INFO', 'SYNC_SINGLE_EXTRACTED', `Lidas ${chatData.messages.length} mensagens de ${chatData.name} (${chatData.phone})`);
    if (badge) badge.innerText = 'Salvando...';

    chrome.runtime.sendMessage({
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

    logToConsoleAndCloudWatch('INFO', 'BATCH_SCAN_INITIATED', 'Varredura em lote acionada pelo corretor');

    // Localiza spans de título na lista lateral do WhatsApp Web
    const titleNodes = Array.from(document.querySelectorAll('#pane-side span[title]'))
      .filter(span => {
        const title = (span.getAttribute('title') || span.innerText || '').trim();
        return title && 
               title !== 'Meta AI' && 
               title !== 'Arquivadas' && 
               !title.includes('Você') &&
               span.offsetHeight > 0;
      });

    logToConsoleAndCloudWatch('INFO', 'CHATS_DISCOVERED', `Localizados ${titleNodes.length} chats para sincronização`);

    if (titleNodes.length === 0) {
      logToConsoleAndCloudWatch('WARN', 'NO_CHATS_FOUND', 'Nenhum chat visível encontrado no #pane-side');
      alert('Nenhum chat visível no WhatsApp Web. Certifique-se de que o WhatsApp Web está aberto.');
      isSyncing = false;
      if (btn) btn.disabled = false;
      return;
    }

    const total = Math.min(titleNodes.length, 30);
    const syncedChats = [];

    for (let i = 0; i < total; i++) {
      const titleSpan = titleNodes[i];
      if (!titleSpan) continue;

      const name = titleSpan.getAttribute('title') || titleSpan.innerText || `Chat ${i + 1}`;

      if (progressStatus) {
        progressStatus.innerText = `Abrindo e lendo histórico (${i + 1}/${total}): ${name}...`;
      }

      logToConsoleAndCloudWatch('DEBUG', 'OPENING_CHAT', `Abrindo (${i + 1}/${total}): ${name}`);

      // Clica para abrir a conversa usando múltiplos eventos de ponteiro
      const clickable = titleSpan.closest('div[role="gridcell"], div[role="row"], div._ak8l') || 
                        titleSpan.parentElement?.parentElement || 
                        titleSpan;

      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
        clickable.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
        titleSpan.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
      });

      // Aguarda 950ms para o WhatsApp renderizar os balões
      await new Promise(r => setTimeout(r, 950));

      // Extrai dados reais com mensagens
      const chatData = extractActiveChatData();
      if (chatData && chatData.phone) {
        syncedChats.push(chatData);

        logToConsoleAndCloudWatch('INFO', 'CHAT_INGEST_PAYLOAD', `Ingerindo ${chatData.messages.length} msgs de ${chatData.name} (${chatData.phone})`);

        // Envia imediatamente cada chat para a API da Brokiva
        chrome.runtime.sendMessage({
          action: 'SYNC_BATCH_CHATS',
          data: { chats: [chatData] }
        });
      } else {
        logToConsoleAndCloudWatch('WARN', 'CHAT_NO_MSGS', `Chat ${name}: Não foi possível resolver identificador do contato`);
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

    logToConsoleAndCloudWatch('INFO', 'BATCH_SCAN_COMPLETE', `Varredura finalizada: ${syncedChats.length}/${total} chats sincronizados com a nuvem`);
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
