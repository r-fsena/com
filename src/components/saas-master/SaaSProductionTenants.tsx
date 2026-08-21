'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Tenant, TenantStatus } from '@/types/crm';
import { 
  Building2, 
  Search, 
  Filter, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Users, 
  MessageSquare, 
  CreditCard, 
  ExternalLink, 
  ShieldCheck, 
  Trash2, 
  Edit3,
  MoreVertical,
  Plus
} from 'lucide-react';

interface SaaSProductionTenantsProps {
  onEnterTenant: (tenant: Tenant) => void;
  onNavigateToNewTenant: () => void;
}

export function SaaSProductionTenants({ onEnterTenant, onNavigateToNewTenant }: SaaSProductionTenantsProps) {
  const { tenants, currentTenant, updateTenantStatus, deleteTenant } = useCRM();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenantStatus>('ALL');

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.documentCnpj.includes(searchTerm);
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header dos Ambientes Produtivos */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Ambientes Produtivos & Imobiliárias</h2>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
              {tenants.length} cadastradas
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie as imobiliárias em produção e acesse qualquer ambiente em Modo Gestão (Impersonate) com 1 clique.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToNewTenant}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Provisionar Novo Ambiente</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome da imobiliária, CNPJ ou subdomínio..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todas ({tenants.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'ACTIVE' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ● Ativas
          </button>
          <button
            onClick={() => setStatusFilter('TRIAL')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'TRIAL' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ● Trial
          </button>
          <button
            onClick={() => setStatusFilter('SUSPENDED')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'SUSPENDED' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ● Suspensas
          </button>
        </div>
      </div>

      {/* Grid de Cards dos Ambientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.map(tenant => {
          const isActive = tenant.status === 'ACTIVE';
          const isTrial = tenant.status === 'TRIAL';
          const isSuspended = tenant.status === 'SUSPENDED';

          return (
            <div
              key={tenant.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4 group"
            >
              {/* Topo do Card */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md text-base"
                      style={{ backgroundColor: tenant.primaryColor || '#059669' }}
                    >
                      {tenant.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                        {tenant.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {tenant.slug}.faithhubs.com
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                    isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    isTrial ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {isActive ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                     isTrial ? <Clock className="w-3 h-3 text-amber-500" /> :
                     <AlertTriangle className="w-3 h-3 text-rose-600" />}
                    <span>{tenant.status}</span>
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Plano Contratado:</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {tenant.plan}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Mensalidade Asaas:</span>
                    <span className="font-bold text-emerald-700">
                      R$ {tenant.monthlyFee?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Capacidade de Corretores:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Users className="w-3 h-3 text-purple-600" />
                      <span>Até {tenant.maxBrokers} corretores</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Linhas WhatsApp Z-API:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      <span>{tenant.maxInstances} instâncias</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">CNPJ:</span>
                    <span className="font-mono text-[11px] text-slate-600">{tenant.documentCnpj}</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação do Card */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {/* Botão de Destaque: Entrar no CRM da Imobiliária */}
                <button
                  type="button"
                  onClick={() => onEnterTenant(tenant)}
                  className="w-full bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98 group/btn"
                >
                  <span>🚀 Entrar no CRM desta Imobiliária</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>

                {/* Status Switcher Rápido */}
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 pt-1">
                  <span>Alterar Status:</span>
                  <div className="flex items-center gap-1">
                    {tenant.status !== 'ACTIVE' && (
                      <button
                        onClick={() => updateTenantStatus(tenant.id, 'ACTIVE')}
                        className="text-emerald-700 hover:underline font-bold"
                      >
                        Ativar
                      </button>
                    )}
                    {tenant.status !== 'SUSPENDED' && (
                      <button
                        onClick={() => updateTenantStatus(tenant.id, 'SUSPENDED')}
                        className="text-rose-600 hover:underline font-bold ml-1.5"
                      >
                        Suspender
                      </button>
                    )}
                    {tenant.status !== 'TRIAL' && (
                      <button
                        onClick={() => updateTenantStatus(tenant.id, 'TRIAL')}
                        className="text-amber-700 hover:underline font-bold ml-1.5"
                      >
                        Trial
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
