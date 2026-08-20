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
  Lock,
  Smartphone,
  Send,
  Sliders,
  Calendar,
  UserPlus,
  Shield,
  Palette,
  Globe
} from 'lucide-react';

interface SettingsManagerProps {
  onOpenQrCodeModal?: () => void;
}

export function SettingsManager({ onOpenQrCodeModal }: SettingsManagerProps) {
  const { currentTenant, instances, syncZapiInstance, users } = useCRM();
  const [activeTab, setActiveTab] = useState<'ZAPI' | 'TENANT' | 'SLA' | 'AI' | 'TEAM'>('ZAPI');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testPhone, setTestPhone] = useState('+55 11 99123-4567');
  const [testSent, setTestSent] = useState(false);

  const webhookUrl = `https://crm.faithhubs.com/api/v1/webhooks/zapi/${currentTenant.id}/${instances[0]?.zapiInstanceId || 'instance-01'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Configurações & Painel de Controle</h1>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie de forma isolada as conexões do WhatsApp, regras de negócio, IA e equipe
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs (Separadas por Categoria) */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-2 sm:gap-6 text-xs font-semibold text-slate-500 overflow-x-auto no-scrollbar">
        {/* ABA 1: WHATSAPP */}
        <button
          onClick={() => setActiveTab('ZAPI')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ZAPI'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span>WhatsApp & Z-API</span>
        </button>

        {/* ABA 2: EMPRESA */}
        <button
          onClick={() => setActiveTab('TENANT')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'TENANT'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>Dados da Imobiliária</span>
        </button>

        {/* ABA 3: SLAS E DISTRIBUIÇÃO */}
        <button
          onClick={() => setActiveTab('SLA')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'SLA'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>SLAs & Horário Comercial</span>
        </button>

        {/* ABA 4: IA COPILOTO */}
        <button
          onClick={() => setActiveTab('AI')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'AI'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-purple-600" />
          <span>IA Copiloto (Bedrock)</span>
        </button>

        {/* ABA 5: EQUIPE */}
        <button
          onClick={() => setActiveTab('TEAM')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'TEAM'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-blue-500" />
          <span>Equipe & Permissões RBAC</span>
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
        
        {/* ========================================================================= */}
        {/* ABA 1: WHATSAPP & Z-API (Exclusivo para conexão e gerenciamento de linha) */}
        {/* ========================================================================= */}
        {activeTab === 'ZAPI' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-300">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Instância WhatsApp Ativa
                    </span>
                    <h2 className="text-lg font-bold text-white">Z-API Gateway Oficial</h2>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  OPERACIONAL
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 leading-relaxed">
                Todas as mensagens recebidas e enviadas pelos corretores passam por esta instância oficial da Z-API com fila SQS e criptografia.
              </p>
            </div>

            {/* Card da Instância com Ações */}
            {instances.map(inst => (
              <div key={inst.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 font-bold">
                      WA
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

                  <div className="flex items-center gap-2">
                    {onOpenQrCodeModal && (
                      <button
                        onClick={onOpenQrCodeModal}
                        className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 py-2 transition font-bold shadow-xs active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Abrir QR Code / Reconectar</span>
                      </button>
                    )}
                    <button
                      onClick={() => syncZapiInstance(inst.id)}
                      className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-xl px-3 py-2 transition font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Testar Conexão</span>
                    </button>
                  </div>
                </div>

                {/* Chaves de Acesso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Instance ID</span>
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
                    URL de Webhook (Configure no painel Z-API em "Ao Receber Mensagem")
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 text-xs bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-700 focus:outline-none"
                    />
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs"
                    >
                      {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* Formulário de Envio de Teste */}
                <form onSubmit={handleSendTestMessage} className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Disparar Mensagem de Teste Direto
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+55 11 99999-8888"
                      className="w-48 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                    />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testSent ? '✓ Mensagem Enviada!' : 'Enviar Teste'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: DADOS DA IMOBILIÁRIA (Identidade, CNPJ e Subdomínio)               */}
        {/* ========================================================================= */}
        {activeTab === 'TENANT' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Perfil da Imobiliária (Tenant)</h3>
                <p className="text-xs text-slate-500">Dados cadastrais e parametrizações de marca</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                SaaS Multi-tenant Ativo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Razão Social / Nome Fantasia</label>
                <input
                  type="text"
                  defaultValue={currentTenant.name}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  defaultValue={currentTenant.documentCnpj}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Domínio de Acesso</label>
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-mono">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>crm.faithhubs.com</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fuso Horário Operacional</label>
                <select
                  defaultValue="America/Sao_Paulo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none cursor-pointer"
                >
                  <option value="America/Sao_Paulo">Brasília (GMT-3) - América/São Paulo</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-xs"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: SLAS & HORÁRIO COMERCIAL (Regras de Atendimento e Distribuição)   */}
        {/* ========================================================================= */}
        {activeTab === 'SLA' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Parametrização de SLAs & Atendimento</h3>
              <p className="text-xs text-slate-500">Defina os prazos máximos para evitar perda de leads no WhatsApp</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-bold text-slate-800 mb-1">
                  SLA de Primeiro Atendimento (minutos)
                </label>
                <input
                  type="number"
                  defaultValue={currentTenant.settings.slaFirstResponseMinutes}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Dispara alarme visual se um novo lead não receber resposta dentro desta janela.
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-bold text-slate-800 mb-1">
                  Alerta de Inatividade de Lead (horas)
                </label>
                <input
                  type="number"
                  defaultValue={currentTenant.settings.slaInactivityHours}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Sinaliza oportunidade estagnada no Kanban sem mensagem recente.
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1 text-xs">
                Regra de Distribuição Automática de Leads
              </label>
              <select
                defaultValue={currentTenant.settings.autoAssignRule}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none cursor-pointer"
              >
                <option value="ROUND_ROBIN">Rodízio Circular entre Corretores Ativos (Round-Robin)</option>
                <option value="UNASSIGNED_QUEUE">Fila Geral de Não Atribuídos (A equipe puxa)</option>
                <option value="BY_REGION">Distribuição Inteligente por Bairro / Região</option>
              </select>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 4: IA COPILOTO (Bedrock / Claude 3.5 Sonnet)                         */}
        {/* ========================================================================= */}
        {activeTab === 'AI' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Bot className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">IA Copiloto (Amazon Bedrock)</h3>
                <p className="text-xs text-slate-500">Modelo Anthropic Claude 3.5 Sonnet para auxílio consultivo</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={currentTenant.settings.aiCopilotEnabled}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Ativar IA Copiloto nas Conversas</span>
                  <span className="text-slate-500 text-[11px]">
                    Gera resumos instantâneos, identifica temperatura do lead e extrai renda/entrada.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={currentTenant.settings.requireHumanApprovalForAI}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-emerald-950 block">Modo Human-in-the-Loop Obrigatório</span>
                  <span className="text-emerald-800 text-[11px]">
                    O corretor sempre revisa e aprova as respostas sugeridas antes de serem enviadas no WhatsApp.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 5: EQUIPE & PERMISSÕES (RBAC)                                        */}
        {/* ========================================================================= */}
        {activeTab === 'TEAM' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Membros da Equipe & Papéis</h3>
                <p className="text-xs text-slate-500">Corretores, gestores e administradores com acesso ao tenant</p>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Convidar Membro</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {users.map(u => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name)}
                      alt={u.name}
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900">{u.name}</h4>
                      <p className="text-[11px] text-slate-500">{u.email}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                    u.role === 'MANAGER' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
