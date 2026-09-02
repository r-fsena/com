'use client';

import React from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
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
  Calendar,
  ArrowRight,
  Flame,
  FileText,
  Target,
  Check
} from 'lucide-react';

interface SalesDashboardProps {
  onOpenChat?: (contactId: string) => void;
}

export function SalesDashboard({ onOpenChat }: SalesDashboardProps) {
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
    openChatForContact 
  } = useCRM();

  // Métricas Principais
  const totalVGV = deals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
  const totalLeads = contacts.length;
  const wonDeals = deals.filter(d => d.status === 'WON');
  const wonVGV = wonDeals.reduce((acc, d) => acc + d.expectedValue, 0);

  // Meta Mensal Estimada (ex: R$ 5.000.000)
  const monthlyTargetVGV = 5000000;
  const targetPercent = Math.min(Math.round((wonVGV / monthlyTargetVGV) * 100), 100);

  // Leads Prioritários com Mensagem Não Respondida
  const unreadConversations = conversations.filter(c => (c.unreadCount || 0) > 0);
  const pendingLeads = unreadConversations.slice(0, 4).map(conv => {
    const contact = contacts.find(c => c.id === conv.contactId) || contacts.find(c => c.phone.replace(/\D/g, '') === conv.id.replace(/\D/g, ''));
    return {
      conv,
      contact,
    };
  });

  // Visitas & Tarefas Agendadas para Hoje
  const todayTasks = tasks.filter(t => !t.isCompleted).slice(0, 4);

  // Propostas em Aberto
  const pendingProposals = (proposals || []).filter(p => p.status === 'SENT' || p.status === 'DRAFT').slice(0, 3);

  // Conversão por Etapa do Funil
  const funnelData = currentPipeline.stages.map(st => {
    const count = deals.filter(d => d.stageId === st.id).length;
    const value = deals.filter(d => d.stageId === st.id).reduce((sum, d) => sum + d.expectedValue, 0);
    return {
      name: st.name.split('.')[1]?.trim() || st.name,
      negocios: count,
      valor: value,
      color: st.colorHex,
    };
  });

  // Leads por Origem
  const sourceCountMap: Record<string, number> = {};
  contacts.forEach(c => {
    sourceCountMap[c.source] = (sourceCountMap[c.source] || 0) + 1;
  });

  const sourceData = Object.entries(sourceCountMap).length > 0 
    ? Object.entries(sourceCountMap).map(([source, count]) => ({
        name: source === 'WHATSAPP' ? 'WhatsApp Direto' :
              source === 'INSTAGRAM_ADS' ? 'Instagram Ads' :
              source === 'FACEBOOK_ADS' ? 'Facebook Ads' :
              source === 'PORTAL_ZAP' ? 'Portal ZAP' : 'Outros',
        value: count,
      }))
    : [{ name: 'Aguardando Leads', value: 1 }];

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6'];

  const handleGoToChat = (contactId?: string) => {
    if (!contactId) return;
    if (onOpenChat) onOpenChat(contactId);
    else openChatForContact(contactId);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50 p-6 sm:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Dashboard & Foco Diário do Corretor</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Suas prioridades comerciais de hoje, alertas de resposta e metas de fechamento
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs text-xs">
          <Wifi className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span className="font-semibold text-slate-700">Z-API Gateway:</span>
          <span className="text-emerald-700 font-bold">Instâncias Ativas ({instances.length})</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COCKPIT DIÁRIO DO CORRETOR: SUAS PRIORIDADES DE HOJE                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Leads Aguardando Resposta no WhatsApp */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Leads Aguardando Resposta</h3>
                  <span className="text-[10.5px] text-slate-400">Atendimento prioritário</span>
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {unreadConversations.length} pendentes
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {pendingLeads.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700">Tudo em dia!</p>
                  <p className="text-[11px]">Nenhuma mensagem sem resposta na sua caixa.</p>
                </div>
              ) : (
                pendingLeads.map(({ conv, contact }) => (
                  <div
                    key={conv.id}
                    onClick={() => handleGoToChat(contact?.id || conv.contactId)}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 p-2 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={contact?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(contact?.name || 'Lead')}
                        alt={contact?.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">{contact?.name || conv.id}</span>
                          {contact?.temperature === 'HOT' && (
                            <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 px-1 py-0.2 rounded-full shrink-0">
                              🔥 Quente
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate max-w-[170px]">{conv.lastMessagePreview || 'Nova mensagem'}</p>
                      </div>
                    </div>

                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
                      {conv.unreadCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleGoToChat(pendingLeads[0]?.contact?.id)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>Abrir Inbox WhatsApp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Visitas & Tarefas de Hoje */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Visitas & Tarefas de Hoje</h3>
                  <span className="text-[10.5px] text-slate-400">Compromissos agendados</span>
                </div>
              </div>
              <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                {todayTasks.length} tarefas
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {todayTasks.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs space-y-1">
                  <Calendar className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700">Agenda livre</p>
                  <p className="text-[11px]">Nenhuma visita ou tarefa pendente para hoje.</p>
                </div>
              ) : (
                todayTasks.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">{t.title}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Vence hoje • {t.dueDate ? new Date(t.dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia todo'}</span>
                      </span>
                    </div>
                    <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md shrink-0">
                      {t.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2">
            <span className="text-[11px] text-slate-400 text-center block">
              Sincronizado com Google Agenda & iCalendar (.ICS)
            </span>
          </div>
        </div>

        {/* 3. Termômetro de Meta Mensal */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Meta de Vendas do Mês</h3>
                  <span className="text-[10.5px] text-slate-400">Progresso de VGV Fechado</span>
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {targetPercent}%
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Realizado</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    R$ {wonVGV.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Objetivo</span>
                  <span className="text-sm font-mono text-slate-300">
                    R$ {monthlyTargetVGV.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${targetPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
            <span>Volume em Negociação no Funil:</span>
            <strong className="font-mono text-emerald-400">R$ {totalVGV.toLocaleString('pt-BR')}</strong>
          </div>
        </div>

      </div>

      {/* KPI Cards Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">VGV em Funil</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            R$ {totalVGV.toLocaleString('pt-BR')}
          </p>
          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> {deals.length} oportunidades ativas
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contratos Fechados</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            R$ {wonVGV.toLocaleString('pt-BR')}
          </p>
          <span className="text-[11px] font-semibold text-blue-600 mt-1 block">
            {wonDeals.length} negócios convertidos
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Base de Leads</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {totalLeads}
          </p>
          <span className="text-[11px] font-semibold text-indigo-600 mt-1 block">
            Cadastros no CRM
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SLA Médio de Resposta</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            &lt; 3.5 min
          </p>
          <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 98% dentro do SLA
          </span>
        </div>
      </div>

      {/* Gráficos de Funil e Origem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico do Funil */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Volume Financeiro por Etapa do Funil</h3>
              <p className="text-xs text-slate-400">Distribuição do VGV pelas fases de negociação</p>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-xl">
              {currentPipeline.name}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'VGV']}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Origem de Leads */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Canais de Entrada</h3>
            <p className="text-xs text-slate-400">Origem dos leads captados</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sourceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 text-[11px] text-slate-500 text-center border border-slate-100">
            Origem predominante: <strong className="text-emerald-700">WhatsApp Direto & Campanhas</strong>
          </div>
        </div>

      </div>

    </div>
  );
}
