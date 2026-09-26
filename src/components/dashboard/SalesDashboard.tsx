'use client';

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  Trophy, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Sparkles,
  Wifi,
  MessageSquare,
  Calendar as CalendarIcon,
  ArrowRight,
  ArrowUpRight,
  Flame,
  FileText,
  Target,
  Check,
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Phone,
  Sliders
} from 'lucide-react';
import { GoalsEngineModal } from './GoalsEngineModal';
import { SalesFunnelModal } from './SalesFunnelModal';
import { ContactUrgencyAnalysis } from '@/types/crm';
import { isWhatsAppChannelOrGroup, formatCanonicalPhone } from '@/lib/whatsapp-filter';

interface SalesDashboardProps {
  onOpenChat?: (contactId: string) => void;
  onNavigateToGoals?: () => void;
}

export type TableTab = 'RADAR_ALL' | 'RADAR_VACUO' | 'RADAR_STALE' | 'DEALS';

export function SalesDashboard({ onOpenChat, onNavigateToGoals }: SalesDashboardProps) {
  const { 
    contacts, 
    deals, 
    currentPipeline, 
    users, 
    instances, 
    currentTenant, 
    conversations, 
    tasks, 
    toggleTask,
    proposals,
    currentUser,
    openChatForContact,
    getGoalsProgress,
    getUrgentContactsRadar
  } = useCRM();

  const [activeTableTab, setActiveTableTab] = useState<TableTab>('RADAR_ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 8;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);

  const handleOpenGoals = () => {
    if (onNavigateToGoals) {
      onNavigateToGoals();
    } else {
      setIsGoalsModalOpen(true);
    }
  };

  const handleTabChange = (tab: TableTab) => {
    setActiveTableTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setTableSearch(val);
    setCurrentPage(1);
  };

  // Motor de Metas & Acompanhamento
  const currentGoals = useMemo(() => getGoalsProgress(), [getGoalsProgress, deals]);

  // Métricas Principais (Exclusivo para Leads Comerciais - ignora contatos pessoais)
  const commercialContacts = useMemo(() => contacts.filter(c => !c.isPersonal), [contacts]);
  const commercialContactIds = useMemo(() => new Set(commercialContacts.map(c => c.id)), [commercialContacts]);

  const commercialDeals = useMemo(() => deals.filter(d => commercialContactIds.has(d.contactId)), [deals, commercialContactIds]);
  const totalVGV = useMemo(() => commercialDeals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0), [commercialDeals]);
  const totalLeads = commercialContacts.length;
  const wonDeals = useMemo(() => commercialDeals.filter(d => d.status === 'WON'), [commercialDeals]);
  const wonVGV = useMemo(() => wonDeals.reduce((acc, d) => acc + d.expectedValue, 0), [wonDeals]);

  // Meta Mensal Calculada pelo Motor de Metas
  const monthlyTargetVGV = currentGoals.monthlyVGV.target;
  const targetPercent = currentGoals.monthlyVGV.percentage;

  // Leads com Mensagem Não Respondida (Apenas Comerciais e Não Arquivadas)
  const unreadConversations = useMemo(() => conversations.filter(c => 
    (c.unreadCount || 0) > 0 && 
    commercialContactIds.has(c.contactId) && 
    !c.isPersonal && 
    !c.isArchived && 
    !isWhatsAppChannelOrGroup(c)
  ), [conversations, commercialContactIds]);

  // Radar de Inatividade & Pareamento Emergencial
  const urgentRadar = useMemo(() => getUrgentContactsRadar(), [getUrgentContactsRadar, conversations, deals, contacts]);
  const criticalUnanswered = useMemo(() => urgentRadar.filter(r => r.urgencyLevel === 'CRITICAL_UNANSWERED'), [urgentRadar]);
  const staleDeals = useMemo(() => urgentRadar.filter(r => r.urgencyLevel === 'HIGH_STALE_DEAL'), [urgentRadar]);

  // Visitas & Tarefas Agendadas
  const pendingTasks = useMemo(() => tasks.filter(t => !t.isCompleted), [tasks]);

  const handleGoToChat = (contactId?: string) => {
    if (!contactId) return;
    if (onOpenChat) onOpenChat(contactId);
    else openChatForContact(contactId);
  };

  // Filtragem da Lista do Radar
  const filteredRadarList = useMemo(() => {
    let list = urgentRadar;
    if (activeTableTab === 'RADAR_VACUO') {
      list = criticalUnanswered;
    } else if (activeTableTab === 'RADAR_STALE') {
      list = staleDeals;
    }

    if (!tableSearch.trim()) return list;
    const term = tableSearch.toLowerCase();
    return list.filter(item => 
      item.contactName.toLowerCase().includes(term) ||
      item.contactPhone.includes(term) ||
      (item.dealTitle && item.dealTitle.toLowerCase().includes(term)) ||
      item.urgencyReason.toLowerCase().includes(term)
    );
  }, [urgentRadar, criticalUnanswered, staleDeals, activeTableTab, tableSearch]);

  // Filtragem da Lista de Oportunidades (Apenas Comerciais)
  const filteredDealsList = useMemo(() => {
    if (!tableSearch.trim()) return commercialDeals;
    const term = tableSearch.toLowerCase();
    return commercialDeals.filter(deal => {
      const contact = contacts.find(c => c.id === deal.contactId);
      return (
        deal.title.toLowerCase().includes(term) ||
        contact?.name.toLowerCase().includes(term) ||
        (contact?.phone && (
          contact.phone.toLowerCase().includes(term) ||
          formatCanonicalPhone(contact.phone).toLowerCase().includes(term)
        ))
      );
    });
  }, [commercialDeals, contacts, tableSearch]);

  // Paginação Inteligente
  const isRadarMode = activeTableTab !== 'DEALS';
  const totalItems = isRadarMode ? filteredRadarList.length : filteredDealsList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRadarList = filteredRadarList.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);
  const paginatedDealsList = filteredDealsList.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);

  // Navegação Interativa da Agenda do Dia
  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  const selectedDateISO = selectedDate.toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);
  const isToday = selectedDateISO === todayISO;

  const formattedDayTitle = useMemo(() => {
    const dayNumber = selectedDate.getDate();
    const monthLong = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
    const weekday = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    
    if (isToday) return `Hoje • ${dayNumber} de ${monthLong}`;
    return `${capWeekday}, ${dayNumber} de ${monthLong}`;
  }, [selectedDate, isToday]);

  // Tarefas filtradas para o dia selecionado
  const dayTasks = useMemo(() => {
    const list = tasks.filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate.slice(0, 10) === selectedDateISO;
    });

    if (list.length > 0) return list;

    // Se for o dia de hoje e não houver tarefas com dueDate exato de hoje, exibe tarefas pendentes reais da equipe
    if (isToday && tasks.length > 0) {
      return tasks.slice(0, 5);
    }
    return [];
  }, [tasks, selectedDateISO, isToday]);

  // Resumo do Funil de Vendas para o Dashboard
  const funnelStages = useMemo(() => {
    const sorted = [...currentPipeline.stages].sort((a, b) => a.order - b.order);
    const totalDeals = commercialDeals.length || 1;
    return sorted.map((stage) => {
      const dealsInStage = commercialDeals.filter(d => d.stageId === stage.id);
      const vgv = dealsInStage.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
      return {
        stage,
        count: dealsInStage.length,
        vgv,
        percent: Math.round((dealsInStage.length / totalDeals) * 100),
      };
    });
  }, [currentPipeline, commercialDeals]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-5rem)] overflow-y-auto bg-[#F0F3FA] p-6 sm:p-8 space-y-6">
      
      {/* ========================================================================= */}
      {/* LINHA SUPERIOR: TOP METRIC CARDS (ESTILO SOVEREIGN)                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: VGV em Funil */}
        <div className="sovereign-card-interactive p-6 relative flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <button 
              type="button" 
              onClick={() => setIsFunnelModalOpen(true)}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-[#3742AC] flex items-center justify-center transition cursor-pointer"
              title="Ver apresentação do funil de vendas"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Volume em Negociação
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
              R$ {totalVGV.toLocaleString('pt-BR')}
            </h3>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
            <span className="flex items-center gap-1 font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" /> {deals.length} oportunidades ativas
            </span>
            <span>Funil de Vendas</span>
          </div>
        </div>

        {/* Card 2: Contratos Fechados */}
        <div className="sovereign-card-interactive p-6 relative flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
              <Trophy className="w-5 h-5" />
            </div>
            <button 
              type="button" 
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              title="Ver contratos fechados"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Contratos Fechados (VGV)
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
              R$ {wonVGV.toLocaleString('pt-BR')}
            </h3>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
            <span className="font-bold text-[#3742AC]">
              {wonDeals.length} negócios convertidos
            </span>
            <span>Taxa de Fechamento: 28%</span>
          </div>
        </div>

        {/* Card 3: Base de Leads & WhatsApp */}
        <div className="sovereign-card-interactive p-6 relative flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <button 
              type="button" 
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              title="Ver leads do WhatsApp"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Leads & Clientes Ativos
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
              {totalLeads}
            </h3>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
            {urgentRadar.length > 0 ? (
              <span className="flex items-center gap-1.5 text-rose-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>{urgentRadar.length} no radar de inatividade ({criticalUnanswered.length} no vácuo)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <Check className="w-3.5 h-3.5" /> Atendimento 100% em dia
              </span>
            )}
            <span className="font-mono text-[10px] text-slate-400">Z-API Live</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO PRINCIPAL: TABELA RECENT DEALS (ESQUERDA) + WIDGETS (DIREITA)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA (8 COLUNAS): RADAR DE AÇÃO IMEDIATA (SOBERANIA OPERACIONAL) */}
        <div className="lg:col-span-8 sovereign-card p-6 sm:p-7 space-y-5">
          
          {/* Header da Tabela com Tabs em Pílula */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600 animate-pulse" />
                <span>Radar de Ação Imediata</span>
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhamento prioritário de clientes no vácuo, negociações esfriando e SLAs críticos
              </p>
            </div>

            {/* Pill Tabs Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-full border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleTabChange('RADAR_ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTableTab === 'RADAR_ALL'
                    ? 'bg-[#3742AC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🚨 Todos no Radar</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTableTab === 'RADAR_ALL' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  {urgentRadar.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('RADAR_VACUO')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTableTab === 'RADAR_VACUO'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🔴 No Vácuo</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTableTab === 'RADAR_VACUO' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  {criticalUnanswered.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('RADAR_STALE')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTableTab === 'RADAR_STALE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⚠️ Esfriando</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTableTab === 'RADAR_STALE' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {staleDeals.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('DEALS')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTableTab === 'DEALS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>💼 Recent Deals</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTableTab === 'DEALS' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {deals.length}
                </span>
              </button>
            </div>
          </div>

          {/* Barra de Busca e Paginação da Tabela */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isRadarMode ? "Buscar por lead, telefone ou motivo..." : "Buscar oportunidade ou lead..."}
                value={tableSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-full pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <span>
                Mostrando <strong className="text-slate-900">{totalItems === 0 ? 0 : (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}</strong>-
                <strong className="text-slate-900">{Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalItems)}</strong> de <strong className="text-slate-900">{totalItems}</strong>
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-[11px] font-mono px-1">
                    {safeCurrentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Dados: Modo Radar vs Modo Deals */}
          {isRadarMode ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-2">Cliente / Lead</th>
                    <th className="py-3 px-2">Gravidade & Tempo</th>
                    <th className="py-3 px-2">Diagnóstico & Sugestão</th>
                    <th className="py-3 px-2">Oportunidade / Funil</th>
                    <th className="py-3 px-2">Corretor</th>
                    <th className="py-3 px-2 text-right">Ação Imediata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paginatedRadarList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="max-w-xs mx-auto text-center space-y-1">
                          <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          <p className="font-bold text-slate-700">Tudo em dia!</p>
                          <p className="text-[11px] text-slate-400">Nenhum cliente necessita de ação imediata nesta visualização.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRadarList.map((item) => {
                      const contact = contacts.find(c => c.id === item.contactId);
                      const broker = users.find(u => u.id === item.assignedUserId);

                      return (
                        <tr
                          key={item.contactId}
                          className={`transition cursor-pointer group ${
                            item.urgencyLevel === 'CRITICAL_UNANSWERED'
                              ? 'bg-rose-50/40 hover:bg-rose-50/80'
                              : item.urgencyLevel === 'HIGH_STALE_DEAL'
                              ? 'bg-amber-50/30 hover:bg-amber-50/70'
                              : 'hover:bg-slate-50/80'
                          }`}
                          onClick={() => handleGoToChat(item.contactId)}
                        >
                          {/* Cliente / Lead */}
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={contact?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.contactName)}
                                alt={item.contactName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 ring-1 ring-white shrink-0"
                              />
                              <div>
                                <span className="font-bold text-slate-900 group-hover:text-[#3742AC] transition block truncate max-w-[140px]">
                                  {item.contactName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {item.contactPhone}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Gravidade & Tempo */}
                          <td className="py-3.5 px-2">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                item.urgencyLevel === 'CRITICAL_UNANSWERED'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : item.urgencyLevel === 'HIGH_STALE_DEAL'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {item.urgencyLevel === 'CRITICAL_UNANSWERED' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                )}
                                {item.urgencyLevel === 'CRITICAL_UNANSWERED' ? '🚨 No Vácuo' : '⏱️ Esfriando'}
                              </span>
                              <p className="text-[10.5px] font-bold text-slate-700">
                                {item.formattedTimeAgo}
                              </p>
                            </div>
                          </td>

                          {/* Diagnóstico & Sugestão */}
                          <td className="py-3.5 px-2 max-w-[210px]">
                            <p className="font-semibold text-slate-800 text-[11px] truncate">
                              {item.urgencyReason}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              👉 {item.suggestedAction}
                            </p>
                          </td>

                          {/* Oportunidade / Funil */}
                          <td className="py-3.5 px-2">
                            {item.dealTitle ? (
                              <div>
                                <span className="font-bold text-slate-900 block truncate max-w-[130px] text-[11.5px]">
                                  {item.dealTitle}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {item.stageName || 'Funil'} {item.dealValue ? `• R$ ${item.dealValue.toLocaleString('pt-BR')}` : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Contato WhatsApp</span>
                            )}
                          </td>

                          {/* Corretor */}
                          <td className="py-3.5 px-2 text-slate-600 font-medium">
                            {broker?.name.split(' ')[0] || 'Corretor'}
                          </td>

                          {/* Ação Imediata */}
                          <td className="py-3.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGoToChat(item.contactId);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto shadow-2xs transition cursor-pointer active:scale-95"
                              title="Responder pelo WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Falar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-2">Negócio / Oportunidade</th>
                    <th className="py-3 px-2">Cliente / Lead</th>
                    <th className="py-3 px-2">Corretor</th>
                    <th className="py-3 px-2">Valor (R$)</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paginatedDealsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        Nenhuma oportunidade encontrada nesta visualização.
                      </td>
                    </tr>
                  ) : (
                    paginatedDealsList.map((deal) => {
                      const contact = contacts.find(c => c.id === deal.contactId);
                      const broker = users.find(u => u.id === deal.assignedUserId);
                      const stage = currentPipeline.stages.find(s => s.id === deal.stageId);

                      return (
                        <tr 
                          key={deal.id}
                          className="hover:bg-slate-50/80 transition cursor-pointer group"
                          onClick={() => handleGoToChat(contact?.id)}
                        >
                          <td className="py-3.5 px-2">
                            <div className="font-bold text-slate-900 group-hover:text-[#3742AC] transition">
                              {deal.title}
                            </div>
                            <span className="text-[10.5px] text-slate-400">
                              {stage?.name || 'Em atendimento'}
                            </span>
                          </td>

                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={contact?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(contact?.name || 'Cliente')}
                                alt={contact?.name}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                              />
                              <div>
                                <span className="font-semibold text-slate-800 block truncate max-w-[130px]">
                                  {contact?.name || 'Lead WhatsApp'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono font-medium">
                                  {formatCanonicalPhone(contact?.phone)}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-2 text-slate-600 font-medium">
                            {broker?.name.split(' ')[0] || 'Corretor'}
                          </td>

                          <td className="py-3.5 px-2 font-mono font-bold text-slate-900">
                            R$ {deal.expectedValue.toLocaleString('pt-BR')}
                          </td>

                          <td className="py-3.5 px-2">
                            {deal.status === 'WON' ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Fechado</span>
                              </span>
                            ) : deal.status === 'LOST' ? (
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full w-fit block">
                                Perdido
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-indigo-50 text-[#3742AC] border border-indigo-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#3742AC] animate-pulse" />
                                <span>Ativo</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGoToChat(contact?.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#3742AC] hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                              title="Abrir no WhatsApp"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* COLUNA DIREITA (4 COLUNAS): GAUGE DE METAS + DARK CALENDAR WIDGET */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. FUNIL DE VENDAS DO CORRETOR (WIDGET COMPACTO - NO TOPO) */}
          <div className="sovereign-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#3742AC]" />
                  Funil de Vendas & Esteira
                </h3>
                <p className="text-xs text-slate-400">
                  {commercialDeals.length} oportunidades • R$ {(totalVGV / 1000000).toFixed(1)}M VGV
                </p>
              </div>

              <button 
                type="button" 
                onClick={() => setIsFunnelModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#3742AC] bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                title="Abrir Apresentação do Funil"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Expandir</span>
              </button>
            </div>

            {/* Mini visualizador de funil em barras decrescentes */}
            <div className="space-y-2 pt-1">
              {funnelStages.slice(0, 5).map((item, idx) => {
                const colors = [
                  'bg-[#3742AC] text-white',
                  'bg-indigo-600 text-white',
                  'bg-blue-600 text-white',
                  'bg-cyan-600 text-white',
                  'bg-emerald-600 text-white'
                ];
                const colorClass = item.stage.isWon ? 'bg-emerald-600 text-white' : item.stage.isLost ? 'bg-rose-600 text-white' : colors[idx % colors.length];

                return (
                  <div 
                    key={item.stage.id} 
                    className="space-y-1 cursor-pointer group"
                    onClick={() => setIsFunnelModalOpen(true)}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 group-hover:text-[#3742AC] transition truncate max-w-[170px]">
                        {item.stage.name}
                      </span>
                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="text-[10px] text-slate-400">
                          R$ {(item.vgv / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                        </span>
                        <span className="font-extrabold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded-md text-[11px]">
                          {item.count}
                        </span>
                      </div>
                    </div>
                    {/* Barra de progresso visual */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                        style={{ width: `${Math.max(6, item.percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botão de Apresentação Completa */}
            <button
              type="button"
              onClick={() => setIsFunnelModalOpen(true)}
              className="w-full py-2 px-3 bg-gradient-to-r from-indigo-50/80 to-slate-50 hover:from-indigo-100 hover:to-indigo-50 border border-indigo-100/80 rounded-xl text-xs font-bold text-[#3742AC] transition flex items-center justify-center gap-2 group cursor-pointer shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-[#3742AC] group-hover:scale-110 transition-transform" />
              <span>Ver Apresentação Executiva do Funil</span>
              <ChevronRight className="w-3 h-3 text-[#3742AC] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* 2. GAUGE / RADIAL TARGET WIDGET (METAS & PERFORMANCE) */}
          <div className="sovereign-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[#3742AC]" />
                  Metas & Performance
                </h3>
                <p className="text-xs text-slate-400 capitalize">
                  {currentGoals.monthName} • Meta R$ {(currentGoals.monthlyVGV.target / 1000000).toFixed(1)}M
                </p>
              </div>
              <button 
                type="button" 
                onClick={handleOpenGoals}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#3742AC] bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                title="Configurar Metas"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configurar</span>
              </button>
            </div>

            {/* Semicircular Radial Progress */}
            <div 
              className="relative flex flex-col items-center justify-center py-2 cursor-pointer group"
              onClick={handleOpenGoals}
              title="Clique para abrir o painel de metas"
            >
              <svg className="w-48 h-28 group-hover:scale-105 transition-transform" viewBox="0 0 100 55">
                {/* Arco de fundo */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Arco de progresso */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={
                    targetPercent >= 100 ? '#10B981' :
                    targetPercent >= 70 ? '#3742AC' :
                    targetPercent >= 40 ? '#F59E0B' : '#EF4444'
                  }
                  strokeWidth="8"
                  strokeDasharray="126"
                  strokeDashoffset={Math.max(0, 126 - (126 * Math.min(targetPercent, 100)) / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Porcentagem no Centro */}
              <div className="text-center -mt-6">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {targetPercent}%
                </span>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                  Progresso VGV
                </span>
                <span className="text-[11px] font-bold text-slate-700 font-mono">
                  R$ {(currentGoals.monthlyVGV.achieved / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k / R$ {(currentGoals.monthlyVGV.target / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>

            {/* 3 Mini Indicadores Circulares Sovereign */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
              <div 
                className="p-2 rounded-2xl bg-orange-50/60 border border-orange-100/60 cursor-pointer hover:bg-orange-100/60 transition"
                onClick={handleOpenGoals}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mx-auto block mb-1" />
                <span className="text-xs font-bold text-slate-900 font-mono block">
                  {currentGoals.leads.achieved} / {currentGoals.leads.target}
                </span>
                <span className="text-[9px] text-slate-500 font-medium">Leads ({currentGoals.leads.percentage}%)</span>
              </div>

              <div 
                className="p-2 rounded-2xl bg-indigo-50/60 border border-indigo-100/60 cursor-pointer hover:bg-indigo-100/60 transition"
                onClick={handleOpenGoals}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#3742AC] mx-auto block mb-1" />
                <span className="text-xs font-bold text-slate-900 font-mono block">
                  {currentGoals.clients.achieved} / {currentGoals.clients.target}
                </span>
                <span className="text-[9px] text-slate-500 font-medium">Clientes ({currentGoals.clients.percentage}%)</span>
              </div>

              <div 
                className="p-2 rounded-2xl bg-emerald-50/60 border border-emerald-100/60 cursor-pointer hover:bg-emerald-100/60 transition"
                onClick={handleOpenGoals}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto block mb-1" />
                <span className="text-xs font-bold text-slate-900 font-mono block">
                  {currentGoals.wonDeals.achieved} / {currentGoals.wonDeals.target}
                </span>
                <span className="text-[9px] text-slate-500 font-medium">Vendas ({currentGoals.wonDeals.percentage}%)</span>
              </div>
            </div>

            {/* Botão de Ação Direta */}
            <button
              type="button"
              onClick={handleOpenGoals}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-200 rounded-xl text-xs font-bold text-slate-700 hover:text-[#3742AC] transition flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-[#3742AC] group-hover:scale-110 transition-transform" />
              <span>Abrir Motor de Metas no Menu</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-[#3742AC]" />
            </button>
          </div>

          {/* 3. AGENDA & APRESENTAÇÃO DO DIA COM NAVEGAÇÃO POR SETAS */}
          <div className="sovereign-navy-card p-6 space-y-4">
            
            {/* Header da Agenda com Navegador de Datas por Setas */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Dia Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Próximo Dia"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center truncate">
                <h3 className="text-xs font-extrabold text-white truncate">
                  {formattedDayTitle}
                </h3>
                <span className="text-[10px] text-indigo-200">
                  {dayTasks.length} {dayTasks.length === 1 ? 'compromisso' : 'compromissos'}
                </span>
              </div>

              {!isToday ? (
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-[#3742AC] hover:bg-indigo-600 text-white transition cursor-pointer"
                >
                  Hoje
                </button>
              ) : (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Hoje
                </span>
              )}
            </div>

            {/* Lista de Apresentação dos Compromissos do Dia */}
            <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
              {dayTasks.length === 0 ? (
                <div className="py-8 text-center text-indigo-200/70 space-y-1.5">
                  <CalendarIcon className="w-7 h-7 text-indigo-300/50 mx-auto" />
                  <p className="text-xs font-semibold text-white">Nenhum compromisso agendado.</p>
                  <p className="text-[10px] text-indigo-300">Agenda livre para prospecção ou follow-up no WhatsApp!</p>
                </div>
              ) : (
                dayTasks.map((task) => {
                  const contact = contacts.find(c => c.id === task.contactId);
                  const isCompleted = task.isCompleted;

                  // Tipagem e Ícone
                  const isVisit = task.taskType === 'VISIT';
                  const isWhatsApp = task.taskType === 'WHATSAPP';
                  const isCall = task.taskType === 'CALL';
                  const isProposal = task.taskType === 'PROPOSAL';

                  const badgeColor = isVisit 
                    ? 'bg-amber-400/20 text-amber-200 border-amber-400/30'
                    : isProposal
                    ? 'bg-purple-400/20 text-purple-200 border-purple-400/30'
                    : isWhatsApp
                    ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30'
                    : 'bg-indigo-400/20 text-indigo-200 border-indigo-400/30';

                  const typeLabel = isVisit 
                    ? '🏠 Visita' 
                    : isProposal 
                    ? '📄 Proposta' 
                    : isWhatsApp 
                    ? '💬 WhatsApp' 
                    : '📞 Ligação';

                  // Extrai horário se presente
                  const time = task.dueDate?.includes('T') ? task.dueDate.split('T')[1]?.slice(0, 5) : '14:00';

                  return (
                    <div 
                      key={task.id}
                      className={`p-3 rounded-xl border transition flex items-start justify-between gap-2.5 ${
                        isCompleted
                          ? 'bg-white/5 border-white/5 opacity-60'
                          : 'bg-white/10 hover:bg-white/15 border-white/10'
                      }`}
                    >
                      {/* Checkbox para Concluir */}
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center border transition shrink-0 cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-400 text-white'
                            : 'border-white/30 hover:border-white text-transparent'
                        }`}
                        title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluído'}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>

                      {/* Informações da Tarefa */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-bold border ${badgeColor}`}>
                            {typeLabel}
                          </span>
                          <span className="text-[10px] font-mono text-indigo-200 font-semibold">
                            {time}
                          </span>
                        </div>

                        <p className={`text-xs font-bold truncate leading-tight ${isCompleted ? 'line-through text-indigo-200' : 'text-white'}`}>
                          {task.title}
                        </p>

                        {contact && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] text-indigo-200 truncate">
                              Lead: <strong className="text-white font-medium">{contact.name}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Botão de Ação Rápida WhatsApp */}
                      {contact && (
                        <button
                          type="button"
                          onClick={() => handleGoToChat(contact.id)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-emerald-600 text-white transition shrink-0 cursor-pointer"
                          title="Falar no WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Modal Motor de Metas & Performance */}
      <GoalsEngineModal
        isOpen={isGoalsModalOpen}
        onClose={() => setIsGoalsModalOpen(false)}
      />

      {/* Modal de Apresentação Executiva do Funil de Vendas */}
      <SalesFunnelModal
        isOpen={isFunnelModalOpen}
        onClose={() => setIsFunnelModalOpen(false)}
        onOpenChat={onOpenChat}
      />

    </div>
  );
}
