import { Contact, Deal, Conversation, Message, AIInsight } from '@/types/crm';

export interface ServerCRMState {
  contacts: Contact[];
  deals: Deal[];
  conversations: Conversation[];
  messages: Message[];
  aiInsights: Record<string, AIInsight>;
}

// Initial Seed robusto com os dados qualificados de produção e de teste
const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'contact-zapi-554891079478',
    tenantId: 'tenant-vanguard-01',
    name: 'Rafael Sena',
    phone: '+554891079478',
    email: 'rafael.sena@exemplo.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Rafael+Sena&background=059669&color=fff',
    monthlyIncome: 45000,
    downPaymentAvailable: 300000,
    maxPropertyValue: 1200000,
    preferredPropertyType: 'APARTMENT',
    targetRegions: ['Região Nobre', 'Batel'],
    source: 'WHATSAPP',
    temperature: 'HOT',
    aiPriorityScore: 95,
    assignedUserId: 'user-lucas-corretor',
    tags: ['#Lead Quente', '#Apartamento', 'Z-API Live'],
    notesCount: 1,
    consentGiven: true,
    hasOptedOut: false,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'contact-zapi-554888774408',
    tenantId: 'tenant-vanguard-01',
    name: 'Rafael Sena (Comercial)',
    phone: '+554888774408',
    email: 'rafael.sena@exemplo.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Rafael+Sena&background=059669&color=fff',
    monthlyIncome: 45000,
    downPaymentAvailable: 300000,
    maxPropertyValue: 1200000,
    preferredPropertyType: 'APARTMENT',
    targetRegions: ['Região Nobre', 'Batel'],
    source: 'WHATSAPP',
    temperature: 'HOT',
    aiPriorityScore: 95,
    assignedUserId: 'user-lucas-corretor',
    tags: ['#Lead Quente', '#Apartamento', 'Z-API Live'],
    notesCount: 1,
    consentGiven: true,
    hasOptedOut: false,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'contact-01',
    tenantId: 'tenant-vanguard-01',
    name: 'Dra. Mariana Vasconcelos',
    phone: '+55 (11) 98765-4321',
    email: 'mariana.vasconcelos@medicina.ufrj.br',
    cpf: '123.456.789-00',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    monthlyIncome: 55000,
    householdIncome: 85000,
    downPaymentAvailable: 450000,
    estimatedFinancing: 1350000,
    minPropertyValue: 1500000,
    maxPropertyValue: 2200000,
    preferredPropertyType: 'APARTMENT',
    purchasePurpose: 'LIVING',
    targetRegions: ['Batel', 'Ecoville', 'Jardins'],
    targetBedrooms: 3,
    targetParkingSpots: 2,
    purchaseTimeline: '1_TO_3_MONTHS',
    source: 'WHATSAPP',
    temperature: 'HOT',
    aiPriorityScore: 95,
    assignedUserId: 'user-lucas-corretor',
    tags: ['Médica', 'Alto Padrão', 'Pronto para Morar', 'Financiamento Aprovado'],
    notesCount: 3,
    consentGiven: true,
    consentDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    hasOptedOut: false,
    lastClientInteractionAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lastTeamInteractionAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const INITIAL_DEALS: Deal[] = [
  {
    id: 'deal-rafael-sena-01',
    tenantId: 'tenant-vanguard-01',
    contactId: 'contact-zapi-554891079478',
    pipelineId: 'pipe-vendas-residencial',
    stageId: 'stage-3',
    assignedUserId: 'user-lucas-corretor',
    title: 'Apartamento Alto Padrão - Rafael Sena',
    expectedValue: 1200000,
    manualProbability: 80,
    aiProbabilityScore: 95,
    status: 'OPEN',
    propertyInterest: 'Apartamento Alto Padrão',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-rafael-01',
    tenantId: 'tenant-vanguard-01',
    conversationId: 'conv-zapi-554891079478',
    senderType: 'CONTACT',
    senderName: 'Rafael Sena',
    messageType: 'TEXT',
    content: 'Olá! Busco um apartamento de alto padrão na região nobre. Tenho renda mensal de 45 mil reais e entrada de 300 mil reais.',
    status: 'READ',
    isInternalNote: false,
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'msg-rafael-02',
    tenantId: 'tenant-vanguard-01',
    conversationId: 'conv-zapi-554891079478',
    senderType: 'USER',
    senderName: 'Corretor',
    messageType: 'TEXT',
    content: 'Olá Rafael! Excelente perfil. Temos opções incríveis com 3 suítes que se encaixam perfeitamente no seu orçamento.',
    status: 'READ',
    isInternalNote: false,
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  }
];

const INITIAL_INSIGHTS: Record<string, AIInsight> = {
  'conv-zapi-554891079478': {
    id: 'insight-rafael-sena',
    tenantId: 'tenant-vanguard-01',
    conversationId: 'conv-zapi-554891079478',
    contactId: 'contact-zapi-554891079478',
    summary: 'Lead qualificado com renda de R$ 45.000/mês e entrada de R$ 300.000 para apartamento de alto padrão.',
    extractedData: {
      maxBudget: 1200000,
      propertyType: 'Apartamento',
      urgencyLevel: 'ALTA',
      preferredRegion: 'Região Nobre',
      monthlyIncome: 45000,
      downPayment: 300000,
    },
    sentiment: 'POSITIVE',
    intent: 'AGENDAR_VISITA',
    suggestedResponse: 'Olá Rafael! Preparei uma seleção exclusiva de apartamentos de alto padrão no seu perfil de R$ 45k/mês. Gostaria de agendar uma visita ao decorado neste sábado?',
    confidenceScore: 95,
    createdAt: new Date().toISOString(),
  }
};

declare global {
  var __SERVER_CRM_STATE__: ServerCRMState | undefined;
}

if (!global.__SERVER_CRM_STATE__) {
  global.__SERVER_CRM_STATE__ = {
    contacts: INITIAL_CONTACTS,
    deals: INITIAL_DEALS,
    conversations: [
      {
        id: 'conv-zapi-554891079478',
        tenantId: 'tenant-vanguard-01',
        instanceId: '3F1B67FC8139425171C79ED390C0144C',
        contactId: 'contact-zapi-554891079478',
        assignedUserId: 'user-lucas-corretor',
        status: 'OPEN',
        lastMessagePreview: 'Olá! Busco um apartamento de alto padrão...',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        slaBreached: false,
      }
    ],
    messages: INITIAL_MESSAGES,
    aiInsights: INITIAL_INSIGHTS,
  };
}

export const serverCRMStore = {
  getState(): ServerCRMState {
    if (!global.__SERVER_CRM_STATE__) {
      global.__SERVER_CRM_STATE__ = {
        contacts: INITIAL_CONTACTS,
        deals: INITIAL_DEALS,
        conversations: [],
        messages: INITIAL_MESSAGES,
        aiInsights: INITIAL_INSIGHTS,
      };
    }
    return global.__SERVER_CRM_STATE__;
  },

  updateState(partial: Partial<ServerCRMState>): ServerCRMState {
    const current = this.getState();
    const next: ServerCRMState = {
      contacts: partial.contacts ? this.mergeContacts(current.contacts, partial.contacts) : current.contacts,
      deals: partial.deals || current.deals,
      conversations: partial.conversations || current.conversations,
      messages: partial.messages ? this.mergeMessages(current.messages, partial.messages) : current.messages,
      aiInsights: partial.aiInsights ? { ...current.aiInsights, ...partial.aiInsights } : current.aiInsights,
    };
    global.__SERVER_CRM_STATE__ = next;
    return next;
  },

  mergeContacts(oldList: Contact[], newList: Contact[]): Contact[] {
    const normalizeKey = (phone?: string) => {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length >= 12) return digits.slice(2);
      return digits;
    };

    const phoneMap = new Map<string, Contact>();
    const idMap = new Map<string, Contact>();
    const result: Contact[] = [];

    const all = [...oldList, ...newList];
    all.forEach(c => {
      if (!c) return;
      const pKey = normalizeKey(c.phone);
      const existing = (pKey ? phoneMap.get(pKey) : null) || idMap.get(c.id);

      if (existing) {
        const merged: Contact = {
          ...existing,
          ...c,
          id: existing.id,
          name: (existing.name && !existing.name.startsWith('+') && !existing.name.startsWith('WhatsApp') && existing.name !== 'Lead WhatsApp' && existing.name !== 'Cliente')
            ? existing.name
            : (c.name || existing.name),
          monthlyIncome: c.monthlyIncome || existing.monthlyIncome,
          downPaymentAvailable: c.downPaymentAvailable || existing.downPaymentAvailable,
          maxPropertyValue: c.maxPropertyValue || existing.maxPropertyValue,
          preferredPropertyType: c.preferredPropertyType || existing.preferredPropertyType,
          email: c.email || existing.email,
          tags: Array.from(new Set([...(existing.tags || []), ...(c.tags || [])])),
          targetRegions: Array.from(new Set([...(existing.targetRegions || []), ...(c.targetRegions || [])])),
          assignedUserId: c.assignedUserId || existing.assignedUserId,
          updatedAt: new Date().toISOString(),
        };

        if (pKey) phoneMap.set(pKey, merged);
        idMap.set(merged.id, merged);

        const idx = result.findIndex(x => x.id === existing.id);
        if (idx >= 0) result[idx] = merged;
      } else {
        if (pKey) phoneMap.set(pKey, c);
        idMap.set(c.id, c);
        result.push(c);
      }
    });

    return result;
  },

  mergeMessages(oldMsgs: Message[], newMsgs: Message[]): Message[] {
    const seen = new Set<string>();
    const all = [...oldMsgs, ...newMsgs];
    return all.filter(m => {
      const key = `${m.conversationId}-${m.senderType}-${(m.content || '').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
};
