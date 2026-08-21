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
  ChevronRight
} from 'lucide-react';
import { AIPersonaTone } from '@/types/crm';

const PROMPT_TEMPLATES = [
  {
    id: 'luxury',
    title: '👑 Alto Padrão / Luxo (Consultivo)',
    tone: 'CONSULTATIVE' as AIPersonaTone,
    model: 'anthropic.claude-3-5-sonnet',
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
    model: 'anthropic.claude-3-5-sonnet',
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
    model: 'anthropic.claude-3-5-sonnet',
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
    model: 'anthropic.claude-3-5-sonnet',
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

  const [activeTab, setActiveTab] = useState<'PERSONA' | 'SIMULATOR' | 'GLOBAL_SETTINGS'>('PERSONA');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  
  const selectedUser = users.find(u => u.id === selectedUserId) || currentUser;

  // Estados locais da persona
  const [promptText, setPromptText] = useState<string>(selectedUser.aiPersonaPrompt || PROMPT_TEMPLATES[0].prompt);
  const [tone, setTone] = useState<AIPersonaTone>(selectedUser.aiTone || 'CONSULTATIVE');
  const [model, setModel] = useState<string>(selectedUser.aiModel || 'anthropic.claude-3-5-sonnet');
  const [directives, setDirectives] = useState<string[]>(selectedUser.aiDirectives || PROMPT_TEMPLATES[0].directives);
  const [newDirectiveInput, setNewDirectiveInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estados do Simulador
  const [simulatedLeadMsg, setSimulatedLeadMsg] = useState('Olá! Vi o anúncio do Edifício Lumina Batel de R$ 1.450.000. Achei o valor um pouco puxado para o meu orçamento, mas gostei muito da localização.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedResponses, setSimulatedResponses] = useState<any[] | null>(null);

  // Sincroniza ao trocar de usuário
  React.useEffect(() => {
    const u = users.find(x => x.id === selectedUserId);
    if (u) {
      setPromptText(u.aiPersonaPrompt || PROMPT_TEMPLATES[0].prompt);
      setTone(u.aiTone || 'CONSULTATIVE');
      setModel(u.aiModel || 'anthropic.claude-3-5-sonnet');
      setDirectives(u.aiDirectives || PROMPT_TEMPLATES[0].directives);
    }
  }, [selectedUserId, users]);

  const handleApplyTemplate = (template: typeof PROMPT_TEMPLATES[0]) => {
    setPromptText(template.prompt);
    setTone(template.tone);
    setModel(template.model);
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
    updateUserAIPersona(selectedUserId, {
      aiPersonaPrompt: promptText,
      aiTone: tone,
      aiDirectives: directives,
      aiModel: model,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      let responses: any[] = [];
      if (tone === 'CONSULTATIVE') {
        responses = [
          {
            badge: '🤝 Alinhamento Executivo',
            text: `Olá! Compreendo perfeitamente sua avaliação. O Lumina Batel se destaca pelo padrão construtivo e liquidez no metro quadrado do Batel. Seria um prazer conversarmos com mais calma em um café ou reunião exclusiva para eu lhe apresentar o memorial descritivo e as condições personalizadas de fluxo. Como está sua disponibilidade neste sábado às 10h?`
          },
          {
            badge: '📐 Estudo de Mercado',
            text: `Olá! Realmente o investimento reflete o acabamento premium e as 3 suítes com vagas exclusivas. Temos também estudos de valorização da região que justificam a segurança desse aporte. Gostaria que eu lhe enviasse a lâmina técnica comparativa de valores por metro quadrado do Batel?`
          }
        ];
      } else if (tone === 'PERSUASIVE') {
        responses = [
          {
            badge: '⚡ Oportunidade na Planta',
            text: `Olá! Entendo sua colocação. Esse valor de R$ 1.45M é da tabela de lançamento de abertura, e conseguimos montar um fluxo direto com a construtora com entrada reduzida durante a obra. As unidades nessa prumada estão com alta procura! Que tal darmos um pulo no plantão para ver o decorado hoje ou amanhã?`
          },
          {
            badge: '🔥 Condição Exclusiva',
            text: `Olá! Temos uma margem de negociação aberta para propostas à vista ou com fluxo acelerado nessa semana. Vale muito a pena conhecer o decorado antes de fecharem a tabela do mês. Posso reservar seu horário amanhã às 16h?`
          }
        ];
      } else if (tone === 'FRIENDLY') {
        responses = [
          {
            badge: '🏡 Acolhedor & FGTS',
            text: `Olá! Tudo bem? Fico feliz pelo seu contato! O Lumina é realmente maravilhoso e super seguro para a família. Sobre o valor, nós conseguimos simular opções com o banco para encaixar a parcela com tranquilidade no seu orçamento, inclusive utilizando FGTS na entrada. Posso fazer uma simulação sem compromisso para você ver como fica?`
          },
          {
            badge: '👪 Qualidade de Vida',
            text: `Oi! Entendo perfeitamente sua preocupação com o orçamento. O legal desse condomínio é que o condomínio já tem toda estrutura de lazer para as crianças, o que gera muita economia no dia a dia. Se quiser, te mando fotos dos ambientes para você ver com a família!`
          }
        ];
      } else {
        responses = [
          {
            badge: '📈 Estudo de Cap Rate',
            text: `Olá. O Lumina Batel opera com Cap Rate projetado de 6.8% a.a. em locação corporativa e valor de m² 12% abaixo da média entregue na região. Podemos analisar o fluxo de rentabilidade frente à renda fixa. Quando podemos revisar a planilha financeira?`
          }
        ];
      }
      setSimulatedResponses(responses);
      setIsSimulating(false);
    }, 600);
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
            Configure o estilo de atendimento, tom de voz e prompts personalizados para cada corretor da equipe
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
          <span>Persona & Prompt por Corretor</span>
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

        <button
          onClick={() => setActiveTab('GLOBAL_SETTINGS')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'GLOBAL_SETTINGS'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Modelos LLM & Conexão de API</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* ==================================================== */}
        {/* ABA 1: CONFIGURAÇÃO DE PERSONA POR CORRETOR          */}
        {/* ==================================================== */}
        {activeTab === 'PERSONA' && (
          <div className="space-y-6">
            {/* Seletor de Corretor */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <label className="text-xs font-bold text-slate-800 block mb-2">
                1. Selecione o Corretor / Agente para Configurar a Persona:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                      selectedUserId === u.id
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
                    Modelo de Linguagem (LLM):
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="anthropic.claude-3-5-sonnet">⚡ Anthropic Claude 3.5 Sonnet (Recomendado • Alta Precisão Comercial)</option>
                    <option value="openai.gpt-4o">🧠 OpenAI GPT-4o (Multimodal & Rápido)</option>
                    <option value="google.gemini-1-5-pro">💎 Google Gemini 1.5 Pro (Contexto Longo)</option>
                  </select>
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

              {/* Respostas Geradas */}
              {simulatedResponses && (
                <div className="space-y-3 pt-3 border-t border-slate-100 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Sugestões Geradas para a Persona ({tone}):
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                      Modelo: {model}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {simulatedResponses.map((res, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <span className="inline-block text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {res.badge}
                        </span>
                        <p className="text-xs text-slate-700 leading-relaxed italic">
                          "{res.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ABA 3: CONFIGURAÇÕES GLOBAIS DE MODELO LLM          */}
        {/* ==================================================== */}
        {activeTab === 'GLOBAL_SETTINGS' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-600" />
                  <span>Provedores de IA & Chaves de API</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conecte suas credenciais do Amazon Bedrock, OpenAI ou Anthropic para inferência em produção.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                      AWS
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Amazon Bedrock (Claude 3.5 Sonnet)</h4>
                      <p className="text-[10px] text-slate-500">Região us-east-1 • Segurança Empresarial LGPD / HIPAA</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    CONECTADO & ATIVO
                  </span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      OAI
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">OpenAI API (GPT-4o)</h4>
                      <p className="text-[10px] text-slate-500">Chave de fallback secundária para alta disponibilidade</p>
                    </div>
                  </div>
                  <button className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer">
                    Configurar Chave
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
