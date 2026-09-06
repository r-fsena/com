'use client';

import React, { useState, useMemo } from 'react';
import { 
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
  BarChart3,
  Sliders,
  Table as TableIcon
} from 'lucide-react';
import { useCRM } from '@/lib/crm-context';
import { MonthlyGoal, GoalProgressItem } from '@/types/crm';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface GoalsManagerProps {
  initialTab?: 'OVERVIEW' | 'SETTINGS' | 'YEAR_TABLE';
  initialMonth?: number;
}

export function GoalsManager({ initialTab = 'OVERVIEW', initialMonth }: GoalsManagerProps) {
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

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || currentMonthNum);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SETTINGS' | 'YEAR_TABLE'>(initialTab);
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

  // Formulário de edição
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
    for (let m = selectedMonth + 1; m <= 12; m++) {
      const targetKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
      updateMonthlyGoal(targetKey, {
        targetMonthlyVGV: Number(formTargetVGV) || 0,
        targetWonDealsCount: Number(formTargetWonCount) || 0,
        targetLeads: Number(formTargetLeads) || 0,
        targetClients: Number(formTargetClients) || 0,
        notes: formNotes.trim(),
      });
    }
    showNotification(`Metas replicadas com sucesso de ${MONTH_NAMES[selectedMonth]} até Dezembro de ${selectedYear}!`);
  };

  const handleSaveAnnualTarget = () => {
    updateAnnualTarget(Number(formAnnualTargetVGV) || 0);
    showNotification(`Meta anual de VGV atualizada para R$ ${(Number(formAnnualTargetVGV) / 1000000).toFixed(1)}M!`);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

  const renderStatusBadge = (status: GoalProgressItem['status']) => {
    switch (status) {
      case 'EXCEEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Flame className="w-3 h-3 text-emerald-600" /> Superada!
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-[#3742AC] border border-indigo-200">
            <Check className="w-3 h-3 text-[#3742AC]" /> No Ritmo
          </span>
        );
      case 'ATTENTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Atenção
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-500" /> Crítico
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-5rem)] overflow-y-auto bg-[#F0F3FA] p-6 sm:p-8 space-y-6">
      
      {/* ========================================================================= */}
      {/* HEADER DA PÁGINA COM NAVEGAÇÃO DE ABAS                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center shrink-0 shadow-2xs">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Metas & Performance Comercial
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-[#3742AC] border border-indigo-100 rounded-md">
                Motor 2026
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Planejamento e acompanhamento de VGV, vendas fechadas, captação de leads e clientes atendidos • <strong className="text-slate-700 font-semibold">{currentTenant.name}</strong>
            </p>
          </div>
        </div>

        {/* Seletor de Abas Estilo Sovereign */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-white text-[#3742AC] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Dashboard Detalhado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'SETTINGS'
                ? 'bg-white text-[#3742AC] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configurar Metas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('YEAR_TABLE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'YEAR_TABLE'
                ? 'bg-white text-[#3742AC] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Tabela Anual</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs transition-all animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: DASHBOARD DETALHADO (OVERVIEW)                                     */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* Seletor de Mês (Pills Sovereign) */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max">
              <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Mês:
              </span>
              {MONTH_NAMES.map((name, idx) => {
                const monthNum = idx + 1;
                const isSelected = selectedMonth === monthNum;
                const isCurrentRealMonth = currentMonthNum === monthNum;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedMonth(monthNum)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#3742AC] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {name.slice(0, 3)}
                    {isCurrentRealMonth && (
                      <span className={`w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5 ${isSelected ? 'bg-emerald-400 ring-2 ring-white' : 'bg-emerald-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('SETTINGS')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#3742AC] bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Metas de {MONTH_NAMES[selectedMonth - 1]}</span>
            </button>
          </div>

          {/* Hero Banner: Meta Anual Acumulada */}
          <div className="sovereign-navy-card p-6 sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 block">
                  Consolidado Anual de Performance • {selectedYear}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Meta Anual de VGV: {formatCurrency(progress.annualTargetVGV)}
                </h2>
                <p className="text-xs text-indigo-200 mt-1">
                  VGV acumulado até agora: <strong className="text-white font-mono">{formatCurrency(progress.annualAchievedVGV)}</strong> ({progress.annualPercentage}% da meta anual)
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white/10 px-5 py-3 rounded-2xl border border-white/10 shrink-0">
                <Trophy className="w-8 h-8 text-amber-300 shrink-0" />
                <div>
                  <span className="text-[10px] text-indigo-200 block uppercase font-bold">Saldo Restante para o Ano</span>
                  <span className="text-lg font-black text-white font-mono">{formatCurrency(progress.annualRemaining)}</span>
                </div>
              </div>
            </div>

            {/* Barra de Progresso Anual */}
            <div className="space-y-1.5 pt-2">
              <div className="w-full h-3 rounded-full bg-white/15 overflow-hidden p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-[#3742AC] transition-all duration-1000"
                  style={{ width: `${Math.min(progress.annualPercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-indigo-200 font-mono">
                <span>0%</span>
                <span className="font-bold text-white">{progress.annualPercentage}% Concluído</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* 4 Cards de Metas do Mês Selecionado */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: VGV do Mês */}
            <div className="sovereign-card p-6 flex flex-col justify-between space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                {renderStatusBadge(progress.monthlyVGV.status)}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  VGV em Vendas ({MONTH_NAMES[selectedMonth - 1]})
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
                  {formatCurrency(progress.monthlyVGV.achieved)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Meta: <strong className="text-slate-800 font-mono">{formatCurrency(progress.monthlyVGV.target)}</strong>
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Progresso</span>
                  <span className="text-[#3742AC] font-mono">{progress.monthlyVGV.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      progress.monthlyVGV.percentage >= 100 ? 'bg-emerald-500' :
                      progress.monthlyVGV.percentage >= 70 ? 'bg-[#3742AC]' :
                      progress.monthlyVGV.percentage >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(progress.monthlyVGV.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Faltam: {formatCurrency(progress.monthlyVGV.remaining)}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Contratos Fechados */}
            <div className="sovereign-card p-6 flex flex-col justify-between space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Trophy className="w-5 h-5" />
                </div>
                {renderStatusBadge(progress.wonDeals.status)}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Vendas Fechadas (Unidades)
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
                  {progress.wonDeals.achieved} <span className="text-sm font-normal text-slate-400">/ {progress.wonDeals.target} un.</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {progress.wonDeals.remaining > 0 ? `Faltam ${progress.wonDeals.remaining} contratos` : 'Meta de unidades batida!'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Progresso</span>
                  <span className="text-indigo-600 font-mono">{progress.wonDeals.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-indigo-600 transition-all duration-700"
                    style={{ width: `${Math.min(progress.wonDeals.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Meta: {progress.wonDeals.target} contratos</span>
                </div>
              </div>
            </div>

            {/* Card 3: Novos Leads */}
            <div className="sovereign-card p-6 flex flex-col justify-between space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <Flame className="w-5 h-5" />
                </div>
                {renderStatusBadge(progress.leads.status)}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Novos Leads Captados
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
                  {progress.leads.achieved} <span className="text-sm font-normal text-slate-400">/ {progress.leads.target}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {progress.leads.remaining > 0 ? `Faltam ${progress.leads.remaining} leads` : 'Meta de captação superada!'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Captação</span>
                  <span className="text-orange-600 font-mono">{progress.leads.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-orange-500 transition-all duration-700"
                    style={{ width: `${Math.min(progress.leads.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Meta: {progress.leads.target} leads</span>
                </div>
              </div>
            </div>

            {/* Card 4: Clientes Atendidos */}
            <div className="sovereign-card p-6 flex flex-col justify-between space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                {renderStatusBadge(progress.clients.status)}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Clientes Atendidos
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
                  {progress.clients.achieved} <span className="text-sm font-normal text-slate-400">/ {progress.clients.target}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {progress.clients.remaining > 0 ? `Faltam ${progress.clients.remaining} atendimentos` : 'Meta de atendimento batida!'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Engajamento</span>
                  <span className="text-emerald-600 font-mono">{progress.clients.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.min(progress.clients.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Meta: {progress.clients.target} clientes</span>
                </div>
              </div>
            </div>

          </div>

          {/* Banner de Projeção & Velocidade (Run-Rate) */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white border border-indigo-900 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Motor de Projeção & Velocidade (Run-Rate)
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                Projeção estimada de fechamento: <span className="text-emerald-400 font-mono">{formatCurrency(progress.projectedMonthEndVGV)}</span>
              </h4>
              <p className="text-xs text-indigo-200">
                Velocidade diária calculada: <strong className="text-white font-mono">{formatCurrency(progress.dailyRunRateVGV)}/dia</strong>.
                {progress.projectedMonthEndVGV >= progress.monthlyVGV.target ? (
                  <span className="text-emerald-300 ml-1 font-semibold">✨ Mantendo esse ritmo, a meta mensal será superada!</span>
                ) : (
                  <span className="text-amber-300 ml-1 font-semibold">⚠️ É necessário acelerar fechamentos para atingir a meta até o final do mês.</span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('SETTINGS')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 border border-white/10 cursor-pointer shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ajustar Metas do Mês</span>
            </button>
          </div>

          {/* Anotações Estratégicas do Mês */}
          {currentGoal.notes && (
            <div className="bg-amber-50/70 border border-amber-200/80 p-5 rounded-2xl text-amber-900 text-xs space-y-1">
              <span className="font-extrabold uppercase tracking-wider text-amber-800 text-[10px] block">
                Diretrizes & Estratégia de {MONTH_NAMES[selectedMonth - 1]}:
              </span>
              <p className="leading-relaxed font-medium">{currentGoal.notes}</p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CONFIGURAÇÃO DE METAS (SETTINGS)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'SETTINGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna 1 & 2: Formulário de Configuração do Mês */}
          <div className="lg:col-span-2 sovereign-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Configurar Metas de {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
                </h3>
                <p className="text-xs text-slate-500">
                  Defina os alvos de desempenho comercial para este período.
                </p>
              </div>

              {/* Seletor rápido de mês */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name} ({selectedYear})
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSaveMonthGoal} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Meta de VGV */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-[#3742AC]" />
                    Meta de VGV do Mês (R$)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={formTargetVGV}
                    onChange={(e) => setFormTargetVGV(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 5000000"
                    required
                  />
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatCurrency(Number(formTargetVGV) || 0)}
                  </span>
                </div>

                {/* Meta de Vendas Fechadas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-indigo-600" />
                    Meta de Contratos Fechados (unidades)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formTargetWonCount}
                    onChange={(e) => setFormTargetWonCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 5"
                    required
                  />
                  <span className="text-[11px] text-slate-400">
                    Número de negócios fechados no mês
                  </span>
                </div>

                {/* Meta de Novos Leads */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-600" />
                    Meta de Novos Leads (Captação)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formTargetLeads}
                    onChange={(e) => setFormTargetLeads(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 60"
                    required
                  />
                  <span className="text-[11px] text-slate-400">
                    Novos contatos que entrarão no funil
                  </span>
                </div>

                {/* Meta de Clientes Atendidos */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    Meta de Clientes Atendidos
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formTargetClients}
                    onChange={(e) => setFormTargetClients(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 40"
                    required
                  />
                  <span className="text-[11px] text-slate-400">
                    Atendimentos ativos com conversas e visitas
                  </span>
                </div>

              </div>

              {/* Notas Estratégicas */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Diretrizes & Notas Estratégicas do Mês
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Foco no lançamento do Empreendimento Alpha e reengajamento de leads parados..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Ações do Formulário */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReplicateToNextMonths}
                  className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-[#3742AC] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Replicar para os próximos meses ({MONTH_NAMES[selectedMonth] || 'fim'} até Dez)</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#3742AC] hover:bg-indigo-900 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Metas de {MONTH_NAMES[selectedMonth - 1]}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Coluna 3: Meta Anual e Dicas Rápidas */}
          <div className="space-y-6">
            
            {/* Configuração de Meta Anual */}
            <div className="sovereign-card p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-extrabold text-slate-900">Meta Anual Acumulada ({selectedYear})</h4>
              </div>

              <p className="text-xs text-slate-500">
                Objetivo anual de VGV total para toda a imobiliária.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">VGV Anual Alvo (R$)</label>
                <input
                  type="number"
                  step="100000"
                  value={formAnnualTargetVGV}
                  onChange={(e) => setFormAnnualTargetVGV(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: 50000000"
                />
                <span className="text-[11px] text-slate-400 font-mono">
                  {formatCurrency(Number(formAnnualTargetVGV) || 0)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveAnnualTarget}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Meta Anual</span>
              </button>
            </div>

            {/* Guia Rápido */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl text-xs space-y-2">
              <span className="font-extrabold text-[#3742AC] block">💡 Como o motor calcula os resultados:</span>
              <ul className="space-y-1.5 text-slate-600 text-[11px] list-disc list-inside">
                <li><strong>VGV:</strong> Soma o valor dos negócios com status <em>Ganho (WON)</em> no mês.</li>
                <li><strong>Vendas:</strong> Quantidade de negócios convertidos.</li>
                <li><strong>Leads:</strong> Novos contatos cadastrados ou sincronizados no mês.</li>
                <li><strong>Clientes:</strong> Contatos com mensagens trocadas no WhatsApp no período.</li>
              </ul>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: TABELA ANUAL CONSOLIDADA (YEAR_TABLE)                              */}
      {/* ========================================================================= */}
      {activeTab === 'YEAR_TABLE' && (
        <div className="sovereign-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Tabela Consolidada de Metas • {selectedYear}
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhamento mês a mês das metas de VGV, vendas e captação.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('SETTINGS')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#3742AC] bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configurar Valores</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Mês</th>
                  <th className="py-3 px-4">Meta VGV</th>
                  <th className="py-3 px-4">Realizado VGV</th>
                  <th className="py-3 px-4 text-center">% VGV</th>
                  <th className="py-3 px-4 text-center">Meta Vendas</th>
                  <th className="py-3 px-4 text-center">Vendas Feitas</th>
                  <th className="py-3 px-4 text-center">Leads Alvo</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {MONTH_NAMES.map((name, idx) => {
                  const mNum = idx + 1;
                  const mKey = `${selectedYear}-${String(mNum).padStart(2, '0')}`;
                  const mProgress = getGoalsProgress(mKey);
                  const isCurrent = currentMonthNum === mNum;

                  return (
                    <tr 
                      key={name}
                      className={`hover:bg-slate-50/80 transition ${isCurrent ? 'bg-indigo-50/30 font-bold' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#3742AC] text-white">
                              Atual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {formatCurrency(mProgress.monthlyVGV.target)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {formatCurrency(mProgress.monthlyVGV.achieved)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-bold ${
                          mProgress.monthlyVGV.percentage >= 100 ? 'text-emerald-600' :
                          mProgress.monthlyVGV.percentage >= 70 ? 'text-[#3742AC]' :
                          mProgress.monthlyVGV.percentage >= 40 ? 'text-amber-600' : 'text-slate-400'
                        }`}>
                          {mProgress.monthlyVGV.percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {mProgress.wonDeals.target} un.
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {mProgress.wonDeals.achieved} un.
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {mProgress.leads.target}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(mProgress.monthlyVGV.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMonth(mNum);
                            setActiveTab('SETTINGS');
                          }}
                          className="text-[#3742AC] hover:text-indigo-900 font-bold text-[11px] underline cursor-pointer"
                        >
                          Editar
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
  );
}
