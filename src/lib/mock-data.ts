import { 
  Tenant, 
  User, 
  WhatsAppInstance, 
  Contact, 
  Pipeline, 
  Deal, 
  LossReason,
  LeadSourceGroup,
  LeadSource,
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
  FinancialTransaction, 
  SaaSPlan, 
  MasterUser, 
  SaaSApiConfig 
} from '@/types/crm';

export const DEFAULT_FEATURE_FLAGS = {
  // WhatsApp & Mensagens
  whatsappAutoSync: true,
  whatsappVoiceTranscription: true,
  whatsappLabelsSync: true,
  whatsappMultiBroker: true,
  campaigns: true,
  automations: true,

  // Inteligência Artificial
  aiCopilot: true,
  aiAutoScoring: true,
  aiRequireHumanApproval: true,

  // Vendas & Comercial
  kanbanDeals: true,
  financialQualification: true,
  presentedProperties: true,
  leadImportExport: true,
  proposals: true,

  // Cobrança & Compliance
  asaasBilling: true,
  lgpdCompliance: true,
};

// -------------------------------------------------------------
// 1. AMBIENTES PRODUTIVOS (TENANTS)
// -------------------------------------------------------------
export const MOCK_TENANTS: Tenant[] = [
  {
    id: 'tenant-1790857269847',
    name: 'Ambiente Teste Rafael Sena',
    slug: 'ambiente-teste-rafael-sena',
    documentCnpj: '21585562000114',
    logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=128&auto=format&fit=crop&q=60',
    primaryColor: '#000000',
    timezone: 'America/Sao_Paulo',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    monthlyFee: 0.00,
    maxBrokers: 50,
    maxInstances: 10,
    featureFlags: { 
      ...DEFAULT_FEATURE_FLAGS,
      proposals: true,
      asaasBilling: true,
      campaigns: true,
      automations: true,
    },
    businessHours: {
      start: '08:00',
      end: '20:00',
      workDays: [1, 2, 3, 4, 5, 6, 0],
    },
    settings: {
      slaFirstResponseMinutes: 5,
      slaInactivityHours: 12,
      autoAssignRule: 'ROUND_ROBIN',
      aiCopilotEnabled: true,
      requireHumanApprovalForAI: false,
    }
  },
  {
    id: 'tenant-amabile-barbarotti',
    name: 'Amábile Barbarotti Imóveis',
    slug: 'amabile-barbarotti',
    documentCnpj: '52.189.432/0001-90',
    logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=128&auto=format&fit=crop&q=60',
    primaryColor: '#059669',
    timezone: 'America/Sao_Paulo',
    status: 'ACTIVE',
    plan: 'PROFESSIONAL',
    monthlyFee: 890.00,
    maxBrokers: 15,
    maxInstances: 3,
    asaasApiKey: '',
    featureFlags: { 
      ...DEFAULT_FEATURE_FLAGS,
      proposals: false,
      asaasBilling: false,
      campaigns: false,
      automations: false,
    },
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
  }
];

// -------------------------------------------------------------
// 2. USUÁRIOS DO CRM (RBAC) - ÚNICO ADMIN MASTER ROOT
// -------------------------------------------------------------
export const MOCK_USERS: User[] = [
  {
    id: 'user-rafael-admin',
    tenantId: 'tenant-1790857269847',
    name: 'Rafael Sena',
    email: 'rafael@faithhubs.com',
    phone: '+55 11 98877-6655',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'SUPERADMIN',
    isActive: true,
    status: 'ACTIVE',
    passwordSet: true,
    aiPersonaPrompt: 'Você é a Brok.ia comercial de Rafael Sena, Diretor Executivo. Adote tom executivo, consultivo e focado em valorização patrimonial, ROI e discrição. Sempre enfatize liquidez e localização nobre.',
    aiTone: 'CONSULTATIVE',
    aiDirectives: [
      'Sempre convidar para uma reunião estratégica de alinhamento ou café executivo',
      'Destacar o potencial de valorização do metro quadrado e liquidez',
      'Nunca usar gírias ou mensagens prolixas'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  },
  {
    id: 'user-amabile-admin',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Amábile Barbarotti',
    email: 'amabile.barbarotti@gmail.com',
    phone: '+55 11 99999-8877',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    isActive: true,
    status: 'ACTIVE',
    passwordSet: true,
    aiPersonaPrompt: 'Você é a Brok.ia comercial de Amábile Barbarotti Imóveis. Conduza atendimentos com sofisticação, simpatia, clareza e foco consultivo para agendamento de visitas aos imóveis de alto padrão.',
    aiTone: 'CONSULTATIVE',
    aiDirectives: [
      'Sempre convidar cordialmente para uma visita presencial ou café de alinhamento',
      'Destacar sofisticação, localização nobre e liquidez do imóvel',
      'Manter atendimento humanizado, atencioso e de alto padrão'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  }
];

// -------------------------------------------------------------
// 3. INSTÂNCIAS DE WHATSAPP Z-API
// -------------------------------------------------------------
export const MOCK_INSTANCES: WhatsAppInstance[] = [
  {
    id: 'inst-rafael-individual',
    tenantId: 'tenant-1790857269847',
    name: 'WhatsApp Individual • Rafael Sena',
    phoneNumber: 'Aguardando pareamento',
    zapiInstanceId: '3F1B67FC8139425171C79ED390C0144C',
    status: 'DISCONNECTED',
    type: 'BROKER_DIRECT',
    assignedUserId: 'user-rafael-admin',
    isDefault: true,
    batteryLevel: 100,
    lastSyncAt: new Date().toISOString(),
  },
  {
    id: 'inst-amabile-central',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Central WhatsApp • Amábile Barbarotti',
    phoneNumber: '+55 (48) 9979-7603',
    zapiInstanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
    status: 'CONNECTED',
    type: 'COMPANY_CENTRAL',
    isDefault: false,
    batteryLevel: 100,
    lastSyncAt: new Date().toISOString(),
  }
];

// -------------------------------------------------------------
// 4. FUNIS DE VENDAS & PROCESSOS (KANBAN)
// -------------------------------------------------------------
export const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-amabile-default',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Funil Geral de Vendas',
    isDefault: true,
    stages: [
      { id: 'stage-1', pipelineId: 'pipe-amabile-default', name: '1. Novo Lead WhatsApp', order: 1, slaHours: 2, colorHex: '#3b82f6', whatsappLabelMapping: ['Novo Cliente', 'Novo Lead', 'Lead', 'WhatsApp'] },
      { id: 'stage-2', pipelineId: 'pipe-amabile-default', name: '2. Primeiro Contato Realizado', order: 2, slaHours: 12, colorHex: '#6366f1', whatsappLabelMapping: ['Primeiro Contato', 'Atendimento Iniciado'] },
      { id: 'stage-3', pipelineId: 'pipe-amabile-default', name: '3. Em Qualificação / Perfil', order: 3, slaHours: 24, colorHex: '#8b5cf6', whatsappLabelMapping: ['Qualificação', 'Perfil', 'Investidor'] },
      { id: 'stage-4', pipelineId: 'pipe-amabile-default', name: '4. Imóveis Apresentados', order: 4, slaHours: 48, colorHex: '#a855f7', whatsappLabelMapping: ['Imóveis Enviados', 'Apresentado'] },
      { id: 'stage-5', pipelineId: 'pipe-amabile-default', name: '5. Visita Agendada', order: 5, slaHours: 72, colorHex: '#d97706', whatsappLabelMapping: ['Visita Agendada', 'Visita', 'Agendado'] },
      { id: 'stage-6', pipelineId: 'pipe-amabile-default', name: '6. Proposta em Mesa', order: 6, slaHours: 48, colorHex: '#f59e0b', whatsappLabelMapping: ['Proposta', 'Negociação', 'Em Negociação'] },
      { id: 'stage-7', pipelineId: 'pipe-amabile-default', name: '7. Contrato Fechado', order: 7, slaHours: 0, colorHex: '#059669', isWon: true, whatsappLabelMapping: ['Fechado', 'Contrato', 'Vendido', 'Pago'] },
      { id: 'stage-8', pipelineId: 'pipe-amabile-default', name: 'Perdido / Descarte', order: 8, slaHours: 0, colorHex: '#ef4444', isLost: true, whatsappLabelMapping: ['Perdido', 'Descarte', 'Desistiu'] },
    ]
  },
  {
    id: 'pipe-amabile-locacao',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Funil de Locação',
    isDefault: false,
    stages: [
      { id: 'loc-1', pipelineId: 'pipe-amabile-locacao', name: '1. Interessado / Consulta', order: 1, slaHours: 4, colorHex: '#06b6d4' },
      { id: 'loc-2', pipelineId: 'pipe-amabile-locacao', name: '2. Visita Agendada', order: 2, slaHours: 24, colorHex: '#3b82f6' },
      { id: 'loc-3', pipelineId: 'pipe-amabile-locacao', name: '3. Ficha & Documentação', order: 3, slaHours: 48, colorHex: '#8b5cf6' },
      { id: 'loc-4', pipelineId: 'pipe-amabile-locacao', name: '4. Análise de Garantia / CredPago', order: 4, slaHours: 24, colorHex: '#f59e0b' },
      { id: 'loc-5', pipelineId: 'pipe-amabile-locacao', name: '5. Contrato Assinado / Chaves', order: 5, slaHours: 0, colorHex: '#10b981', isWon: true },
      { id: 'loc-6', pipelineId: 'pipe-amabile-locacao', name: 'Locação Cancelada', order: 6, slaHours: 0, colorHex: '#ef4444', isLost: true }
    ]
  },
  {
    id: 'pipe-amabile-captacao',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Funil de Captação (Proprietários)',
    isDefault: false,
    stages: [
      { id: 'cap-1', pipelineId: 'pipe-amabile-captacao', name: '1. Indicação / Lead Proprietário', order: 1, slaHours: 12, colorHex: '#64748b' },
      { id: 'cap-2', pipelineId: 'pipe-amabile-captacao', name: '2. Avaliação / Vistoria', order: 2, slaHours: 48, colorHex: '#0ea5e9' },
      { id: 'cap-3', pipelineId: 'pipe-amabile-captacao', name: '3. Negociação de Exclusividade', order: 3, slaHours: 72, colorHex: '#f59e0b' },
      { id: 'cap-4', pipelineId: 'pipe-amabile-captacao', name: '4. Imóvel Captado & Anunciado', order: 4, slaHours: 0, colorHex: '#10b981', isWon: true },
      { id: 'cap-5', pipelineId: 'pipe-amabile-captacao', name: 'Captação Recusada', order: 5, slaHours: 0, colorHex: '#ef4444', isLost: true }
    ]
  }
];

// 4.1 MOTIVOS DE PERDA (CONFIGURÁVEIS POR FUNIL)
// -------------------------------------------------------------
export const MOCK_LOSS_REASONS: LossReason[] = [
  { id: 'lr-1', tenantId: 'tenant-amabile-barbarotti', name: 'Preço alto / Fora do orçamento', isActive: true, pipelineIds: [], createdAt: '2026-01-01' },
  { id: 'lr-2', tenantId: 'tenant-amabile-barbarotti', name: 'Optou pelo concorrente / Outra imobiliária', isActive: true, pipelineIds: [], createdAt: '2026-01-01' },
  { id: 'lr-3', tenantId: 'tenant-amabile-barbarotti', name: 'Falta de crédito / Reprovado no banco', isActive: true, pipelineIds: ['pipe-amabile-default'], createdAt: '2026-01-01' },
  { id: 'lr-4', tenantId: 'tenant-amabile-barbarotti', name: 'Desistiu da compra / Momento inoportuno', isActive: true, pipelineIds: ['pipe-amabile-default'], createdAt: '2026-01-01' },
  { id: 'lr-5', tenantId: 'tenant-amabile-barbarotti', name: 'Não respondeu às tentativas de contato', isActive: true, pipelineIds: [], createdAt: '2026-01-01' },
  { id: 'lr-6', tenantId: 'tenant-amabile-barbarotti', name: 'Localização / Bairro não atendeu', isActive: true, pipelineIds: ['pipe-amabile-default', 'pipe-amabile-locacao'], createdAt: '2026-01-01' },
  { id: 'lr-7', tenantId: 'tenant-amabile-barbarotti', name: 'Proprietário recusou exclusividade', isActive: true, pipelineIds: ['pipe-amabile-captacao'], createdAt: '2026-01-01' },
  { id: 'lr-8', tenantId: 'tenant-amabile-barbarotti', name: 'Imóvel já foi vendido/locado por terceiros', isActive: true, pipelineIds: ['pipe-amabile-captacao'], createdAt: '2026-01-01' },
  { id: 'lr-9', tenantId: 'tenant-amabile-barbarotti', name: 'Garantia locatícia não aprovada (CredPago/Fiador)', isActive: true, pipelineIds: ['pipe-amabile-locacao'], createdAt: '2026-01-01' },
];

// 4.2 GRUPOS DE ORIGENS E ORIGENS DE LEADS
// -------------------------------------------------------------
export const MOCK_LEAD_SOURCE_GROUPS: LeadSourceGroup[] = [
  { id: 'group-anuncios', tenantId: 'tenant-amabile-barbarotti', name: 'Anúncios & Tráfego Pago', description: 'Campanhas de mídia de performance (Meta, Google, TikTok)', isActive: true, order: 1, createdAt: '2026-01-01' },
  { id: 'group-portais', tenantId: 'tenant-amabile-barbarotti', name: 'Portais Imobiliários', description: 'Integrações automáticas e leads de portais', isActive: true, order: 2, createdAt: '2026-01-01' },
  { id: 'group-redes', tenantId: 'tenant-amabile-barbarotti', name: 'Redes Sociais Orgânicas', description: 'Canais orgânicos, perfis e direct', isActive: true, order: 3, createdAt: '2026-01-01' },
  { id: 'group-indicacoes', tenantId: 'tenant-amabile-barbarotti', name: 'Indicações & Parcerias', description: 'Networking e referências de clientes/corretores', isActive: true, order: 4, createdAt: '2026-01-01' },
  { id: 'group-outbound', tenantId: 'tenant-amabile-barbarotti', name: 'Prospecção Ativa (Outbound)', description: 'Plantões, placas no imóvel e abordagens ativas', isActive: true, order: 5, createdAt: '2026-01-01' },
  { id: 'group-receptivo', tenantId: 'tenant-amabile-barbarotti', name: 'Receptivo Direto', description: 'Telefone e balcão da imobiliária', isActive: true, order: 6, createdAt: '2026-01-01' },
];

export const MOCK_LEAD_SOURCES: LeadSource[] = [
  { id: 'src-1', tenantId: 'tenant-amabile-barbarotti', name: 'Anúncios ADS Meta (Instagram & Facebook)', groupId: 'group-anuncios', description: 'Campanhas pagas com formulário nativo', isActive: true, order: 1, createdAt: '2026-01-01' },
  { id: 'src-2', tenantId: 'tenant-amabile-barbarotti', name: 'Google Ads (Pesquisa & Rede Display)', groupId: 'group-anuncios', description: 'Campanhas de busca com intenção imediata', isActive: true, order: 2, createdAt: '2026-01-01' },
  { id: 'src-3', tenantId: 'tenant-amabile-barbarotti', name: 'Portal Zap Imóveis', groupId: 'group-portais', description: 'Leads do portal Zap Imóveis', isActive: true, order: 3, createdAt: '2026-01-01' },
  { id: 'src-4', tenantId: 'tenant-amabile-barbarotti', name: 'Portal VivaReal', groupId: 'group-portais', description: 'Leads do portal VivaReal', isActive: true, order: 4, createdAt: '2026-01-01' },
  { id: 'src-5', tenantId: 'tenant-amabile-barbarotti', name: 'Instagram Orgânico', groupId: 'group-redes', description: 'Direct e comentários no Instagram', isActive: true, order: 5, createdAt: '2026-01-01' },
  { id: 'src-6', tenantId: 'tenant-amabile-barbarotti', name: 'Indicações Clientes', groupId: 'group-indicacoes', description: 'Recomendações diretas de clientes satisfeitos', isActive: true, order: 6, createdAt: '2026-01-01' },
  { id: 'src-7', tenantId: 'tenant-amabile-barbarotti', name: 'Indicações Parceiros', groupId: 'group-indicacoes', description: 'Parcerias com corretores externos (co-brokerage)', isActive: true, order: 7, createdAt: '2026-01-01' },
  { id: 'src-8', tenantId: 'tenant-amabile-barbarotti', name: 'Lista Prospecção - Outbound', groupId: 'group-outbound', description: 'Prospecção fria e contato com proprietários', isActive: true, order: 8, createdAt: '2026-01-01' },
  { id: 'src-9', tenantId: 'tenant-amabile-barbarotti', name: 'Placa no Imóvel', groupId: 'group-outbound', description: 'Ligação ou WhatsApp via placa de venda', isActive: true, order: 9, createdAt: '2026-01-01' },
  { id: 'src-10', tenantId: 'tenant-amabile-barbarotti', name: 'Receptivo - Telefone', groupId: 'group-receptivo', description: 'Ligação direta recebida na imobiliária', isActive: true, order: 10, createdAt: '2026-01-01' },
  { id: 'src-11', tenantId: 'tenant-amabile-barbarotti', name: 'Carteira de Clientes', groupId: 'group-indicacoes', description: 'Base histórica reativada', isActive: true, order: 11, createdAt: '2026-01-01' },
];

// -------------------------------------------------------------
// 5. BASE DE DADOS DO CRM (HIGIENIZADA / PRONTA PARA OPERAÇÃO)
// -------------------------------------------------------------
export const MOCK_CONTACTS: Contact[] = [];
export const MOCK_DEALS: Deal[] = [];
export const MOCK_CONVERSATIONS: Conversation[] = [];
export const MOCK_MESSAGES: Message[] = [];
export const MOCK_AI_INSIGHTS: Record<string, AIInsight> = {};
export const MOCK_TASKS: Task[] = [];
export const MOCK_ALERTS: SLAAlert[] = [];
export const MOCK_CAMPAIGNS: Campaign[] = [];
export const MOCK_PROPOSALS: Proposal[] = [];
export const MOCK_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [];
export const MOCK_AUTOMATION_LOGS: AutomationExecutionLog[] = [];

// -------------------------------------------------------------
// 6. RESPOSTAS RÁPIDAS & AUTOMAÇÕES PADRÃO
// -------------------------------------------------------------
export const MOCK_QUICK_REPLIES: QuickReplyTemplate[] = [
  {
    id: 'qr-01',
    tenantId: 'tenant-amabile-barbarotti',
    title: 'Boas-vindas Padrão',
    shortcut: '/ola',
    category: 'GREETING',
    content: 'Olá {{nome}}! Aqui é da equipe Amábile Barbarotti Imóveis. Como posso te ajudar na busca do seu imóvel hoje?',
  },
  {
    id: 'qr-02',
    tenantId: 'tenant-amabile-barbarotti',
    title: 'Convite para Visita Presencial',
    shortcut: '/visita',
    category: 'VISIT',
    content: '{{nome}}, que tal agendarmos uma visita exclusiva para conhecer o imóvel? Temos horários disponíveis esta semana.',
  },
  {
    id: 'qr-03',
    tenantId: 'tenant-amabile-barbarotti',
    title: 'Envio de Proposta / Memorial',
    shortcut: '/proposta',
    category: 'CLOSING',
    content: 'Prezado(a) {{nome}}, segue anexo o material completo com memorial descritivo e as condições comerciais.',
  }
];

export const MOCK_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto-01',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Boas-vindas Instantânea para Novos Leads do WhatsApp',
    description: 'Envia mensagem inicial de acolhimento e atribui atendimento.',
    triggerType: 'LEAD_CREATED',
    conditions: [
      { field: 'source', operator: 'EQUALS', value: 'WHATSAPP' }
    ],
    actions: [
      { actionType: 'SEND_WHATSAPP_MESSAGE', config: { template: 'Olá {{nome}}, recebemos seu contato na Amábile Barbarotti Imóveis!' } },
      { actionType: 'CREATE_TASK', config: { title: 'Fazer 1º contato telefônico', dueHours: 2 } }
    ],
    isActive: true,
    executionCount: 0,
    createdAt: new Date().toISOString(),
  }
];

// -------------------------------------------------------------
// 7. PLANOS SAAS MASTER
// -------------------------------------------------------------
export const MOCK_SAAS_PLANS: SaaSPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter Imobiliário',
    slug: 'starter',
    monthlyPrice: 490.00,
    annualPrice: 4900.00,
    maxBrokers: 5,
    maxInstances: 1,
    aiCopilotEnabled: true,
    features: [
      'Até 5 Corretores',
      '1 Linha WhatsApp Z-API Integrada',
      'Inbox Central & Funil Kanban',
      'Brok.ia com sugestões básicas',
      'Propostas com Aceite Digital',
      'Suporte via Ticket'
    ],
    isActive: true,
    isPopular: false
  },
  {
    id: 'plan-pro',
    name: 'Professional Boutique',
    slug: 'professional',
    monthlyPrice: 890.00,
    annualPrice: 8900.00,
    maxBrokers: 15,
    maxInstances: 3,
    aiCopilotEnabled: true,
    features: [
      'Até 15 Corretores',
      '3 Linhas WhatsApp (Central + Corretores)',
      'Brok.ia com Personas Individuais',
      'Split de Comissões & Gateway Asaas',
      'Campanhas em Lote & Automações',
      'Suporte Prioritário via WhatsApp'
    ],
    isActive: true,
    isPopular: true
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise Corporate',
    slug: 'enterprise',
    monthlyPrice: 1490.00,
    annualPrice: 14900.00,
    maxBrokers: 50,
    maxInstances: 10,
    aiCopilotEnabled: true,
    features: [
      'Até 50 Corretores (Multi-equipes)',
      '10 Linhas WhatsApp Z-API',
      'Brok.ia Treinada com Empreendimentos',
      'Integração Completa Gateway Asaas',
      'Painel de SLAs Críticos em Tempo Real',
      'Gerente de Contas Exclusivo 24/7'
    ],
    isActive: true,
    isPopular: false
  },
  {
    id: 'plan-custom',
    name: 'Custom / Redes & Franquias',
    slug: 'custom',
    monthlyPrice: 2990.00,
    annualPrice: 29900.00,
    maxBrokers: 200,
    maxInstances: 30,
    aiCopilotEnabled: true,
    features: [
      'Corretores Ilimitados',
      'Instâncias WhatsApp Ilimitadas',
      'Ambiente Dedicado & Multi-filiais',
      'Split Financeiro Automatizado',
      'Modelos de IA Customizados no AWS Bedrock',
      'SLA de 99.9% e Consultoria Mensal'
    ],
    isActive: true,
    isPopular: false
  }
];

// -------------------------------------------------------------
// 8. USUÁRIOS DO PORTAL SAAS MASTER (ROOT)
// -------------------------------------------------------------
export const MOCK_MASTER_USERS: MasterUser[] = [
  {
    id: 'master-01',
    name: 'Rafael Sena',
    email: 'rafael@faithhubs.com',
    phone: '+55 11 98877-6655',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'SUPERADMIN_GLOBAL',
    permissions: ['ALL_PERMISSIONS', 'MANAGE_TENANTS', 'MANAGE_PLANS', 'MANAGE_APIS', 'MANAGE_MASTERS', 'VIEW_FINANCIALS'],
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-01-01T00:00:00Z'
  }
];

// -------------------------------------------------------------
// 9. CONFIGURAÇÃO DE APIS GLOBAIS DO SAAS MASTER
// -------------------------------------------------------------
export const MOCK_SAAS_API_CONFIG: SaaSApiConfig = {
  zapiMasterKey: '',
  zapiGlobalWebhook: 'https://crm.faithhubs.com/api/v1/webhooks/zapi',
  asaasMasterApiKey: '',
  asaasMasterWalletId: '',
  asaasWebhookUrl: 'https://crm.faithhubs.com/api/v1/asaas/webhook',
  awsBedrockModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  awsBedrockRegion: 'us-east-1',
  openAiApiKey: '',
  googleGeminiApiKey: ''
};

