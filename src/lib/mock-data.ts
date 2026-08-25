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
  FinancialTransaction, 
  SaaSPlan, 
  MasterUser, 
  SaaSApiConfig 
} from '@/types/crm';

// -------------------------------------------------------------
// 1. AMBIENTES PRODUTIVOS (TENANTS)
// -------------------------------------------------------------
export const MOCK_TENANTS: Tenant[] = [
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
    asaasApiKey: 'asaas_secret_key_amabile_production',
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
    name: 'Rafael Sena',
    email: 'rafael@faithhubs.com',
    phone: '+55 11 98877-6655',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'SUPERADMIN',
    isActive: true,
    status: 'ACTIVE',
    passwordSet: true,
    aiPersonaPrompt: 'Você é o copiloto comercial de Rafael Sena, Diretor Executivo. Adote tom executivo, consultivo e focado em valorização patrimonial, ROI e discrição. Sempre enfatize liquidez e localização nobre.',
    aiTone: 'CONSULTATIVE',
    aiDirectives: [
      'Sempre convidar para uma reunião estratégica de alinhamento ou café executivo',
      'Destacar o potencial de valorização do metro quadrado e liquidez',
      'Nunca usar gírias ou mensagens prolixas'
    ],
    aiModel: 'anthropic.claude-3-5-sonnet'
  }
];

// -------------------------------------------------------------
// 3. INSTÂNCIAS DE WHATSAPP Z-API
// -------------------------------------------------------------
export const MOCK_INSTANCES: WhatsAppInstance[] = [
  {
    id: 'inst-amabile-central',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Central WhatsApp • Amábile Barbarotti',
    phoneNumber: '',
    zapiInstanceId: '3F1B67FC8139425171C79ED390C0144C',
    status: 'DISCONNECTED',
    type: 'COMPANY_CENTRAL',
    isDefault: true,
    batteryLevel: 100,
    lastSyncAt: new Date().toISOString(),
  }
];

// -------------------------------------------------------------
// 4. FUNIL DE VENDAS (KANBAN)
// -------------------------------------------------------------
export const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-amabile-default',
    tenantId: 'tenant-amabile-barbarotti',
    name: 'Funil Geral de Vendas',
    isDefault: true,
    stages: [
      { id: 'stage-1', pipelineId: 'pipe-amabile-default', name: '1. Novo Lead WhatsApp', order: 1, slaHours: 2, colorHex: '#3b82f6' },
      { id: 'stage-2', pipelineId: 'pipe-amabile-default', name: '2. Primeiro Contato Realizado', order: 2, slaHours: 12, colorHex: '#6366f1' },
      { id: 'stage-3', pipelineId: 'pipe-amabile-default', name: '3. Em Qualificação / Perfil', order: 3, slaHours: 24, colorHex: '#8b5cf6' },
      { id: 'stage-4', pipelineId: 'pipe-amabile-default', name: '4. Imóveis Apresentados', order: 4, slaHours: 48, colorHex: '#a855f7' },
      { id: 'stage-5', pipelineId: 'pipe-amabile-default', name: '5. Visita Agendada', order: 5, slaHours: 72, colorHex: '#d97706' },
      { id: 'stage-6', pipelineId: 'pipe-amabile-default', name: '6. Proposta em Mesa', order: 6, slaHours: 48, colorHex: '#f59e0b' },
      { id: 'stage-7', pipelineId: 'pipe-amabile-default', name: '7. Contrato Fechado', order: 7, slaHours: 0, colorHex: '#059669', isWon: true },
      { id: 'stage-8', pipelineId: 'pipe-amabile-default', name: 'Perdido / Descarte', order: 8, slaHours: 0, colorHex: '#ef4444', isLost: true },
    ]
  }
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
      'IA Copiloto com sugestões básicas',
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
      'IA Copiloto com Personas Individuais',
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
      'IA Copilot Treinada com Empreendimentos',
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
  zapiMasterKey: 'zapi_integrator_key_master_faithhubs_live',
  zapiGlobalWebhook: 'https://crm.faithhubs.com/api/v1/webhooks/zapi/events',
  asaasMasterApiKey: 'asaas_secret_key_master_faithhubs_production',
  asaasMasterWalletId: 'wal_master_faithhubs_saas_01',
  asaasWebhookUrl: 'https://crm.faithhubs.com/api/v1/asaas/webhook',
  awsBedrockModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  awsBedrockRegion: 'us-east-1',
  openAiApiKey: 'sk-proj-master-faithhubs-ai-hub',
  googleGeminiApiKey: 'AIzaSyMasterFaithHubsGeminiKey'
};
