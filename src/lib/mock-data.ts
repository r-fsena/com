import { 
  Tenant, 
  User, 
  WhatsAppInstance, 
  Contact, 
  Pipeline, 
  Deal, 
  Conversation, 
  Message, 
  AIInsight, 
  Task, 
  SLAAlert, 
  Campaign, 
  QuickReplyTemplate,
  AutomationRule,
  AutomationExecutionLog,
  Proposal,
  FinancialTransaction
} from '@/types/crm';

export const MOCK_TENANTS: Tenant[] = [
  {
    id: 'tenant-vanguard-01',
    name: 'Vanguard Prime Imóveis',
    slug: 'vanguard-prime',
    documentCnpj: '34.567.890/0001-12',
    logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=128&auto=format&fit=crop&q=60',
    primaryColor: '#059669',
    timezone: 'America/Sao_Paulo',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    monthlyFee: 1490.00,
    maxBrokers: 50,
    maxInstances: 10,
    asaasApiKey: 'asaas_secret_key_vanguard_sandbox',
    businessHours: {
      start: '08:30',
      end: '19:00',
      workDays: [1, 2, 3, 4, 5, 6],
    },
    settings: {
      slaFirstResponseMinutes: 15,
      slaInactivityHours: 24,
      autoAssignRule: 'ROUND_ROBIN',
      aiCopilotEnabled: true,
      requireHumanApprovalForAI: true,
    }
  },
  {
    id: 'tenant-horizonte-02',
    name: 'Horizonte Empreendimentos',
    slug: 'horizonte-imoveis',
    documentCnpj: '12.345.678/0001-90',
    logoUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=128&auto=format&fit=crop&q=60',
    primaryColor: '#0284c7',
    timezone: 'America/Sao_Paulo',
    status: 'ACTIVE',
    plan: 'PROFESSIONAL',
    monthlyFee: 890.00,
    maxBrokers: 15,
    maxInstances: 3,
    businessHours: {
      start: '09:00',
      end: '18:30',
      workDays: [1, 2, 3, 4, 5],
    },
    settings: {
      slaFirstResponseMinutes: 20,
      slaInactivityHours: 48,
      autoAssignRule: 'UNASSIGNED_QUEUE',
      aiCopilotEnabled: true,
      requireHumanApprovalForAI: true,
    }
  },
  {
    id: 'tenant-alphaville-03',
    name: 'Alphaville Imóveis Boutique',
    slug: 'alphaville-boutique',
    documentCnpj: '45.678.901/0001-23',
    logoUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=128&auto=format&fit=crop&q=60',
    primaryColor: '#d97706',
    timezone: 'America/Sao_Paulo',
    status: 'TRIAL',
    plan: 'STARTER',
    monthlyFee: 490.00,
    maxBrokers: 5,
    maxInstances: 1,
    businessHours: {
      start: '08:00',
      end: '18:00',
      workDays: [1, 2, 3, 4, 5],
    },
    settings: {
      slaFirstResponseMinutes: 30,
      slaInactivityHours: 48,
      autoAssignRule: 'ROUND_ROBIN',
      aiCopilotEnabled: true,
      requireHumanApprovalForAI: true,
    }
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'user-rafael-admin',
    name: 'Rafael Sena',
    email: 'rafael.sena@vanguardprime.com.br',
    phone: '+55 11 98877-6655',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    isActive: true,
    aiPersonaPrompt: 'Você é o copiloto comercial de Rafael Sena, Diretor Imobiliário. Adote tom executivo, consultivo e focado em valorização patrimonial, ROI e discrição. Sempre enfatize liquidez e localização nobre.',
    aiTone: 'CONSULTATIVE',
    aiDirectives: [
      'Sempre convidar para uma reunião estratégica de alinhamento ou café executivo',
      'Destacar o potencial de valorização do metro quadrado e liquidez',
      'Nunca usar gírias ou mensagens prolixas'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  },
  {
    id: 'user-camila-gestora',
    name: 'Camila Mendonça',
    email: 'camila.gestora@vanguardprime.com.br',
    phone: '+55 11 97766-5544',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'MANAGER',
    isActive: true,
    aiPersonaPrompt: 'Você é o copiloto de Camila Mendonça, Gestora de Vendas. Adote tom motivador, ágil e resolutivo. Priorize rapidez nas respostas e transição de leads mornos para visitas presenciais.',
    aiTone: 'PERSUASIVE',
    aiDirectives: [
      'Priorizar agendamento de visita no mesmo dia ou no dia seguinte',
      'Tirar dúvidas sobre fluxo de pagamento e parcelamento direto com a construtora',
      'Criar senso de urgência com base na tabela de preços atual'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  },
  {
    id: 'user-lucas-corretor',
    name: 'Lucas Brandão',
    email: 'lucas.corretor@vanguardprime.com.br',
    phone: '+55 11 96655-4433',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'BROKER',
    isActive: true,
    aiPersonaPrompt: 'Você é o copiloto de Lucas Brandão, corretor especialista em Alto Padrão no Batel e Ecoville. Seja extremamente polido, cordial e atento a detalhes de arquitetura, varanda gourmet e vagas de garagem.',
    aiTone: 'CONSULTATIVE',
    aiDirectives: [
      'Mencionar a privacidade e segurança do condomínio fechado',
      'Propor envio de vídeo exclusivo do imóvel antes da visita',
      'Sugerir horários no sábado pela manhã para visita sem pressa'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  },
  {
    id: 'user-juliana-corretora',
    name: 'Juliana Paes Costa',
    email: 'juliana.corretora@vanguardprime.com.br',
    phone: '+55 11 95544-3322',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'BROKER',
    isActive: true,
    aiPersonaPrompt: 'Você é a copiloto de Juliana Paes, especialista em primeiros imóveis e famílias. Seja acolhedora, empática e simplifique termos financeiros para transmitir total segurança aos compradores.',
    aiTone: 'FRIENDLY',
    aiDirectives: [
      'Explicar como funciona o uso do FGTS e composição de renda familiar',
      'Destacar as áreas de lazer para crianças e proximidade de escolas e parques',
      'Oferecer simulação gratuita de financiamento pelo WhatsApp'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  }
];

export const MOCK_INSTANCES: WhatsAppInstance[] = [
  {
    id: 'inst-central',
    tenantId: 'tenant-vanguard-01',
    name: 'Central Imobiliária (Tronco Principal)',
    phoneNumber: '+55 11 98800-0000',
    zapiInstanceId: '3F1B67FC8139425171C79ED390C0144C',
    status: 'CONNECTED',
    type: 'COMPANY_CENTRAL',
    isDefault: true,
    batteryLevel: 98,
    lastSyncAt: new Date().toISOString(),
  },
  {
    id: 'inst-lucas',
    tenantId: 'tenant-vanguard-01',
    name: 'Lucas Brandão (Linha Direta Corretor)',
    phoneNumber: '+55 11 96655-4433',
    zapiInstanceId: '7A8B9C0D1E2F3G4H5I6J7K8L9M0N1P2Q',
    status: 'CONNECTED',
    type: 'BROKER_DIRECT',
    assignedUserId: 'user-lucas-corretor',
    batteryLevel: 85,
    lastSyncAt: new Date().toISOString(),
  },
  {
    id: 'inst-juliana',
    tenantId: 'tenant-vanguard-01',
    name: 'Juliana Paes (Linha Direta Corretor)',
    phoneNumber: '+55 11 95544-3322',
    zapiInstanceId: '9Z8Y7X6W5V4U3T2S1R0Q9P8O7N6M5L4K',
    status: 'CONNECTED',
    type: 'BROKER_DIRECT',
    assignedUserId: 'user-juliana-corretora',
    batteryLevel: 92,
    lastSyncAt: new Date().toISOString(),
  }
];

export const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-vendas-residencial',
    tenantId: 'tenant-vanguard-01',
    name: 'Vendas Residencial Alto Padrão',
    isDefault: true,
    stages: [
      { id: 'stage-1', pipelineId: 'pipe-vendas-residencial', name: '1. Novo Lead WhatsApp', order: 1, slaHours: 2, colorHex: '#3b82f6' },
      { id: 'stage-2', pipelineId: 'pipe-vendas-residencial', name: '2. Primeiro Contato Realizado', order: 2, slaHours: 12, colorHex: '#6366f1' },
      { id: 'stage-3', pipelineId: 'pipe-vendas-residencial', name: '3. Em Qualificação / Perfil', order: 3, slaHours: 24, colorHex: '#8b5cf6' },
      { id: 'stage-4', pipelineId: 'pipe-vendas-residencial', name: '4. Imóveis Apresentados', order: 4, slaHours: 48, colorHex: '#a855f7' },
      { id: 'stage-5', pipelineId: 'pipe-vendas-residencial', name: '5. Visita Agendada', order: 5, slaHours: 72, colorHex: '#d97706' },
      { id: 'stage-6', pipelineId: 'pipe-vendas-residencial', name: '6. Proposta em Mesa', order: 6, slaHours: 48, colorHex: '#f59e0b' },
      { id: 'stage-7', pipelineId: 'pipe-vendas-residencial', name: '7. Análise de Crédito', order: 7, slaHours: 96, colorHex: '#10b981' },
      { id: 'stage-8', pipelineId: 'pipe-vendas-residencial', name: '8. Contrato Fechado', order: 8, slaHours: 0, colorHex: '#059669', isWon: true },
      { id: 'stage-9', pipelineId: 'pipe-vendas-residencial', name: 'Perdido / Descarte', order: 9, slaHours: 0, colorHex: '#ef4444', isLost: true },
    ]
  }
];

// Base limpa para início de testes reais
export const MOCK_CONTACTS: Contact[] = [];
export const MOCK_DEALS: Deal[] = [];
export const MOCK_CONVERSATIONS: Conversation[] = [];
export const MOCK_MESSAGES: Message[] = [];
export const MOCK_AI_INSIGHTS: Record<string, AIInsight> = {};
export const MOCK_TASKS: Task[] = [];
export const MOCK_ALERTS: SLAAlert[] = [];
export const MOCK_CAMPAIGNS: Campaign[] = [];

export const MOCK_QUICK_REPLIES: QuickReplyTemplate[] = [
  {
    id: 'qr-01',
    tenantId: 'tenant-vanguard-01',
    title: 'Boas-vindas Padrão',
    shortcut: '/ola',
    category: 'GREETING',
    content: 'Olá {{nome}}! Aqui é o(a) {{corretor_nome}} da Vanguard Prime Imóveis. Como posso te ajudar na busca do seu imóvel hoje?',
  },
  {
    id: 'qr-02',
    tenantId: 'tenant-vanguard-01',
    title: 'Convite para Visita Presencial',
    shortcut: '/visita',
    category: 'VISIT',
    content: '{{nome}}, que tal agendarmos uma visita exclusiva para conhecer o empreendimento neste sábado? Temos horários disponíveis pela manhã.',
  },
  {
    id: 'qr-03',
    tenantId: 'tenant-vanguard-01',
    title: 'Envio de Proposta / Tabela',
    shortcut: '/proposta',
    category: 'CLOSING',
    content: 'Prezado(a) {{nome}}, segue anexo o material completo com planta humanizada, memorial descritivo e a simulação de fluxo de pagamento.',
  }
];

export const MOCK_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto-01',
    tenantId: 'tenant-vanguard-01',
    name: 'Boas-vindas Instantânea para Novos Leads do WhatsApp',
    description: 'Envia mensagem inicial de acolhimento e atribui corretor por rodízio circular.',
    triggerType: 'LEAD_CREATED',
    conditions: [
      { field: 'source', operator: 'EQUALS', value: 'WHATSAPP' }
    ],
    actions: [
      { actionType: 'SEND_WHATSAPP_MESSAGE', config: { template: 'Olá {{nome}}, recebemos seu contato na Vanguard Prime Imóveis!' } },
      { actionType: 'ASSIGN_BROKER_ROUND_ROBIN', config: {} },
      { actionType: 'CREATE_TASK', config: { title: 'Fazer 1º contato telefônico', dueHours: 2 } }
    ],
    isActive: true,
    executionCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'auto-02',
    tenantId: 'tenant-vanguard-01',
    name: 'Alerta de Inatividade > 24h para Gestão',
    description: 'Notifica o gestor caso um lead quente fique mais de 24 horas sem resposta.',
    triggerType: 'LEAD_INACTIVE',
    conditions: [
      { field: 'temperature', operator: 'EQUALS', value: 'HOT' }
    ],
    actions: [
      { actionType: 'NOTIFY_TEAM', config: { message: 'Lead de alto valor sem interação há mais de 24h.' } }
    ],
    isActive: true,
    executionCount: 0,
    createdAt: new Date().toISOString(),
  }
];

export const MOCK_AUTOMATION_LOGS: AutomationExecutionLog[] = [];

export const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'prop-101',
    tenantId: 'tenant-vanguard-01',
    dealId: 'deal-01',
    contactId: 'contact-01',
    contactName: 'Carlos Eduardo Ramos',
    contactPhone: '+55 11 98888-1111',
    assignedUserId: 'user-lucas-broker',
    propertyName: 'Edifício Lumina Batel',
    unit: 'Apto 1402 - Torre Solar',
    propertyAddress: 'Av. Batel, 1550 - Batel, Curitiba - PR',
    totalValue: 1450000,
    downPayment: 290000,
    downPaymentMethod: 'PIX',
    installmentCount: 36,
    installmentValue: 18055.55,
    baloonValue: 150000,
    baloonCount: 3,
    bankFinancingValue: 510000,
    brokerCommissionPercent: 40,
    brokerCommissionValue: 34800,
    agencyCommissionValue: 52200,
    status: 'ACCEPTED',
    notes: 'Proposta com fluxo facilitado direto na planta.',
    clientAcceptedAt: '2026-08-20T16:45:00Z',
    clientIp: '189.40.72.115',
    asaasPaymentId: 'pay_asaas_8849201948',
    asaasInvoiceUrl: 'https://sandbox.asaas.com/i/8849201948',
    asaasQrCode: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865409290000.005802BR5922Vanguard Prime Imoveis6009Sao Paulo62070503***6304ABCD',
    expiresAt: '2026-08-30T23:59:59Z',
    createdAt: '2026-08-19T10:30:00Z',
  },
  {
    id: 'prop-102',
    tenantId: 'tenant-vanguard-01',
    dealId: 'deal-02',
    contactId: 'contact-02',
    contactName: 'Mariana Silveira',
    contactPhone: '+55 11 97777-2222',
    assignedUserId: 'user-juliana-broker',
    propertyName: 'Residencial Villa Jardins',
    unit: 'Casa 08',
    propertyAddress: 'Rua das Palmeiras, 300 - Graciosa, Curitiba - PR',
    totalValue: 2850000,
    downPayment: 570000,
    downPaymentMethod: 'PIX',
    installmentCount: 24,
    installmentValue: 35416.66,
    baloonValue: 300000,
    baloonCount: 2,
    bankFinancingValue: 1430000,
    brokerCommissionPercent: 50,
    brokerCommissionValue: 85500,
    agencyCommissionValue: 85500,
    status: 'SENT',
    notes: 'Aguardando confirmação do sinal via PIX Asaas.',
    asaasPaymentId: 'pay_asaas_9928174621',
    asaasInvoiceUrl: 'https://sandbox.asaas.com/i/9928174621',
    expiresAt: '2026-08-28T23:59:59Z',
    createdAt: '2026-08-20T14:00:00Z',
  }
];

export const MOCK_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'tx-01',
    tenantId: 'tenant-vanguard-01',
    proposalId: 'prop-101',
    dealId: 'deal-01',
    contactId: 'contact-01',
    contactName: 'Carlos Eduardo Ramos',
    description: 'Sinal de Entrada - Apto 1402 (Ed. Lumina Batel)',
    amount: 290000,
    dueDate: '2026-08-20',
    paidAt: '2026-08-20T16:45:00Z',
    status: 'PAID',
    type: 'PROPERTY_PAYMENT',
    category: 'ENTRADA',
    paymentMethod: 'PIX',
    asaasPaymentId: 'pay_asaas_8849201948',
    asaasInvoiceUrl: 'https://sandbox.asaas.com/i/8849201948',
    createdAt: '2026-08-19T10:30:00Z',
  },
  {
    id: 'tx-02',
    tenantId: 'tenant-vanguard-01',
    proposalId: 'prop-101',
    dealId: 'deal-01',
    contactId: 'contact-01',
    contactName: 'Carlos Eduardo Ramos',
    description: 'Comissão Corretor - Lucas Brandão (40% de 6%)',
    amount: 34800,
    dueDate: '2026-08-25',
    paidAt: '2026-08-20T18:00:00Z',
    status: 'PAID',
    type: 'COMMISSION_PAYOUT',
    category: 'COMISSAO_CORRETOR',
    paymentMethod: 'PIX',
    recipientUserId: 'user-lucas-broker',
    recipientName: 'Lucas Brandão',
    createdAt: '2026-08-20T16:50:00Z',
  },
  {
    id: 'tx-03',
    tenantId: 'tenant-vanguard-01',
    proposalId: 'prop-102',
    dealId: 'deal-02',
    contactId: 'contact-02',
    contactName: 'Mariana Silveira',
    description: 'Sinal de Reserva - Casa 08 (Res. Villa Jardins)',
    amount: 570000,
    dueDate: '2026-08-28',
    status: 'PENDING',
    type: 'PROPERTY_PAYMENT',
    category: 'ENTRADA',
    paymentMethod: 'PIX',
    asaasPaymentId: 'pay_asaas_9928174621',
    asaasInvoiceUrl: 'https://sandbox.asaas.com/i/9928174621',
    createdAt: '2026-08-20T14:00:00Z',
  },
  {
    id: 'tx-04',
    tenantId: 'tenant-vanguard-01',
    contactName: 'Felipe Alencar',
    description: '1ª Parcela Mensal - Studio 302 (Nexus Smart)',
    amount: 3850,
    dueDate: '2026-08-15',
    status: 'OVERDUE',
    type: 'PROPERTY_PAYMENT',
    category: 'PARCELA',
    paymentMethod: 'BOLETO',
    asaasPaymentId: 'pay_asaas_7719283401',
    asaasInvoiceUrl: 'https://sandbox.asaas.com/i/7719283401',
    createdAt: '2026-08-01T09:00:00Z',
  }
];
