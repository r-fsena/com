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
  AutomationExecutionLog
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
  },
  {
    id: 'user-camila-gestora',
    name: 'Camila Mendonça',
    email: 'camila.gestora@vanguardprime.com.br',
    phone: '+55 11 97766-5544',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'MANAGER',
    isActive: true,
  },
  {
    id: 'user-lucas-corretor',
    name: 'Lucas Brandão',
    email: 'lucas.corretor@vanguardprime.com.br',
    phone: '+55 11 96655-4433',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'BROKER',
    isActive: true,
  },
  {
    id: 'user-juliana-corretora',
    name: 'Juliana Paes Costa',
    email: 'juliana.corretora@vanguardprime.com.br',
    phone: '+55 11 95544-3322',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'BROKER',
    isActive: true,
  }
];

export const MOCK_INSTANCES: WhatsAppInstance[] = [
  {
    id: 'inst-01',
    tenantId: 'tenant-vanguard-01',
    name: 'WhatsApp Comercial Principal',
    phoneNumber: 'Aguardando pareamento via QR Code',
    zapiInstanceId: '3C9B8A7F20D1',
    status: 'DISCONNECTED',
    batteryLevel: 0,
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
