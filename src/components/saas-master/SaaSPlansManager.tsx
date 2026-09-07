'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { SaaSPlan } from '@/types/crm';
import { 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  Users, 
  MessageSquare, 
  Bot, 
  DollarSign, 
  Edit3, 
  Trash2, 
  ShieldCheck,
  Zap,
  Tag,
  X
} from 'lucide-react';

export function SaaSPlansManager() {
  const { saasPlans, createSaaSPlan, updateSaaSPlan, deleteSaaSPlan } = useCRM();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState<number>(890);
  const [annualPrice, setAnnualPrice] = useState<number>(8900);
  const [maxBrokers, setMaxBrokers] = useState<number>(15);
  const [maxInstances, setMaxInstances] = useState<number>(3);
  const [aiCopilotEnabled, setAiCopilotEnabled] = useState(true);
  const [featuresText, setFeaturesText] = useState('Até 15 Corretores\n3 Linhas WhatsApp\nIA Copilot\nGateway Asaas');
  const [isPopular, setIsPopular] = useState(false);

  const openNewPlanModal = () => {
    setEditingPlan(null);
    setName('');
    setSlug('');
    setMonthlyPrice(890);
    setAnnualPrice(8900);
    setMaxBrokers(15);
    setMaxInstances(3);
    setAiCopilotEnabled(true);
    setFeaturesText('Até 15 Corretores\n3 Linhas WhatsApp\nIA Copiloto\nGateway Asaas Integrado');
    setIsPopular(false);
    setIsModalOpen(true);
  };

  const openEditModal = (plan: SaaSPlan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setSlug(plan.slug);
    setMonthlyPrice(plan.monthlyPrice);
    setAnnualPrice(plan.annualPrice);
    setMaxBrokers(plan.maxBrokers);
    setMaxInstances(plan.maxInstances);
    setAiCopilotEnabled(plan.aiCopilotEnabled);
    setFeaturesText(plan.features.join('\n'));
    setIsPopular(!!plan.isPopular);
    setIsModalOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const features = featuresText
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    if (editingPlan) {
      updateSaaSPlan(editingPlan.id, {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        monthlyPrice,
        annualPrice,
        maxBrokers,
        maxInstances,
        aiCopilotEnabled,
        features,
        isPopular
      });
    } else {
      createSaaSPlan({
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        monthlyPrice,
        annualPrice,
        maxBrokers,
        maxInstances,
        aiCopilotEnabled,
        features,
        isActive: true,
        isPopular
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header dos Planos */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Catálogo de Planos Comerciais SaaS</h2>
            <span className="text-xs font-bold font-mono bg-indigo-50 text-[#3742AC] border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
              {saasPlans.length} planos ativos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Defina faixas de preço, cotas de corretores e recursos. Estes planos alimentam o provisionamento e propostas comerciais.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewPlanModal}
          className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-md shadow-indigo-950/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Plano</span>
        </button>
      </div>

      {/* Grid de Planos Comerciais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {saasPlans.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-3xl border p-6 shadow-2xs flex flex-col justify-between space-y-4 relative hover:shadow-md transition ${
              plan.isPopular ? 'border-[#3742AC] ring-2 ring-[#3742AC]/15' : 'border-slate-200/80'
            }`}
          >
            {plan.isPopular && (
              <span className="absolute -top-3 right-6 bg-[#3742AC] text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
                Mais Escolhido
              </span>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-base">{plan.name}</h3>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  /{plan.slug}
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">
                    R$ {plan.monthlyPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/mês</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  R$ {plan.annualPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} /ano
                </p>
              </div>

              {/* Especificações Técnicas */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Users className="w-4 h-4 text-[#3742AC]" />
                  <span>Até {plan.maxBrokers} corretores</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>{plan.maxInstances} instâncias WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span>{plan.aiCopilotEnabled ? 'IA Copilot Inclusa' : 'Sem IA'}</span>
                </div>
              </div>

              {/* Features Inclusas */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recursos inclusos:</p>
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-slate-700 font-medium">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => openEditModal(plan)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold py-2 rounded-xl border border-slate-200/80 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={() => deleteSaaSPlan(plan.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer border border-transparent hover:border-rose-200"
                title="Excluir Plano"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Criar / Editar Plano */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-2xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-[#3742AC] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingPlan ? 'Editar Plano Comercial' : 'Criar Novo Plano Comercial'}
                  </h3>
                  <p className="text-[11px] text-indigo-200">Configure preços, limites e funcionalidades</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Growth Imobiliário"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Slug Identificador *</label>
                  <input
                    type="text"
                    required
                    placeholder="growth"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Preço Mensal (R$) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Preço Anual Total (R$) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Máx. Corretores *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={maxBrokers}
                    onChange={(e) => setMaxBrokers(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Máx. Linhas Z-API *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={maxInstances}
                    onChange={(e) => setMaxInstances(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Recursos Inclusos (1 por linha)</label>
                <textarea
                  rows={4}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aiCopilotEnabled}
                    onChange={(e) => setAiCopilotEnabled(e.target.checked)}
                    className="rounded text-[#3742AC] focus:ring-[#3742AC] w-4 h-4"
                  />
                  <span className="font-semibold text-slate-800">Habilitar IA Copiloto neste plano</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPopular}
                    onChange={(e) => setIsPopular(e.target.checked)}
                    className="rounded text-[#3742AC] focus:ring-[#3742AC] w-4 h-4"
                  />
                  <span className="font-semibold text-slate-800">Marcar como Plano Popular / Destaque</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold px-5 py-2 rounded-xl transition shadow-md shadow-indigo-950/10 cursor-pointer"
                >
                  {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
