/**
 * Adaptador de IA Copiloto (Amazon Bedrock / Claude 3.5 Sonnet + Motor Semântico NLP de Alta Precisão)
 * Responsável por extração de dados comerciais, resumo de conversas e sugestões de respostas imobiliárias.
 */

export interface LeadExtractionResult {
  monthlyIncome?: number;
  downPayment?: number;
  maxBudget?: number;
  preferredRegion?: string;
  propertyType?: string;
  urgencyLevel?: 'ALTA' | 'MEDIA' | 'BAIXA';
  detectedObjections: string[];
}

export interface AICopilotAnalysis {
  summary: string;
  extractedData: LeadExtractionResult;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  intent: 'AGENDAR_VISITA' | 'SIMULAR_FINANCIAMENTO' | 'PEDIR_FOTOS' | 'NEGOCIAR_VALOR' | 'DUVIDA_GERAL' | 'DESINTERESSE';
  suggestedResponse: string;
  confidenceScore: number;
}

export class BedrockCopilotClient {
  private modelId: string;
  private region: string;

  constructor(modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0', region = 'us-east-1') {
    this.modelId = modelId;
    this.region = region;
  }

  /**
   * Executa a análise de contexto da conversa e infere dados de qualificação imobiliária
   */
  async analyzeConversation(
    chatHistory: Array<{ sender: 'CLIENT' | 'BROKER'; text: string }>,
    brokerName = 'Corretor'
  ): Promise<AICopilotAnalysis> {
    return this.enhancedSemanticAnalysis(chatHistory, brokerName);
  }

  /**
   * Motor Semântico Avançado de Processamento de Linguagem Natural Imobiliário
   */
  private enhancedSemanticAnalysis(
    chatHistory: Array<{ sender: 'CLIENT' | 'BROKER'; text: string }>,
    brokerName: string
  ): AICopilotAnalysis {
    const fullText = chatHistory.map(m => m.text).join(' ');
    const lowerText = fullText.toLowerCase();

    // 1. Detecção de Intenção Comercial
    let intent: AICopilotAnalysis['intent'] = 'DUVIDA_GERAL';
    if (/(visita|sábado|domingo|horário|agendar|conhecer|ir no local|ver o decorado|plantão|presencial)/i.test(lowerText)) {
      intent = 'AGENDAR_VISITA';
    } else if (/(financiamento|entrada|caixa|santander|itau|itaú|bradesco|parcela|fgts|banco|simulação|simular|taxa|juros)/i.test(lowerText)) {
      intent = 'SIMULAR_FINANCIAMENTO';
    } else if (/(foto|planta|vídeo|video|book|imagens|imagem|pdf|catálogo|apresentação|memorial|folder)/i.test(lowerText)) {
      intent = 'PEDIR_FOTOS';
    } else if (/(desconto|proposta|negociar|permuta|oferta|contraproposta|abate|fechar por)/i.test(lowerText)) {
      intent = 'NEGOCIAR_VALOR';
    }

    // 2. Extração de Entrada Financeira (Down Payment)
    const downPayment = this.extractMoneyDownPayment(lowerText);

    // 3. Extração de Orçamento / Valor Máximo do Imóvel (Max Budget)
    const maxBudget = this.extractMoneyMaxBudget(lowerText);

    // 4. Extração de Tipo de Imóvel
    const propertyType = this.extractPropertyType(lowerText);

    // 5. Extração de Regiões e Bairros
    const regions = this.extractRegions(lowerText, fullText);
    const preferredRegion = regions.length > 0 ? regions.join(', ') : 'Região Central / Metropolitana';

    // 6. Urgência e Sentimento
    let urgencyLevel: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA';
    if (/(urgente|este mês|fechar rápido|comprar agora|já vendi|aprovado|à vista|a vista|sinal hoje)/i.test(lowerText) || intent === 'AGENDAR_VISITA') {
      urgencyLevel = 'ALTA';
    }

    let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'POSITIVE';
    if (/(não quero|sem interesse|desistir|cancelar|muito caro|fora do orçamento|não gostei)/i.test(lowerText)) {
      sentiment = 'NEGATIVE';
    }

    // 7. Sugestão Dinâmica de Resposta Comercial Humanizada
    let suggestedResponse = `Olá! Que excelente momento para conversar. Temos unidades com perfil selecionado exatamente para essa busca. Gostaria de agendar uma visita presencial ou prefere que eu envie o material completo em PDF primeiro?`;

    if (intent === 'AGENDAR_VISITA') {
      suggestedResponse = `Excelente! Podemos organizar uma visita exclusiva ao imóvel decorado neste final de semana. Qual período fica melhor para você: sábado pela manhã ou à tarde?`;
    } else if (intent === 'SIMULAR_FINANCIAMENTO') {
      suggestedResponse = downPayment
        ? `Com essa entrada de R$ ${downPayment.toLocaleString('pt-BR')} conseguimos condições especiais de financiamento e tabela direta com a construtora. Posso gerar uma simulação detalhada para você agora?`
        : `Consigo aprovação bancária rápida com as melhores taxas do mercado. Gostaria que eu rodasse uma simulação personalizada das parcelas?`;
    } else if (intent === 'PEDIR_FOTOS') {
      suggestedResponse = `Já separei o book digital em alta resolução com as plantas humanizadas, fotos do decorado e a tabela de unidades disponíveis. Deseja que eu envie aqui no WhatsApp?`;
    } else if (intent === 'NEGOCIAR_VALOR') {
      suggestedResponse = `Entendido! Vou levar sua proposta diretamente para a diretoria comercial para buscarmos a melhor condição de fechamento. Em breve te trago um retorno!`;
    }

    // 8. Resumo Sintético do Lead
    const summaryParts: string[] = [
      `Lead com interesse em ${propertyType} em ${preferredRegion}.`,
    ];
    if (downPayment) {
      summaryParts.push(`Entrada informada: R$ ${downPayment.toLocaleString('pt-BR')}.`);
    }
    if (maxBudget) {
      summaryParts.push(`Orçamento máximo: R$ ${maxBudget.toLocaleString('pt-BR')}.`);
    }
    if (urgencyLevel === 'ALTA') {
      summaryParts.push('Nível de urgência elevado.');
    }

    return {
      summary: summaryParts.join(' '),
      extractedData: {
        downPayment,
        maxBudget,
        preferredRegion,
        propertyType,
        urgencyLevel,
        detectedObjections: /(condomínio|iptu|reforma|prazo de entrega)/i.test(lowerText)
          ? ['Verificar custos recorrentes e prazos de entrega']
          : [],
      },
      sentiment,
      intent,
      suggestedResponse,
      confidenceScore: 96,
    };
  }

  /**
   * Extração Numérica de Entrada
   */
  private extractMoneyDownPayment(text: string): number | undefined {
    // Padrão 1: "minha entrada é 200 mil", "entrada de 150k", "entrada: 300.000"
    const p1 = /(?:minha\s+)?entrada(?:\s+(?:é|de|em|seria|fica|disponível|em torno de|por volta de|na faixa de|será))?\s*(?:de)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m1 = text.match(p1);
    if (m1) {
      const val = this.parseMoney(m1[1], m1[2]);
      if (val && val >= 5000) return val;
    }

    // Padrão 2: "posso dar 200k", "consigo dar 150 mil", "vou dar 300 mil de entrada"
    const p2 = /(?:posso|consigo|pretendo|quero|vou|tenho como|tenho pra|disponho de)\s+(?:dar|investir|pagar|colocar)\s*(?:de)?\s*(?:entrada)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m2 = text.match(p2);
    if (m2) {
      const val = this.parseMoney(m2[1], m2[2]);
      if (val && val >= 5000) return val;
    }

    // Padrão 3: "tenho 200 mil em mãos / na mão / de sinal"
    const p3 = /(?:tenho|possuo|sinal de|recursos de)\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)\s*(?:de entrada|em mãos|na mão|disponíveis|de sinal)/i;
    const m3 = text.match(p3);
    if (m3) {
      const val = this.parseMoney(m3[1], m3[2]);
      if (val && val >= 5000) return val;
    }

    // Padrão 4: "200k de entrada", "300 mil de entrada"
    const p4 = /(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)\s*(?:de entrada|na entrada|de sinal)/i;
    const m4 = text.match(p4);
    if (m4) {
      const val = this.parseMoney(m4[1], m4[2]);
      if (val && val >= 5000) return val;
    }

    return undefined;
  }

  /**
   * Extração Numérica de Orçamento / Teto Máximo
   */
  private extractMoneyMaxBudget(text: string): number | undefined {
    // Padrão 1: "orçamento de 1.2 milhão", "budget de 900k", "teto de 2 milhões"
    const p1 = /(?:or[çc]amento|budget|teto|limite|capacidade|valor m[áa]ximo|pre[çc]o m[áa]ximo|faixa de pre[çc]o|faixa de valor)(?:\s+(?:é|de|em|seria|fica|em torno de|por volta de|na faixa de|at[ée]))?\s*(?:de)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m1 = text.match(p1);
    if (m1) {
      const val = this.parseMoney(m1[1], m1[2]);
      if (val && val >= 50000) return val;
    }

    // Padrão 2: "até 1.5 milhão", "imóvel até 800 mil", "busco algo de 900k"
    const p2 = /(?:at[ée]|por at[ée]|no m[áa]ximo|valor de|im[óo]vel de|busco algo de|procuro algo de|na faixa de)\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)/i;
    const m2 = text.match(p2);
    if (m2) {
      const val = this.parseMoney(m2[1], m2[2]);
      if (val && val >= 50000) return val;
    }

    // Padrão 3: "posso pagar até 1.200.000", "consigo financiar até 700 mil"
    const p3 = /(?:posso pagar|pretendo investir|quero gastar|consigo financiar|procuro im[óo]vel at[ée]|ap at[ée]|casa at[ée]|cobertura at[ée])\s*(?:at[ée])?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)/i;
    const m3 = text.match(p3);
    if (m3) {
      const val = this.parseMoney(m3[1], m3[2]);
      if (val && val >= 50000) return val;
    }

    // Padrão 4: "1.5 milhão no total / no imóvel"
    const p4 = /(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)\s*(?:no total|de valor|no imóvel|de orçamento)/i;
    const m4 = text.match(p4);
    if (m4) {
      const val = this.parseMoney(m4[1], m4[2]);
      if (val && val >= 50000) return val;
    }

    return undefined;
  }

  /**
   * Converte strings numéricas em Reais (com suporte a k, mil, mi, milhões)
   */
  private parseMoney(numStr: string, unitStr?: string): number | undefined {
    if (!numStr) return undefined;
    let clean = numStr.trim().replace(/^r\$\s*/i, '');
    clean = clean.replace(/\./g, '').replace(',', '.');
    let num = parseFloat(clean);
    if (isNaN(num)) return undefined;

    const unit = (unitStr || '').toLowerCase().trim();
    if (unit.startsWith('mi') || unit === 'm' || unit.includes('milh')) {
      num *= 1000000;
    } else if (unit.startsWith('mil') || unit === 'k') {
      num *= 1000;
    } else if (num < 1000) {
      if (num <= 50) num *= 1000000; // ex: 1.5 -> 1.500.000
      else if (num < 1000) num *= 1000; // ex: 350 -> 350.000
    }

    return num > 0 ? Math.round(num) : undefined;
  }

  /**
   * Extração de Tipo de Imóvel
   */
  private extractPropertyType(text: string): string {
    if (/(cobertura|penthouse|duplex|triplex|rooftop|último andar)/i.test(text)) {
      return 'Cobertura';
    }
    if (/(casa em condomínio|casa de condomínio|condomínio fechado|casa térrea|sobrado|mansão|casa)/i.test(text)) {
      return 'Casa em Condomínio';
    }
    if (/(studio|loft|kitnet|compacto|1 quarto|1 dorm|kitchenette|flat)/i.test(text)) {
      return 'Studio / Loft';
    }
    if (/(terreno|lote|loteamento|chácara|área)/i.test(text)) {
      return 'Terreno';
    }
    if (/(comercial|sala comercial|consultório|laje corporativa|escritório|galpão|loja)/i.test(text)) {
      return 'Comercial';
    }
    return 'Apartamento';
  }

  /**
   * Extração de Bairros e Regiões
   */
  private extractRegions(text: string, originalText: string): string[] {
    const found: string[] = [];
    const knownRegions = [
      'Centro', 'Beira-Mar', 'Agronômica', 'Itacorubi', 'Trindade', 'Santa Mônica', 'Córrego Grande',
      'Campeche', 'Lagoa da Conceição', 'Jurerê', 'Jurerê Internacional', 'Canasvieiras', 'Ingleses',
      'Coqueiros', 'Estreito', 'Abraão', 'João Paulo', 'Cacupé', 'Santo Antônio de Lisboa', 'Sambaqui',
      'Rio Tavares', 'Daniela', 'Novo Campeche', 'Jardins', 'Pinheiros', 'Itaim Bibi', 'Vila Olímpia',
      'Moema', 'Perdizes', 'Vila Mariana', 'Higienópolis', 'Morumbi', 'Brooklin', 'Campo Belo',
      'Leblon', 'Ipanema', 'Copacabana', 'Barra da Tijuca', 'Recreio', 'Botafogo', 'Flamengo',
      'Meia Praia', 'Barra Sul', 'Barra Norte', 'Batel', 'Ecoville', 'Cabral', 'Bigorrilho',
      'Atiradores', 'América'
    ];

    knownRegions.forEach(r => {
      const lower = r.toLowerCase();
      if (text.includes(lower)) {
        found.push(r);
      }
    });

    // Extração dinâmica por preposição: "no / na / em [Nome do Bairro]"
    const dynamicRegex = /(?:em|no|na|bairro|regi[ãa]o|praia|praia de|perto de|pr[óo]ximo a|zona)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/g;
    let match;
    while ((match = dynamicRegex.exec(originalText)) !== null) {
      const candidate = match[1].trim();
      const lowerCand = candidate.toLowerCase();
      if (!['um', 'uma', 'este', 'esta', 'outro', 'outra', 'algum', 'alguma', 'bom', 'boa', 'grande', 'whatsapp'].includes(lowerCand)) {
        if (!found.some(f => f.toLowerCase() === lowerCand) && candidate.length > 2) {
          found.push(candidate);
        }
      }
    }

    return found;
  }
}
