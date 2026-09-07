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
  Plus,
  Sparkles
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
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header dos Ambientes Produtivos */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Ambientes Produtivos & Imobiliárias</h2>
            <span className="text-xs font-bold font-mono bg-indigo-50 text-[#3742AC] border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
              {tenants.length} cadastradas
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Gerencie as imobiliárias ativas no SaaS e entre em qualquer ambiente em Modo Gestão (Impersonate) com 1 clique.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToNewTenant}
          className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-md shadow-indigo-950/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Provisionar Nova Imobiliária</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome da imobiliária, CNPJ ou subdomínio..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'ALL' 
                ? 'bg-white text-slate-900 shadow-2xs font-extrabold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todas ({tenants.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ACTIVE' 
                ? 'bg-emerald-600 text-white shadow-2xs font-extrabold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ativas</span>
          </button>
          <button
            onClick={() => setStatusFilter('TRIAL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'TRIAL' 
                ? 'bg-amber-600 text-white shadow-2xs font-extrabold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Trial</span>
          </button>
          <button
            onClick={() => setStatusFilter('SUSPENDED')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'SUSPENDED' 
                ? 'bg-rose-600 text-white shadow-2xs font-extrabold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Suspensas</span>
          </button>
        </div>
      </div>

      {/* Grid de Cards dos Ambientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">Nenhum ambiente encontrado</p>
            <p className="text-xs text-slate-400">Tente buscar por outro termo ou limpe os filtros.</p>
          </div>
        ) : (
          filteredTenants.map(tenant => {
            const isActive = tenant.status === 'ACTIVE';
            const isTrial = tenant.status === 'TRIAL';
            const isSuspended = tenant.status === 'SUSPENDED';

            return (
              <div
                key={tenant.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md hover:border-indigo-200 transition flex flex-col justify-between space-y-4 group"
              >
                {/* Topo do Card */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-xs text-base shrink-0"
                        style={{ backgroundColor: tenant.primaryColor || '#3742AC' }}
                      >
                        {tenant.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-[#3742AC] transition truncate">
                          {tenant.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {tenant.slug}.faithhubs.com
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${
                      isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      isTrial ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {isActive ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> :
                       isTrial ? <Clock className="w-3 h-3 text-amber-500" /> :
                       <AlertTriangle className="w-3 h-3 text-rose-600" />}
                      <span>{tenant.status}</span>
                    </span>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Plano Contratado:</span>
                      <span className="font-extrabold text-[#3742AC] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[11px]">
                        {tenant.plan}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Mensalidade Asaas:</span>
                      <span className="font-extrabold text-emerald-700">
                        R$ {tenant.monthlyFee?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Capacidade Corretores:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#3742AC]" />
                        <span>Até {tenant.maxBrokers} corretores</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Linhas WhatsApp Z-API:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{tenant.maxInstances} conexões</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">CNPJ / Documento:</span>
                      <span className="font-mono text-[11px] text-slate-600 font-medium">{tenant.documentCnpj || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Card */}
                <div className="pt-3.5 border-t border-slate-100 space-y-2">
                  {/* Botão de Destaque: Entrar no CRM da Imobiliária */}
                  <button
                    type="button"
                    onClick={() => onEnterTenant(tenant)}
                    className="w-full bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 group/btn"
                  >
                    <span>Entrar no CRM desta Imobiliária</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>

                  {/* Status Switcher Rápido */}
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 pt-1">
                    <span>Alterar Status:</span>
                    <div className="flex items-center gap-1.5">
                      {tenant.status !== 'ACTIVE' && (
                        <button
                          onClick={() => updateTenantStatus(tenant.id, 'ACTIVE')}
                          className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                        >
                          Ativar
                        </button>
                      )}
                      {tenant.status !== 'TRIAL' && (
                        <button
                          onClick={() => updateTenantStatus(tenant.id, 'TRIAL')}
                          className="text-amber-700 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                        >
                          Trial
                        </button>
                      )}
                      {tenant.status !== 'SUSPENDED' && (
                        <button
                          onClick={() => updateTenantStatus(tenant.id, 'SUSPENDED')}
                          className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                        >
                          Suspender
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
