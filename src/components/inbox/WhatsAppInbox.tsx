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
  Bot
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function WhatsAppInbox() {
  const { 
    conversations, 
    activeConversationId, 
    setActiveConversationId,
    messages, 
    sendMessage, 
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
    updateContact
  } = useCRM();

  const [filterTab, setFilterTab] = useState<'ALL' | 'UNASSIGNED' | 'MINE' | 'PENDING_TEAM' | 'SLA_BREACHED'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showLeadDrawer, setShowLeadDrawer] = useState(true);

  // Active Conversation & Contact
  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeContact = contacts.find(c => c.id === activeConversation?.contactId);
  const activeMessages = messages.filter(m => m.conversationId === activeConversation?.id);
  const activeInsight = activeConversation ? aiInsights[activeConversation.id] : null;
  const activeDeal = deals.find(d => d.contactId === activeContact?.id);

  // Filtered Conversations
  const filteredConversations = conversations.filter(c => {
    const contact = contacts.find(cnt => cnt.id === c.contactId);
    const matchesSearch = !searchFilter.trim() || 
      (contact?.name.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (contact?.phone.includes(searchFilter)) ||
      (c.lastMessagePreview.toLowerCase().includes(searchFilter.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === 'UNASSIGNED') return !c.assignedUserId;
    if (filterTab === 'MINE') return c.assignedUserId === currentUser.id;
    if (filterTab === 'PENDING_TEAM') return c.status === 'PENDING_TEAM';
    if (filterTab === 'SLA_BREACHED') return c.slaBreached;
    return true;
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

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* ---------------------------------------------------- */}
      {/* COLUNA 1: Lista de Conversas & Filtros              */}
      {/* ---------------------------------------------------- */}
      <div className="w-80 sm:w-96 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Header & Filtros Rápidos */}
        <div className="p-3.5 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Inbox WhatsApp</span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Z-API Live
              </span>
            </h1>
            <span className="text-xs font-semibold text-slate-400">
              {filteredConversations.length} conversas
            </span>
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
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.map((conv) => {
            const contact = contacts.find(c => c.id === conv.contactId);
            const isSelected = conv.id === activeConversation?.id;
            const assignedUser = users.find(u => u.id === conv.assignedUserId);

            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
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
                    <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                      {contact?.name || 'Lead WhatsApp'}
                    </h3>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                      {format(new Date(conv.lastMessageAt), 'HH:mm', { locale: ptBR })}
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
          })}
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
                  <p className="text-xs text-slate-500 font-mono">{activeContact.phone}</p>
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
                          {msg.senderName} • {format(new Date(msg.timestamp), 'HH:mm', { locale: ptBR })}
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
                      
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500">
                        <span>{format(new Date(msg.timestamp), 'HH:mm', { locale: ptBR })}</span>
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
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <p className="text-xs">Selecione uma conversa para iniciar o atendimento.</p>
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
                <p className="text-xs text-slate-500 font-mono">{activeContact.phone}</p>
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
                  <strong className="text-slate-800">Regiões:</strong> {activeContact.targetRegions.join(', ')}
                </p>
                <p className="text-slate-600">
                  <strong className="text-slate-800">Origem:</strong> {activeContact.source}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Tags Comerciais</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {activeContact.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                  >
                    #{tag}
                  </span>
                ))}
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
