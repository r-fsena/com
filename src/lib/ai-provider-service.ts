import { AICopilotAnalysis, BedrockCopilotClient } from './bedrock-client';
import { TenantAIConfig } from '@/types/crm';

export interface CopilotChatHistoryItem {
  sender: 'CLIENT' | 'BROKER';
  text: string;
}

export class UniversalCopilotService {
  /**
   * Testa a conectividade com o provedor e valida a API Key fornecida pelo Tenant
   */
  static async testConnection(config: TenantAIConfig): Promise<{ success: boolean; message: string; model?: string }> {
    const provider = config.provider || 'PLATFORM_DEFAULT';
    const apiKey = (config.apiKey || '').trim();

    if (provider === 'PLATFORM_DEFAULT') {
      const defaultKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
      if (defaultKey) {
        return { success: true, message: 'Copiloto da Plataforma ativo e operacional com inteligência generativa.' };
      }
      return { success: true, message: 'Motor de inferência nativo de alto desempenho pronto para uso.' };
    }

    if (!apiKey) {
      return { success: false, message: 'Por favor, informe a Chave de Acesso (API Key) para testar.' };
    }

    try {
      if (provider === 'OPENAI') {
        const model = config.model || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          return { success: true, message: `Conexão estabelecida com sucesso via OpenAI (${model})!`, model };
        } else {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: err?.error?.message || `Erro de autenticação na OpenAI (Status ${res.status}). Verifique a chave.` };
        }
      }

      if (provider === 'ANTHROPIC') {
        const model = config.model || 'claude-3-5-haiku-20241022';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          return { success: true, message: `Conexão estabelecida com sucesso via Anthropic (${model})!`, model };
        } else {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: err?.error?.message || `Erro de autenticação na Anthropic (Status ${res.status}). Verifique a chave.` };
        }
      }

      if (provider === 'GEMINI') {
        const model = config.model || 'gemini-1.5-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping' }] }],
          }),
        });

        if (res.ok) {
          return { success: true, message: `Conexão estabelecida com sucesso via Google Gemini (${model})!`, model };
        } else {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: err?.error?.message || `Erro na API do Google Gemini (Status ${res.status}). Verifique a chave.` };
        }
      }

      return { success: false, message: 'Provedor desconhecido selecionado.' };
    } catch (err: any) {
      return { success: false, message: `Falha de rede ao conectar com ${provider}: ${err.message}` };
    }
  }

  /**
   * Executa a análise de IA gerando resumo, 4 pilares do lead e 3 opções de resposta tática de vendas
   * Aplica janela deslizante de custo mínimo (últimas 12 mensagens) e prompts estruturados.
   */
  static async analyzeConversation(params: {
    chatHistory: CopilotChatHistoryItem[];
    brokerName?: string;
    contactContext?: any;
    aiConfig?: TenantAIConfig;
  }): Promise<AICopilotAnalysis> {
    const { chatHistory, brokerName = 'Corretor', contactContext, aiConfig } = params;

    // Janela Deslizante de Otimização de Custos (apenas as 12 mensagens mais recentes)
    const recentHistory = chatHistory.slice(-12);

    const provider = aiConfig?.provider || 'PLATFORM_DEFAULT';
    const apiKey = (aiConfig?.apiKey || '').trim();

    // Se o usuário configurou OpenAI com sua própria chave
    if (provider === 'OPENAI' && apiKey) {
      try {
        const result = await this.executeOpenAI({
          history: recentHistory,
          brokerName,
          contactContext,
          aiConfig: aiConfig!,
          apiKey,
        });
        if (result) return result;
      } catch (err) {
        console.error('[Copilot] Erro na chamada OpenAI BYOK, ativando fallback:', err);
      }
    }

    // Se o usuário configurou Anthropic Claude com sua própria chave
    if (provider === 'ANTHROPIC' && apiKey) {
      try {
        const result = await this.executeAnthropic({
          history: recentHistory,
          brokerName,
          contactContext,
          aiConfig: aiConfig!,
          apiKey,
        });
        if (result) return result;
      } catch (err) {
        console.error('[Copilot] Erro na chamada Anthropic BYOK, ativando fallback:', err);
      }
    }

    // Se o usuário configurou Google Gemini com sua própria chave
    if (provider === 'GEMINI' && apiKey) {
      try {
        const result = await this.executeGemini({
          history: recentHistory,
          brokerName,
          contactContext,
          aiConfig: aiConfig!,
          apiKey,
        });
        if (result) return result;
      } catch (err) {
        console.error('[Copilot] Erro na chamada Gemini BYOK, ativando fallback:', err);
      }
    }

    // Fallback para OpenAI padrão da plataforma (se configurada nas variáveis de ambiente globais)
    const platformOpenAIKey = process.env.OPENAI_API_KEY;
    if (platformOpenAIKey) {
      try {
        const result = await this.executeOpenAI({
          history: recentHistory,
          brokerName,
          contactContext,
          aiConfig: {
            provider: 'OPENAI',
            tone: aiConfig?.tone || 'CONSULTATIVE',
            objective: aiConfig?.objective || 'EQUILIBRADO',
            model: 'gpt-4o-mini',
            enabled: true,
          },
          apiKey: platformOpenAIKey,
        });
        if (result) return result;
      } catch (err) {
        console.error('[Copilot] Erro na OpenAI da plataforma, acionando motor semântico:', err);
      }
    }

    // Fallback de alta precisão sem custos (Motor Semântico Local)
    const fallbackEngine = new BedrockCopilotClient();
    return fallbackEngine.analyzeConversation(chatHistory, brokerName, contactContext);
  }

  /**
   * Construtor de Prompt do Sistema com Tom de Voz e Foco Comercial
   */
  private static buildSystemPrompt(brokerName: string, aiConfig?: TenantAIConfig, contactContext?: any): string {
    const toneMap = {
      CONSULTATIVE: 'Consultivo, empático, especialista de confiança que faz perguntas inteligentes.',
      CLOSER: 'Focado em fechamento, proativo, persuasivo e direcionado para agendar visitas ou simulações.',
      ELEGANT: 'Sofisticado, exclusivo, formal com foco em alto padrão e discrição.',
      FRIENDLY: 'Acolhedor, caloroso, descontraído e próximo (sem perder o profissionalismo).',
    };

    const objectiveMap = {
      AGENDAR_VISITA: 'Prioridade máxima: Convidar e garantir a presença do cliente em uma visita presencial ao decorado ou plantão.',
      SIMULAR_FINANCIAMENTO: 'Prioridade máxima: Obter dados de entrada e renda para rodar uma simulação bancária com as melhores taxas.',
      QUALIFICAR: 'Prioridade máxima: Mapear os 4 pilares (Orçamento, Região, Tipo de Imóvel e Prazo de Compra).',
      EQUILIBRADO: 'Equilibrar acolhimento, resposta clara à dúvida do cliente e avanço para o próximo passo no funil.',
    };

    const selectedTone = toneMap[aiConfig?.tone || 'CONSULTATIVE'];
    const selectedObjective = objectiveMap[aiConfig?.objective || 'EQUILIBRADO'];
    const customInstructions = aiConfig?.customInstructions ? `\nDIRETRIZES DA IMOBILIÁRIA:\n${aiConfig.customInstructions}` : '';

    return `Você é o Copiloto de IA Especialista em Vendas Imobiliárias de Alta Performance, atuando em conjunto com o corretor(a) ${brokerName}.
Sua missão é analisar o diálogo de WhatsApp com o cliente, extrair o perfil comercial do lead e sugerir respostas táticas naturais e humanas.

TOM DE VOZ: ${selectedTone}
OBJETIVO COMERCIAL: ${selectedObjective}${customInstructions}

RETORNE ESTRITAMENTE UM OBJETO JSON VÁLIDO no seguinte formato (sem formatação markdown extra, apenas JSON puro):
{
  "summary": "Resumo executivo de 1 a 2 linhas do momento atual da negociação.",
  "extractedData": {
    "monthlyIncome": number ou null,
    "downPayment": number ou null,
    "maxBudget": number ou null,
    "preferredRegion": "string com o bairro/cidade desejado ou null",
    "propertyType": "ex: Apartamento 3 quartos, Cobertura, Casa em condomínio ou null",
    "urgencyLevel": "ALTA" | "MEDIA" | "BAIXA",
    "detectedObjections": ["lista de objeções reais identificadas nas mensagens do cliente"]
  },
  "detectedObjections": ["lista resumida das objeções"],
  "responseOptions": [
    {
      "id": "opt-1",
      "category": "OBJECTION",
      "badge": "🛡️ Quebra de Objeção",
      "label": "Contornar a principal dúvida ou receio",
      "text": "Mensagem pronta e humana para o WhatsApp que contorna a objeção e convida para ação."
    },
    {
      "id": "opt-2",
      "category": "VISIT",
      "badge": "📅 Agendamento",
      "label": "Convidar para Visita Presencial",
      "text": "Mensagem persuasiva convidando para conhecer o decorado ou imóvel."
    },
    {
      "id": "opt-3",
      "category": "MATERIAL",
      "badge": "📄 Book & Condições",
      "label": "Enviar Tabela e Fotos",
      "text": "Mensagem oferecendo envio de plantas, memorial e condições facilitadas."
    }
  ],
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "intent": "AGENDAR_VISITA" | "SIMULAR_FINANCIAMENTO" | "PEDIR_FOTOS" | "NEGOCIAR_VALOR" | "DUVIDA_GERAL" | "DESINTERESSE",
  "suggestedResponse": "O texto da melhor opção entre as 3 sugeridas",
  "confidenceScore": 95
}`;
  }

  /**
   * Chamada OpenAI (GPT-4o / GPT-4o-mini com response_format JSON)
   */
  private static async executeOpenAI(params: {
    history: CopilotChatHistoryItem[];
    brokerName: string;
    contactContext: any;
    aiConfig: TenantAIConfig;
    apiKey: string;
  }): Promise<AICopilotAnalysis | null> {
    const model = params.aiConfig.model || 'gpt-4o-mini';
    const systemPrompt = this.buildSystemPrompt(params.brokerName, params.aiConfig, params.contactContext);

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...params.history.map(m => ({
        role: m.sender === 'BROKER' ? ('assistant' as const) : ('user' as const),
        content: m.text,
      })),
      { role: 'user', content: 'Analise o histórico acima e devolva a qualificação comercial e as 3 opções de resposta no formato JSON.' }
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: params.aiConfig.temperature ?? 0.3,
        max_tokens: params.aiConfig.maxTokens ?? 700,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as AICopilotAnalysis;
  }

  /**
   * Chamada Anthropic (Claude 3.5 Haiku / Sonnet)
   */
  private static async executeAnthropic(params: {
    history: CopilotChatHistoryItem[];
    brokerName: string;
    contactContext: any;
    aiConfig: TenantAIConfig;
    apiKey: string;
  }): Promise<AICopilotAnalysis | null> {
    const model = params.aiConfig.model || 'claude-3-5-haiku-20241022';
    const systemPrompt = this.buildSystemPrompt(params.brokerName, params.aiConfig, params.contactContext);

    const messages = [
      ...params.history.map(m => ({
        role: m.sender === 'BROKER' ? ('assistant' as const) : ('user' as const),
        content: m.text,
      })),
      { role: 'user' as const, content: 'Analise o histórico acima e devolva a qualificação comercial e as 3 opções de resposta no formato JSON estrito.' }
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages,
        max_tokens: params.aiConfig.maxTokens ?? 750,
        temperature: params.aiConfig.temperature ?? 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    if (!rawText) return null;

    // Extrai JSON limpo caso venha encapsulado em ```json
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AICopilotAnalysis;
  }

  /**
   * Chamada Google Gemini (Gemini 1.5 Flash)
   */
  private static async executeGemini(params: {
    history: CopilotChatHistoryItem[];
    brokerName: string;
    contactContext: any;
    aiConfig: TenantAIConfig;
    apiKey: string;
  }): Promise<AICopilotAnalysis | null> {
    const model = params.aiConfig.model || 'gemini-1.5-flash';
    const systemPrompt = this.buildSystemPrompt(params.brokerName, params.aiConfig, params.contactContext);

    const chatText = params.history
      .map(m => `${m.sender === 'BROKER' ? params.brokerName : 'Cliente'}: ${m.text}`)
      .join('\n');

    const prompt = `${systemPrompt}\n\nHISTÓRICO DA CONVERSA NO WHATSAPP:\n${chatText}\n\nRetorne agora o JSON estruturado:`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: params.aiConfig.temperature ?? 0.3,
          maxOutputTokens: params.aiConfig.maxTokens ?? 750,
        }
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AICopilotAnalysis;
  }
}
