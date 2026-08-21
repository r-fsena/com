'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Tenant, TenantPlan, TenantStatus } from '@/types/crm';
import { 
  Building2, 
  Plus, 
  ShieldCheck, 
  Users, 
  Smartphone, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  Search, 
  MoreVertical,
  ExternalLink,
  Settings,
  Trash2,
  Lock,
  Layers,
  Sparkles,
  TrendingUp,
  CreditCard,
  Building
} from 'lucide-react';

interface TenantManagerProps {
  onEnterTenant?: (tenant: Tenant) => void;
}

export function TenantManager({ onEnterTenant }: TenantManagerProps) {
  const { 
    tenants, 
    currentTenant, 
    setCurrentTenant, 
    createTenant, 
    updateTenantStatus, 
    deleteTenant, 
    currentUser 
  } = useCRM();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenantStatus>('ALL');
  const [isNewTenantModalOpen, setIsNewTenantModalOpen] = useState(false);

  // Form State para Novo Ambiente
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [documentCnpj, setDocumentCnpj] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#059669');
  const [plan, setPlan] = useState<TenantPlan>('PROFESSIONAL');
  const [monthlyFee, setMonthlyFee] = useState(890.00);
  const [maxBrokers, setMaxBrokers] = useState(15);
  const [maxInstances, setMaxInstances] = useState(3);
  const [logoUrl, setLogoUrl] = useState('');

  // Filtro
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.documentCnpj.includes(searchTerm) ||
                          t.slug.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  // Métricas Globais SaaS
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.status === 'ACTIVE').length;
  const trialTenants = tenants.filter(t => t.status === 'TRIAL').length;
  const totalMRR = tenants.reduce((acc, t) => t.status === 'ACTIVE' ? acc + (t.monthlyFee || 0) : acc, 0);
  const totalMaxBrokers = tenants.reduce((acc, t) => acc + (t.maxBrokers || 10), 0);

  const handlePlanChange = (selectedPlan: TenantPlan) => {
    setPlan(selectedPlan);
    if (selectedPlan === 'STARTER') {
      setMonthlyFee(490.00);
      setMaxBrokers(5);
      setMaxInstances(1);
    } else if (selectedPlan === 'PROFESSIONAL') {
      setMonthlyFee(890.00);
      setMaxBrokers(15);
      setMaxInstances(3);
    } else if (selectedPlan === 'ENTERPRISE') {
      setMonthlyFee(1490.00);
      setMaxBrokers(50);
      setMaxInstances(10);
    }
  };

  const handleCreateTenantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createTenant({
      name: name.trim(),
      slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      documentCnpj: documentCnpj.trim() || '00.000.000/0001-00',
      primaryColor,
      plan,
      monthlyFee,
      maxBrokers,
      maxInstances,
      logoUrl: logoUrl.trim() || undefined,
      status: 'TRIAL',
    });

    // Reset Form
    setName('');
    setSlug('');
    setDocumentCnpj('');
    setLogoUrl('');
    setIsNewTenantModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header do Gestor SaaS */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-800 flex items-center justify-center text-white shadow-md">
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Gestão de Ambientes • Dono do CRM (SaaS Hub)</h1>
            <span className="text-xs font-semibold bg-slate-900 text-emerald-400 border border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>SuperAdmin Multi-Tenant</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Crie, configure limites, monitore o faturamento de assinaturas e acesse qualquer imobiliária cadastrada na plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewTenantModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>+ Criar Novo Ambiente / Imobiliária</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Cards SaaS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MRR */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">MRR (Receita Mensal)</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Receita Recorrente SaaS Ativa</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          {/* Imobiliárias Ativas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ambientes Ativos</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {activeTenants} <span className="text-sm font-normal text-slate-400">/ {totalTenants}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {trialTenants} em período de teste (Trial)
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Building className="w-6 h-6" />
            </div>
          </div>

          {/* Capacidade de Corretores */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capacidade Corretores</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalMaxBrokers}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Licenças contratadas somadas
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Integração Gateway */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway Asaas</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Conectado & Ativo</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                Split Automático Ativo
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome da imobiliária, CNPJ ou slug..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({tenants.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'ACTIVE' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Ativos ({activeTenants})
            </button>
            <button
              onClick={() => setStatusFilter('TRIAL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'TRIAL' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Trial ({trialTenants})
            </button>
            <button
              onClick={() => setStatusFilter('SUSPENDED')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'SUSPENDED' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Suspensos
            </button>
          </div>
        </div>

        {/* Lista de Cards dos Ambientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTenants.map(tenant => {
            const isCurrent = tenant.id === currentTenant.id;
            return (
              <div 
                key={tenant.id}
                className={`bg-white rounded-2xl border p-5 transition flex flex-col justify-between relative shadow-xs hover:shadow-md ${
                  isCurrent ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/10' : 'border-slate-200'
                }`}
              >
                {/* Top Badge */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={tenant.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(tenant.name)}&background=059669&color=fff`}
                      alt={tenant.name}
                      className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900">{tenant.name}</h3>
                        {isCurrent && (
                          <span className="text-[9px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                            Ambiente Atual
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">CNPJ: {tenant.documentCnpj}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    tenant.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    tenant.status === 'TRIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {tenant.status === 'ACTIVE' ? '● Ativo' : tenant.status === 'TRIAL' ? '● Trial' : '● Suspenso'}
                  </span>
                </div>

                {/* Info do Plano */}
                <div className="py-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Plano Contratado:</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {tenant.plan || 'PROFESSIONAL'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Mensalidade SaaS:</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      R$ {(tenant.monthlyFee || 890).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Limite de Corretores:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Até {tenant.maxBrokers || 15} corretores</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Linhas WhatsApp Z-API:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Até {tenant.maxInstances || 3} instâncias</span>
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <select
                      value={tenant.status}
                      onChange={(e) => updateTenantStatus(tenant.id, e.target.value as TenantStatus)}
                      className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value="ACTIVE">Ativar</option>
                      <option value="TRIAL">Colocar em Trial</option>
                      <option value="SUSPENDED">Suspender</option>
                    </select>

                    {tenants.length > 1 && tenant.id !== 'tenant-vanguard-01' && (
                      <button
                        onClick={() => deleteTenant(tenant.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Excluir Ambiente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTenant(tenant);
                      if (onEnterTenant) onEnterTenant(tenant);
                    }}
                    className="bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                  >
                    <span>Entrar no CRM</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Criar Novo Ambiente */}
      {isNewTenantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Criar Novo Ambiente (Tenant)</h3>
                  <p className="text-[11px] text-slate-400">Cadastre uma nova imobiliária ou construtora</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewTenantModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenantSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Nome Fantasia da Imobiliária / Construtora *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prime Luxury Imóveis"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">CNPJ</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={documentCnpj}
                    onChange={(e) => setDocumentCnpj(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Subdomínio / Slug</label>
                  <input
                    type="text"
                    placeholder="prime-luxury"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Seleção de Plano */}
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Plano SaaS Contratado</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlanChange('STARTER')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      plan === 'STARTER' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold text-slate-900 text-xs">Starter</p>
                    <p className="text-[11px] text-emerald-700 font-bold mt-1">R$ 490/mês</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">5 corretores</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlanChange('PROFESSIONAL')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      plan === 'PROFESSIONAL' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold text-slate-900 text-xs">Professional</p>
                    <p className="text-[11px] text-emerald-700 font-bold mt-1">R$ 890/mês</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">15 corretores</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlanChange('ENTERPRISE')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      plan === 'ENTERPRISE' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold text-slate-900 text-xs">Enterprise</p>
                    <p className="text-[11px] text-emerald-700 font-bold mt-1">R$ 1.490/mês</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">50 corretores</p>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewTenantModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Criar Ambiente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
