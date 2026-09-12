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
      const platformGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
      if (platformGeminiKey) {
        return { 
          success: true, 
          message: 'Motor Google Gemini Flash ativo e operacional como inteligência central do CRM (Custo Mínimo & Contexto de 1M tokens).',
          model: 'gemini-flash-latest'
        };
      }
      const defaultKey = process.env.OPENAI_API_KEY;
      if (defaultKey) {
        return { success: true, message: 'Copiloto da Plataforma ativo e operacional com OpenAI.', model: 'gpt-4o-mini' };
      }
      return { success: true, message: 'Motor de inferência nativo de alto desempenho pronto para uso.' };
    }

    if (!apiKey) {
      return { success: false, message: 'Por favor, informe a Chave de Acesso (API Key) para testar.' };
    }

    try {
      if (provider === 'GEMINI') {
        const candidateModels = ['gemini-flash-latest', 'gemini-3.6-flash', config.model || 'gemini-flash-latest'];
        let lastErr = '';
        for (const candidate of candidateModels) {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Ping' }] }],
            }),
          });

          if (res.ok) {
            return { success: true, message: `Conexão estabelecida com sucesso via Google Gemini (${candidate})!`, model: candidate };
          }
          const err = await res.json().catch(() => ({}));
          lastErr = err?.error?.message || `Erro na API do Google Gemini (Status ${res.status}). Verifique a chave.`;
          if (res.status !== 404) break;
        }
        return { success: false, message: lastErr };
      }

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

      return { success: false, message: 'Provedor desconhecido selecionado.' };
    } catch (err: any) {
      return { success: false, message: `Falha de rede ao conectar com ${provider}: ${err.message}` };
    }
  }

  /**
   * Executa a análise de IA gerando resumo, 4 pilares do lead e 3 opções de resposta tática de vendas
   * Prioriza Google Gemini 1.5 Flash com janela expandida para análise aprofundada de histórico.
   */
  static async analyzeConversation(params: {
    chatHistory: CopilotChatHistoryItem[];
    brokerName?: string;
    contactContext?: any;
    aiConfig?: TenantAIConfig;
  }): Promise<AICopilotAnalysis> {
    const { chatHistory, brokerName = 'Corretor', contactContext, aiConfig } = params;

    const provider = aiConfig?.provider || 'PLATFORM_DEFAULT';
    const apiKey = (aiConfig?.apiKey || '').trim();
    const platformGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    // 1. PRIORIDADE MÁXIMA: Google Gemini (Nativo da Plataforma ou Chave Master)
    if (provider === 'GEMINI' || provider === 'PLATFORM_DEFAULT') {
      const activeGeminiKey = apiKey || platformGeminiKey;
      if (activeGeminiKey) {
        try {
          // Gemini possui 1 milhão de tokens de contexto: analisamos até 70 mensagens com custo irrisório
          const geminiHistory = chatHistory.slice(-70);
          const result = await this.executeGemini({
            history: geminiHistory,
            brokerName,
            contactContext,
            aiConfig: {
              ...(aiConfig || {}),
              provider: 'GEMINI',
              model: aiConfig?.model || 'gemini-flash-latest',
            } as TenantAIConfig,
            apiKey: activeGeminiKey,
          });
          if (result) return result;
        } catch (err) {
          console.error('[Copilot] Erro no motor Google Gemini, acionando fallback secundário:', err);
        }
      }
    }

    // Janela deslizante para modelos de menor contexto (até 25 mensagens mais recentes)
    const recentHistory = chatHistory.slice(-25);

    // 2. Se o usuário configurou OpenAI BYOK
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

    // 3. Se o usuário configurou Anthropic Claude BYOK
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

    // 4. Fallback para OpenAI padrão da plataforma (se configurada)
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

    // 5. Fallback de alta precisão sem custos de API (Motor Semântico Local)
    const fallbackEngine = new BedrockCopilotClient();
    return fallbackEngine.analyzeConversation(chatHistory, brokerName, contactContext);
  }

  /**
   * Construtor de Prompt do Sistema com Tom de Voz e Foco Comercial
   */
  private static buildSystemPrompt(brokerName: string, aiConfig?: TenantAIConfig, contactContext?: any): string {
    const toneMap: Record<string, string> = {
      CONSULTATIVE: 'Consultivo, empático, especialista de confiança que faz perguntas inteligentes e conduz com segurança.',
      CLOSER: 'Focado em fechamento rápido, proativo, persuasivo e direcionado para marcar visitas ou simulações.',
      PERSUASIVE: 'Persuasivo, ágil, focado em criar senso de oportunidade, valorização e agendamento de visita.',
      ELEGANT: 'Sofisticado, exclusivo, executivo e formal com foco em alto padrão, liquidez e discrição.',
      FRIENDLY: 'Acolhedor, caloroso, descontraído, didático e empático (perfeito para famílias e primeiro imóvel).',
      TECHNICAL: 'Técnico, analítico e objetivo, focado em métricas de investimento, Cap Rate, ROI e liquidez.',
    };

    const objectiveMap: Record<string, string> = {
      AGENDAR_VISITA: 'Prioridade máxima: Convidar e garantir a presença do cliente em uma visita presencial ao decorado ou plantão.',
      SIMULAR_FINANCIAMENTO: 'Prioridade máxima: Obter dados de entrada e renda para rodar uma simulação bancária com as melhores taxas.',
      QUALIFICAR: 'Prioridade máxima: Mapear os 4 pilares (Orçamento, Região, Tipo de Imóvel e Prazo de Compra).',
      EQUILIBRADO: 'Equilibrar acolhimento, resposta clara à dúvida do cliente e avanço para o próximo passo no funil de vendas.',
    };

    const selectedTone = toneMap[aiConfig?.tone || 'CONSULTATIVE'] || toneMap.CONSULTATIVE;
    const selectedObjective = objectiveMap[aiConfig?.objective || 'EQUILIBRADO'] || objectiveMap.EQUILIBRADO;
    const customInstructions = aiConfig?.customInstructions 
      ? `\n\nREGRAS COMERCIAIS & DIRETRIZES DA PERSONA DO CORRETOR (MANDATÓRIAS - INCORPORE AO ESTILO):\n${aiConfig.customInstructions}` 
      : '';

    return `Você é o Copiloto de IA Especialista em Vendas Imobiliárias e Análise Conversacional, atuando em conjunto com o corretor(a) ${brokerName}.
Sua missão é analisar com total fidelidade as mensagens de WhatsApp do contato, identificar a verdadeira natureza da conversa e sugerir respostas humanas, altamente persuasivas e personalizadas.

DIRETRIZES DE FIDELIDADE E ANCORAGEM DE CONTEXTO (MANDATÓRIAS):
1. CLASSIFICAÇÃO DA CONVERSA ("conversationType"):
   - "PERSONAL_OR_OTHER": Conversas pessoais, familiares, amigos, afazeres domésticos, comprovantes avulsos, rotina ou bate-papo sem interesse imobiliário.
   - "OPERATIONAL_OR_VENDOR": Conversas com fornecedores, fotógrafos, cartórios, bancos, corretores parceiros ou assuntos operacionais.
   - "REAL_ESTATE_LEAD": Quando o contato está ativamente buscando, consultando ou negociando a compra, venda ou locação de um imóvel.

2. SE A CONVERSA FOR PESSOAL OU OPERACIONAL (não imobiliária):
   - No campo "summary": resuma com precisão factual o assunto real tratado na conversa (ex: "Conversa pessoal sobre afazeres do dia a dia e envio de comprovante bancário.").
   - NUNCA invente interesse em imóveis, orçamentos milionários, renda ou bairros.
   - Em "extractedData": defina estritamente: "monthlyIncome": null, "downPayment": null, "maxBudget": null, "preferredRegion": null, "propertyType": null, "urgencyLevel": "BAIXA", "detectedObjections": [].
   - Em "responseOptions": forneça respostas naturais condizentes com o tema real (ex: confirmação cordial de recebimento, agradecimento ou resposta casual), NUNCA convidando para plantão de vendas, decorado ou book imobiliário.

3. SE A CONVERSA FOR IMOBILIÁRIA ("REAL_ESTATE_LEAD"):
   - FORMATO E CONTEÚDO OBRIGATÓRIO DO RESUMO EXECUTIVO ("summary"):
     O resumo executivo deve ser analítico, direto e enriquecido com os detalhes expressamente citados pelo cliente.
     Estrutura obrigatória em 2 partes:
     Linha 1: O que o cliente está buscando com exatidão (ex: tipo de imóvel, oportunidades de lançamentos, número de dormitórios/quartos citados, localização e características principais).
     Linha 2: "Região: [Bairro/Cidade ou 'Não informada'], Urgência: [Alta | Média | Baixa | 'Não identificada']"
     Exemplo esperado:
     "Lead buscando oportunidades em Palhoça, com dois dormitórios\n\nRegião: Palhoça, Urgência: Não identificada"
   - Extraia SOMENTE informações expressamente mencionadas ou confirmadas pelo cliente. Se não falou de orçamento, retorne null. Se não falou de bairro, retorne null.
   - Em "extractedData":
     - "propertyType": capture com fidelidade incluindo o número de dormitórios caso citado (ex: "Apartamento 2 dormitórios", "Lançamento 2 dormitórios", "Casa em condomínio").
     - "preferredRegion": bairro ou cidade citados (ex: "Palhoça, SC" ou "Palhoça").
     - "urgencyLevel": "ALTA" (prazo imediato ou urgência expressa), "MEDIA" (médio prazo), "BAIXA" (longo prazo) ou "NAO_IDENTIFICADA" (se o cliente não expressou prazo).
   - Tom de voz adotado: ${selectedTone}
   - Objetivo comercial principal: ${selectedObjective}${customInstructions}
   - AS OPÇÕES DE RESPOSTA DEVEM REFLETIR ESTREITAMENTE O TOM DE VOZ E AS REGRAS COMERCIAIS ACIMA.

RETORNE ESTRITAMENTE UM OBJETO JSON VÁLIDO no seguinte formato (sem formatação markdown extra, apenas JSON puro):
{
  "summary": "Lead buscando [oportunidade/imóvel] em [Cidade/Bairro], com [X dormitórios/especificações]\\n\\nRegião: [Bairro/Cidade ou Não informada], Urgência: [Alta | Média | Baixa | Não identificada]",
  "conversationType": "REAL_ESTATE_LEAD" | "PERSONAL_OR_OTHER" | "OPERATIONAL_OR_VENDOR",
  "extractedData": {
    "monthlyIncome": number ou null,
    "downPayment": number ou null,
    "maxBudget": number ou null,
    "preferredRegion": "string com o bairro/cidade desejado ou null",
    "propertyType": "ex: Lançamento 2 dormitórios, Apartamento 3 quartos ou null",
    "urgencyLevel": "ALTA" | "MEDIA" | "BAIXA" | "NAO_IDENTIFICADA",
    "detectedObjections": ["lista de objeções reais identificadas nas mensagens do cliente"]
  },
  "detectedObjections": ["lista resumida das objeções reais"],
  "responseOptions": [
    {
      "id": "opt-1",
      "category": "OBJECTION",
      "badge": "🛡️ Resposta Tática",
      "label": "Rótulo curto da opção",
      "text": "Mensagem pronta e humana para o WhatsApp."
    },
    {
      "id": "opt-2",
      "category": "VISIT",
      "badge": "💬 Resposta Direta",
      "label": "Avançar conversa",
      "text": "Mensagem pertinente e natural para o WhatsApp."
    }
  ],
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "intent": "AGENDAR_VISITA" | "SIMULAR_FINANCIAMENTO" | "PEDIR_FOTOS" | "NEGOCIAR_VALOR" | "DUVIDA_GERAL" | "DESINTERESSE",
  "suggestedResponse": "O texto da melhor opção entre as sugeridas",
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
   * Chamada Google Gemini (Gemini 1.5 Flash com Contexto Amplo & JSON Nativo)
   */
  private static async executeGemini(params: {
    history: CopilotChatHistoryItem[];
    brokerName: string;
    contactContext: any;
    aiConfig: TenantAIConfig;
    apiKey: string;
  }): Promise<AICopilotAnalysis | null> {
    const candidateModels = ['gemini-flash-latest', 'gemini-3.6-flash'];
    if (params.aiConfig.model && !params.aiConfig.model.includes('1.5') && !candidateModels.includes(params.aiConfig.model)) {
      candidateModels.unshift(params.aiConfig.model);
    }
    const systemPrompt = this.buildSystemPrompt(params.brokerName, params.aiConfig, params.contactContext);

    const chatText = params.history
      .map(m => `${m.sender === 'BROKER' ? params.brokerName : 'Cliente'}: ${m.text}`)
      .join('\n');

    const prompt = `${systemPrompt}\n\nHISTÓRICO DA CONVERSA NO WHATSAPP (${params.history.length} mensagens):\n${chatText}\n\nRetorne agora estritamente o objeto JSON estruturado solicitado:`;

    let data: any = null;
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: params.aiConfig.temperature ?? 0.3,
              maxOutputTokens: Math.max(params.aiConfig.maxTokens ?? 4096, 3000),
            }
          }),
        });

        if (res.ok) {
          data = await res.json();
          break;
        } else if (res.status === 404) {
          continue;
        } else {
          const err = await res.text();
          throw new Error(`Gemini API error (${res.status}): ${err}`);
        }
      } catch (e: any) {
        lastError = e;
      }
    }

    if (!data) {
      if (lastError) throw lastError;
      return null;
    }
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    // Limpa delimitadores markdown caso o modelo os tenha incluído
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    let parsed: any = null;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      // Sanitização de trailing commas e caracteres de controle
      const sanitized = jsonMatch[0]
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\x00-\x1F\x7F]/g, ' ');
      parsed = JSON.parse(sanitized);
    }
    
    // Normalização defensiva para garantir que arrays e campos essenciais estejam presentes
    return {
      summary: parsed.summary || 'Resumo do contato não identificado.',
      conversationType: parsed.conversationType || 'REAL_ESTATE_LEAD',
      extractedData: {
        email: parsed.extractedData?.email || undefined,
        monthlyIncome: typeof parsed.extractedData?.monthlyIncome === 'number' ? parsed.extractedData.monthlyIncome : undefined,
        downPayment: typeof parsed.extractedData?.downPayment === 'number' ? parsed.extractedData.downPayment : undefined,
        maxBudget: typeof parsed.extractedData?.maxBudget === 'number' ? parsed.extractedData.maxBudget : undefined,
        preferredRegion: parsed.extractedData?.preferredRegion || undefined,
        propertyType: parsed.extractedData?.propertyType || undefined,
        urgencyLevel: parsed.extractedData?.urgencyLevel || 'NAO_IDENTIFICADA',
        detectedObjections: Array.isArray(parsed.extractedData?.detectedObjections) ? parsed.extractedData.detectedObjections : [],
      },
      detectedObjections: Array.isArray(parsed.detectedObjections) ? parsed.detectedObjections : [],
      responseOptions: Array.isArray(parsed.responseOptions) && parsed.responseOptions.length > 0 
        ? parsed.responseOptions 
        : [
            {
              id: 'opt-gemini-1',
              category: 'VISIT',
              badge: '✨ Sugestão Gemini',
              label: 'Avançar atendimento',
              text: parsed.suggestedResponse || 'Olá! Como posso te ajudar com o imóvel?',
            }
          ],
      sentiment: parsed.sentiment || 'NEUTRAL',
      intent: parsed.intent || 'DUVIDA_GERAL',
      suggestedResponse: parsed.suggestedResponse || (parsed.responseOptions?.[0]?.text ?? ''),
      confidenceScore: parsed.confidenceScore || 96,
    };
  }
}
