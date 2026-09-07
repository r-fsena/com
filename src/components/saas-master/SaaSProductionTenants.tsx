'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Tenant, TenantStatus, TenantPlan, TenantFeatureFlags } from '@/types/crm';
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
  Plus, 
  Sparkles,
  X,
  Save,
  Globe,
  Palette,
  Bot,
  Zap,
  Check
} from 'lucide-react';

interface SaaSProductionTenantsProps {
  onEnterTenant: (tenant: Tenant) => void;
  onNavigateToNewTenant: () => void;
}

export function SaaSProductionTenants({ onEnterTenant, onNavigateToNewTenant }: SaaSProductionTenantsProps) {
  const { tenants, currentTenant, updateTenantStatus, updateTenantById, deleteTenant, saasPlans } = useCRM();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenantStatus>('ALL');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Estado do Modal de Edição de Ambiente
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<'info' | 'plan' | 'modules'>('info');

  // Campos do Formulário de Edição
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDocumentCnpj, setFormDocumentCnpj] = useState('');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#3742AC');
  const [formPlan, setFormPlan] = useState<TenantPlan>('PROFESSIONAL');
  const [formMonthlyFee, setFormMonthlyFee] = useState<number>(890);
  const [formMaxBrokers, setFormMaxBrokers] = useState<number>(15);
  const [formMaxInstances, setFormMaxInstances] = useState<number>(3);
  const [formStatus, setFormStatus] = useState<TenantStatus>('ACTIVE');
  const [formFeatureFlags, setFormFeatureFlags] = useState<TenantFeatureFlags>({
    whatsappAutoSync: true,
    whatsappVoiceTranscription: true,
    whatsappLabelsSync: true,
    whatsappMultiBroker: true,
    campaigns: true,
    automations: true,
    aiCopilot: true,
    aiAutoScoring: true,
    aiRequireHumanApproval: false,
    kanbanDeals: true,
    financialQualification: true,
    presentedProperties: true,
    leadImportExport: true,
    proposals: true,
    asaasBilling: true,
    lgpdCompliance: true,
  });

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.documentCnpj && t.documentCnpj.includes(searchTerm));
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  const handleOpenEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormSlug(tenant.slug);
    setFormDocumentCnpj(tenant.documentCnpj || '');
    setFormPrimaryColor(tenant.primaryColor || '#3742AC');
    setFormPlan(tenant.plan || 'PROFESSIONAL');
    setFormMonthlyFee(tenant.monthlyFee ?? 890);
    setFormMaxBrokers(tenant.maxBrokers ?? 15);
    setFormMaxInstances(tenant.maxInstances ?? 3);
    setFormStatus(tenant.status || 'ACTIVE');
    setFormFeatureFlags(tenant.featureFlags || {
      whatsappAutoSync: true,
      whatsappVoiceTranscription: true,
      whatsappLabelsSync: true,
      whatsappMultiBroker: true,
      campaigns: true,
      automations: true,
      aiCopilot: true,
      aiAutoScoring: true,
      aiRequireHumanApproval: false,
      kanbanDeals: true,
      financialQualification: true,
      presentedProperties: true,
      leadImportExport: true,
      proposals: true,
      asaasBilling: true,
      lgpdCompliance: true,
    });
    setActiveEditTab('info');
    setIsEditModalOpen(true);
  };

  const handlePlanSelect = (selectedPlan: TenantPlan) => {
    setFormPlan(selectedPlan);
    if (selectedPlan === 'STARTER') {
      setFormMonthlyFee(490);
      setFormMaxBrokers(5);
      setFormMaxInstances(1);
    } else if (selectedPlan === 'PROFESSIONAL') {
      setFormMonthlyFee(890);
      setFormMaxBrokers(15);
      setFormMaxInstances(3);
    } else if (selectedPlan === 'ENTERPRISE') {
      setFormMonthlyFee(1490);
      setFormMaxBrokers(50);
      setFormMaxInstances(10);
    }
  };

  const handleSaveTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    const updates: Partial<Tenant> = {
      name: formName.trim() || editingTenant.name,
      slug: formSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || editingTenant.slug,
      documentCnpj: formDocumentCnpj.trim(),
      primaryColor: formPrimaryColor,
      plan: formPlan,
      monthlyFee: Number(formMonthlyFee) || 0,
      maxBrokers: Math.max(1, Number(formMaxBrokers) || 1),
      maxInstances: Math.max(1, Number(formMaxInstances) || 1),
      status: formStatus,
      featureFlags: formFeatureFlags,
    };

    updateTenantById(editingTenant.id, updates);
    setIsEditModalOpen(false);
    setSuccessToast(`Ambiente "${updates.name}" atualizado com sucesso!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const toggleFeatureFlag = (key: keyof TenantFeatureFlags) => {
    setFormFeatureFlags(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span className="text-xs font-bold">{successToast}</span>
          <button 
            type="button" 
            onClick={() => setSuccessToast(null)} 
            className="text-emerald-200 hover:text-white ml-2 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

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
            Gerencie e edite diretamente o contrato, dados cadastrais e limites de cada imobiliária, ou entre em Modo Gestão (Impersonate).
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão de Edição Direta no Topo */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(tenant)}
                        className="p-1.5 text-slate-400 hover:text-[#3742AC] hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                        title="Editar Informações do Ambiente"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

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
                  <div className="grid grid-cols-2 gap-2">
                    {/* Botão de Edição */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(tenant)}
                      className="w-full bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-[#3742AC] border border-slate-200/80 hover:border-indigo-200 text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#3742AC]" />
                      <span>Editar Dados</span>
                    </button>

                    {/* Botão de Destaque: Entrar no CRM da Imobiliária */}
                    <button
                      type="button"
                      onClick={() => onEnterTenant(tenant)}
                      className="w-full bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98 group/btn"
                    >
                      <span className="truncate">Entrar</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform shrink-0" />
                    </button>
                  </div>

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

      {/* MODAL SOVEREIGN: Edição do Ambiente pelo Admin Master */}
      {isEditModalOpen && editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-scaleUp">
            
            {/* Header do Modal */}
            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black shadow-md text-sm border border-white/20"
                  style={{ backgroundColor: formPrimaryColor }}
                >
                  {formName.slice(0, 2).toUpperCase() || 'IM'}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Editar Ambiente</span>
                    <span className="text-[10px] font-mono bg-white/10 text-slate-300 px-2 py-0.5 rounded-md">
                      {editingTenant.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Modifique contratos, dados cadastrais e limites operacionais da imobiliária
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Abas do Modal */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50/70 px-6 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveEditTab('info')}
                className={`pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeEditTab === 'info'
                    ? 'border-[#3742AC] text-[#3742AC]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Dados Cadastrais</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditTab('plan')}
                className={`pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeEditTab === 'plan'
                    ? 'border-[#3742AC] text-[#3742AC]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Plano & Contrato SaaS</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditTab('modules')}
                className={`pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeEditTab === 'modules'
                    ? 'border-[#3742AC] text-[#3742AC]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Módulos & Recursos</span>
              </button>
            </div>

            {/* Corpo do Formulário */}
            <form onSubmit={handleSaveTenant} className="p-6 space-y-5 text-xs">
              
              {/* ABA 1: DADOS CADASTRAIS */}
              {activeEditTab === 'info' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1.5">
                      Nome Fantasia da Imobiliária / Construtora *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Amábile Barbarotti Imóveis"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30 focus:border-[#3742AC]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        Subdomínio / Slug (Acesso) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={formSlug}
                          onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          placeholder="amabile-barbarotti"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-24 py-2.5 font-mono text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30 focus:border-[#3742AC]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono select-none">
                          .faithhubs.com
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        CNPJ / Inscrição Municipal
                      </label>
                      <input
                        type="text"
                        value={formDocumentCnpj}
                        onChange={(e) => setFormDocumentCnpj(e.target.value)}
                        placeholder="00.000.000/0001-00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30 focus:border-[#3742AC]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        Cor Primária da Marca (Visual do CRM)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                        />
                        <input
                          type="text"
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          placeholder="#3742AC"
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        Status do Ambiente
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as TenantStatus)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30 cursor-pointer"
                      >
                        <option value="ACTIVE">Ativo (Operação Liberada)</option>
                        <option value="TRIAL">Trial (Período de Demonstração)</option>
                        <option value="SUSPENDED">Suspenso (Inadimplente / Bloqueado)</option>
                        <option value="INACTIVE">Inativo</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: PLANO & CONTRATO SAAS */}
              {activeEditTab === 'plan' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="text-slate-700 font-bold block mb-2">
                      Plano Contratado
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handlePlanSelect('STARTER')}
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer relative ${
                          formPlan === 'STARTER'
                            ? 'bg-indigo-50/60 border-[#3742AC] ring-2 ring-[#3742AC]/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {formPlan === 'STARTER' && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-[#3742AC] text-white rounded-full flex items-center justify-center text-[10px]">
                            ✓
                          </span>
                        )}
                        <p className="font-extrabold text-slate-900 text-xs">Starter</p>
                        <p className="text-xs font-extrabold text-[#3742AC] mt-1">R$ 490/mês</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">5 corretores • 1 linha</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePlanSelect('PROFESSIONAL')}
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer relative ${
                          formPlan === 'PROFESSIONAL'
                            ? 'bg-indigo-50/60 border-[#3742AC] ring-2 ring-[#3742AC]/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {formPlan === 'PROFESSIONAL' && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-[#3742AC] text-white rounded-full flex items-center justify-center text-[10px]">
                            ✓
                          </span>
                        )}
                        <p className="font-extrabold text-slate-900 text-xs">Professional</p>
                        <p className="text-xs font-extrabold text-[#3742AC] mt-1">R$ 890/mês</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">15 corretores • 3 linhas</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePlanSelect('ENTERPRISE')}
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer relative ${
                          formPlan === 'ENTERPRISE'
                            ? 'bg-indigo-50/60 border-[#3742AC] ring-2 ring-[#3742AC]/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {formPlan === 'ENTERPRISE' && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-[#3742AC] text-white rounded-full flex items-center justify-center text-[10px]">
                            ✓
                          </span>
                        )}
                        <p className="font-extrabold text-slate-900 text-xs">Enterprise</p>
                        <p className="text-xs font-extrabold text-[#3742AC] mt-1">R$ 1.490/mês</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">50 corretores • 10 linhas</p>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        Mensalidade Asaas (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formMonthlyFee}
                          onChange={(e) => setFormMonthlyFee(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        Capacidade de Corretores
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={formMaxBrokers}
                        onChange={(e) => setFormMaxBrokers(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30"
                      />
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1.5">
                        Linhas WhatsApp Z-API
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formMaxInstances}
                        onChange={(e) => setFormMaxInstances(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/30"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-[11px] text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p>
                      Alterações no valor da mensalidade e capacidade são aplicadas imediatamente ao ambiente sem exigir re-login da equipe da imobiliária.
                    </p>
                  </div>
                </div>
              )}

              {/* ABA 3: MÓDULOS & FEATURE FLAGS */}
              {activeEditTab === 'modules' && (
                <div className="space-y-3 animate-fadeIn">
                  <p className="text-[11px] text-slate-500 mb-2">
                    Ligue ou desligue módulos específicos para customizar a entrega deste cliente:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { key: 'aiCopilot', label: 'IA Copiloto & Sugestões', desc: 'Respostas inteligentes e transcrição' },
                      { key: 'whatsappAutoSync', label: 'WhatsApp Auto-Sync', desc: 'Sincronização contínua de contatos' },
                      { key: 'whatsappMultiBroker', label: 'Linhas WhatsApp por Corretor', desc: 'Múltiplas instâncias Z-API' },
                      { key: 'campaigns', label: 'Campanhas em Lote', desc: 'Disparos e réguas de aquecimento' },
                      { key: 'proposals', label: 'Propostas Comerciais', desc: 'Aceite digital e PDF de proposta' },
                      { key: 'kanbanDeals', label: 'Funil Visual Kanban', desc: 'Gestão de etapas de negociação' },
                      { key: 'financialQualification', label: 'Qualificação Financeira 360º', desc: 'Renda, FGTS e entrada' },
                      { key: 'asaasBilling', label: 'Cobrança Asaas', desc: 'Faturas e cobranças automáticas' },
                    ].map(module => {
                      const isEnabled = Boolean(formFeatureFlags[module.key as keyof TenantFeatureFlags]);
                      return (
                        <div
                          key={module.key}
                          onClick={() => toggleFeatureFlag(module.key as keyof TenantFeatureFlags)}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                            isEnabled
                              ? 'bg-indigo-50/50 border-[#3742AC]/40'
                              : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 text-xs">{module.label}</p>
                            <p className="text-[10px] text-slate-400 truncate">{module.desc}</p>
                          </div>

                          <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${
                            isEnabled ? 'bg-[#3742AC]' : 'bg-slate-300'
                          }`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rodapé de Ações do Modal */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="bg-[#3742AC] hover:bg-[#2D368E] text-white font-extrabold px-6 py-2.5 rounded-xl shadow-md shadow-indigo-950/10 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
