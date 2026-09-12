'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Bot, 
  Sparkles, 
  Save, 
  Check, 
  Send, 
  RefreshCw, 
  Cpu, 
  Sliders, 
  Zap, 
  ShieldCheck, 
  MessageSquare, 
  User as UserIcon, 
  Flame, 
  Award, 
  Key, 
  TrendingUp, 
  Plus, 
  X, 
  Building2, 
  Copy,
  ChevronRight,
  Lock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { AIPersonaTone } from '@/types/crm';

const PROMPT_TEMPLATES = [
  {
    id: 'luxury',
    title: '👑 Alto Padrão / Luxo (Consultivo)',
    tone: 'CONSULTATIVE' as AIPersonaTone,
    model: 'gemini-1.5-flash',
    prompt: 'Você é o copiloto comercial de um corretor de imóveis especialista no mercado de Alto Padrão e Luxo. Adote um tom estritamente executivo, polido, consultivo e focado em valorização patrimonial, discrição, ROI e liquidez. Destaque localização nobre, privacidade e acabamentos nobres. Conduza o cliente com perguntas abertas para reuniões estratégicas ou visitas exclusivas.',
    directives: [
      'Sempre propor uma reunião estratégica presencial ou café executivo',
      'Destacar o potencial de valorização do metro quadrado e liquidez',
      'Nunca usar gírias ou mensagens prolixas'
    ]
  },
  {
    id: 'plant',
    title: '🚀 Lançamentos na Planta (Fechador)',
    tone: 'PERSUASIVE' as AIPersonaTone,
    model: 'gemini-1.5-flash',
    prompt: 'Você é o copiloto de um corretor focado em lançamentos e imóveis na planta. Seja ágil, persuasivo e crie senso de oportunidade comercial com base na tabela de abertura de vendas, potencial de valorização durante a obra e fluxo facilitado de pagamento direto com a construtora. Sempre busque levar o cliente ao plantão de vendas para conhecer o decorado.',
    directives: [
      'Priorizar agendamento de visita ao apartamento decorado',
      'Explicar a flexibilidade do fluxo de pagamento durante a obra',
      'Destacar a valorização histórica de imóveis comprados na planta'
    ]
  },
  {
    id: 'first_home',
    title: '🏡 Primeiro Imóvel / Famílias (Acolhedor)',
    tone: 'FRIENDLY' as AIPersonaTone,
    model: 'gemini-1.5-flash',
    prompt: 'Você é o copiloto de um corretor especialista em famílias e compradores do primeiro imóvel. Adote um tom acolhedor, empático, seguro e didático. Simplifique termos de financiamento bancário, explique como funciona o uso do FGTS e composição de renda, e destaque segurança, áreas de lazer para crianças e qualidade de vida no condomínio.',
    directives: [
      'Oferecer simulação gratuita de financiamento pelo WhatsApp',
      'Explicar o uso do saldo do FGTS para abater na entrada',
      'Ressaltar áreas de convivência, lazer e segurança do bairro'
    ]
  },
  {
    id: 'investor',
    title: '📈 Investidor & Renda de Locação (Técnico)',
    tone: 'TECHNICAL' as AIPersonaTone,
    model: 'gemini-1.5-flash',
    prompt: 'Você é o copiloto de um corretor especialista em investidores imobiliários (fundos, studios e imóveis para locação Airbnb ou tradicional). Use linguagem técnica, focada em taxa de cap rate, yield anual, taxa de vacância estimada da região, custo por metro quadrado e liquidez de revenda. Apresente números claros e objetivos.',
    directives: [
      'Apresentar estimativa de rentabilidade mensal e anual (Yield)',
      'Comparar rentabilidade imobiliária com aplicações financeiras de renda fixa',
      'Enviar estudo de demanda de locação na região'
    ]
  }
];

export function CopilotManager() {
  const { users, currentUser, updateUserAIPersona, currentTenant } = useCRM();

  // Controle de Acesso: Apenas Administradores e Gestores podem alternar entre os corretores
  const isManagerOrAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'MANAGER';

  const [activeTab, setActiveTab] = useState<'PERSONA' | 'SIMULATOR' | 'GLOBAL_SETTINGS'>('PERSONA');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  
  const effectiveUserId = isManagerOrAdmin ? selectedUserId : currentUser.id;
  const selectedUser = users.find(u => u.id === effectiveUserId) || currentUser;

  // Estados locais da persona
  const [promptText, setPromptText] = useState<string>(selectedUser.aiPersonaPrompt || PROMPT_TEMPLATES[0].prompt);
  const [tone, setTone] = useState<AIPersonaTone>(selectedUser.aiTone || 'CONSULTATIVE');
  const [model, setModel] = useState<string>('gemini-1.5-flash');
  const [directives, setDirectives] = useState<string[]>(selectedUser.aiDirectives || PROMPT_TEMPLATES[0].directives);
  const [newDirectiveInput, setNewDirectiveInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estados do Simulador
  const [simulatedLeadMsg, setSimulatedLeadMsg] = useState('Olá! Gostaria de saber mais sobre opções de lançamentos de 2 quartos com boa localização.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedResponses, setSimulatedResponses] = useState<any[] | null>(null);
  const [simulationAnalysis, setSimulationAnalysis] = useState<any | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Sincroniza ao trocar de usuário
  React.useEffect(() => {
    const u = users.find(x => x.id === selectedUserId);
    if (u) {
      setPromptText(u.aiPersonaPrompt || PROMPT_TEMPLATES[0].prompt);
      setTone(u.aiTone || 'CONSULTATIVE');
      setModel('gemini-1.5-flash');
      setDirectives(u.aiDirectives || PROMPT_TEMPLATES[0].directives);
    }
  }, [selectedUserId, users]);

  const handleApplyTemplate = (template: typeof PROMPT_TEMPLATES[0]) => {
    setPromptText(template.prompt);
    setTone(template.tone);
    setModel('gemini-1.5-flash');
    setDirectives(template.directives);
  };

  const handleAddDirective = () => {
    if (newDirectiveInput.trim()) {
      setDirectives(prev => [...prev, newDirectiveInput.trim()]);
      setNewDirectiveInput('');
    }
  };

  const handleRemoveDirective = (index: number) => {
    setDirectives(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePersona = () => {
    updateUserAIPersona(effectiveUserId, {
      aiPersonaPrompt: promptText,
      aiTone: tone,
      aiDirectives: directives,
      aiModel: 'gemini-1.5-flash',
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRunSimulation = async () => {
    if (!simulatedLeadMsg.trim()) return;
    setIsSimulating(true);
    setSimulationError(null);
    setSimulatedResponses(null);
    setSimulationAnalysis(null);

    try {
      const res = await fetch('/api/v1/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: [
            { sender: 'CLIENT', text: simulatedLeadMsg.trim() }
          ],
          brokerName: selectedUser.name || currentUser.name || 'Corretor',
          contactContext: {
            name: 'Lead Simulado',
          },
          aiConfig: {
            provider: 'PLATFORM_DEFAULT',
            model: 'gemini-flash-latest',
            tone: tone,
            objective: currentTenant?.aiConfig?.objective || 'EQUILIBRADO',
            customInstructions: `${promptText}\n\nDIRETRIZES ESPECÍFICAS DA PERSONA:\n${directives.map(d => `- ${d}`).join('\n')}`,
            enabled: true,
          }
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(resData.message || resData.error || 'Erro na inferência da IA');
      }

      if (resData.data) {
        const analysis = resData.data;
        setSimulationAnalysis(analysis);
        setSimulatedResponses(analysis.responseOptions || []);
      }
    } catch (err: any) {
      console.error('[Copilot Simulator Error]', err);
      setSimulationError(err.message || 'Falha ao conectar com o motor de IA Google Gemini.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/20">
              <Bot className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900">IA Copiloto • Inteligência Comercial & Personas</h1>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Conectado • AWS Bedrock & Claude 3.5 Sonnet</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isManagerOrAdmin 
              ? 'Configure o estilo de atendimento, tom de voz e prompts personalizados para cada corretor da equipe'
              : 'Personalize o estilo de atendimento, tom de voz e instruções do seu Copiloto de IA exclusivo'}
          </p>
        </div>

        {/* Status Chips */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600 font-medium">Latência Média: <strong className="text-slate-900">1.1s</strong></span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Taxa de Aceitação: 89%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-6 text-xs font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('PERSONA')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'PERSONA'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{isManagerOrAdmin ? 'Personas da Equipe' : 'Meu Copiloto de IA'}</span>
        </button>

        <button
          onClick={() => setActiveTab('SIMULATOR')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'SIMULATOR'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Simulador & Testador em Tempo Real</span>
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('GLOBAL_SETTINGS')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'GLOBAL_SETTINGS'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Infraestrutura de IA (Nativa)</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* ==================================================== */}
        {/* ABA 1: CONFIGURAÇÃO DE PERSONA POR CORRETOR          */}
        {/* ==================================================== */}
        {activeTab === 'PERSONA' && (
          <div className="space-y-6">
            {/* Seletor de Corretor (Visível apenas para Gestores/Admins) */}
            {isManagerOrAdmin ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  1. Selecione o Corretor / Agente para Auditar ou Configurar a Persona:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                        effectiveUserId === u.id
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <img
                        src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=059669&color=fff`}
                        alt={u.name}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-300 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                          {u.role}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Banner de Persona Pessoal Exclusiva para o Corretor */
              <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white rounded-2xl p-5 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <img
                    src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=059669&color=fff`}
                    alt={currentUser.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-400/50 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
                      <span className="text-[10px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                        Seu Copiloto Pessoal Exclusivo
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/70 mt-0.5">
                      Configure o tom de voz e regras para que a IA gere respostas de WhatsApp no seu estilo próprio de vendas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Painel Principal de Configuração da Persona */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Configuração da IA para:</span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      {selectedUser.name}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    As sugestões de resposta geradas no WhatsApp Inbox seguirão rigorosamente as instruções abaixo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSavePersona}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savedSuccess ? 'Salvo com Sucesso! ✨' : 'Salvar Persona'}</span>
                </button>
              </div>

              {/* Templates Rápidos de 1-Clique */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Carregar Template Pronto de 1-Clique:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {PROMPT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition cursor-pointer group"
                    >
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">{tmpl.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{tmpl.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Modelo e Tom de Voz */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Motor de Inteligência Artificial:
                  </label>
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200/90 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
                        GE
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Google Gemini 1.5 Flash</span>
                          <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md">
                            Padrão CRM
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">1M Contexto • Fornecimento Padrão Entregue pelo CRM</p>
                      </div>
                    </div>
                    <span title="Motor oficial gerenciado pelo CRM">
                      <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tom de Voz Comercial da IA:
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as AIPersonaTone)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="CONSULTATIVE">🎩 Consultivo & Executivo (Alto Padrão / Discrição / Reuniões)</option>
                    <option value="PERSUASIVE">🚀 Persuasivo & Fechador (Lançamentos / Urgência / Visita)</option>
                    <option value="FRIENDLY">🏡 Acolhedor & Empático (Primeiro Imóvel / FGTS / Famílias)</option>
                    <option value="TECHNICAL">📈 Técnico & Investimentos (Cap Rate / ROI / Permuta)</option>
                  </select>
                </div>
              </div>

              {/* Prompt da Persona */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Instrução de Comportamento (System Prompt Customizado da Persona):</span>
                  <span className="text-[10px] text-slate-400 font-mono">{promptText.length} caracteres</span>
                </label>
                <textarea
                  rows={4}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Instrua a IA sobre como esse corretor fala, quais termos prefere, e como deve conduzir o cliente..."
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                />
              </div>

              {/* Diretrizes Comerciais (Regras de Fechamento) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Regras Comerciais & Diretrizes de Fechamento:
                </label>
                <div className="space-y-1.5 mb-2">
                  {directives.map((dir, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-800">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{dir}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDirective(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar nova diretriz (ex: 'Sempre enfatizar as 3 vagas de garagem')..."
                    value={newDirectiveInput}
                    onChange={(e) => setNewDirectiveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDirective();
                      }
                    }}
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDirective}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Regra</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ABA 2: SIMULADOR & TESTADOR EM TEMPO REAL            */}
        {/* ==================================================== */}
        {activeTab === 'SIMULATOR' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Simulador de Respostas do Copiloto</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Teste em tempo real como o copiloto responde a uma mensagem de lead usando a persona do corretor <strong>{selectedUser.name}</strong>.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mensagem Simulada do Lead no WhatsApp:
                </label>
                <textarea
                  rows={3}
                  value={simulatedLeadMsg}
                  onChange={(e) => setSimulatedLeadMsg(e.target.value)}
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Sparkles className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                <span>{isSimulating ? 'Processando com a Persona...' : 'Testar Respostas da IA'}</span>
              </button>

              {/* Feedback de Erro se houver */}
              {simulationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{simulationError}</span>
                </div>
              )}

              {/* Respostas Geradas em Tempo Real pelo Gemini */}
              {simulationAnalysis && (
                <div className="space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Análise em Tempo Real pelo Google Gemini (Tom: {tone}):</span>
                    </span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Google Gemini 1.5 Flash (Nativo)
                    </span>
                  </div>

                  {/* Resumo & Dados Extraídos */}
                  {simulationAnalysis.summary && (
                    <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl text-xs text-slate-700 space-y-2">
                      <div className="font-bold text-blue-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Resumo Executivo do Lead:</span>
                      </div>
                      <p className="leading-relaxed text-slate-800 whitespace-pre-line">{simulationAnalysis.summary}</p>
                      
                      {simulationAnalysis.extractedData && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-100 text-[11px]">
                          {simulationAnalysis.extractedData.preferredRegion && (
                            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded-md text-slate-700">
                              📍 Região: <strong>{simulationAnalysis.extractedData.preferredRegion}</strong>
                            </span>
                          )}
                          {simulationAnalysis.extractedData.propertyType && (
                            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded-md text-slate-700">
                              🏠 Imóvel: <strong>{simulationAnalysis.extractedData.propertyType}</strong>
                            </span>
                          )}
                          {simulationAnalysis.extractedData.maxBudget && (
                            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded-md text-slate-700">
                              💰 Orçamento: <strong>R$ {Number(simulationAnalysis.extractedData.maxBudget).toLocaleString('pt-BR')}</strong>
                            </span>
                          )}
                          {simulationAnalysis.extractedData.downPayment && (
                            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded-md text-slate-700">
                              💵 Entrada: <strong>R$ {Number(simulationAnalysis.extractedData.downPayment).toLocaleString('pt-BR')}</strong>
                            </span>
                          )}
                          {simulationAnalysis.extractedData.urgencyLevel && (
                            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded-md text-slate-700">
                              ⚡ Urgência: <strong>{simulationAnalysis.extractedData.urgencyLevel === 'NAO_IDENTIFICADA' ? 'Não identificada' : simulationAnalysis.extractedData.urgencyLevel}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opções de Resposta Geradas */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">
                      Sugestões de Resposta Prontas para o WhatsApp:
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {simulatedResponses && simulatedResponses.map((res: any, i: number) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 hover:border-emerald-300 transition">
                          <div className="flex items-center justify-between">
                            <span className="inline-block text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                              {res.badge || res.label || 'Sugestão Tática'}
                            </span>
                            {res.category && (
                              <span className="text-[9px] text-slate-400 uppercase font-mono">
                                {res.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed italic">
                            "{res.text}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ABA 3: INFRAESTRUTURA DE IA NATIVA                   */}
        {/* ==================================================== */}
        {activeTab === 'GLOBAL_SETTINGS' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span>Infraestrutura de Inteligência Artificial do CRM</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  O provedor de IA é entregue e gerenciado de forma nativa pela plataforma, com disponibilidade 24/7 para todos os corretores.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                      GE
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">Google Gemini 1.5 Flash</h4>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                          Motor Padrão Oficial do CRM
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Janela ultra-ampla de 1.000.000 de tokens de contexto • Leitura sem cortes do histórico do WhatsApp
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-center shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    CONECTADO & ATIVO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-2">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Gestão Centralizada</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Provedor e infraestrutura geridos pela plataforma CRM sem necessidade de configurar chaves de API individuais.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ultra Baixa Latência</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Respostas comerciais inteligentes e síntese de negociações em menos de 1 segundo.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>4 Pilares do Lead</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Extração e qualificação automática de Orçamento, Urgência, Perfil Familiar e Objeções.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
