'use client';

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  X, 
  TrendingUp, 
  DollarSign, 
  Users, 
  ArrowRight, 
  ArrowDown, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Building2, 
  Filter, 
  ChevronRight, 
  Flame, 
  Layers,
  Award,
  Calendar,
  Share2,
  Maximize2
} from 'lucide-react';
import { formatCanonicalPhone } from '@/lib/whatsapp-filter';

interface SalesFunnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (contactId: string) => void;
  initialBrokerId?: string;
}

export function SalesFunnelModal({
  isOpen,
  onClose,
  onOpenChat,
  initialBrokerId
}: SalesFunnelModalProps) {
  const { 
    deals, 
    contacts, 
    currentPipeline, 
    users, 
    currentUser,
    openChatForContact 
  } = useCRM();

  const [selectedBrokerId, setSelectedBrokerId] = useState<string>(initialBrokerId || 'ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtra corretores ativos
  const brokers = useMemo(() => {
    return users.filter(u => u.isActive && (u.role === 'BROKER' || u.role === 'ADMIN' || u.role === 'MANAGER'));
  }, [users]);

  // Contatos comerciais (ignora contatos pessoais)
  const commercialContacts = useMemo(() => contacts.filter(c => !c.isPersonal), [contacts]);
  const commercialContactIds = useMemo(() => new Set(commercialContacts.map(c => c.id)), [commercialContacts]);

  // Negócios filtrados por corretor
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (!commercialContactIds.has(d.contactId)) return false;
      if (selectedBrokerId !== 'ALL' && d.assignedUserId !== selectedBrokerId) return false;
      return true;
    });
  }, [deals, commercialContactIds, selectedBrokerId]);

  // Etapas ordenadas do Pipeline
  const stages = useMemo(() => {
    return [...currentPipeline.stages].sort((a, b) => a.order - b.order);
  }, [currentPipeline]);

  // Métricas do Funil por Etapa
  const funnelStagesData = useMemo(() => {
    const totalDealsCount = filteredDeals.length || 1;
    let prevCount = 0;

    return stages.map((stage, index) => {
      const dealsInStage = filteredDeals.filter(d => d.stageId === stage.id);
      const count = dealsInStage.length;
      const vgv = dealsInStage.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
      const wonCount = dealsInStage.filter(d => d.status === 'WON').length;
      
      // Taxa de conversão para a etapa atual vs anterior
      const conversionRate = index === 0 ? 100 : prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
      prevCount = count || 1; // Salva para a próxima

      // Percentual relativo ao topo do funil
      const shareOfTop = Math.round((count / totalDealsCount) * 100);

      // Largura da barra do funil (entre 35% e 100% para manter elegância visual)
      const visualWidthPercent = Math.max(38, Math.min(100, 100 - (index * 12)));

      return {
        stage,
        count,
        vgv,
        wonCount,
        conversionRate,
        shareOfTop,
        visualWidthPercent,
        deals: dealsInStage,
      };
    });
  }, [stages, filteredDeals]);

  // KPIs Gerais do Funil
  const totalFunnelVGV = useMemo(() => {
    return filteredDeals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
  }, [filteredDeals]);

  const wonDeals = useMemo(() => filteredDeals.filter(d => d.status === 'WON'), [filteredDeals]);
  const wonVGV = useMemo(() => wonDeals.reduce((acc, d) => acc + d.expectedValue, 0), [wonDeals]);
  
  const overallConversionRate = useMemo(() => {
    if (filteredDeals.length === 0) return 0;
    return Math.round((wonDeals.length / filteredDeals.length) * 100);
  }, [filteredDeals, wonDeals]);

  const averageTicket = useMemo(() => {
    if (filteredDeals.length === 0) return 0;
    return Math.round(totalFunnelVGV / filteredDeals.length);
  }, [totalFunnelVGV, filteredDeals]);

  // Gargalo Detectado pela Inteligência
  const bottleneck = useMemo(() => {
    if (funnelStagesData.length < 2) return null;
    let worstDrop = 0;
    let bottleneckStage = null;

    for (let i = 1; i < funnelStagesData.length; i++) {
      const prev = funnelStagesData[i - 1];
      const curr = funnelStagesData[i];
      if (prev.count > 0) {
        const drop = prev.count - curr.count;
        if (drop > worstDrop) {
          worstDrop = drop;
          bottleneckStage = {
            from: prev.stage.name,
            to: curr.stage.name,
            dropCount: drop,
            retention: Math.round((curr.count / prev.count) * 100),
          };
        }
      }
    }
    return bottleneckStage;
  }, [funnelStagesData]);

  // Negócios da etapa selecionada no drill-down
  const activeStageDetails = useMemo(() => {
    if (!selectedStageId) {
      // Por padrão, se nada selecionado, foca na primeira etapa com negócios ou na primeira etapa
      return funnelStagesData.find(s => s.count > 0) || funnelStagesData[0];
    }
    return funnelStagesData.find(s => s.stage.id === selectedStageId) || funnelStagesData[0];
  }, [selectedStageId, funnelStagesData]);

  const handleGoToChat = (contactId?: string) => {
    if (!contactId) return;
    onClose();
    if (onOpenChat) onOpenChat(contactId);
    else openChatForContact(contactId);
  };

  const selectedBrokerName = useMemo(() => {
    if (selectedBrokerId === 'ALL') return 'Toda a Equipe';
    const b = users.find(u => u.id === selectedBrokerId);
    return b?.name || 'Corretor';
  }, [selectedBrokerId, users]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* HEADER EXECUTIVO                                                          */}
        {/* ========================================================================= */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#3742AC] text-white flex items-center justify-center shadow-md shadow-indigo-900/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Funil de Vendas & Performance
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-[#3742AC] border border-indigo-200 uppercase tracking-wider">
                  Visão Executiva
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Andamento da esteira comercial, taxas de passagem entre etapas e conversão do corretor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Corretor */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedBrokerId}
                onChange={(e) => setSelectedBrokerId(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer pr-2"
              >
                <option value="ALL">👥 Todos os Corretores</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    👤 {broker.name} ({broker.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Período */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setSelectedPeriod('MONTH')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedPeriod === 'MONTH' ? 'bg-white text-[#3742AC] shadow-2xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('QUARTER')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedPeriod === 'QUARTER' ? 'bg-white text-[#3742AC] shadow-2xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Trimestre
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('YEAR')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedPeriod === 'YEAR' ? 'bg-white text-[#3742AC] shadow-2xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Ano
              </button>
            </div>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CORPO DO MODAL                                                            */}
        {/* ========================================================================= */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          
          {/* CARDS DE KPIS DO FUNIL */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Card 1: VGV Total no Funil */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#3742AC]" />
                Volume Total no Funil
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                R$ {totalFunnelVGV.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10.5px] font-semibold text-slate-500 block">
                {filteredDeals.length} oportunidades mapeadas
              </span>
            </div>

            {/* Card 2: VGV Convertido / Ganho */}
            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                VGV Fechado
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight">
                R$ {wonVGV.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10.5px] font-semibold text-emerald-600 block">
                {wonDeals.length} contratos assinados
              </span>
            </div>

            {/* Card 3: Taxa de Conversão Global */}
            <div className="bg-indigo-50/40 rounded-2xl p-4 border border-indigo-100 space-y-1">
              <span className="text-[11px] font-bold text-[#3742AC] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#3742AC]" />
                Conversão do Funil
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#3742AC] font-mono tracking-tight">
                {overallConversionRate}%
              </div>
              <span className="text-[10.5px] font-semibold text-slate-500 block">
                Média do mercado: 18% a 25%
              </span>
            </div>

            {/* Card 4: Ticket Médio */}
            <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100 space-y-1">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                Ticket Médio por Negócio
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                R$ {averageTicket.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10.5px] font-semibold text-slate-500 block">
                {selectedBrokerName}
              </span>
            </div>

          </div>

          {/* ALERTA DE INTELIGÊNCIA COMERCIAL: GARGALO IDENTIFICADO */}
          {bottleneck && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-transparent border border-amber-200/80 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Flame className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                  <span>Diagnóstico de Fricção no Funil:</span>
                  <span className="bg-amber-200/80 text-amber-800 text-[10px] px-2 py-0.2 rounded-full font-bold">
                    Ação Recomendada
                  </span>
                </h4>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  O maior ponto de retenção/desaceleração está entre as etapas <strong>{bottleneck.from}</strong> e <strong>{bottleneck.to}</strong>. 
                  Houve uma queda de <strong>{bottleneck.dropCount} negociações</strong> (taxa de passagem de apenas {bottleneck.retention}%). 
                  Revise os follow-ups e objeções dos clientes parados nessa etapa.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEÇÃO PRINCIPAL: FUNIL VISUAL (ESQUERDA) + DRILLDOWN DA ETAPA (DIREITA)   */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUNA ESQUERDA: VISUALIZADOR DE FUNIL ESCALONADO (7 COLUNAS) */}
            <div className="lg:col-span-7 bg-slate-50/60 rounded-3xl p-6 border border-slate-200/70 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#3742AC]" />
                    <span>Estrutura Visual do Funil</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Clique em qualquer etapa para auditar os negócios correspondentes
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                  {stages.length} Etapas
                </span>
              </div>

              {/* BARRAS DO FUNIL ESCALONADO */}
              <div className="space-y-3 pt-2">
                {funnelStagesData.map((stageData, idx) => {
                  const isSelected = activeStageDetails.stage.id === stageData.stage.id;
                  const isWon = stageData.stage.isWon;
                  const isLost = stageData.stage.isLost;

                  // Gradiente e cor da etapa
                  const bgGradient = isWon 
                    ? 'from-emerald-600 to-teal-500 text-white' 
                    : isLost
                    ? 'from-rose-500 to-red-600 text-white'
                    : idx === 0
                    ? 'from-[#3742AC] to-indigo-600 text-white'
                    : idx === 1
                    ? 'from-indigo-600 to-blue-600 text-white'
                    : idx === 2
                    ? 'from-blue-600 to-cyan-600 text-white'
                    : idx === 3
                    ? 'from-cyan-600 to-teal-600 text-white'
                    : 'from-slate-700 to-slate-800 text-white';

                  return (
                    <div key={stageData.stage.id} className="space-y-1.5">
                      
                      {/* Barra do Funil com Formato Trapezoidal / Centralizada */}
                      <div 
                        className="flex justify-center cursor-pointer group"
                        onClick={() => setSelectedStageId(stageData.stage.id)}
                      >
                        <div 
                          style={{ width: `${stageData.visualWidthPercent}%` }}
                          className={`relative rounded-2xl p-3.5 transition-all duration-300 shadow-sm flex items-center justify-between gap-3 ${
                            isSelected 
                              ? 'ring-4 ring-indigo-400/50 scale-[1.02] shadow-lg' 
                              : 'hover:scale-[1.01] hover:shadow-md'
                          } bg-gradient-to-r ${bgGradient}`}
                        >
                          {/* Nome da Etapa e Ordem */}
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="truncate text-left">
                              <span className="font-extrabold text-xs block truncate leading-tight">
                                {stageData.stage.name}
                              </span>
                              <span className="text-[10px] text-white/80 font-mono">
                                R$ {(stageData.vgv / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                              </span>
                            </div>
                          </div>

                          {/* Indicador de Quantidade */}
                          <div className="text-right shrink-0">
                            <span className="text-base font-black font-mono block leading-tight">
                              {stageData.count}
                            </span>
                            <span className="text-[9.5px] uppercase font-bold text-white/70 block">
                              negócios
                            </span>
                          </div>

                          {/* Indicador de Seleção Ativa */}
                          {isSelected && (
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-white shadow-xs" />
                          )}
                        </div>
                      </div>

                      {/* Conector e Taxa de Passagem para a Próxima Etapa */}
                      {idx < funnelStagesData.length - 1 && (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 py-0.5">
                          <ArrowDown className="w-3 h-3 text-slate-400" />
                          <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 font-mono">
                            Conversão: {funnelStagesData[idx + 1].conversionRate}%
                          </span>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUNA DIREITA: DRILLDOWN DA ETAPA SELECIONADA (5 COLUNAS) */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              
              {/* Header da Etapa Selecionada */}
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Etapa Selecionada
                  </span>
                  <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>{activeStageDetails.stage.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-[#3742AC] font-bold font-mono">
                      {activeStageDetails.count} leads
                    </span>
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">VGV Acumulado</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    R$ {activeStageDetails.vgv.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Lista dos Negócios nesta Etapa */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {activeStageDetails.deals.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold">Nenhum negócio ativo nesta etapa no momento.</p>
                  </div>
                ) : (
                  activeStageDetails.deals.map((deal) => {
                    const contact = contacts.find(c => c.id === deal.contactId);
                    const broker = users.find(u => u.id === deal.assignedUserId);

                    return (
                      <div
                        key={deal.id}
                        onClick={() => handleGoToChat(contact?.id)}
                        className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-200 transition cursor-pointer group space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate">
                            <h5 className="font-bold text-xs text-slate-900 group-hover:text-[#3742AC] transition truncate">
                              {deal.title}
                            </h5>
                            <span className="text-[10.5px] text-slate-500 font-mono font-bold block">
                              R$ {deal.expectedValue.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGoToChat(contact?.id);
                            }}
                            className="p-1.5 rounded-xl bg-white group-hover:bg-[#3742AC] text-slate-400 group-hover:text-white border border-slate-200 group-hover:border-[#3742AC] transition shrink-0 shadow-2xs"
                            title="Conversar no WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Dados do Lead */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50">
                          <div className="flex items-center gap-1.5 truncate">
                            <img
                              src={contact?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(contact?.name || 'Cliente')}
                              alt={contact?.name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200"
                            />
                            <span className="font-semibold text-slate-700 truncate max-w-[140px]">
                              {contact?.name || 'Lead'}
                            </span>
                          </div>

                          <span className="text-[10px] font-medium text-slate-400 font-mono">
                            {broker?.name.split(' ')[0] || 'Corretor'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* FOOTER DO MODAL                                                           */}
        {/* ========================================================================= */}
        <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Dados sincronizados em tempo real com o WhatsApp e Pipeline</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-bold hover:bg-slate-200/60 transition cursor-pointer"
            >
              Fechar Apresentação
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
