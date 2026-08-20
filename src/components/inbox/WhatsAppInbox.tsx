'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  Sparkles, 
  Lock, 
  UserCheck, 
  Phone, 
  MoreVertical, 
  Check, 
  CheckCheck, 
  Clock, 
  Flame, 
  Building2, 
  Calendar, 
  Tag, 
  Plus, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Zap,
  Bot,
  MessageSquare,
  RefreshCw,
  MapPin,
  Mic,
  ExternalLink,
  FileText,
  X,
  Pin,
  Trash2,
  Archive,
  Eraser
} from 'lucide-react';
import { safeFormatDate } from '@/lib/date-utils';

const formatDisplayPhone = (phone?: string | null): string => {
  if (!phone) return '';
  const clean = phone.replace(/@.*$/, '').replace(/[^\d+]/g, '');
  if (!clean) return '';
  return clean.startsWith('+') ? clean : `+${clean}`;
};

export function WhatsAppInbox() {
  const { 
    conversations, 
    activeConversationId, 
    setActiveConversationId,
    messages, 
    sendMessage, 
    markConversationAsRead,
    clearChatMessages,
    archiveConversation,
    deleteConversation,
    pinConversation,
    contacts, 
    users, 
    currentUser,
    assignConversation, 
    aiInsights,
    applyAIExtractionToContact,
    recordAIFeedback,
    deals,
    moveDealStage,
    currentPipeline,
    quickReplies,
    updateContact,
    instances,
    syncWhatsAppChats,
    isSyncingWhatsApp
  } = useCRM();

  const [filterTab, setFilterTab] = useState<'ALL' | 'UNASSIGNED' | 'MINE' | 'PENDING_TEAM' | 'SLA_BREACHED'>('ALL');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showLeadDrawer, setShowLeadDrawer] = useState(true);
  const [showChatOptionsDropdown, setShowChatOptionsDropdown] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Active Conversation & Contact
  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeContact = contacts.find(c => c.id === activeConversation?.contactId);
  const activeMessages = messages.filter(m => m.conversationId === activeConversation?.id);
  const activeInsight = activeConversation ? aiInsights[activeConversation.id] : null;
  const activeDeal = deals.find(d => d.contactId === activeContact?.id);

  // Remove notificação de mensagens pendentes quando a conversa está aberta na tela
  React.useEffect(() => {
    if (activeConversation?.id && activeConversation.unreadCount > 0) {
      markConversationAsRead(activeConversation.id);
    }
  }, [activeConversation?.id, activeConversation?.unreadCount, markConversationAsRead]);

  // Tags disponíveis para filtro
  const availableTags = ['Lead Quente', 'Investidor', 'Lançamento', 'Visita Agendada', 'Financiamento'];

  // Filtered Conversations
  const filteredConversations = conversations.filter(c => {
    // Oculta conversas arquivadas
    if (c.isArchived) return false;

    const contact = contacts.find(cnt => cnt.id === c.contactId);
    const matchesSearch = !searchFilter.trim() || 
      (contact?.name.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (contact?.phone.includes(searchFilter)) ||
      (c.lastMessagePreview.toLowerCase().includes(searchFilter.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedTagFilter) {
      const hasTag = (contact?.tags || []).some(t => t.toLowerCase() === selectedTagFilter.toLowerCase());
      if (!hasTag) return false;
    }

    if (filterTab === 'UNASSIGNED') return !c.assignedUserId;
    if (filterTab === 'MINE') return c.assignedUserId === currentUser.id;
    if (filterTab === 'PENDING_TEAM') return c.status === 'PENDING_TEAM';
    if (filterTab === 'SLA_BREACHED') return c.slaBreached;
    return true;
  }).sort((a, b) => {
    // Prioridade 1: Conversas Fixadas no Topo
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Prioridade 2: Mensagem mais recente
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversation) return;

    sendMessage(activeConversation.id, messageInput.trim(), isInternalNote);
    setMessageInput('');
    setIsInternalNote(false);
  };

  const handleApplyQuickReply = (text: string) => {
    const customized = text
      .replace('{{corretor_nome}}', currentUser.name.split(' ')[0])
      .replace('{{nome}}', activeContact?.name.split(' ')[0] || 'Cliente');
    setMessageInput(customized);
    setShowQuickReplies(false);
  };

  const handleUseAISuggestion = (suggestionText: string) => {
    setMessageInput(suggestionText);
    if (activeConversation) {
      recordAIFeedback(activeConversation.id, 'ACCEPTED');
    }
  };

  // Envio de Localização do Plantão via Z-API
  const handleSendLocation = async () => {
    if (!activeContact?.phone || !activeConversation) return;
    try {
      setIsActionLoading(true);
      const res = await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-location',
          phone: activeContact.phone,
          name: 'Plantão de Vendas Vanguard',
          address: 'Av. Beira Mar Norte, 1000 - Florianópolis, SC',
        }),
      });
      sendMessage(activeConversation.id, '📍 Localização do Plantão de Vendas compartilhada.');
    } catch {} finally {
      setIsActionLoading(false);
    }
  };

  // Envio de Cartão do Corretor via Z-API
  const handleSendContactCard = async () => {
    if (!activeContact?.phone || !activeConversation) return;
    try {
      setIsActionLoading(true);
      await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-contact',
          phone: activeContact.phone,
          contactName: currentUser.name,
          contactPhone: instances[0]?.phoneNumber || '+554888774408',
        }),
      });
      sendMessage(activeConversation.id, `📇 Cartão de Visita de ${currentUser.name} compartilhado.`);
    } catch {} finally {
      setIsActionLoading(false);
    }
  };

  // Envio de Reação com Emoji via Z-API
  const handleSendReaction = async (messageId: string, emoji: string) => {
    if (!activeContact?.phone) return;
    try {
      await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-reaction',
          phone: activeContact.phone,
          messageId,
          emoji,
        }),
      });
    } catch {}
  };

  // Adicionar Tag Comercial ao Lead
  const handleAddTag = (tag: string) => {
    if (!activeContact || !tag.trim()) return;
    const currentTags = activeContact.tags || [];
    if (!currentTags.includes(tag.trim())) {
      updateContact(activeContact.id, { tags: [...currentTags, tag.trim()] });
    }
    setNewTagInput('');
  };

  // Remover Tag Comercial do Lead
  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeContact) return;
    const currentTags = activeContact.tags || [];
    updateContact(activeContact.id, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* ---------------------------------------------------- */}
      {/* COLUNA 1: Lista de Conversas & Filtros              */}
      {/* ---------------------------------------------------- */}
      <div className="w-80 sm:w-96 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Header & Filtros Rápidos */}
        <div className="p-3.5 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-800">
                Inbox WhatsApp
              </h1>
              {instances[0]?.status === 'CONNECTED' ? (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Ao Vivo</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  Desconectado
                </span>
              )}
            </div>

            <button
              onClick={() => syncWhatsAppChats()}
              disabled={isSyncingWhatsApp}
              className="flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50"
              title="Sincronizar conversas do WhatsApp"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-700 ${isSyncingWhatsApp ? 'animate-spin' : ''}`} />
              <span>{isSyncingWhatsApp ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar conversa ou telefone..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-50 text-xs rounded-xl pl-8 pr-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-medium text-slate-600 no-scrollbar">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterTab === 'ALL' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterTab('UNASSIGNED')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterTab === 'UNASSIGNED' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              Não Atribuídas
            </button>
            <button
              onClick={() => setFilterTab('MINE')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterTab === 'MINE' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              Minhas
            </button>
            <button
              onClick={() => setFilterTab('PENDING_TEAM')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterTab === 'PENDING_TEAM' ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              Aguardando
            </button>
            <button
              onClick={() => setFilterTab('SLA_BREACHED')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                filterTab === 'SLA_BREACHED' ? 'bg-rose-600 text-white font-semibold' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              SLA Atrasado
            </button>
          </div>

          {/* Tag / Etiquetas Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] no-scrollbar">
            <span className="text-slate-400 font-bold uppercase text-[9px] flex-shrink-0">Tags:</span>
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`px-2 py-0.5 rounded-md font-semibold transition whitespace-nowrap ${
                selectedTagFilter === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-md font-semibold transition whitespace-nowrap border ${
                  selectedTagFilter === tag
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Nenhuma conversa no momento</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  As mensagens recebidas no WhatsApp aparecerão aqui automaticamente.
                </p>
              </div>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const contact = contacts.find(c => c.id === conv.contactId);
              const isSelected = conv.id === activeConversation?.id;
              const assignedUser = users.find(u => u.id === conv.assignedUserId);

              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    markConversationAsRead(conv.id);
                  }}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition relative group ${
                    isSelected ? 'bg-emerald-50/70 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={contact?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(contact?.name || 'Cliente')}
                      alt={contact?.name}
                      className="w-11 h-11 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    {contact?.temperature === 'HOT' && (
                      <span className="absolute -bottom-1 -right-1 text-xs" title="Lead Quente">
                        🔥
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                          {contact?.name || 'Lead WhatsApp'}
                        </h3>
                        {conv.isPinned && (
                          <span title="Conversa Fixada">
                            <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                        {safeFormatDate(conv.lastMessageAt, 'HH:mm')}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 truncate mb-1.5 leading-relaxed">
                      {conv.lastMessagePreview}
                    </p>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 text-[10px]">
                        {assignedUser ? (
                          <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]">
                            👤 {assignedUser.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                            ⚠️ Não Atribuído
                          </span>
                        )}

                        {contact?.aiPriorityScore && contact.aiPriorityScore >= 80 && (
                          <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-bold">
                            ★ {contact.aiPriorityScore}
                          </span>
                        )}
                      </div>

                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* COLUNA 2: Janela de Chat Ativa & Mensagens           */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative min-w-0">
        {activeConversation && activeContact ? (
          <>
            {/* Header do Chat */}
            <div className="h-16 bg-white border-b border-slate-200 px-5 flex items-center justify-between z-10 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={activeContact.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(activeContact.name)}
                  alt={activeContact.name}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-800 truncate">{activeContact.name}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeContact.temperature === 'HOT' ? 'bg-rose-100 text-rose-700' :
                      activeContact.temperature === 'WARM' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {activeContact.temperature === 'HOT' ? '🔥 Quente' : activeContact.temperature === 'WARM' ? '⚡ Morno' : '❄️ Frio'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{formatDisplayPhone(activeContact.phone)}</p>
                </div>
              </div>

              {/* Ações do Header */}
              <div className="flex items-center gap-2.5">
                {/* Atribuição de Corretor */}
                <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Responsável:</span>
                  <select
                    value={activeConversation.assignedUserId || ''}
                    onChange={(e) => assignConversation(activeConversation.id, e.target.value || undefined)}
                    className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="">(Não Atribuído)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Atalho WhatsApp Web Oficial */}
                <a
                  href={`https://web.whatsapp.com/send?phone=${activeContact.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  title="Abrir esta conversa no WhatsApp Web oficial"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">WhatsApp Web</span>
                  <ExternalLink className="w-3 h-3 text-emerald-500" />
                </a>

                {/* Drawer Toggle */}
                <button
                  onClick={() => setShowLeadDrawer(!showLeadDrawer)}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                    showLeadDrawer ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                  title="Abrir Perfil 360 do Lead"
                >
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Perfil 360º</span>
                </button>

                {/* Menu 3 Pontinhos de Gerenciamento da Conversa */}
                <div className="relative">
                  <button
                    onClick={() => setShowChatOptionsDropdown(!showChatOptionsDropdown)}
                    className={`p-2 rounded-xl border text-slate-600 transition active:scale-95 ${
                      showChatOptionsDropdown ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-inner' : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                    title="Mais opções da conversa"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showChatOptionsDropdown && (
                    <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            pinConversation(activeConversation.id);
                            setShowChatOptionsDropdown(false);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium transition"
                        >
                          <Pin className={`w-3.5 h-3.5 ${activeConversation.isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                          <span>{activeConversation.isPinned ? 'Desafixar do Topo' : 'Fixar no Topo'}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('Deseja limpar o histórico de mensagens desta conversa?')) {
                              clearChatMessages(activeConversation.id);
                              setShowChatOptionsDropdown(false);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium transition"
                        >
                          <Eraser className="w-3.5 h-3.5 text-slate-400" />
                          <span>Limpar Histórico</span>
                        </button>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            archiveConversation(activeConversation.id, true);
                            setShowChatOptionsDropdown(false);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium transition"
                        >
                          <Archive className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Arquivar Conversa</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir esta conversa do CRM e do WhatsApp?')) {
                              deleteConversation(activeConversation.id);
                              setShowChatOptionsDropdown(false);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 font-semibold transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Excluir Conversa</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SLA Alert Banner (se houver atraso) */}
            {activeConversation.slaBreached && (
              <div className="bg-rose-500 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>SLA Alerta: {activeConversation.slaBreachReason || 'Lead aguardando resposta'}</span>
                </div>
                <span className="text-[10px] bg-rose-700 px-2 py-0.5 rounded font-bold">URGENTE</span>
              </div>
            )}

            {/* Área de Mensagens (com background WhatsApp) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 whatsapp-chat-bg">
              {activeMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-center p-6 space-y-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-xs text-emerald-600 flex items-center justify-center shadow-xs border border-slate-200/80">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Conversa Ativa no WhatsApp</h3>
                    <p className="text-[11px] text-slate-500 max-w-xs mt-0.5 leading-relaxed">
                      Digite abaixo para responder. Todas as mensagens trocadas a partir de agora ficarão salvas aqui.
                    </p>
                  </div>
                </div>
              )}

              {activeMessages.map((msg) => {
                const isMe = msg.senderType === 'USER';
                const isNote = msg.isInternalNote;

                if (isNote) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3 max-w-md shadow-xs text-xs text-amber-900">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Nota Interna da Equipe (Invisível para o cliente)</span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <span className="block text-[10px] text-amber-600/80 text-right mt-1">
                          {msg.senderName} • {safeFormatDate(msg.timestamp, 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-2xl px-4 py-2.5 shadow-sm text-xs relative ${
                        isMe
                          ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                          : 'bg-white text-slate-900 rounded-tl-none'
                      }`}
                    >
                      {isMe && msg.senderName && (
                        <p className="text-[10px] font-bold text-emerald-800 mb-0.5">
                          {msg.senderName}
                        </p>
                      )}
                      
                      {/* Imagem / Foto */}
                      {msg.attachments?.[0]?.url && (msg.messageType === 'IMAGE' || msg.attachments[0].mimeType?.startsWith('image')) && (
                        <div className="mb-2 rounded-xl overflow-hidden max-w-xs border border-slate-200/50 bg-black/5">
                          <img
                            src={msg.attachments[0].url}
                            alt="Foto recebida"
                            className="w-full h-auto max-h-64 object-cover hover:opacity-95 transition cursor-pointer"
                            onClick={() => window.open(msg.attachments?.[0]?.url, '_blank')}
                          />
                        </div>
                      )}

                      {/* Badge para Foto ou Vídeo de Visualização Única */}
                      {(msg.content.includes('Visualização Única') || msg.content.includes('Foto (Visualização Única)')) && (
                        <div className="flex items-center gap-2 bg-slate-900/10 text-slate-800 px-3 py-2 rounded-xl mb-1.5 font-medium border border-slate-300/40">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            1
                          </span>
                          <div>
                            <p className="font-bold text-[11px] text-slate-900">Foto de Visualização Única</p>
                            <p className="text-[10px] text-slate-600">Por privacidade, fotos de visualização única são abertas exclusivamente no WhatsApp do celular.</p>
                          </div>
                        </div>
                      )}

                      {/* Player de Áudio / Mensagem de Voz */}
                      {msg.messageType === 'AUDIO' && msg.attachments?.[0]?.url && (
                        <div className="mb-2 pt-1">
                          <audio controls className="w-64 h-8">
                            <source src={msg.attachments[0].url} />
                            Seu navegador não suporta reprodução de áudio.
                          </audio>
                        </div>
                      )}

                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500">
                        <span>{safeFormatDate(msg.timestamp, 'HH:mm')}</span>
                        {isMe && (
                          <span>
                            {msg.status === 'READ' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ---------------------------------------------------- */}
            {/* IA COPILOTO: Sugestão de Resposta Inteligente        */}
            {/* ---------------------------------------------------- */}
            {activeInsight && activeInsight.suggestedResponse && (
              <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-emerald-100 p-3 mx-4 mb-2 rounded-2xl shadow-xl border border-emerald-500/40 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-300 text-[11px] flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      Sugestão IA Copiloto (Confiança: {activeInsight.confidenceScore}%)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Intenção: {activeInsight.intent}
                    </span>
                  </div>
                  <p className="text-slate-200 italic line-clamp-2 mb-2 bg-black/20 p-2 rounded-lg text-[11px]">
                    "{activeInsight.suggestedResponse}"
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUseAISuggestion(activeInsight.suggestedResponse)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-[11px] transition active:scale-95"
                    >
                      Inserir no Chat
                    </button>
                    <button
                      onClick={() => recordAIFeedback(activeConversation.id, 'REJECTED')}
                      className="text-emerald-300/70 hover:text-emerald-100 text-[11px]"
                    >
                      Descartar Sugestão
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Caixa de Digitação / Respostas Rápidas */}
            <div className="bg-white border-t border-slate-200 p-3">
              {/* Quick Replies Menu Dropdown */}
              {showQuickReplies && (
                <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">
                    Modelos de Respostas Rápidas
                  </div>
                  {quickReplies.map(qr => (
                    <button
                      key={qr.id}
                      onClick={() => handleApplyQuickReply(qr.content)}
                      className="w-full text-left p-2 hover:bg-emerald-50 rounded-lg text-xs transition"
                    >
                      <span className="font-bold text-emerald-700 font-mono">{qr.shortcut}</span> - {qr.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Botões de Ação da Barra de Digitação */}
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  {/* Alternador Nota Interna */}
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(!isInternalNote)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      isInternalNote
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isInternalNote ? 'Modo Nota Interna' : 'WhatsApp Cliente'}</span>
                  </button>

                  {/* Respostas Rápidas */}
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1 border border-slate-200"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Modelos Rápidos</span>
                  </button>

                  {/* Anexo de Arquivo S3 */}
                  <label className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1 border border-slate-200 cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Anexar</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && activeConversation) {
                          sendMessage(
                            activeConversation.id,
                            `📎 [Arquivo Anexado]: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
                          );
                        }
                      }}
                    />
                  </label>

                  {/* Ação Z-API: Localização do Plantão */}
                  <button
                    type="button"
                    onClick={handleSendLocation}
                    disabled={isActionLoading}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1 border border-slate-200 transition active:scale-95"
                    title="Enviar Localização GPS do Plantão de Vendas"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Localização</span>
                  </button>

                  {/* Ação Z-API: Cartão do Corretor */}
                  <button
                    type="button"
                    onClick={handleSendContactCard}
                    disabled={isActionLoading}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1 border border-slate-200 transition active:scale-95"
                    title="Enviar Cartão de Visitas do Corretor"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="hidden sm:inline">Cartão vCard</span>
                  </button>

                  {/* Ação Z-API: Book de Lançamento */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeConversation) {
                        sendMessage(
                          activeConversation.id,
                          '📄 *Book Oficial Vanguard*: Baixe a apresentação completa com plantas, memorial descritivo e tabela de unidades: https://crm.faithhubs.com/docs/book-vanguard.pdf'
                        );
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1 border border-slate-200 transition active:scale-95"
                    title="Enviar Apresentação e Planta do Imóvel"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span className="hidden sm:inline">Book PDF</span>
                  </button>
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                  rows={2}
                  placeholder={
                    isInternalNote
                      ? 'Escreva uma nota interna sobre este lead (somente a equipe verá)...'
                      : 'Digite sua mensagem para o WhatsApp... (Enter para enviar)'
                  }
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  className={`flex-1 text-xs rounded-xl p-3 border focus:outline-none resize-none transition ${
                    isInternalNote
                      ? 'bg-amber-50/70 border-amber-300 focus:ring-1 focus:ring-amber-500 text-amber-950 placeholder-amber-700/60'
                      : 'bg-slate-50 border-slate-200 focus:ring-1 focus:ring-emerald-500 text-slate-900'
                  }`}
                />

                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className={`p-3 rounded-xl transition shadow-md active:scale-95 disabled:opacity-40 ${
                    isInternalNote
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#efeae2]/60">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-4 shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Caixa de Entrada WhatsApp Pronta
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              Nenhuma conversa selecionada. Vincule seu WhatsApp através do QR Code para receber e responder mensagens em tempo real.
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* COLUNA 3: Perfil 360º do Lead & IA Insights          */}
      {/* ---------------------------------------------------- */}
      {showLeadDrawer && activeContact && (
        <div className="w-80 sm:w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Header Lead 360 */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Perfil 360º do Lead
              </span>
              <span className="text-xs font-bold text-slate-600">
                Score IA: {activeContact.aiPriorityScore}/100
              </span>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={activeContact.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(activeContact.name)}
                alt={activeContact.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{activeContact.name}</h3>
                <p className="text-xs text-slate-500 font-mono">{formatDisplayPhone(activeContact.phone)}</p>
                <p className="text-[11px] text-slate-400 truncate">{activeContact.email || 'E-mail não informado'}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* IA Extracted Data Card (com 1-click aplicar) */}
            {activeInsight && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Extração Inteligente de IA</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {activeInsight.sentiment}
                  </span>
                </div>

                <p className="text-[11px] text-emerald-950 mb-2 leading-relaxed font-medium">
                  {activeInsight.summary}
                </p>

                <div className="space-y-1 text-[10px] text-emerald-900">
                  {activeInsight.extractedData.downPayment && (
                    <p>• <strong>Entrada Detectada:</strong> R$ {activeInsight.extractedData.downPayment.toLocaleString('pt-BR')}</p>
                  )}
                  {activeInsight.extractedData.preferredRegion && (
                    <p>• <strong>Região de Interesse:</strong> {activeInsight.extractedData.preferredRegion}</p>
                  )}
                </div>

                <button
                  onClick={() => applyAIExtractionToContact(activeInsight.conversationId, activeContact.id)}
                  className="w-full mt-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold py-1.5 rounded-lg shadow-xs transition"
                >
                  ✓ Salvar Dados no Perfil do Lead
                </button>
              </div>
            )}

            {/* Estágio Atual no Funil (Kanban) */}
            {activeDeal && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">Negócio no Funil</span>
                  <span className="text-xs font-bold text-emerald-600">
                    R$ {activeDeal.expectedValue.toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 mb-2 truncate">
                  {activeDeal.title}
                </p>

                <label className="block text-[10px] text-slate-500 mb-1 font-semibold">
                  Mover Etapa do Funil:
                </label>
                <select
                  value={activeDeal.stageId}
                  onChange={(e) => moveDealStage(activeDeal.id, e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 font-medium text-slate-700 focus:outline-none"
                >
                  {currentPipeline.stages.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dados Financeiros & Qualificação */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Qualificação Financeira</h4>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Entrada</span>
                  <span className="font-bold text-slate-800 font-mono">
                    R$ {(activeContact.downPaymentAvailable || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Orçamento Max</span>
                  <span className="font-bold text-slate-800 font-mono">
                    R$ {(activeContact.maxPropertyValue || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                <p className="text-slate-600">
                  <strong className="text-slate-800">Tipo:</strong> {activeContact.preferredPropertyType || 'Apartamento'}
                </p>
                <p className="text-slate-600">
                  <strong className="text-slate-800">Regiões:</strong> {(activeContact.targetRegions || []).join(', ') || 'Todas as regiões'}
                </p>
                <p className="text-slate-600">
                  <strong className="text-slate-800">Origem:</strong> {activeContact.source || 'WHATSAPP'}
                </p>
              </div>
            </div>

            {/* Tags Comerciais */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tags Comerciais</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">{(activeContact.tags || []).length} tags</span>
              </div>

              {/* Tags List com botão de remover */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(activeContact.tags || []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 group"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-emerald-500 hover:text-rose-600 transition"
                      title="Remover tag"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Input Adicionar Tag */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Nova tag... (ex: Investidor)"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    }
                  }}
                  className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* LGPD & Consentimento */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Consentimento LGPD</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {activeContact.hasOptedOut ? 'OPT-OUT (Bloqueado)' : 'OPT-IN Ativo'}
                </span>
              </div>
              <button
                onClick={() => updateContact(activeContact.id, { hasOptedOut: !activeContact.hasOptedOut })}
                className="mt-2 text-[10px] text-slate-500 hover:text-rose-600 underline"
              >
                {activeContact.hasOptedOut ? 'Reativar comunicações' : 'Registrar Opt-out (Solicitação do titular)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
