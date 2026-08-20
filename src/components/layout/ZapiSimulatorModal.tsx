'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Bot, Send, X, Sparkles, MessageSquare, CheckCircle2, Code2 } from 'lucide-react';

interface ZapiSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZapiSimulatorModal({ isOpen, onClose }: ZapiSimulatorModalProps) {
  const { simulateIncomingMessage, instances, currentTenant } = useCRM();

  const [leadName, setLeadName] = useState('Dra. Beatriz Albuquerque');
  const [leadPhone, setLeadPhone] = useState('+55 11 98112-9988');
  const [messageContent, setMessageContent] = useState(
    'Olá! Vi o anúncio no Instagram do empreendimento Horizon Jardins. Tenho R$ 900 mil de entrada e gostaria de saber as opções de 3 ou 4 suítes.'
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [showJsonPayload, setShowJsonPayload] = useState(false);

  if (!isOpen) return null;

  const presets = [
    {
      title: 'Médica (Alta Renda - Jardins)',
      name: 'Dra. Beatriz Albuquerque',
      phone: '+55 11 98112-9988',
      message: 'Olá! Vi o anúncio no Instagram do empreendimento Horizon Jardins. Tenho R$ 900 mil de entrada e gostaria de saber as opções de 3 ou 4 suítes.',
    },
    {
      title: 'Investidor (Short Stay / Studios Faria Lima)',
      name: 'Gustavo Mendonça Castro',
      phone: '+55 11 97223-4455',
      message: 'Boa tarde! Sou investidor e estou buscando 2 ou 3 unidades compactas mobiliadas para locação no Airbnb perto da Faria Lima. Pagamento à vista.',
    },
    {
      title: 'Família (Primeiro Imóvel Pinheiros)',
      name: 'Thiago & Aline Prado',
      phone: '+55 11 96334-5566',
      message: 'Oi! Buscamos apartamento de 2 ou 3 quartos em Pinheiros até R$ 1.3M. Aceita financiamento Caixa? Nosso pet é porte médio.',
    }
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    setLeadName(preset.name);
    setLeadPhone(preset.phone);
    setMessageContent(preset.message);
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) return;

    setIsSimulating(true);

    setTimeout(() => {
      simulateIncomingMessage(leadPhone, leadName, messageContent.trim());
      setIsSimulating(false);
      onClose();
    }, 600);
  };

  const mockZapiPayload = {
    event: "on-message-received",
    instanceId: instances[0]?.zapiInstanceId || "3C9B8A7F20D1",
    messageId: `ZAPI-${Date.now()}`,
    phone: leadPhone.replace(/\D/g, ''),
    fromMe: false,
    text: {
      message: messageContent
    },
    senderName: leadName,
    momment: Date.now(),
    tenantContext: {
      tenantId: currentTenant.id,
      tenantSlug: currentTenant.slug
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Bot className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Simulador de Webhook Z-API</h2>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  v1.2 Ingest
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                Dispare mensagens recebidas pelo WhatsApp para testar a criação de lead e IA Copiloto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSimulate} className="p-6 space-y-4">
          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Cenários Pré-configurados (Clique para carregar):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {presets.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/50 transition group"
                >
                  <p className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-700 truncate">
                    {p.title}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{p.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Lead (WhatsApp Sender)
              </label>
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                required
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone (Formato E.164)
              </label>
              <input
                type="text"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                required
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Conteúdo da Mensagem Recebida
            </label>
            <textarea
              rows={3}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              required
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Toggle JSON view */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowJsonPayload(!showJsonPayload)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showJsonPayload ? 'Ocultar Payload JSON do Webhook' : 'Visualizar Payload JSON Z-API'}</span>
            </button>

            {showJsonPayload && (
              <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 text-[10px] rounded-xl font-mono overflow-x-auto max-h-36">
                {JSON.stringify(mockZapiPayload, null, 2)}
              </pre>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSimulating}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 transition active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSimulating ? 'Processando Webhook...' : 'Simular Recebimento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
