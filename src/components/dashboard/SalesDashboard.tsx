'use client';

import React, { useState } from 'react';
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
import { ContactUrgencyAnalysis } from '@/types/crm';

interface SalesDashboardProps {
  onOpenChat?: (contactId: string) => void;
  onNavigateToGoals?: () => void;
}

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
    proposals,
    currentUser,
    openChatForContact,
    getGoalsProgress,
    getUrgentContactsRadar
  } = useCRM();

  const [activeTableTab, setActiveTableTab] = useState<'ALL' | 'WHATSAPP' | 'DEALS' | 'WON'>('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(new Date().getDate());
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);

  const handleOpenGoals = () => {
    if (onNavigateToGoals) {
      onNavigateToGoals();
    } else {
      setIsGoalsModalOpen(true);
    }
  };

  // Motor de Metas & Acompanhamento
  const currentGoals = getGoalsProgress();

  // Métricas Principais
  const totalVGV = deals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
  const totalLeads = contacts.length;
  const wonDeals = deals.filter(d => d.status === 'WON');
  const wonVGV = wonDeals.reduce((acc, d) => acc + d.expectedValue, 0);

  // Meta Mensal Calculada pelo Motor de Metas
  const monthlyTargetVGV = currentGoals.monthlyVGV.target;
  const targetPercent = currentGoals.monthlyVGV.percentage;

  // Leads com Mensagem Não Respondida
  const unreadConversations = conversations.filter(c => (c.unreadCount || 0) > 0);

  // Radar de Inatividade & Pareamento Emergencial
  const urgentRadar = getUrgentContactsRadar();
  const criticalUnanswered = urgentRadar.filter(r => r.urgencyLevel === 'CRITICAL_UNANSWERED');
  const staleDeals = urgentRadar.filter(r => r.urgencyLevel === 'HIGH_STALE_DEAL');

  // Visitas & Tarefas Agendadas
  const pendingTasks = tasks.filter(t => !t.isCompleted);

  const handleGoToChat = (contactId?: string) => {
    if (!contactId) return;
    if (onOpenChat) onOpenChat(contactId);
    else openChatForContact(contactId);
  };

  // Filtragem da Tabela Soberana
  const filteredDealsList = deals.filter(deal => {
    const contact = contacts.find(c => c.id === deal.contactId);
    if (activeTableTab === 'WHATSAPP') {
      const conv = conversations.find(cv => cv.contactId === contact?.id);
      if (!conv) return false;
    } else if (activeTableTab === 'DEALS') {
      if (deal.status !== 'OPEN') return false;
    } else if (activeTableTab === 'WON') {
      if (deal.status !== 'WON') return false;
    }

    if (!tableSearch.trim()) return true;
    const term = tableSearch.toLowerCase();
    return (
      deal.title.toLowerCase().includes(term) ||
      contact?.name.toLowerCase().includes(term) ||
      contact?.phone.includes(term)
    );
  });

  // Dias do Mês para o Calendário Sovereign
  const currentMonthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

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
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              title="Ver detalhes do funil"
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
        
        {/* COLUNA ESQUERDA (8 COLUNAS): TABELA SOVEREIGN RECENT DEALS */}
        <div className="lg:col-span-8 sovereign-card p-6 sm:p-7 space-y-5">
          
          {/* Header da Tabela com Tabs em Pílula */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Recent Deals</h3>
              <p className="text-xs text-slate-400">Acompanhamento de oportunidades e clientes recentes</p>
            </div>

            {/* Pill Tabs Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-full border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTableTab('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeTableTab === 'ALL'
                    ? 'bg-[#3742AC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('WHATSAPP')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeTableTab === 'WHATSAPP'
                    ? 'bg-[#3742AC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('DEALS')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeTableTab === 'DEALS'
                    ? 'bg-[#3742AC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Deals
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('WON')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeTableTab === 'WON'
                    ? 'bg-[#3742AC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Closed Won
              </button>
            </div>
          </div>

          {/* Barra de Busca da Tabela */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nome ou imóvel..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-full pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
              />
            </div>

            <span className="text-xs font-semibold text-slate-400">
              {filteredDealsList.length} itens encontrados
            </span>
          </div>

          {/* Tabela de Dados Sovereign */}
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
                {filteredDealsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Nenhuma oportunidade encontrada nesta visualização.
                    </td>
                  </tr>
                ) : (
                  filteredDealsList.slice(0, 7).map((deal) => {
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
                              <span className="text-[10px] text-slate-400 font-mono">
                                {contact?.phone}
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

        </div>

        {/* COLUNA DIREITA (4 COLUNAS): GAUGE DE METAS + DARK CALENDAR WIDGET */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. GAUGE / RADIAL TARGET WIDGET (ESTILO SOVEREIGN) */}
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

          {/* 2. RADAR DE AÇÃO IMEDIATA / CONTATOS EMERGENCIAIS */}
          <div className="sovereign-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
                  Radar de Ação Imediata
                </h3>
                <p className="text-xs text-slate-400">Leads no vácuo e negociações esfriando</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                urgentRadar.length > 0 
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {urgentRadar.length > 0 ? `${urgentRadar.length} no Radar` : '100% em dia'}
              </span>
            </div>

            {urgentRadar.length === 0 ? (
              <div className="text-center py-5 px-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/60">
                <Check className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-emerald-900">Atendimento 100% em dia!</p>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">
                  Nenhum cliente sem resposta e nenhuma proposta esfriando no funil.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentRadar.slice(0, 4).map((item) => (
                  <div
                    key={item.contactId}
                    className={`p-3 rounded-2xl border transition flex flex-col gap-2 ${
                      item.urgencyLevel === 'CRITICAL_UNANSWERED'
                        ? 'bg-rose-50/60 border-rose-200/80 hover:bg-rose-50'
                        : item.urgencyLevel === 'HIGH_STALE_DEAL'
                        ? 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-50'
                        : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {item.contactName}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                            item.urgencyLevel === 'CRITICAL_UNANSWERED'
                              ? 'bg-rose-600 text-white'
                              : item.urgencyLevel === 'HIGH_STALE_DEAL'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {item.urgencyLevel === 'CRITICAL_UNANSWERED' ? '🚨 No Vácuo' : '⏱️ Esfriando'}
                          </span>
                        </div>
                        {item.dealTitle && (
                          <span className="text-[11px] text-slate-600 font-medium block truncate mt-0.5">
                            {item.dealTitle} • {item.stageName}
                          </span>
                        )}
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {item.urgencyReason}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGoToChat(item.contactId)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 transition shadow-2xs cursor-pointer active:scale-95"
                        title="Responder pelo WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Falar</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-200/40">
                      <span>Última interação: <strong className="text-slate-700">{item.formattedTimeAgo}</strong></span>
                      <span className="font-mono text-slate-500">{item.contactPhone}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. DARK ACCENT CALENDAR / SCHEDULE WIDGET (SOVEREIGN NAVY) */}
          <div className="sovereign-navy-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white">Calendar & Agenda</h3>
                <span className="text-[11px] text-indigo-200 capitalize">{currentMonthName}</span>
              </div>
              <span className="text-[10px] font-bold bg-white/10 text-indigo-100 px-2.5 py-1 rounded-full border border-white/10">
                Hoje • Dia {new Date().getDate()}
              </span>
            </div>

            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-indigo-300">
              <span>D</span>
              <span>S</span>
              <span>T</span>
              <span>Q</span>
              <span>Q</span>
              <span>S</span>
              <span>S</span>
            </div>

            {/* Grade de Dias Sovereign */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {daysInMonth.slice(0, 28).map((day) => {
                const isSelected = day === selectedCalendarDay;
                const isToday = day === new Date().getDate();
                const hasTask = day % 4 === 0;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedCalendarDay(day)}
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-semibold transition cursor-pointer text-[11px] mx-auto ${
                      isSelected
                        ? 'bg-[#3742AC] text-white font-bold ring-2 ring-indigo-400'
                        : isToday
                        ? 'bg-emerald-500 text-white font-bold'
                        : hasTask
                        ? 'bg-white/15 text-indigo-100 hover:bg-white/25'
                        : 'text-indigo-200 hover:bg-white/10'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Lista de Próxima Visita */}
            <div className="bg-white/10 rounded-2xl p-3 border border-white/10 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5" /> Visita de Hoje
                </span>
                <span className="font-mono text-indigo-200">14:30</span>
              </div>
              <p className="font-bold text-white truncate">
                {pendingTasks[0]?.title || 'Atendimento presencial • Cobertura Duplex'}
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Modal Motor de Metas & Performance */}
      <GoalsEngineModal
        isOpen={isGoalsModalOpen}
        onClose={() => setIsGoalsModalOpen(false)}
      />

    </div>
  );
}
