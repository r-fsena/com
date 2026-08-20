'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Send, 
  Plus, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Play, 
  Pause, 
  Sparkles,
  BarChart2,
  Filter
} from 'lucide-react';
import { safeFormatDate } from '@/lib/date-utils';

export function CampaignManager() {
  const { campaigns, createCampaign, contacts, instances } = useCRM();
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [name, setName] = useState('');
  const [targetSegment, setTargetSegment] = useState('LEADS_QUENTES');
  const [messageTemplate, setMessageTemplate] = useState(
    'Olá {{nome}}, temos uma oportunidade exclusiva de lançamento com unidades limitadas na região de seu interesse. Deseja receber as plantas?'
  );
  const [sendRate, setSendRate] = useState(20);

  // Audiência estimada baseada em consentimento e filtro
  const validContacts = contacts.filter(c => !c.hasOptedOut && c.consentGiven);
  const targetCount = targetSegment === 'LEADS_QUENTES' 
    ? validContacts.filter(c => c.temperature === 'HOT').length 
    : validContacts.length;

  const handleLaunchCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createCampaign({
      name: name.trim(),
      targetSegment: targetSegment === 'LEADS_QUENTES' ? 'Leads Quentes (Alta Prioridade)' : 'Todos os Contatos Válidos',
      totalRecipients: targetCount || 10,
      messageTemplate,
      sendRatePerMinute: sendRate,
      status: 'RUNNING',
    });

    setName('');
    setShowWizard(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Campanhas & Disparos WhatsApp</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Z-API Rate-Limited
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Envios segmentados com respeito a opt-out, cadência controlada e proteção anti-bloqueio
          </p>
        </div>

        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Campanha</span>
        </button>
      </div>

      {/* Campaign Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-4">
        {campaigns.map((camp) => {
          const deliveryRate = camp.sentCount > 0 ? Math.round((camp.deliveredCount / camp.sentCount) * 100) : 0;
          const readRate = camp.sentCount > 0 ? Math.round((camp.readCount / camp.sentCount) * 100) : 0;
          const replyRate = camp.sentCount > 0 ? Math.round((camp.repliedCount / camp.sentCount) * 100) : 0;

          return (
            <div
              key={camp.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900">{camp.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      camp.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800 animate-pulse' :
                      camp.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {camp.status === 'RUNNING' ? '● Em Execução' :
                       camp.status === 'COMPLETED' ? '✓ Concluída' : 'Pausada'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Público: <strong className="text-slate-700">{camp.targetSegment}</strong> • Taxa: {camp.sendRatePerMinute} msgs/min
                  </p>
                </div>

                <div className="text-right text-xs font-mono text-slate-500">
                  {safeFormatDate(camp.createdAt, 'dd/MM/yyyy HH:mm')}
                </div>
              </div>

              {/* Template Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-mono mb-4">
                "{camp.messageTemplate}"
              </div>

              {/* Real-time Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Destinatários</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{camp.totalRecipients}</span>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Enviados</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">{camp.sentCount}</span>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Entregues</span>
                  <span className="font-bold text-blue-700 font-mono text-sm">{camp.deliveredCount} ({deliveryRate}%)</span>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Lidos</span>
                  <span className="font-bold text-indigo-700 font-mono text-sm">{camp.readCount} ({readRate}%)</span>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Respondidos</span>
                  <span className="font-bold text-emerald-800 font-mono text-sm">{camp.repliedCount} ({replyRate}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm flex items-center justify-between">
              <span>Disparador de Campanha WhatsApp</span>
              <span className="text-xs text-emerald-400 font-mono">LGPD Compliant</span>
            </div>

            <form onSubmit={handleLaunchCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Campanha *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lançamento Coberturas Pinheiros (Setembro)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Segmento de Público</label>
                  <select
                    value={targetSegment}
                    onChange={(e) => setTargetSegment(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="LEADS_QUENTES">Leads Quentes (Alta Prioridade)</option>
                    <option value="TODOS">Todos os Contatos com Opt-in</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Velocidade (msgs/min)</label>
                  <input
                    type="number"
                    value={sendRate}
                    onChange={(e) => setSendRate(Number(e.target.value))}
                    max={30}
                    min={5}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Audience Preview Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-center justify-between">
                <div>
                  <p className="font-bold">Estimativa de Alcance:</p>
                  <p className="text-[11px] text-emerald-800">Contatos com Opt-in válido: {targetCount} destinatários</p>
                </div>
                <span className="text-sm font-bold font-mono bg-emerald-100 px-3 py-1 rounded-lg">
                  {targetCount} leads
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Texto da Mensagem (Variáveis disponíveis: {'{{nome}}'}, {'{{corretor_nome}}'})
                </label>
                <textarea
                  rows={3}
                  required
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWizard(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md transition"
                >
                  Confirmar e Iniciar Disparos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
