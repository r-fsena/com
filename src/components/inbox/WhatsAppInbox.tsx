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
  Eraser,
  Edit3,
  Save,
  DollarSign,
  Building,
  Notebook
} from 'lucide-react';
import { safeFormatDate } from '@/lib/date-utils';
import { PropertyType } from '@/types/crm';

const mapToPropertyType = (type?: string): PropertyType => {
  if (!type) return 'APARTMENT';
  const lower = type.toLowerCase();
  if (lower.includes('cobertura') || lower.includes('penthouse')) return 'PENTHOUSE';
  if (lower.includes('casa') || lower.includes('condomínio')) return 'HOUSE';
  if (lower.includes('studio') || lower.includes('loft')) return 'STUDIO';
  if (lower.includes('terreno') || lower.includes('lote')) return 'LAND';
  if (lower.includes('comercial') || lower.includes('sala')) return 'COMMERCIAL';
  return 'APARTMENT';
};

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

  // Estados de Edição Inline do Perfil 360º
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [editedDownPayment, setEditedDownPayment] = useState<string>('');
  const [editedMaxBudget, setEditedMaxBudget] = useState<string>('');
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [newRegionInput, setNewRegionInput] = useState('');
  const [brokerNote, setBrokerNote] = useState('');

  // Active Conversation & Contact
  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeContact = contacts.find(c => c.id === activeConversation?.contactId);
  const activeMessages = messages.filter(m => m.conversationId === activeConversation?.id);
  const activeInsight = activeConversation ? aiInsights[activeConversation.id] : null;
  const activeDeal = deals.find(d => d.contactId === activeContact?.id);

  // Sincroniza formulário com o contato selecionado
  React.useEffect(() => {
    if (activeContact) {
      setEditedName(activeContact.name);
      setEditedEmail(activeContact.email || '');
      setEditedDownPayment(activeContact.downPaymentAvailable ? String(activeContact.downPaymentAvailable) : '');
      setEditedMaxBudget(activeContact.maxPropertyValue ? String(activeContact.maxPropertyValue) : '');
    }
  }, [activeContact?.id, activeContact?.name, activeContact?.email, activeContact?.downPaymentAvailable, activeContact?.maxPropertyValue]);

  // Opção 1: Auto-Análise e Auto-Save Contínuo por IA
  React.useEffect(() => {
    if (!activeConversation || activeMessages.length === 0 || !activeContact) return;

    const timer = setTimeout(async () => {
      try {
        setIsAnalyzingAI(true);
        const chatHistory = activeMessages
          .filter(m => !m.isInternalNote && m.content)
          .map(m => ({
            sender: m.senderType === 'USER' ? ('BROKER' as const) : ('CLIENT' as const),
            text: m.content,
          }));

        if (chatHistory.length === 0) return;

        const res = await fetch('/api/v1/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatHistory,
            brokerName: currentUser.name || 'Corretor',
          }),
        });

        const resData = await res.json();
        if (resData.data) {
          const analysis = resData.data;

          // Auto-preenchimento e atualização inteligente
          const updates: any = {};
          if (analysis.extractedData?.downPayment && (!activeContact.downPaymentAvailable || activeContact.downPaymentAvailable === 0)) {
            updates.downPaymentAvailable = analysis.extractedData.downPayment;
          }
          if (analysis.extractedData?.maxBudget && (!activeContact.maxPropertyValue || activeContact.maxPropertyValue === 0)) {
            updates.maxPropertyValue = analysis.extractedData.maxBudget;
          }
          if (analysis.extractedData?.propertyType && (!activeContact.preferredPropertyType || activeContact.preferredPropertyType === 'APARTMENT')) {
            updates.preferredPropertyType = mapToPropertyType(analysis.extractedData.propertyType);
          }
          if (analysis.extractedData?.preferredRegion && (!activeContact.targetRegions || activeContact.targetRegions.length === 0 || activeContact.targetRegions.includes('Geral'))) {
            updates.targetRegions = [analysis.extractedData.preferredRegion];
          }
          if (analysis.extractedData?.urgencyLevel === 'ALTA' || analysis.sentiment === 'POSITIVE') {
            updates.temperature = 'HOT';
            updates.aiPriorityScore = Math.max(activeContact.aiPriorityScore || 80, 92);
          }

          if (Object.keys(updates).length > 0) {
            updateContact(activeContact.id, updates);
          }
        }
      } catch (err) {
        console.error('Auto-análise IA:', err);
      } finally {
        setIsAnalyzingAI(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [activeConversation?.id, activeMessages.length]);

  // Forçar Análise Manual por IA sob Demanda
  const handleForceAIAnalysis = async () => {
    if (!activeConversation || !activeContact) return;
    try {
      setIsAnalyzingAI(true);
      const chatHistory = activeMessages
        .filter(m => !m.isInternalNote && m.content)
        .map(m => ({
          sender: m.senderType === 'USER' ? ('BROKER' as const) : ('CLIENT' as const),
          text: m.content,
        }));

      if (chatHistory.length === 0) {
        alert('Esta conversa ainda não possui mensagens gravadas para a IA analisar.');
        return;
      }

      const res = await fetch('/api/v1/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory,
          brokerName: currentUser.name || 'Corretor',
        }),
      });

      const resData = await res.json();
      if (resData.data) {
        const analysis = resData.data;

        // Atualiza campos do Perfil 360
        const updates: any = {};
        if (analysis.extractedData?.downPayment) {
          updates.downPaymentAvailable = analysis.extractedData.downPayment;
          setEditedDownPayment(String(analysis.extractedData.downPayment));
        }
        if (analysis.extractedData?.maxBudget) {
          updates.maxPropertyValue = analysis.extractedData.maxBudget;
          setEditedMaxBudget(String(analysis.extractedData.maxBudget));
        }
        if (analysis.extractedData?.propertyType) {
          updates.preferredPropertyType = mapToPropertyType(analysis.extractedData.propertyType);
        }
        if (analysis.extractedData?.preferredRegion) {
          updates.targetRegions = [analysis.extractedData.preferredRegion];
        }
        if (analysis.extractedData?.urgencyLevel === 'ALTA' || analysis.sentiment === 'POSITIVE') {
          updates.temperature = 'HOT';
          updates.aiPriorityScore = 95;
        }

        if (Object.keys(updates).length > 0) {
          updateContact(activeContact.id, updates);
        }
      }
    } catch (err) {
      console.error('Erro ao forçar análise por IA:', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

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

                {/* Botão Analisar com IA no Cabeçalho */}
                <button
                  onClick={handleForceAIAnalysis}
                  disabled={isAnalyzingAI}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer ring-1 ring-emerald-400/50"
                  title="Executar análise de IA para extrair dados financeiros e qualificação imobiliária"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzingAI ? 'Analisando...' : 'Analisar com IA'}</span>
                </button>

                {/* Drawer Toggle */}
                <button
                  onClick={() => setShowLeadDrawer(!showLeadDrawer)}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                    showLeadDrawer ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs' : 'bg-white text-slate-600 border-slate-200'
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
                            handleForceAIAnalysis();
                            setShowChatOptionsDropdown(false);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 text-emerald-700 font-semibold transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Forçar Análise com IA</span>
                        </button>

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

                  {/* Botão Forçar Análise com IA na Toolbar */}
                  <button
                    type="button"
                    onClick={handleForceAIAnalysis}
                    disabled={isAnalyzingAI}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 border border-emerald-300 transition active:scale-95 shadow-2xs cursor-pointer"
                    title="Forçar extração inteligente de dados com IA Copilot"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingAI ? 'Analisando...' : 'Analisar com IA'}</span>
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
      {/* ---------------------------------------------------- */}
      {/* COLUNA 3: Perfil 360º do Lead & IA Insights          */}
      {/* ---------------------------------------------------- */}
      {showLeadDrawer && activeContact && (
        <div className="w-80 sm:w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Header Lead 360 */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Perfil 360º • IA + CRM</span>
              </span>
              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                Score: {activeContact.aiPriorityScore || 85}/100
              </span>
            </div>

            <div className="flex items-start gap-3">
              <img
                src={activeContact.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(activeContact.name)}
                alt={activeContact.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                {/* Nome Editável */}
                {isEditingName ? (
                  <div className="flex items-center gap-1 mb-1">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editedName.trim()) {
                            updateContact(activeContact.id, { name: editedName.trim() });
                          }
                          setIsEditingName(false);
                        }
                      }}
                      className="text-xs font-bold text-slate-900 border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (editedName.trim()) {
                          updateContact(activeContact.id, { name: editedName.trim() });
                        }
                        setIsEditingName(false);
                      }}
                      className="p-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                      title="Salvar Nome"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group mb-0.5">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{activeContact.name}</h3>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 transition"
                      title="Editar nome"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  <span>{formatDisplayPhone(activeContact.phone)}</span>
                </p>

                {/* E-mail Editável */}
                {isEditingEmail ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="email"
                      placeholder="email@cliente.com"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateContact(activeContact.id, { email: editedEmail.trim() || undefined });
                          setIsEditingEmail(false);
                        }
                      }}
                      className="text-[11px] border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        updateContact(activeContact.id, { email: editedEmail.trim() || undefined });
                        setIsEditingEmail(false);
                      }}
                      className="p-1 text-emerald-600 font-bold text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group mt-0.5">
                    <p className="text-[11px] text-slate-400 truncate">
                      {activeContact.email || 'Clique para adicionar e-mail'}
                    </p>
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 transition"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Seletor de Temperatura de 1 Clique */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">Temperatura:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateContact(activeContact.id, { temperature: 'HOT', aiPriorityScore: 95 })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-0.5 ${
                    activeContact.temperature === 'HOT'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-rose-50'
                  }`}
                >
                  🔥 Quente
                </button>
                <button
                  type="button"
                  onClick={() => updateContact(activeContact.id, { temperature: 'WARM', aiPriorityScore: 75 })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-0.5 ${
                    activeContact.temperature === 'WARM'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'
                  }`}
                >
                  ⚡ Morno
                </button>
                <button
                  type="button"
                  onClick={() => updateContact(activeContact.id, { temperature: 'COLD', aiPriorityScore: 50 })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-0.5 ${
                    activeContact.temperature === 'COLD'
                      ? 'bg-blue-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  ❄️ Frio
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* IA Copilot Card em Tempo Real */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <Sparkles className={`w-4 h-4 text-emerald-600 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                  <span>IA Copilot • Auto-Preenchimento</span>
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wide bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                  {isAnalyzingAI ? 'Analisando...' : 'Ativo'}
                </span>
              </div>

              <p className="text-[11px] text-emerald-900 mb-2 leading-relaxed">
                {activeInsight?.summary || `A IA monitora a conversa e atualiza automaticamente a entrada, orçamento e preferências imobiliárias do cliente.`}
              </p>

              {activeInsight?.suggestedResponse && (
                <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2 border border-emerald-200/80 mt-2">
                  <span className="text-[10px] font-bold text-emerald-800 block mb-1">💡 Sugestão de Resposta da IA:</span>
                  <p className="text-[11px] text-slate-700 italic">"{activeInsight.suggestedResponse}"</p>
                  <button
                    onClick={() => handleUseAISuggestion(activeInsight.suggestedResponse)}
                    className="mt-1.5 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition"
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>Usar esta resposta</span>
                  </button>
                </div>
              )}

              {/* Botão de Forçar Análise Manual */}
              <div className="mt-2.5 pt-2 border-t border-emerald-200/60">
                <button
                  type="button"
                  onClick={handleForceAIAnalysis}
                  disabled={isAnalyzingAI}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Executa a análise de IA em todo o histórico da conversa e atualiza o perfil"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzingAI ? 'Analisando Histórico...' : '⚡ Forçar Análise da Conversa'}</span>
                </button>
              </div>
            </div>

            {/* Qualificação Financeira & Imobiliária (Edição Inline com Salvamento Instantâneo) */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Qualificação do Imóvel</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Edição Rápida</span>
              </div>

              {/* Grid Entrada e Orçamento */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 transition">
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Entrada (R$)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editedDownPayment}
                    onChange={(e) => setEditedDownPayment(e.target.value)}
                    onBlur={() => {
                      const val = Number(editedDownPayment) || 0;
                      updateContact(activeContact.id, { downPaymentAvailable: val });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = Number(editedDownPayment) || 0;
                        updateContact(activeContact.id, { downPaymentAvailable: val });
                      }
                    }}
                    className="w-full text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none"
                  />
                  {Number(editedDownPayment) > 0 && (
                    <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">
                      R$ {Number(editedDownPayment).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 transition">
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Orçamento Max (R$)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editedMaxBudget}
                    onChange={(e) => setEditedMaxBudget(e.target.value)}
                    onBlur={() => {
                      const val = Number(editedMaxBudget) || 0;
                      updateContact(activeContact.id, { maxPropertyValue: val });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = Number(editedMaxBudget) || 0;
                        updateContact(activeContact.id, { maxPropertyValue: val });
                      }
                    }}
                    className="w-full text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none"
                  />
                  {Number(editedMaxBudget) > 0 && (
                    <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">
                      R$ {Number(editedMaxBudget).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              {/* Tipo de Imóvel */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>Tipo de Imóvel de Interesse</span>
                </label>
                <select
                  value={activeContact.preferredPropertyType || 'APARTMENT'}
                  onChange={(e) => updateContact(activeContact.id, { preferredPropertyType: e.target.value as PropertyType })}
                  className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="APARTMENT">Apartamento (Padrão)</option>
                  <option value="PENTHOUSE">Cobertura / Penthouse</option>
                  <option value="HOUSE">Casa em Condomínio Fechado</option>
                  <option value="STUDIO">Studio / Loft Compacto</option>
                  <option value="LAND">Terreno / Lote Residencial</option>
                  <option value="COMMERCIAL">Sala Comercial / Corporativa</option>
                </select>
              </div>

              {/* Regiões de Interesse */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Bairros / Regiões de Busca</span>
                </label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {(activeContact.targetRegions || []).map((reg, idx) => (
                    <span key={idx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                      <span>{reg}</span>
                      <button
                        onClick={() => {
                          const updated = (activeContact.targetRegions || []).filter(r => r !== reg);
                          updateContact(activeContact.id, { targetRegions: updated });
                        }}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Adicionar bairro (ex: Centro)..."
                    value={newRegionInput}
                    onChange={(e) => setNewRegionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newRegionInput.trim()) {
                        e.preventDefault();
                        const updated = [...(activeContact.targetRegions || []), newRegionInput.trim()];
                        updateContact(activeContact.id, { targetRegions: updated });
                        setNewRegionInput('');
                      }
                    }}
                    className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newRegionInput.trim()) {
                        const updated = [...(activeContact.targetRegions || []), newRegionInput.trim()];
                        updateContact(activeContact.id, { targetRegions: updated });
                        setNewRegionInput('');
                      }
                    }}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Estágio Atual no Funil (Kanban) */}
            {activeDeal && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">Negócio no Funil</span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
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
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  {currentPipeline.stages.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags Comerciais */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tags Comerciais</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">{(activeContact.tags || []).length} tags</span>
              </div>

              {/* Tags List com botão de remover */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
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
                  className="flex-1 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Anotações do Corretor */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Notebook className="w-3.5 h-3.5 text-slate-500" />
                  <span>Anotações do Corretor</span>
                </h4>
              </div>

              <textarea
                rows={2}
                placeholder="Observações internas sobre este cliente (ex: prefere visitas aos sábados de manhã)..."
                value={brokerNote}
                onChange={(e) => setBrokerNote(e.target.value)}
                className="w-full text-[11px] bg-white border border-slate-200 rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none text-slate-800 placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (brokerNote.trim() && activeConversation) {
                    sendMessage(activeConversation.id, `📝 NOTA INTERNA: ${brokerNote.trim()}`, true);
                    setBrokerNote('');
                  }
                }}
                disabled={!brokerNote.trim()}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-[11px] font-bold py-1.5 rounded-lg transition shadow-2xs"
              >
                Salvar Nota na Linha do Tempo
              </button>
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
