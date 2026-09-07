'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { TenantPlan, TenantStatus } from '@/types/crm';
import { 
  Building2, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  DollarSign, 
  Users, 
  MessageSquare, 
  Bot, 
  Globe, 
  CreditCard,
  Layers,
  ArrowRight,
  Zap,
  Clock
} from 'lucide-react';

interface SaaSNewTenantPageProps {
  onSuccess: () => void;
}

export function SaaSNewTenantPage({ onSuccess }: SaaSNewTenantPageProps) {
  const { saasPlans, createTenant } = useCRM();

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [documentCnpj, setDocumentCnpj] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3742AC');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(saasPlans[1]?.id || 'plan-pro');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [initialStatus, setInitialStatus] = useState<TenantStatus>('ACTIVE');
  const [trialDays, setTrialDays] = useState(14);
  const [isSuccess, setIsSuccess] = useState(false);

  const selectedPlan = saasPlans.find(p => p.id === selectedPlanId) || saasPlans[0];

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const monthlyPrice = billingCycle === 'ANNUAL' 
      ? (selectedPlan.annualPrice / 12) 
      : selectedPlan.monthlyPrice;

    createTenant({
      name: name.trim(),
      slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      documentCnpj: documentCnpj.trim() || '00.000.000/0001-00',
      logoUrl: logoUrl.trim() || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=128&auto=format&fit=crop&q=60',
      primaryColor,
      status: initialStatus,
      plan: selectedPlan.slug.toUpperCase() as TenantPlan,
      monthlyFee: monthlyPrice,
      maxBrokers: selectedPlan.maxBrokers,
      maxInstances: selectedPlan.maxInstances,
      timezone: 'America/Sao_Paulo',
      businessHours: {
        start: '08:30',
        end: '19:00',
        workDays: [1, 2, 3, 4, 5, 6],
      },
      settings: {
        slaFirstResponseMinutes: 15,
        slaInactivityHours: 24,
        autoAssignRule: 'ROUND_ROBIN',
        aiCopilotEnabled: selectedPlan.aiCopilotEnabled,
        requireHumanApprovalForAI: true,
      }
    });

    setIsSuccess(true);
    setTimeout(() => {
      onSuccess();
    }, 1000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header da Proposta Comercial */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Provisionar Nova Imobiliária</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Cadastre uma nova imobiliária, configure as cotas de corretores e instâncias, e ative o ambiente produtivo na hora.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Faturamento Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('ANNUAL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              billingCycle === 'ANNUAL' ? 'bg-[#3742AC] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Anual (-15%)</span>
            <span className="text-[9px] bg-white/20 px-1 rounded font-mono font-bold">PROMO</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Passo 1: Seleção de Plano Comercial Pré-definido */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#3742AC] text-white flex items-center justify-center text-xs font-black">1</span>
              <span>Selecione o Plano SaaS</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Sincronizado com o catálogo comercial</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {saasPlans.map(plan => {
              const isSelected = plan.id === selectedPlanId;
              const price = billingCycle === 'ANNUAL' ? (plan.annualPrice / 12) : plan.monthlyPrice;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-5 rounded-2xl border-2 transition cursor-pointer relative flex flex-col justify-between ${
                    isSelected 
                      ? 'border-[#3742AC] bg-indigo-50/40 shadow-md shadow-indigo-950/5 ring-2 ring-[#3742AC]/20' 
                      : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-2.5 right-4 bg-[#3742AC] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                      Mais Escolhido
                    </span>
                  )}

                  <div>
                    <h4 className="text-sm font-black text-slate-900">{plan.name}</h4>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-slate-900">
                        R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-600 border-t border-slate-200/80 pt-3">
                      <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-[#3742AC]" />
                        <span>Até {plan.maxBrokers} corretores</span>
                      </p>
                      <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{plan.maxInstances} linhas WhatsApp</span>
                      </p>
                      <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                        <span>IA Copiloto Inclusa</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/80">
                    <span className={`text-xs font-bold w-full py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                      isSelected ? 'bg-[#3742AC] text-white shadow-2xs' : 'bg-slate-200/70 text-slate-700'
                    }`}>
                      {isSelected ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                      <span>{isSelected ? 'Selecionado' : 'Escolher'}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Passo 2: Dados da Empresa & Branding */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#3742AC] text-white flex items-center justify-center text-xs font-black">2</span>
            <span>Dados da Imobiliária & Identidade</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1">Nome Fantasia da Imobiliária *</label>
              <input
                type="text"
                required
                placeholder="Ex: Prime Luxury Imóveis"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
              />
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">CNPJ da Empresa</label>
              <input
                type="text"
                placeholder="00.000.000/0001-00"
                value={documentCnpj}
                onChange={(e) => setDocumentCnpj(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
              />
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">Subdomínio / Slug Exclusivo *</label>
              <div className="flex items-center">
                <input
                  type="text"
                  required
                  placeholder="primeluxury"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-l-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                />
                <span className="bg-slate-100 border border-l-0 border-slate-200/90 px-3 py-2.5 rounded-r-xl text-slate-500 text-xs font-mono font-medium">
                  .faithhubs.com
                </span>
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">Cor Primária da Marca (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Passo 3: Condição Comercial & Ativação */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#3742AC] text-white flex items-center justify-center text-xs font-black">3</span>
            <span>Status Inicial do Ambiente</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onClick={() => setInitialStatus('ACTIVE')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center gap-3 ${
                initialStatus === 'ACTIVE' 
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs' 
                  : 'border-slate-200/80 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Ativo / Comercial</p>
                <p className="text-[11px] text-slate-500">Acesso liberado e cobrança ativa</p>
              </div>
            </div>

            <div 
              onClick={() => setInitialStatus('TRIAL')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center gap-3 ${
                initialStatus === 'TRIAL' 
                  ? 'border-amber-600 bg-amber-50/50 shadow-2xs' 
                  : 'border-slate-200/80 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Período de Testes (Trial)</p>
                <p className="text-[11px] text-slate-500">{trialDays} dias de degustação</p>
              </div>
            </div>

            <div 
              onClick={() => setInitialStatus('SUSPENDED')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center gap-3 ${
                initialStatus === 'SUSPENDED' 
                  ? 'border-rose-600 bg-rose-50/50 shadow-2xs' 
                  : 'border-slate-200/80 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Suspenso</p>
                <p className="text-[11px] text-slate-500">Acesso bloqueado provisoriamente</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo da Proposta e Botão de Ação */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-[#3742AC] text-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-indigo-950/20 border border-indigo-900/40 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-indigo-200 font-extrabold uppercase tracking-wider">Resumo do Provisionamento</p>
            <h4 className="text-lg font-black text-white mt-1">
              {name || 'Nome da Imobiliária'} • Plano {selectedPlan.name}
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Cotas: {selectedPlan.maxBrokers} corretores, {selectedPlan.maxInstances} linhas Z-API • R$ {selectedPlan.monthlyPrice}/mês
            </p>
          </div>

          <button
            type="submit"
            disabled={isSuccess}
            className="bg-white hover:bg-slate-100 text-[#3742AC] font-black px-6 py-3 rounded-2xl text-xs transition shadow-md shadow-slate-950/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Provisionando Ambiente...</span>
              </>
            ) : (
              <>
                <span>Emitir Proposta & Provisionar Ambiente</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
