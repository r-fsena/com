'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { UserPlus, X, DollarSign, MapPin, Tag, Building } from 'lucide-react';
import { LeadTemperature, PropertyType } from '@/types/crm';
import { maskCurrencyInput, parseBRLInputToNumber, formatBRL } from '@/lib/currency-utils';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewLeadModal({ isOpen, onClose }: NewLeadModalProps) {
  const { addContact, createDeal, currentPipeline, users, currentUser } = useCRM();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+55 11 ');
  const [email, setEmail] = useState('');
  const [temperature, setTemperature] = useState<LeadTemperature>('WARM');
  const [source, setSource] = useState('WHATSAPP');
  const [propertyType, setPropertyType] = useState<PropertyType>('APARTMENT');
  const [targetBedrooms, setTargetBedrooms] = useState('2');
  const [purchasePurpose, setPurchasePurpose] = useState<'LIVING' | 'INVESTMENT'>('LIVING');
  const [region, setRegion] = useState('Jardins');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [downPayment, setDownPayment] = useState('500.000');
  const [maxBudget, setMaxBudget] = useState('1.800.000');
  const [assignedUserId, setAssignedUserId] = useState(currentUser.id);
  const [tags, setTags] = useState('Novo Cadastro, Alto Padrão');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const cleanMonthly = parseBRLInputToNumber(monthlyIncome);
    const cleanDown = parseBRLInputToNumber(downPayment);
    const cleanMax = parseBRLInputToNumber(maxBudget);

    // 1. Cria o contato com qualificação completa
    const contact = addContact({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      temperature,
      source: source as any,
      preferredPropertyType: propertyType,
      targetBedrooms: targetBedrooms ? Number(targetBedrooms) : undefined,
      purchasePurpose,
      targetRegions: [region],
      monthlyIncome: cleanMonthly > 0 ? cleanMonthly : undefined,
      downPaymentAvailable: cleanDown,
      maxPropertyValue: cleanMax,
      assignedUserId,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });

    // 2. Cria negócio no primeiro estágio do funil
    createDeal({
      contactId: contact.id,
      assignedUserId,
      title: `${propertyType === 'PENTHOUSE' ? 'Cobertura' : propertyType === 'HOUSE' ? 'Casa' : 'Apartamento'} ${targetBedrooms ? `${targetBedrooms}D ` : ''}em ${region} - ${name}`,
      expectedValue: cleanMax || 1200000,
      stageId: currentPipeline.stages[0].id,
      manualProbability: 60,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Novo Lead & Oportunidade</h2>
              <p className="text-xs text-slate-400">
                Cadastre o lead com perfil 360º e insira diretamente no funil de vendas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome Completo do Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Dra. Mariana Vasconcelos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp (com DDD) *
              </label>
              <input
                type="text"
                required
                placeholder="+55 11 99999-8888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail (Opcional)
              </label>
              <input
                type="email"
                placeholder="cliente@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Origem do Lead
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="WHATSAPP">WhatsApp Direto</option>
                <option value="INSTAGRAM_ADS">Instagram Ads</option>
                <option value="FACEBOOK_ADS">Facebook Ads</option>
                <option value="PORTAL_ZAP">Portal ZAP</option>
                <option value="PORTAL_VIVAREAL">VivaReal</option>
                <option value="GOOGLE">Google Ads</option>
                <option value="INDICATION">Indicação</option>
                <option value="MANUAL">Cadastro Manual / Loja</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Temperatura Inicial
              </label>
              <select
                value={temperature}
                onChange={(e) => setTemperature(e.target.value as LeadTemperature)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="HOT">🔥 Quente (Decisão em 30d)</option>
                <option value="WARM">⚡ Morno (1 a 3 meses)</option>
                <option value="COLD">❄️ Frio (Curioso / Futuro)</option>
              </select>
            </div>
          </div>

          {/* Qualificação Imobiliária */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              Interesse Imobiliário & Capacidade Financeira
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Tipo de Imóvel
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="APARTMENT">Apartamento</option>
                  <option value="PENTHOUSE">Cobertura</option>
                  <option value="HOUSE">Casa em Condomínio</option>
                  <option value="STUDIO">Studio / Compacto</option>
                  <option value="LAND">Terreno / Lote</option>
                  <option value="COMMERCIAL">Comercial</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Dormitórios
                </label>
                <select
                  value={targetBedrooms}
                  onChange={(e) => setTargetBedrooms(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="">Não especificado</option>
                  <option value="1">1 Dormitório</option>
                  <option value="2">2 Dormitórios</option>
                  <option value="3">3 Dormitórios</option>
                  <option value="4">4+ Dormitórios</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Finalidade
                </label>
                <select
                  value={purchasePurpose}
                  onChange={(e) => setPurchasePurpose(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="LIVING">Moradia Própria</option>
                  <option value="INVESTMENT">Investimento / Renda</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Região Desejada
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Ex: Pinheiros, Palhoça"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                </input>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Renda Mensal
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
                  <span className="text-xs font-bold text-slate-400 font-mono mr-1 select-none">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="15.000"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(maskCurrencyInput(e.target.value))}
                    className="w-full text-xs bg-transparent font-mono font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Entrada Disponível
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
                  <span className="text-xs font-bold text-slate-400 font-mono mr-1 select-none">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="100.000"
                    value={downPayment}
                    onChange={(e) => setDownPayment(maskCurrencyInput(e.target.value))}
                    className="w-full text-xs bg-transparent font-mono font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Orçamento Máximo
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
                  <span className="text-xs font-bold text-slate-400 font-mono mr-1 select-none">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="800.000"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(maskCurrencyInput(e.target.value))}
                    className="w-full text-xs bg-transparent font-mono font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Corretor Responsável
                </label>
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Tags (Separadas por vírgula)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Ex: Alto Padrão, Médico, Visita Final de Semana"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 transition active:scale-95"
            >
              Cadastrar Lead & Criar Negócio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
