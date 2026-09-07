'use client';

import React from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  TrendingUp, 
  Building2, 
  Users, 
  DollarSign, 
  MessageSquare, 
  Bot, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight, 
  CreditCard, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  PieChart,
  Layers,
  Sparkles,
  Server,
  Plus
} from 'lucide-react';

interface SaaSDashboardProps {
  onNavigateToTab: (tab: string) => void;
}

export function SaaSDashboard({ onNavigateToTab }: SaaSDashboardProps) {
  const { tenants, saasPlans, users, conversations, messages, masterUsers } = useCRM();

  // Métricas de Receita e Assinaturas
  const totalMRR = tenants
    .filter(t => t.status === 'ACTIVE')
    .reduce((acc, t) => acc + (t.monthlyFee || 0), 0);

  const totalARR = totalMRR * 12;
  const activeTenantsCount = tenants.filter(t => t.status === 'ACTIVE').length;
  const trialTenantsCount = tenants.filter(t => t.status === 'TRIAL').length;
  const suspendedTenantsCount = tenants.filter(t => t.status === 'SUSPENDED').length;

  const averageTicket = activeTenantsCount > 0 ? (totalMRR / activeTenantsCount) : 0;

  // Capacidade e Ocupação de Licenças
  const totalBrokerCapacity = tenants
    .filter(t => t.status === 'ACTIVE' || t.status === 'TRIAL')
    .reduce((acc, t) => acc + (t.maxBrokers || 0), 0);

  const totalBrokersActive = users.length; // Corretores/usuários ativos em produção
  const brokerUtilizationRate = totalBrokerCapacity > 0 
    ? Math.round((totalBrokersActive / totalBrokerCapacity) * 100) 
    : 0;

  // Instâncias e WhatsApp
  const totalInstancesCapacity = tenants.reduce((acc, t) => acc + (t.maxInstances || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header Estratégico Sovereign */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-[#3742AC] p-6 sm:p-7 rounded-3xl text-white shadow-xl shadow-indigo-950/20 border border-indigo-900/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="bg-white/10 text-indigo-200 border border-white/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
              Visão Executiva SaaS
            </span>
            <span className="text-xs text-indigo-200/80 font-mono">Brokiva Platform Engine</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1.5 tracking-tight">
            Dashboard Estratégico & Gestão Multitenant
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Acompanhe o MRR consolidado, ocupação de licenças de corretores, consumo de conexões WhatsApp e infraestrutura de IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateToTab('new-tenant')}
            className="bg-white hover:bg-slate-100 text-[#3742AC] font-black text-xs py-2.5 px-4 rounded-xl transition shadow-md shadow-slate-950/20 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#3742AC]" />
            <span>Nova Imobiliária / Proposta</span>
          </button>
        </div>
      </div>

      {/* Grid de KPIs de Receita SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Global */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MRR Recorrente</p>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>ARR: R$ {totalARR.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/ano</span>
            </p>
          </div>
        </div>

        {/* Ambientes / Imobiliárias */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ambientes Ativos</p>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              {tenants.length} <span className="text-xs font-semibold text-slate-400">imobiliárias</span>
            </h3>
            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded-md">
                ● {activeTenantsCount} Ativas
              </span>
              <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded-md">
                ● {trialTenantsCount} Trial
              </span>
            </div>
          </div>
        </div>

        {/* Posições de Corretores (Capacidade vs Uso) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ocupação de Licenças</p>
            <div className="w-10 h-10 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-black text-[#3742AC]">
                {totalBrokersActive} <span className="text-xs font-semibold text-slate-400">/ {totalBrokerCapacity}</span>
              </h3>
              <span className="text-xs font-extrabold text-[#3742AC] bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                {brokerUtilizationRate}% uso
              </span>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
              <div 
                className="bg-[#3742AC] h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(brokerUtilizationRate, 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ticket Médio</p>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1.5">
              Assinaturas mensais via Asaas
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Métricas de Infraestrutura: WhatsApp & IA & Asaas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Z-API & WhatsApp Gateway */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Z-API WhatsApp Gateway</h4>
                <p className="text-[11px] text-slate-400">Linhas & Tráfego de Mensagens</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>99.9% Uptime</span>
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Slots de Instâncias Liberados:</span>
              <span className="font-bold text-slate-900">{totalInstancesCapacity} slots</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Conversas no Mês:</span>
              <span className="font-bold text-emerald-700">{conversations.length * 48} ativas</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-600 font-medium">Mensagens Trafegadas:</span>
              <span className="font-bold text-slate-900 font-mono">14.820 msgs</span>
            </div>
          </div>
        </div>

        {/* IA Copiloto & Modelos LLM */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#3742AC] flex items-center justify-center font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">IA Copiloto & LLMs</h4>
                <p className="text-[11px] text-slate-400">AWS Bedrock & OpenAI / Claude</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-indigo-50 text-[#3742AC] border border-indigo-200 px-2 py-0.5 rounded-full">
              Ativo
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Motor Primário:</span>
              <span className="font-bold text-[#3742AC]">Claude 3.5 Sonnet</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Sugestões de Respostas:</span>
              <span className="font-bold text-slate-900">1.240 geradas</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-600 font-medium">Extração de Perfil de Leads:</span>
              <span className="font-bold text-emerald-700">96% precisão</span>
            </div>
          </div>
        </div>

        {/* Gateway de Pagamentos Asaas Master */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Gateway Asaas Master</h4>
                <p className="text-[11px] text-slate-400">Cobrança e Split de Planos</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              Sincronizado
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Taxa de Conversão PIX:</span>
              <span className="font-bold text-emerald-700">92% liquidados</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Webhooks Processados:</span>
              <span className="font-bold text-slate-900">100% integrados</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-600 font-medium">Baixa Automática:</span>
              <span className="font-bold text-blue-700">Instantânea</span>
            </div>
          </div>
        </div>
      </div>

      {/* Acesso Rápido aos Ambientes em Produção */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">Imobiliárias Recentes em Produção</h4>
            <p className="text-xs text-slate-400">Acesse qualquer ambiente ou gerencie licenças</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('tenants')}
            className="text-xs font-bold text-[#3742AC] hover:text-[#2D368E] flex items-center gap-1 cursor-pointer transition"
          >
            <span>Ver Todas as Imobiliárias ({tenants.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tenants.slice(0, 3).map(tenant => (
            <div key={tenant.id} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between hover:bg-white hover:border-indigo-200 transition shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center font-bold text-[#3742AC] shadow-2xs">
                  {tenant.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{tenant.name}</p>
                  <p className="text-[11px] text-slate-500">Plano {tenant.plan} • R$ {tenant.monthlyFee}/mês</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                tenant.status === 'ACTIVE' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {tenant.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
