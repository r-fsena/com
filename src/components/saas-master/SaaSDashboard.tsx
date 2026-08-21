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
  Server
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
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header Estratégico */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Visão Executiva SaaS
            </span>
            <span className="text-xs text-slate-400 font-mono">Atualizado em Tempo Real</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1 tracking-tight">
            Dashboard Estratégico & Indicadores de Negócio
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Acompanhamento de MRR, ocupação de licenças de corretores, tráfego de WhatsApp Z-API e infraestrutura de IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateToTab('new-tenant')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>+ Nova Imobiliária / Proposta</span>
          </button>
        </div>
      </div>

      {/* Grid de KPIs de Receita SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Global */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">MRR (Recorrente Mensal)</p>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900">
              R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>ARR Projetado: R$ {totalARR.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/ano</span>
            </p>
          </div>
        </div>

        {/* Ambientes / Imobiliárias */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ambientes Contratados</p>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900">
              {tenants.length} <span className="text-sm font-normal text-slate-500">imobiliárias</span>
            </h3>
            <div className="flex items-center gap-2 mt-1 text-[11px]">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">● {activeTenantsCount} Ativas</span>
              <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded">● {trialTenantsCount} Trial</span>
            </div>
          </div>
        </div>

        {/* Posições de Corretores (Capacidade vs Uso) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ocupação de Corretores</p>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-black text-purple-700">
                {totalBrokersActive} <span className="text-sm font-normal text-slate-500">/ {totalBrokerCapacity}</span>
              </h3>
              <span className="text-xs font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                {brokerUtilizationRate}% uso
              </span>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(brokerUtilizationRate, 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Médio por Cliente</p>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-teal-700">
              R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">
              Cobrança automatizada via Asaas
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Métricas de Infraestrutura: WhatsApp & IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Z-API & WhatsApp Gateway */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Z-API WhatsApp Gateway</h4>
                <p className="text-[11px] text-slate-500">Tráfego de Mensagens</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>99.9% Uptime</span>
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Instâncias Conectadas:</span>
              <span className="font-bold text-slate-900">{totalInstancesCapacity} slots liberados</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Conversas no Mês:</span>
              <span className="font-bold text-emerald-700">{conversations.length * 48} chats ativos</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Mensagens Trafegadas:</span>
              <span className="font-bold text-slate-900 font-mono">14.820 msgs</span>
            </div>
          </div>
        </div>

        {/* IA Copiloto & Modelos LLM */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">IA Copiloto & LLMs</h4>
                <p className="text-[11px] text-slate-500">AWS Bedrock & Claude 3.5</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
              Ativo
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Modelo Primário:</span>
              <span className="font-bold text-purple-700">Claude 3.5 Sonnet</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Sugestões de Respostas:</span>
              <span className="font-bold text-slate-900">1.240 geradas</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Extração de Perfil de Leads:</span>
              <span className="font-bold text-emerald-700 font-bold">96% precisão</span>
            </div>
          </div>
        </div>

        {/* Gateway de Pagamentos Asaas Master */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Gateway Asaas Master</h4>
                <p className="text-[11px] text-slate-500">Cobrança e Split de Planos</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              Sincronizado
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Taxa de Conversão PIX:</span>
              <span className="font-bold text-emerald-700">92% liquidados</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Webhooks Processados:</span>
              <span className="font-bold text-slate-900">100% integrados</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Baixa Automática:</span>
              <span className="font-bold text-blue-700">Instantânea</span>
            </div>
          </div>
        </div>
      </div>

      {/* Acesso Rápido aos Ambientes em Produção */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Ambientes em Produção Mais Ativos</h4>
            <p className="text-xs text-slate-500">Status dos clientes corporativos no SaaS</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('tenants')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver Todos os Ambientes ({tenants.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tenants.slice(0, 3).map(tenant => (
            <div key={tenant.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-800 shadow-2xs">
                  {tenant.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{tenant.name}</p>
                  <p className="text-[11px] text-slate-500">Plano {tenant.plan} • R$ {tenant.monthlyFee}/mês</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                tenant.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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
