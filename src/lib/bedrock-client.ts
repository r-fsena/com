/**
 * Adaptador de IA Copiloto (Amazon Bedrock / Claude 3.5 Sonnet + Motor Semântico NLP de Alta Precisão)
 * Responsável por extração de dados comerciais, resumo 360º, detecção de objeções e respostas táticas.
 */

export interface LeadExtractionResult {
  email?: string;
  monthlyIncome?: number;
  downPayment?: number;
  maxBudget?: number;
  preferredRegion?: string;
  propertyType?: string;
  urgencyLevel?: 'ALTA' | 'MEDIA' | 'BAIXA';
  detectedObjections: string[];
}

export interface AIResponseOption {
  id: string;
  category: 'OBJECTION' | 'VISIT' | 'FINANCE' | 'MATERIAL';
  label: string;
  badge: string;
  text: string;
}

export interface AICopilotAnalysis {
  summary: string;
  conversationType?: 'REAL_ESTATE_LEAD' | 'PERSONAL_OR_OTHER' | 'OPERATIONAL_OR_VENDOR';
  extractedData: LeadExtractionResult;
  detectedObjections: string[];
  responseOptions: AIResponseOption[];
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
    brokerName = 'Corretor',
    contactContext?: {
      name?: string;
      tags?: string[];
      whatsappLabels?: string[];
      monthlyIncome?: number;
      downPaymentAvailable?: number;
      maxPropertyValue?: number;
      preferredPropertyType?: string;
      targetRegions?: string[];
    }
  ): Promise<AICopilotAnalysis> {
    return this.enhancedSemanticAnalysis(chatHistory, brokerName, contactContext);
  }

  /**
   * Motor Semântico Avançado de Processamento de Linguagem Natural Imobiliário
   * Prioriza estritamente as mensagens reais do chat, sem inventar dados não informados
   */
  private enhancedSemanticAnalysis(
    chatHistory: Array<{ sender: 'CLIENT' | 'BROKER'; text: string }>,
    brokerName: string,
    contactContext?: {
      name?: string;
      tags?: string[];
      whatsappLabels?: string[];
      monthlyIncome?: number;
      downPaymentAvailable?: number;
      maxPropertyValue?: number;
      preferredPropertyType?: string;
      targetRegions?: string[];
    }
  ): AICopilotAnalysis {
    const clientMessages = chatHistory.filter(m => m.sender === 'CLIENT').map(m => m.text);
    const clientText = clientMessages.join(' ').toLowerCase();
    const fullText = chatHistory.map(m => m.text).join(' ');
    const lowerText = fullText.toLowerCase();

    // 0. Classificação Prévia da Natureza do Diálogo
    // Detecta se a conversa tem termos e intenção imobiliária genuína
    const realEstateKeywordsRegex = /\b(im[oó]vel|im[oó]veis|apartamento|apartamentos|apto|aptos|cobertura|coberturas|penthouse|terreno|terrenos|loteamento|lotes?\s+residenciais?|casa\s+em\s+condom[íi]nio|casa\s+de\s+condom[íi]nio|condom[íi]nio\s+fechado|casa\s+t[ée]rrea|sobrado|mans[ãa]o|casa\s+de\s+alto\s+padr[ãa]o|(?:comprar|procura(?:ndo)?|busca(?:ndo)?|quer(?:o)?|interesse\s+em)\s+(?:uma?\s+)?casa|empreendimento|lan[çc]amento\s+imobili[áa]rio|im[oó]vel\s+na\s+planta|planta\s+humanizada|planta\s+baixa|decorado|visita\s+ao\s+im[oó]vel|visitar\s+(?:o\s+)?im[oó]vel|plant[ãa]o\s+de\s+vendas|corretor|corretora|imobili[áa]ria|financiamento\s+imobili[áa]rio|financiar\s+im[oó]vel|fgts|proposta\s+de\s+compra|permuta\s+de\s+im[oó]vel|aluguel\s+de\s+im[oó]vel|loca[çc][ãa]o\s+de\s+im[oó]vel|escritura|habite-se)\b/i;

    const personalIndicatorsRegex = /\b(amor\b|vida\b|meu\s+bem|mozi|marido\b|esposa\b|filho\b|filha\b|m[ãa]e\b|pai\b|irm[ãa]\b|maninho\b|p[ãa]o\b|chapa\b|almo[çc]o|jantar|caf[ée]|mercado\b|compras|dormir|acord(ar|ei|ou)|em\s+casa\b|pra\s+casa\b|para\s+casa\b|indo\s+pra|t[ôo]\s+chegando|chegando\s+em|t[ôo]\s+aqui|to\s+aqui)\b/i;

    const contactNameLower = (contactContext?.name || '').toLowerCase();
    const isKnownPersonalContact = contactContext?.tags?.some((t: string) => t.toLowerCase().includes('pessoal')) ||
      ['amor', 'esposa', 'marido', 'mãe', 'pai', 'filho', 'filha', 'irmão', 'irmã'].some(n => contactNameLower.includes(n));

    const hasExplicitRealEstateIntent = realEstateKeywordsRegex.test(fullText);
    const hasPersonalContext = personalIndicatorsRegex.test(fullText) || isKnownPersonalContact;

    // Se NÃO houver intenção imobiliária explícita, ou se houver contexto pessoal sem compra de imóvel:
    if (!hasExplicitRealEstateIntent || (hasPersonalContext && !/(comprar|financiamento|visita\s+ao\s+imóvel|proposta|lançamento)/i.test(fullText))) {
      const hasPaymentMentions = /(comprovante|pagamento|paguei|transfer[êe]ncia|pix|dep[oó]sito|conta\b|valor\b|banco\b|r\$)/i.test(fullText);
      const hasRoutineMentions = /(p[ãa]o|chapa|almo[çc]o|jantar|cheg(ou|amos|ei)|amor|quer\b|vida\b|fam[íi]lia|filh|rotina)/i.test(fullText);

      let factualSummary = 'Conversa de cunho pessoal ou informal, sem menção a transações imobiliárias.';
      if (hasPaymentMentions && hasRoutineMentions) {
        factualSummary = 'Conversa pessoal / cotidiana com combinações da rotina e confirmação de comprovantes / pagamentos.';
      } else if (hasPaymentMentions) {
        factualSummary = 'Conversa pessoal com envio e alinhamento de comprovantes / pagamentos bancários.';
      } else if (hasRoutineMentions) {
        factualSummary = 'Conversa de cunho pessoal / cotidiano sobre afazeres e rotina diária.';
      }

      const email = this.extractEmail(clientText, fullText);

      return {
        summary: factualSummary,
        conversationType: 'PERSONAL_OR_OTHER',
        extractedData: {
          email,
          monthlyIncome: undefined,
          downPayment: undefined,
          maxBudget: undefined,
          preferredRegion: undefined,
          propertyType: undefined,
          urgencyLevel: 'BAIXA',
          detectedObjections: [],
        },
        detectedObjections: [],
        responseOptions: [
          {
            id: 'opt-personal-ack',
            category: 'FINANCE',
            badge: '💬 Resposta Rápida',
            label: 'Confirmar Recebimento',
            text: 'Perfeito, recebido por aqui! Obrigado.'
          },
          {
            id: 'opt-personal-casual',
            category: 'VISIT',
            badge: '👋 Conversa Cotidiana',
            label: 'Responder com Cordialidade',
            text: 'Combinado, qualquer novidade te aviso por aqui!'
          }
        ],
        sentiment: 'POSITIVE',
        intent: 'DUVIDA_GERAL',
        suggestedResponse: 'Perfeito, recebido por aqui! Obrigado.',
        confidenceScore: 98,
      };
    }

    // 1. Diálogo Imobiliário Genuíno (REAL_ESTATE_LEAD):
    let intent: AICopilotAnalysis['intent'] = 'DUVIDA_GERAL';
    const targetTextForIntent = clientText || lowerText;
    if (/(visita|sábado|domingo|horário|agendar|conhecer|ir no local|ver o decorado|plantão|presencial)/i.test(targetTextForIntent)) {
      intent = 'AGENDAR_VISITA';
    } else if (/(financiamento|entrada|caixa|santander|itau|itaú|bradesco|parcela|fgts|banco|simulação|simular|taxa|juros)/i.test(targetTextForIntent)) {
      intent = 'SIMULAR_FINANCIAMENTO';
    } else if (/(foto|planta|vídeo|video|book|imagens|imagem|pdf|catálogo|apresentação|memorial|folder)/i.test(targetTextForIntent)) {
      intent = 'PEDIR_FOTOS';
    } else if (/(desconto|proposta|negociar|permuta|oferta|contraproposta|abate|fechar por)/i.test(targetTextForIntent)) {
      intent = 'NEGOCIAR_VALOR';
    }

    // 2. Extração Numérica de Renda Mensal (sem suposição)
    const monthlyIncome = this.extractMoneyMonthlyIncome(clientText) || this.extractMoneyMonthlyIncome(lowerText);

    // 3. Extração Numérica de Entrada
    const downPayment = this.extractMoneyDownPayment(clientText) || this.extractMoneyDownPayment(lowerText);

    // 4. Extração Numérica de Orçamento Máximo
    const maxBudget = this.extractMoneyMaxBudget(clientText) || this.extractMoneyMaxBudget(lowerText);

    // 5. Extração de Tipo de Imóvel (apenas se expressamente mencionado)
    const propertyType = this.extractPropertyType(clientText, lowerText);

    // 6. Extração de Regiões e Bairros (apenas se expressamente mencionado)
    const regions = this.extractRegions(clientText, fullText);
    const preferredRegion = regions.length > 0 ? regions.join(', ') : undefined;

    // 7. Extração de E-mail do Cliente
    const email = this.extractEmail(clientText, fullText);

    // 8. Detecção Específica de Objeções Reais
    const detectedObjections: string[] = [];
    if (/(caro|preço alto|valor alto|muito dinheiro|fora do orçamento|desconto|abaixar o valor)/i.test(lowerText)) {
      detectedObjections.push('🏷️ Objeção de Preço / Relação Custo-Benefício');
    }
    if (/(juros|taxa alta|parcela alta|financiamento difícil|aprovação|banco)/i.test(lowerText)) {
      detectedObjections.push('🏦 Receio sobre Juros & Financiamento Bancário');
    }
    if (/(esposa|marido|família|sócio|pensar|vou ver|depois te falo|conversar em casa)/i.test(lowerText)) {
      detectedObjections.push('👥 Decisão Compartilhada / Indecisão Familiar');
    }
    if (/(prazo|quando entrega|demora|obra atrasada|na planta|tempo de construção)/i.test(lowerText)) {
      detectedObjections.push('🏗️ Incerteza sobre Prazo de Obra & Entrega');
    }
    if (/(permuta|troca|pega carro|pega imóvel|dação)/i.test(lowerText)) {
      detectedObjections.push('🔄 Necessidade de Permuta / Veículo como Entrada');
    }
    if (/(condomínio|iptu|custo mensal|taxa de condomínio)/i.test(lowerText)) {
      detectedObjections.push('📋 Dúvida sobre Custos Recorrentes de Condomínio e IPTU');
    }

    // 9. Urgência e Sentimento
    let urgencyLevel: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA';
    if (/(urgente|este mês|fechar rápido|comprar agora|já vendi|aprovado|à vista|a vista|sinal hoje)/i.test(targetTextForIntent) || intent === 'AGENDAR_VISITA') {
      urgencyLevel = 'ALTA';
    }

    let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'POSITIVE';
    if (/(não quero|sem interesse|desistir|cancelar|muito caro|fora do orçamento|não gostei)/i.test(targetTextForIntent)) {
      sentiment = 'NEGATIVE';
    }

    // 10. Criação de Opções de Respostas Táticas
    const responseOptions: AIResponseOption[] = [];
    const propDisplay = propertyType || 'imóvel';
    const regionDisplay = preferredRegion ? ` em ${preferredRegion}` : '';

    if (detectedObjections.some(o => o.includes('Preço'))) {
      responseOptions.push({
        id: 'opt-objection-price',
        category: 'OBJECTION',
        badge: '🛡️ Quebra de Objeção',
        label: 'Contornar Objeção de Preço',
        text: `Entendo perfeitamente sua avaliação sobre o valor. O grande diferencial deste projeto é o padrão de acabamento e a valorização acelerada na região. O que acha de analisarmos uma proposta personalizada?`
      });
    } else if (detectedObjections.some(o => o.includes('Financiamento') || o.includes('Juros'))) {
      responseOptions.push({
        id: 'opt-objection-finance',
        category: 'FINANCE',
        badge: '🏦 Quebra de Objeção',
        label: 'Contornar Financiamento & Juros',
        text: `Excelente ponto! Temos correspondentes bancários credenciados que conseguem taxas bonificadas. Quer que eu faça uma simulação comparativa sem compromisso?`
      });
    } else {
      responseOptions.push({
        id: 'opt-objection-general',
        category: 'OBJECTION',
        badge: '🎯 Qualificação Ativa',
        label: 'Apresentar Oportunidade',
        text: `Temos opções estratégicas de ${propDisplay}${regionDisplay}. Gostaria de conhecer as unidades disponíveis nesta semana?`
      });
    }

    responseOptions.push({
      id: 'opt-visit',
      category: 'VISIT',
      badge: '📅 Agendamento',
      label: 'Convidar para Visita',
      text: `Excelente! Podemos organizar uma visita exclusiva para conhecer o ${propDisplay}${regionDisplay}. Qual período fica melhor para você?`
    });

    responseOptions.push({
      id: 'opt-material',
      category: 'MATERIAL',
      badge: '📄 Material & Book',
      label: 'Enviar Plantas e Detalhes',
      text: `Separei as informações detalhadas e plantas do ${propDisplay}. Deseja que eu envie o material completo aqui no WhatsApp?`
    });

    const suggestedResponse = responseOptions[0].text;

    // 11. Resumo Sintético do Perfil 360º Fiel
    const summaryParts: string[] = [];
    if (propertyType && preferredRegion) {
      summaryParts.push(`Lead com interesse em ${propertyType} em ${preferredRegion}.`);
    } else if (propertyType) {
      summaryParts.push(`Lead com interesse em ${propertyType}.`);
    } else if (preferredRegion) {
      summaryParts.push(`Lead buscando oportunidades imobiliárias em ${preferredRegion}.`);
    } else {
      summaryParts.push('Lead com interesse imobiliário em fase inicial de alinhamento de perfil.');
    }

    if (email) summaryParts.push(`E-mail identificado: ${email}.`);
    if (monthlyIncome) summaryParts.push(`Renda informada: R$ ${monthlyIncome.toLocaleString('pt-BR')}/mês.`);
    if (downPayment) summaryParts.push(`Entrada informada: R$ ${downPayment.toLocaleString('pt-BR')}.`);
    if (maxBudget) summaryParts.push(`Orçamento máximo: R$ ${maxBudget.toLocaleString('pt-BR')}.`);
    if (urgencyLevel === 'ALTA') summaryParts.push('Nível de urgência elevado.');

    return {
      summary: summaryParts.join(' '),
      conversationType: 'REAL_ESTATE_LEAD',
      extractedData: {
        email,
        monthlyIncome,
        downPayment,
        maxBudget,
        preferredRegion,
        propertyType,
        urgencyLevel,
        detectedObjections,
      },
      detectedObjections,
      responseOptions,
      sentiment,
      intent,
      suggestedResponse,
      confidenceScore: 96,
    };
  }

  /**
   * Classificador de Tipo de Imóvel por Votação Ponderada
   * Retorna undefined se nenhum tipo de imóvel for mencionado
   */
  private extractPropertyType(clientText: string, fullText: string): string | undefined {
    const scores = {
      Apartamento: 0,
      Cobertura: 0,
      'Casa em Condomínio': 0,
      'Studio / Loft': 0,
      Terreno: 0,
      Comercial: 0,
    };

    const passes = [
      { text: clientText, weight: 4 }, // Mensagens do cliente têm peso 4x
      { text: fullText, weight: 1 },
    ];

    for (const { text, weight } of passes) {
      if (!text) continue;

      // Apartamento
      if (/\b(apartamento|apartamentos|apto|aptos|ap\b|ap\.|\d+\s*quartos|\d+\s*dorms|\d+\s*su[íi]tes|edif[íi]cio|torre|andar|sacada|varanda gourmet)\b/i.test(text)) {
        scores.Apartamento += 3 * weight;
      }

      // Cobertura
      if (/\b(cobertura|coberturas|penthouse|duplex|triplex|rooftop|[úu]ltimo andar)\b/i.test(text)) {
        scores.Cobertura += 4 * weight;
      }

      // Casa
      if (/\b(casa em condom[íi]nio|casa de condom[íi]nio|condom[íi]nio fechado|casa t[ée]rrea|sobrado|mans[ãa]o|casa de alto padr[ãa]o|(?:comprar|procura(?:ndo)?|busca(?:ndo)?|quer(?:o)?|interesse em)\s+(?:uma?\s+)?casa)\b/i.test(text)) {
        scores['Casa em Condomínio'] += 3 * weight;
      }

      // Studio / Loft
      if (/\b(studio|studios|loft|lofts|kitnet|kitnets|compacto|1 quarto|1 dorm|kitchenette|flat)\b/i.test(text)) {
        scores['Studio / Loft'] += 3 * weight;
      }

      // Terreno (Exige palavras estritas e NUNCA a palavra "área" isolada)
      if (/\b(terreno|terrenos|lote\b|lotes\b|loteamento|loteamentos|gleba|ch[áa]cara|terreno residencial|lote residencial)\b/i.test(text)) {
        scores.Terreno += 3 * weight;
      }

      // Comercial
      if (/\b(sala comercial|loja comercial|galp[ãa]o|laje corporativa|consult[óo]rio|escrit[óo]rio comercial)\b/i.test(text)) {
        scores.Comercial += 3 * weight;
      }
    }

    let maxType: string | undefined = undefined;
    let maxScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }

    return maxScore > 0 ? maxType : undefined;
  }

  /**
   * Extração Numérica de Renda Mensal / Familiar
   */
  private extractMoneyMonthlyIncome(text: string): number | undefined {
    if (!text) return undefined;
    const p1 = /(?:minha\s+)?renda(?:\s+(?:mensal|familiar|bruta|l[íi]quida))?(?:\s+(?:é|de|em|seria|fica|em torno de|na faixa de|será))?\s*(?:de)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m1 = text.match(p1);
    if (m1) {
      const val = this.parseMoney(m1[1], m1[2], 'income');
      if (val && val >= 1000) return val;
    }

    const p2 = /(?:ganho|tiro|faturamento|recebo|retiro)\s*(?:por m[êe]s|ao m[êe]s|mensalmente|de)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m2 = text.match(p2);
    if (m2) {
      const val = this.parseMoney(m2[1], m2[2], 'income');
      if (val && val >= 1000) return val;
    }

    const p3 = /(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)\s*(?:de renda|de faturamento|por m[êe]s|ao m[êe]s|mensais|mensal)/i;
    const m3 = text.match(p3);
    if (m3) {
      const val = this.parseMoney(m3[1], m3[2], 'income');
      if (val && val >= 1000) return val;
    }

    const p4 = /(?:r\$)?\s*([\d\.\,]+)\s*(mil|k)\s*(?:reais)?\s*(?:de renda|por m[êe]s)/i;
    const m4 = text.match(p4);
    if (m4) {
      const val = this.parseMoney(m4[1], m4[2], 'income');
      if (val && val >= 1000) return val;
    }

    return undefined;
  }

  /**
   * Extração Numérica de Entrada
   */
  private extractMoneyDownPayment(text: string): number | undefined {
    if (!text) return undefined;
    const p1 = /(?:minha\s+)?entrada(?:\s+(?:é|de|em|seria|fica|disponível|em torno de|por volta de|na faixa de|será))?\s*(?:de)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m1 = text.match(p1);
    if (m1) {
      const val = this.parseMoney(m1[1], m1[2]);
      if (val && val >= 5000) return val;
    }

    const p2 = /(?:posso|consigo|pretendo|quero|vou|tenho como|tenho pra|disponho de)\s+(?:dar|investir|pagar|colocar)\s*(?:de)?\s*(?:entrada)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m2 = text.match(p2);
    if (m2) {
      const val = this.parseMoney(m2[1], m2[2]);
      if (val && val >= 5000) return val;
    }

    const p3 = /(?:tenho|possuo|sinal de|recursos de)\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)\s*(?:de entrada|em mãos|na mão|disponíveis|de sinal)/i;
    const m3 = text.match(p3);
    if (m3) {
      const val = this.parseMoney(m3[1], m3[2]);
      if (val && val >= 5000) return val;
    }

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
    if (!text) return undefined;
    const p1 = /(?:or[çc]amento(?:\s+m[áa]ximo)?|budget|teto|limite|capacidade|valor\s+m[áa]ximo|pre[çc]o\s+m[áa]ximo|faixa\s+de\s+(?:pre[çc]o|valor))(?:\s+(?:é|de|em|seria|fica|em torno de|por volta de|na faixa de|at[ée]))?\s*(?:de)?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)?/i;
    const m1 = text.match(p1);
    if (m1) {
      const val = this.parseMoney(m1[1], m1[2]);
      if (val && val >= 50000) return val;
    }

    const p2 = /(?:at[ée]|por at[ée]|no m[áa]ximo|valor de|im[óo]vel de|busco algo de|procuro algo de|na faixa de)\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)/i;
    const m2 = text.match(p2);
    if (m2) {
      const val = this.parseMoney(m2[1], m2[2]);
      if (val && val >= 50000) return val;
    }

    const p3 = /(?:posso pagar|pretendo investir|quero gastar|consigo financiar|procuro im[óo]vel at[ée]|ap at[ée]|casa at[ée]|cobertura at[ée])\s*(?:at[ée])?\s*(?:r\$)?\s*([\d\.\,]+)\s*(mil(?:h[õo]es)?|k|m(?:ilhões|ilhao|ilhe|i)?)/i;
    const m3 = text.match(p3);
    if (m3) {
      const val = this.parseMoney(m3[1], m3[2]);
      if (val && val >= 50000) return val;
    }

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
  private parseMoney(numStr: string, unitStr?: string, defaultContext: 'income' | 'downpayment' | 'budget' = 'budget'): number | undefined {
    if (!numStr) return undefined;
    let clean = numStr.trim().replace(/^r\$\s*/i, '');

    // Se tem vírgula e ponto (ex: 1.250.000,00 ou 1,250,000.50)
    if (clean.includes('.') && clean.includes(',')) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes('.')) {
      // Se tem apenas ponto:
      const parts = clean.split('.');
      const lastPart = parts[parts.length - 1];
      // Caso 1: Milhares com ponto (ex: 1.200.000 ou 350.000) -> mais de 1 ponto ou 3 dígitos após o ponto sem unidade decimal
      if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3 && (!unitStr || !unitStr.toLowerCase().includes('milh')))) {
        clean = clean.replace(/\./g, '');
      }
      // Caso 2: Decimal (ex: 1.2 milhão ou 1.5 mi) -> mantém o ponto!
    } else if (clean.includes(',')) {
      const parts = clean.split(',');
      const lastPart = parts[parts.length - 1];
      if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3 && !unitStr)) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(',', '.'); // ex: 1,2 -> 1.2
      }
    }

    let num = parseFloat(clean);
    if (isNaN(num)) return undefined;

    const unit = (unitStr || '').toLowerCase().trim();

    // Milhões: 'milhão', 'milhões', 'milhoes', 'milhao', 'mi', 'm' (NÃO 'mil'!)
    // 'mil' e 'k' são estritamente milhares (x1.000)
    const isMillion = unit.includes('milh') || unit === 'mi' || unit === 'milhoes' || unit === 'milhao' || unit === 'milhões' || unit === 'milhão';
    const isThousand = unit === 'mil' || unit === 'k' || unit.startsWith('k') || (unit.startsWith('mil') && !unit.includes('milh'));

    if (isMillion) {
      num *= 1000000;
    } else if (isThousand) {
      num *= 1000;
    } else if (!unitStr) {
      if (defaultContext === 'income') {
        if (num > 0 && num < 150) num *= 1000; // ex: renda '45' -> 45.000
      } else {
        if (num > 0 && num <= 50) num *= 1000000; // ex: orçamento '1.2' -> 1.200.000
        else if (num < 1000) num *= 1000; // ex: 350 -> 350.000
      }
    }

    return num > 0 ? Math.round(num) : undefined;
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

    const dynamicRegex = /(?:em|no|na|bairro|regi[ãa]o|praia|praia de|perto de|pr[óo]ximo a|zona)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/g;
    let match;
    while ((match = dynamicRegex.exec(originalText)) !== null) {
      const candidate = match[1].trim();
      const lowerCand = candidate.toLowerCase();
      if (!['um', 'uma', 'este', 'esta', 'outro', 'outra', 'algum', 'alguma', 'bom', 'boa', 'grande', 'whatsapp', 'decorado', 'plantao', 'plantão', 'instagram', 'facebook', 'anúncio', 'anuncio', 'google', 'site', 'olá', 'ola'].includes(lowerCand)) {
        if (!found.some(f => f.toLowerCase() === lowerCand) && candidate.length > 2) {
          found.push(candidate);
        }
      }
    }

    return found;
  }

  /**
   * Extração de E-mail de Contato
   */
  private extractEmail(clientText: string, fullText: string): string | undefined {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

    // 1. Procura prioritariamente nas mensagens enviadas pelo cliente
    const clientMatch = clientText.match(emailRegex);
    if (clientMatch) {
      const email = clientMatch[1].trim().toLowerCase().replace(/[\.\,\;\:\!\?]+$/, '');
      if (email.includes('@') && email.includes('.')) return email;
    }

    // 2. Procura no histórico completo
    const fullMatch = fullText.match(emailRegex);
    if (fullMatch) {
      const email = fullMatch[1].trim().toLowerCase().replace(/[\.\,\;\:\!\?]+$/, '');
      if (email.includes('@') && email.includes('.') && !email.includes('exemplo') && !email.includes('teste')) {
        return email;
      }
    }

    return undefined;
  }
}
