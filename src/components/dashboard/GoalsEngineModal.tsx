'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Target, 
  Trophy, 
  TrendingUp, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Save, 
  Copy, 
  Sparkles, 
  ArrowUpRight,
  Flame,
  Check,
  Edit3,
  BarChart3
} from 'lucide-react';
import { useCRM } from '@/lib/crm-context';
import { MonthlyGoal, GoalProgressItem } from '@/types/crm';

interface GoalsEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonthKey?: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function GoalsEngineModal({ isOpen, onClose, initialMonthKey }: GoalsEngineModalProps) {
  const { 
    currentTenant, 
    goalsConfig, 
    updateMonthlyGoal, 
    updateAnnualTarget, 
    getGoalsProgress 
  } = useCRM();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const defaultCurrentMonthKey = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (initialMonthKey) {
      const parts = initialMonthKey.split('-');
      if (parts[1]) return Number(parts[1]);
    }
    return currentMonthNum;
  });

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SETTINGS' | 'YEAR_TABLE'>('OVERVIEW');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Chave do mês selecionado
  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Resumo de progresso do mês selecionado
  const progress = useMemo(() => {
    return getGoalsProgress(selectedMonthKey);
  }, [selectedMonthKey, getGoalsProgress, goalsConfig]);

  // Meta configurada para o mês selecionado
  const currentGoal: MonthlyGoal = goalsConfig.monthlyGoals[selectedMonthKey] || {
    monthKey: selectedMonthKey,
    year: selectedYear,
    month: selectedMonth,
    targetMonthlyVGV: 4500000,
    targetWonDealsCount: 4,
    targetLeads: 50,
    targetClients: 35,
    notes: '',
  };

  // Estado do formulário de edição
  const [formTargetVGV, setFormTargetVGV] = useState<number>(currentGoal.targetMonthlyVGV);
  const [formTargetWonCount, setFormTargetWonCount] = useState<number>(currentGoal.targetWonDealsCount);
  const [formTargetLeads, setFormTargetLeads] = useState<number>(currentGoal.targetLeads);
  const [formTargetClients, setFormTargetClients] = useState<number>(currentGoal.targetClients);
  const [formAnnualTargetVGV, setFormAnnualTargetVGV] = useState<number>(goalsConfig.annualVGVTarget || 50000000);
  const [formNotes, setFormNotes] = useState<string>(currentGoal.notes || '');

  // Sincroniza formulário ao trocar o mês
  React.useEffect(() => {
    setFormTargetVGV(currentGoal.targetMonthlyVGV);
    setFormTargetWonCount(currentGoal.targetWonDealsCount);
    setFormTargetLeads(currentGoal.targetLeads);
    setFormTargetClients(currentGoal.targetClients);
    setFormNotes(currentGoal.notes || '');
    setFormAnnualTargetVGV(goalsConfig.annualVGVTarget || 50000000);
  }, [selectedMonthKey, goalsConfig]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleSaveMonthGoal = (e: React.FormEvent) => {
    e.preventDefault();
    updateMonthlyGoal(selectedMonthKey, {
      targetMonthlyVGV: Number(formTargetVGV) || 0,
      targetWonDealsCount: Number(formTargetWonCount) || 0,
      targetLeads: Number(formTargetLeads) || 0,
      targetClients: Number(formTargetClients) || 0,
      notes: formNotes.trim(),
    });
    showNotification(`Metas de ${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear} salvas com sucesso!`);
  };

  const handleReplicateToNextMonths = () => {
    if (!confirm(`Deseja replicar estas metas (${MONTH_NAMES[selectedMonth - 1]}) para todos os meses seguintes de ${selectedYear}?`)) {
      return;
    }

    for (let m = selectedMonth + 1; m <= 12; m++) {
      const pad = String(m).padStart(2, '0');
      const key = `${selectedYear}-${pad}`;
      updateMonthlyGoal(key, {
        targetMonthlyVGV: Number(formTargetVGV) || 0,
        targetWonDealsCount: Number(formTargetWonCount) || 0,
        targetLeads: Number(formTargetLeads) || 0,
        targetClients: Number(formTargetClients) || 0,
        notes: `Meta replicada a partir de ${MONTH_NAMES[selectedMonth - 1]}`,
      });
    }

    showNotification(`Metas replicadas com sucesso até Dezembro de ${selectedYear}!`);
  };

  const handleSaveAnnualTarget = () => {
    updateAnnualTarget(Number(formAnnualTargetVGV) || 50000000);
    showNotification(`Meta Anual atualizada para R$ ${Number(formAnnualTargetVGV).toLocaleString('pt-BR')}!`);
  };

  const getStatusBadge = (status: GoalProgressItem['status'], pct: number) => {
    switch (status) {
      case 'EXCEEDED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Flame className="w-3 h-3 text-emerald-600" /> Superada ({pct}%)
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" /> No Alvo ({pct}%)
          </span>
        );
      case 'ATTENTION':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Atenção ({pct}%)
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Abaixo da Meta ({pct}%)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* ========================================================================= */}
        {/* HEADER DO MOTOR DE METAS                                                  */}
        {/* ========================================================================= */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#3742AC] text-white flex items-center justify-center shadow-md shadow-[#3742AC]/20">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Motor de Metas & Performance Comercial
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#3742AC]/10 text-[#3742AC]">
                  {currentTenant.name}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Acompanhe e configure as metas de VGV, novos leads, clientes e contratos fechados por mês e ano.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK TOAST */}
        {feedbackMessage && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BARRA DE NAVEGAÇÃO: SELETOR DE MÊS & TABS DE VISÃO                         */}
        {/* ========================================================================= */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 bg-white flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Seletor de Ano */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
              {[2025, 2026, 2027].map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedYear === y ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Abas de Navegação */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => setActiveTab('OVERVIEW')}
                className={`flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'OVERVIEW' ? 'bg-[#3742AC] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Acompanhamento do Mês
              </button>

              <button
                onClick={() => setActiveTab('SETTINGS')}
                className={`flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'SETTINGS' ? 'bg-[#3742AC] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Configurar Metas
              </button>

              <button
                onClick={() => setActiveTab('YEAR_TABLE')}
                className={`flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'YEAR_TABLE' ? 'bg-[#3742AC] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Visão Anual (12 Meses)
              </button>
            </div>
          </div>

          {/* Seletor em Pílulas dos 12 Meses */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MONTH_NAMES.map((name, idx) => {
              const mNum = idx + 1;
              const isSelected = selectedMonth === mNum;
              const isCurrent = currentYear === selectedYear && currentMonthNum === mNum;
              const mKey = `${selectedYear}-${String(mNum).padStart(2, '0')}`;
              const mProg = getGoalsProgress(mKey);

              return (
                <button
                  key={mNum}
                  onClick={() => setSelectedMonth(mNum)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-md'
                      : isCurrent
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <span>{name.slice(0, 3)}</span>
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Mês Vigente" />
                  )}
                  {mProg.monthlyVGV.achieved > 0 && (
                    <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {mProg.monthlyVGV.percentage}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CORPO DO MODAL: RENDERIZAÇÃO CONFORME A ABA ATIVA                         */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC] space-y-6">

          {/* BANNER DE VGV ANUAL (PRESENTE EM TODAS AS ABAS) */}
          <div className="rounded-3xl bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E1B4B] p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#3742AC]/20 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" /> Meta Consolidada do Ano ({selectedYear})
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <h3 className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
                    R$ {progress.annualAchievedVGV.toLocaleString('pt-BR')}
                  </h3>
                  <span className="text-sm font-semibold text-slate-300">
                    de R$ {progress.annualTargetVGV.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Atingimento Anual</span>
                  <span className="text-2xl font-mono font-extrabold text-emerald-400">
                    {progress.annualPercentage}%
                  </span>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-lg font-mono border border-white/10">
                  {progress.annualPercentage}%
                </div>
              </div>
            </div>

            {/* Barra de Progresso Anual */}
            <div className="mt-4">
              <div className="w-full h-3 rounded-full bg-slate-700/60 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-[#3742AC] to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(progress.annualPercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5 font-mono">
                <span>Realizado: R$ {progress.annualAchievedVGV.toLocaleString('pt-BR')}</span>
                <span>Restante p/ bater: R$ {progress.annualRemaining.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* ABA 1: ACOMPANHAMENTO DO MÊS                                  */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Desempenho de {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cruzamento dinâmico em tempo real de vendas fechadas, contatos e conversas.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('SETTINGS')}
                  className="text-xs font-bold text-[#3742AC] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar metas deste mês
                </button>
              </div>

              {/* GRID DOS 4 PILARES DA META */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. VGV DO MÊS */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    {getStatusBadge(progress.monthlyVGV.status, progress.monthlyVGV.percentage)}
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      VGV do Mês
                    </span>
                    <h4 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      R$ {progress.monthlyVGV.achieved.toLocaleString('pt-BR')}
                    </h4>
                    <span className="text-xs text-slate-500">
                      Meta: R$ {progress.monthlyVGV.target.toLocaleString('pt-BR')}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress.monthlyVGV.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{progress.monthlyVGV.percentage}% atingido</span>
                      <span>Falta: R$ {progress.monthlyVGV.remaining.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Projeção / Run-rate */}
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                    <span>Projeção Fim do Mês:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      R$ {progress.projectedMonthEndVGV.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* 2. VENDAS FECHADAS (UNIDADES) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
                      <Trophy className="w-4 h-4" />
                    </div>
                    {getStatusBadge(progress.wonDeals.status, progress.wonDeals.percentage)}
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Contratos Fechados
                    </span>
                    <h4 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {progress.wonDeals.achieved} <span className="text-xs font-normal text-slate-500">vendas</span>
                    </h4>
                    <span className="text-xs text-slate-500">
                      Meta: {progress.wonDeals.target} contratos
                    </span>
                  </div>

                  <div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-[#3742AC] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress.wonDeals.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{progress.wonDeals.percentage}% atingido</span>
                      <span>Falta: {progress.wonDeals.remaining} un</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                    <span>Status de Vendas:</span>
                    <span className="font-bold text-slate-900">
                      {progress.wonDeals.achieved >= progress.wonDeals.target ? 'Meta Batida 🎯' : 'Em Negociação'}
                    </span>
                  </div>
                </div>

                {/* 3. NOVOS LEADS */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    {getStatusBadge(progress.leads.status, progress.leads.percentage)}
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Novos Leads Captados
                    </span>
                    <h4 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {progress.leads.achieved} <span className="text-xs font-normal text-slate-500">leads</span>
                    </h4>
                    <span className="text-xs text-slate-500">
                      Meta: {progress.leads.target} leads
                    </span>
                  </div>

                  <div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress.leads.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{progress.leads.percentage}% atingido</span>
                      <span>Falta: {progress.leads.remaining} leads</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                    <span>Origem Principal:</span>
                    <span className="font-bold text-emerald-600">WhatsApp & Campanhas</span>
                  </div>
                </div>

                {/* 4. CLIENTES ATENDIDOS */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    {getStatusBadge(progress.clients.status, progress.clients.percentage)}
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Clientes Atendidos
                    </span>
                    <h4 className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {progress.clients.achieved} <span className="text-xs font-normal text-slate-500">atendimentos</span>
                    </h4>
                    <span className="text-xs text-slate-500">
                      Meta: {progress.clients.target} clientes
                    </span>
                  </div>

                  <div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress.clients.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{progress.clients.percentage}% atingido</span>
                      <span>Falta: {progress.clients.remaining} clientes</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                    <span>Taxa de Engajamento:</span>
                    <span className="font-bold text-slate-900">
                      {progress.leads.achieved > 0 ? `${Math.round((progress.clients.achieved / progress.leads.achieved) * 100)}%` : '100%'}
                    </span>
                  </div>
                </div>

              </div>

              {/* CARD DE NOTAS ESTRATÉGICAS */}
              {currentGoal.notes && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#3742AC] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block mb-0.5">Diretriz Estratégica do Mês:</span>
                    {currentGoal.notes}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* ABA 2: FORMULÁRIO DE CONFIGURAÇÃO DAS METAS                   */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-6">
              
              {/* Seção 1: Meta Anual */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" /> Meta Anual de VGV ({selectedYear})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Define a meta global da corretora para o ano todo (acumulado de Janeiro a Dezembro).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAnnualTarget}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" /> Atualizar Meta Anual
                  </button>
                </div>

                <div className="max-w-md">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    VGV Alvo Anual (R$):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input
                      type="number"
                      step="50000"
                      value={formAnnualTargetVGV}
                      onChange={(e) => setFormAnnualTargetVGV(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3742AC]"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Metas do Mês Selecionado */}
              <form onSubmit={handleSaveMonthGoal} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#3742AC]" /> Metas de {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configure os 4 indicadores-chave de performance comercial para este mês.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReplicateToNextMonths}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Replicar valores deste mês para os próximos"
                    >
                      <Copy className="w-3.5 h-3.5" /> Replicar p/ Meses Seguintes
                    </button>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#3742AC] hover:bg-[#2e3790] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#3742AC]/20"
                    >
                      <Save className="w-3.5 h-3.5" /> Salvar Metas de {MONTH_NAMES[selectedMonth - 1]}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Meta de VGV do Mês */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      1. Meta de VGV do Mês (R$):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                      <input
                        type="number"
                        step="50000"
                        value={formTargetVGV}
                        onChange={(e) => setFormTargetVGV(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3742AC]"
                        placeholder="Ex: 4500000"
                        required
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Valor em vendas fechadas pretendido no mês.
                    </span>
                  </div>

                  {/* Meta de Vendas Fechadas (Contratos) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      2. Quantidade de Vendas Fechadas (Unidades):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formTargetWonCount}
                      onChange={(e) => setFormTargetWonCount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3742AC]"
                      placeholder="Ex: 4"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Total de contratos ou escrituras assinadas no mês.
                    </span>
                  </div>

                  {/* Meta de Novos Leads */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      3. Meta de Novos Leads Captados:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formTargetLeads}
                      onChange={(e) => setFormTargetLeads(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3742AC]"
                      placeholder="Ex: 50"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Volume de novos contatos gerados via anúncios e WhatsApp.
                    </span>
                  </div>

                  {/* Meta de Clientes Atendidos */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      4. Meta de Clientes Atendidos / Em Negociação:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formTargetClients}
                      onChange={(e) => setFormTargetClients(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3742AC]"
                      placeholder="Ex: 35"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Leads qualificados que avançaram para conversa ou visita.
                    </span>
                  </div>
                </div>

                {/* Observações / Estratégia */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Estratégia ou Foco Comercial do Mês (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Ex: Foco no lançamento Residencial Horizon e reativação de leads de médio padrão."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3742AC]"
                  />
                </div>
              </form>

            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* ABA 3: TABELA PANORÂMICA ANUAL (12 MESES)                      */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'YEAR_TABLE' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Consolidado Anual de Metas ({selectedYear})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Visão de ponta a ponta dos 12 meses do ano com metas e volumes realizados.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Mês</th>
                      <th className="py-3 px-4">Meta VGV</th>
                      <th className="py-3 px-4">Realizado VGV</th>
                      <th className="py-3 px-4">Meta Vendas</th>
                      <th className="py-3 px-4">Realizado Vendas</th>
                      <th className="py-3 px-4">Meta Leads</th>
                      <th className="py-3 px-4">Realizado Leads</th>
                      <th className="py-3 px-4 text-center">% VGV</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {MONTH_NAMES.map((name, idx) => {
                      const mNum = idx + 1;
                      const mKey = `${selectedYear}-${String(mNum).padStart(2, '0')}`;
                      const mProg = getGoalsProgress(mKey);
                      const isCurrent = currentYear === selectedYear && currentMonthNum === mNum;

                      return (
                        <tr 
                          key={mNum} 
                          className={`hover:bg-slate-50/80 transition ${isCurrent ? 'bg-emerald-50/30 font-semibold' : ''}`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span>{name}</span>
                            {isCurrent && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                Atual
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            R$ {mProg.monthlyVGV.target.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            R$ {mProg.monthlyVGV.achieved.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {mProg.wonDeals.target} un
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                            {mProg.wonDeals.achieved} un
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {mProg.leads.target} leads
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                            {mProg.leads.achieved} leads
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getStatusBadge(mProg.monthlyVGV.status, mProg.monthlyVGV.percentage)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedMonth(mNum);
                                setActiveTab('SETTINGS');
                              }}
                              className="text-xs font-bold text-[#3742AC] hover:underline cursor-pointer"
                            >
                              Configurar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* FOOTER DO MODAL                                                           */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Motor de Metas integrado ao funil de vendas e Z-API WhatsApp.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
