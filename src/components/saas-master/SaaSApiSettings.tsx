'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Key, 
  Save, 
  CheckCircle2, 
  MessageSquare, 
  CreditCard, 
  Bot, 
  Server, 
  Globe, 
  ShieldCheck, 
  RefreshCw,
  Copy,
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';

export function SaaSApiSettings() {
  const { saasApiConfig, updateSaaSApiConfig } = useCRM();

  const [activeSubmenu, setActiveSubmenu] = useState<'ZAPI' | 'ASAAS' | 'AI_MODELS'>('ZAPI');
  const [isSaved, setIsSaved] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [zapiMasterKey, setZapiMasterKey] = useState(saasApiConfig.zapiMasterKey);
  const [zapiGlobalWebhook, setZapiGlobalWebhook] = useState(saasApiConfig.zapiGlobalWebhook);

  const [asaasMasterApiKey, setAsaasMasterApiKey] = useState(saasApiConfig.asaasMasterApiKey);
  const [asaasMasterWalletId, setAsaasMasterWalletId] = useState(saasApiConfig.asaasMasterWalletId);
  const [asaasWebhookUrl, setAsaasWebhookUrl] = useState(saasApiConfig.asaasWebhookUrl);

  const [awsBedrockModel, setAwsBedrockModel] = useState(saasApiConfig.awsBedrockModel);
  const [awsBedrockRegion, setAwsBedrockRegion] = useState(saasApiConfig.awsBedrockRegion);
  const [openAiApiKey, setOpenAiApiKey] = useState(saasApiConfig.openAiApiKey || '');
  const [googleGeminiApiKey, setGoogleGeminiApiKey] = useState(saasApiConfig.googleGeminiApiKey || '');

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSaaSApiConfig({
      zapiMasterKey,
      zapiGlobalWebhook,
      asaasMasterApiKey,
      asaasMasterWalletId,
      asaasWebhookUrl,
      awsBedrockModel,
      awsBedrockRegion,
      openAiApiKey,
      googleGeminiApiKey
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
              <Key className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Configurações de APIs & Infraestrutura Global</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Centralize as chaves mestras para gateways WhatsApp (Z-API), pagamentos (Asaas) e orquestração de LLMs para o Copiloto.
          </p>
        </div>

        {isSaved && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-fadeIn shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Configurações Salvas com Sucesso!</span>
          </div>
        )}
      </div>

      {/* Submenus Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubmenu('ZAPI')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeSubmenu === 'ZAPI'
              ? 'bg-[#3742AC] text-white shadow-md shadow-indigo-950/10'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/80'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>1. Z-API WhatsApp Gateway</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubmenu('ASAAS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeSubmenu === 'ASAAS'
              ? 'bg-[#3742AC] text-white shadow-md shadow-indigo-950/10'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/80'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>2. Asaas Gateway Master</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubmenu('AI_MODELS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeSubmenu === 'AI_MODELS'
              ? 'bg-[#3742AC] text-white shadow-md shadow-indigo-950/10'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/80'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>3. Modelos de IA & Provedores</span>
        </button>
      </div>

      {/* Conteúdo do Submenu */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SUBMENU 1: Z-API */}
        {activeSubmenu === 'ZAPI' && (
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Configuração Master do Gateway Z-API</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chave mestra de parceiro para provisionamento e gestão automatizada de instâncias WhatsApp
                </p>
              </div>

              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Status: Operacional</span>
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  Chave Mestra de Integrador Z-API (Master Partner Token)
                </label>
                <input
                  type="password"
                  value={zapiMasterKey}
                  onChange={(e) => setZapiMasterKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Permite criar, pausar e excluir instâncias WhatsApp programaticamente para cada nova imobiliária cliente.
                </p>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  URL de Webhook Global do SaaS
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={zapiGlobalWebhook}
                    onChange={(e) => setZapiGlobalWebhook(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-l-xl px-3.5 py-2.5 font-mono text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(zapiGlobalWebhook, 'webhook')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-l-0 border-slate-200 px-3.5 py-2.5 rounded-r-xl font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedField === 'webhook' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'webhook' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Todas as instâncias Z-API provisionadas transmitem eventos de mensagens em tempo real para este endpoint central.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUBMENU 2: ASAAS */}
        {activeSubmenu === 'ASAAS' && (
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Gateway de Pagamentos Asaas Master</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cobrança recorrente de assinaturas das imobiliárias e split automatizado
                </p>
              </div>

              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                Ambiente: Produção
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  API Key Master do Asaas (Produção)
                </label>
                <input
                  type="password"
                  value={asaasMasterApiKey}
                  onChange={(e) => setAsaasMasterApiKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Master Wallet ID (Conta Principal)
                  </label>
                  <input
                    type="text"
                    value={asaasMasterWalletId}
                    onChange={(e) => setAsaasMasterWalletId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Webhook de Notificações de Pagamento
                  </label>
                  <input
                    type="text"
                    value={asaasWebhookUrl}
                    onChange={(e) => setAsaasWebhookUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBMENU 3: MODELOS DE IA */}
        {activeSubmenu === 'AI_MODELS' && (
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span>Modelos de Inteligência Artificial & Provedores LLM</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Orquestração de modelos de linguagem para o Copiloto Imobiliário
                </p>
              </div>

              <span className="text-[10px] font-bold bg-indigo-50 text-[#3742AC] border border-indigo-200 px-2.5 py-1 rounded-full">
                AWS Bedrock Conectado
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Modelo Primário Padrão
                  </label>
                  <select
                    value={awsBedrockModel}
                    onChange={(e) => setAwsBedrockModel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 cursor-pointer focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  >
                    <option value="anthropic.claude-3-5-sonnet-20241022-v2:0">
                      ⚡ Anthropic Claude 3.5 Sonnet (Recomendado / Mais Rápido & Preciso)
                    </option>
                    <option value="openai.gpt-4o">
                      🧠 OpenAI GPT-4o
                    </option>
                    <option value="google.gemini-1.5-pro">
                      🔮 Google Gemini 1.5 Pro
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Região AWS Bedrock
                  </label>
                  <input
                    type="text"
                    value={awsBedrockRegion}
                    onChange={(e) => setAwsBedrockRegion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Chave OpenAI (Backup / Opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={openAiApiKey}
                    onChange={(e) => setOpenAiApiKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Chave Google Gemini (Backup / Opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={googleGeminiApiKey}
                    onChange={(e) => setGoogleGeminiApiKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botão de Salvar Alterações */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="bg-[#3742AC] hover:bg-[#2D368E] text-white font-bold px-6 py-3 rounded-2xl text-xs transition shadow-md shadow-indigo-950/10 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Configurações Globais</span>
          </button>
        </div>
      </form>
    </div>
  );
}
