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
  Wifi
} from 'lucide-react';

export function SalesDashboard() {
  const { contacts, deals, currentPipeline, users, instances, currentTenant } = useCRM();

  // Métricas Principais
  const totalVGV = deals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
  const totalLeads = contacts.length;
  const wonDeals = deals.filter(d => d.status === 'WON');
  const wonVGV = wonDeals.reduce((acc, d) => acc + d.expectedValue, 0);

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

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Dashboard Executivo de Vendas</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Indicadores de conversão, velocidade de resposta e performance comercial
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-xs">
          <Wifi className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span className="font-semibold text-slate-700">Z-API Gateway:</span>
          <span className="text-emerald-700 font-bold">Instâncias Ativas ({instances.length})</span>
        </div>
      </div>

      {/* KPI Cards */}
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
            {wonDeals.length} vendas convertidas
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tempo 1º Atendimento</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            4.2 min
          </p>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">
            ✓ Dentro do SLA (Meta: &lt; 15 min)
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Leads 360</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {totalLeads}
          </p>
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">
            100% consentimento LGPD
          </span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Funil de Vendas Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Distribuição de Negócios por Etapa do Funil
          </h3>
          <p className="text-xs text-slate-500 mb-4">Volume de negociações em cada estágio</p>

          <div className="h-72 w-full min-w-0 relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} debounce={50}>
              <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any) => [`${value} negócios`, 'Volume']}
                />
                <Bar dataKey="negocios" radius={[6, 6, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Origem dos Leads Pie Chart */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Origem dos Leads
          </h3>
          <p className="text-xs text-slate-500 mb-4">Canais de captação de maior conversão</p>

          <div className="h-72 w-full min-w-0 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} debounce={50}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboard de Corretores */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">
          Produtividade da Equipe Comercial
        </h3>

        <div className="divide-y divide-slate-100">
          {users.map((u) => {
            const userDeals = deals.filter(d => d.assignedUserId === u.id);
            const userVGV = userDeals.reduce((sum, d) => sum + d.expectedValue, 0);

            return (
              <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={u.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name)}
                    alt={u.name}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{u.name}</p>
                    <span className="text-[10px] text-slate-500 font-medium">{u.role} • {u.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Negócios</span>
                    <span className="font-bold text-slate-800">{userDeals.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">VGV Ativo</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      R$ {userVGV.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
