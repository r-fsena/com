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
  Tag
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
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header dos Planos */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Catálogo de Planos Comerciais SaaS</h2>
            <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
              {saasPlans.length} planos ativos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure os planos de assinatura disponíveis para venda. Estes planos alimentam automaticamente a tela de propostas comerciais.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewPlanModal}
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Criar Novo Plano</span>
        </button>
      </div>

      {/* Grid de Planos Comerciais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {saasPlans.map(plan => (
          <div
            key={plan.id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4 relative hover:shadow-md transition"
          >
            {plan.isPopular && (
              <span className="absolute -top-3 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
                Destaque / Popular
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
                  <span className="text-xs text-slate-500 font-semibold">/mês</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  R$ {plan.annualPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} /ano
                </p>
              </div>

              {/* Especificações Técnicas */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Até {plan.maxBrokers} corretores</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>{plan.maxInstances} instâncias WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span>{plan.aiCopilotEnabled ? 'IA Copilot Ativa' : 'Sem IA'}</span>
                </div>
              </div>

              {/* Features Inclusas */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Recursos inclusos:</p>
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => openEditModal(plan)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={() => deleteSaaSPlan(plan.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingPlan ? 'Editar Plano Comercial' : 'Criar Novo Plano Comercial'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure preços, limites e funcionalidades</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Diamond Corporate"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Identificador (Slug) *</label>
                  <input
                    type="text"
                    required
                    placeholder="diamond"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Preço Mensal (R$) *</label>
                  <input
                    type="number"
                    required
                    value={monthlyPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMonthlyPrice(val);
                      setAnnualPrice(val * 10); // Sugere 2 meses grátis
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-sm text-purple-700"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Preço Anual (R$) *</label>
                  <input
                    type="number"
                    required
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Limite de Corretores *</label>
                  <input
                    type="number"
                    required
                    value={maxBrokers}
                    onChange={(e) => setMaxBrokers(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Linhas WhatsApp Z-API *</label>
                  <input
                    type="number"
                    required
                    value={maxInstances}
                    onChange={(e) => setMaxInstances(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Recursos Inclusos (1 por linha)</label>
                <textarea
                  rows={4}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs leading-relaxed focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPopular}
                    onChange={(e) => setIsPopular(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <span className="text-slate-700 font-semibold text-xs">Marcar como Plano em Destaque (Popular)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Salvar Plano Comercial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
