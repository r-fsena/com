'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Building2, 
  Settings, 
  QrCode, 
  Wifi, 
  ShieldCheck, 
  Bot, 
  Clock, 
  Users, 
  Copy, 
  Check, 
  RefreshCw,
  Lock
} from 'lucide-react';

export function SettingsManager() {
  const { currentTenant, instances, syncZapiInstance, users } = useCRM();
  const [activeTab, setActiveTab] = useState<'ZAPI' | 'SLA' | 'AI' | 'TENANT' | 'TEAM'>('ZAPI');
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `https://api.vanguardcrm.com.br/v1/webhooks/zapi/${currentTenant.id}/${instances[0]?.zapiInstanceId || 'instance-01'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Configurações do Tenant & Integrações</h1>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento de instâncias Z-API, regras de SLA, IA Copiloto e equipe
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-6 text-xs font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('ZAPI')}
          className={`py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'ZAPI' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Instâncias Z-API (WhatsApp)</span>
        </button>

        <button
          onClick={() => setActiveTab('SLA')}
          className={`py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'SLA' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Regras de SLA & Distribuição</span>
        </button>

        <button
          onClick={() => setActiveTab('AI')}
          className={`py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'AI' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>IA Copiloto (Bedrock)</span>
        </button>

        <button
          onClick={() => setActiveTab('TENANT')}
          className={`py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'TENANT' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Dados da Imobiliária</span>
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
        {/* TAB 1: Z-API */}
        {activeTab === 'ZAPI' && (
          <div className="space-y-6">
            {/* Instance Cards */}
            {instances.map((inst) => (
              <div key={inst.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                      <Wifi className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{inst.name}</h3>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          ● Conectado
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-500">{inst.phoneNumber}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => syncZapiInstance(inst.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-xl px-3 py-1.5 transition font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Testar Conexão</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Instance ID (Z-API)</span>
                    <span className="font-bold text-slate-800">{inst.zapiInstanceId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Token de Segurança</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> AWS Secrets Manager (Encriptado)
                    </span>
                  </div>
                </div>

                {/* Webhook Endpoint */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL de Webhook (Copie e cole no painel oficial da Z-API)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-700 focus:outline-none"
                    />
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs"
                    >
                      {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: SLAs */}
        {activeTab === 'SLA' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Parametrização de SLAs & Atendimento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  SLA de Primeiro Atendimento (minutos)
                </label>
                <input
                  type="number"
                  defaultValue={currentTenant.settings.slaFirstResponseMinutes}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Dispara alerta caso um lead novo não seja respondido neste tempo.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alerta de Inatividade do Lead (horas)
                </label>
                <input
                  type="number"
                  defaultValue={currentTenant.settings.slaInactivityHours}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Sinaliza oportunidade estagnada no funil sem interação.
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-xs">
                Regra de Distribuição Automática de Novos Leads
              </label>
              <select
                defaultValue={currentTenant.settings.autoAssignRule}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
              >
                <option value="ROUND_ROBIN">Rodízio Circular entre Corretores Ativos (Round-Robin)</option>
                <option value="UNASSIGNED_QUEUE">Fila Geral de Não Atribuídos (A equipe puxa)</option>
                <option value="BY_REGION">Distribuição por Bairro / Região de Especialidade</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 3: IA */}
        {activeTab === 'AI' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-600" />
              <span>Configuração da IA Copiloto (Amazon Bedrock / Claude 3.5 Sonnet)</span>
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={currentTenant.settings.aiCopilotEnabled}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Ativar IA Copiloto no Atendimento</span>
                  <span className="text-slate-500 text-[11px]">
                    Gera resumos automáticos, identifica sentimento e extrai intenção de compra.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={currentTenant.settings.requireHumanApprovalForAI}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-emerald-950 block">Exigir Aprovação Humana (Human-in-the-Loop)</span>
                  <span className="text-emerald-800 text-[11px]">
                    Obrigatório no MVP: nenhuma mensagem é enviada ao cliente sem a validação do corretor.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* TAB 4: TENANT */}
        {activeTab === 'TENANT' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Perfil da Imobiliária (Multi-tenant)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Razão Social / Nome Fantasia</label>
                <input
                  type="text"
                  defaultValue={currentTenant.name}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  defaultValue={currentTenant.documentCnpj}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
