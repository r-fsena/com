'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { 
  Tenant, 
  TenantStatus,
  User, 
  WhatsAppInstance, 
  Contact, 
  PresentedProperty,
  BrokerNote,
  Pipeline, 
  PipelineStage,
  Deal, 
  Conversation, 
  Message, 
  Attachment,
  MessageType,
  AIInsight, 
  Task, 
  SLAAlert, 
  Campaign, 
  QuickReplyTemplate,
  Proposal,
  FinancialTransaction,
  TransactionStatus,
  SaaSPlan,
  MasterUser,
  SaaSApiConfig,
  TenantFeatureFlags,
  MonthlyGoal,
  TenantGoalsConfig,
  GoalProgressItem,
  GoalsProgressSummary,
  InactivityUrgencyLevel,
  ContactUrgencyAnalysis
} from '@/types/crm';
import { 
  MOCK_TENANTS, 
  DEFAULT_FEATURE_FLAGS,
  MOCK_USERS, 
  MOCK_INSTANCES, 
  MOCK_CONTACTS, 
  MOCK_PIPELINES, 
  MOCK_DEALS, 
  MOCK_CONVERSATIONS, 
  MOCK_MESSAGES, 
  MOCK_AI_INSIGHTS, 
  MOCK_TASKS, 
  MOCK_ALERTS, 
  MOCK_CAMPAIGNS, 
  MOCK_QUICK_REPLIES,
  MOCK_PROPOSALS,
  MOCK_FINANCIAL_TRANSACTIONS,
  MOCK_SAAS_PLANS,
  MOCK_MASTER_USERS,
  MOCK_SAAS_API_CONFIG
} from './mock-data';
import { isWhatsAppChannelOrGroup, isRealWhatsAppConversation, canonicalPhoneKey, arePhonesEquivalent, isWhatsAppSystemMessage } from '@/lib/whatsapp-filter';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';

interface CRMContextType {
  // Autenticação & Sessão Cognito
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (email: string, role?: string) => void;
  logout: () => void;

  // Gestão de Ambientes SaaS (SuperAdmin) & Tenant
  tenants: Tenant[];
  currentTenant: Tenant;
  setCurrentTenant: (tenant: Tenant) => void;
  updateTenant: (updates: Partial<Tenant>) => void;
  createTenant: (tenantData: Partial<Tenant>) => Tenant;
  updateTenantStatus: (tenantId: string, status: TenantStatus) => void;
  deleteTenant: (tenantId: string) => void;
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  createUser: (userData: Partial<User>) => User;
  deleteUser: (userId: string) => void;
  resendUserInvite: (userId: string) => Promise<{ success: boolean; message: string }>;
  resetUserPassword: (userId: string, newPassword: string, options?: { notifyEmail?: boolean; mustChangePassword?: boolean }) => Promise<{ success: boolean; message: string }>;
  updateUserAIPersona: (userId: string, data: { aiPersonaPrompt?: string; aiTone?: any; aiDirectives?: string[]; aiModel?: string }) => void;

  // CRM Leads e Contatos
  contacts: Contact[];
  addContact: (contact: Partial<Contact>) => Contact;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  toggleContactPersonal: (contactId: string) => void;
  addPresentedProperty: (contactId: string, property: Omit<PresentedProperty, 'id' | 'presentedAt'>) => void;
  updatePresentedProperty: (contactId: string, propertyId: string, updates: Partial<PresentedProperty>) => void;
  removePresentedProperty: (contactId: string, propertyId: string) => void;
  addBrokerNote: (contactId: string, content: string, category?: BrokerNote['category']) => void;
  removeBrokerNote: (contactId: string, noteId: string) => void;

  // Funis e Deals (Kanban)
  pipelines: Pipeline[];
  currentPipeline: Pipeline;
  setCurrentPipeline: (pipeline: Pipeline) => void;
  deals: Deal[];
  moveDealStage: (dealId: string, targetStageId: string) => void;
  createDeal: (deal: Partial<Deal>) => Deal;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  updatePipelineStages: (stages: PipelineStage[]) => void;

  // WhatsApp e Mensagens
  instances: WhatsAppInstance[];
  activeInstanceId: string;
  setActiveInstanceId: (id: string) => void;
  createInstance: (data: Partial<WhatsAppInstance>) => WhatsAppInstance;
  updateInstance: (instanceId: string, updates: Partial<WhatsAppInstance>) => void;
  deleteInstance: (instanceId: string) => void;
  refreshLiveZapiStatus: () => Promise<boolean>;
  transferConversationInstance: (conversationId: string, targetInstanceId: string, sendTransitionMessage?: boolean) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  openChatForContact: (contactId: string) => string;
  loadChatHistory: (phone: string, conversationId: string, page?: number, historyDays?: number) => Promise<void>;
  messages: Message[];
  sendMessage: (
    conversationId: string, 
    content: string, 
    isInternalNote?: boolean, 
    aiSuggested?: boolean, 
    attachments?: Attachment[], 
    messageType?: MessageType
  ) => void;
  markConversationAsRead: (conversationId: string) => void;
  clearChatMessages: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string, archive?: boolean) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  pinConversation: (conversationId: string) => Promise<void>;
  assignConversation: (conversationId: string, userId?: string) => void;
  simulateIncomingMessage: (phone: string, name: string, content: string) => void;

  // IA Copiloto
  aiInsights: Record<string, AIInsight>;
  updateAIInsight: (conversationId: string, insight: Partial<AIInsight>) => void;
  applyAIExtractionToContact: (conversationId: string, contactId: string) => void;
  recordAIFeedback: (conversationId: string, feedback: 'ACCEPTED' | 'EDITED' | 'REJECTED') => void;

  // Tarefas e Alertas
  tasks: Task[];
  toggleTask: (taskId: string) => void;
  createTask: (task: Partial<Task>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  alerts: SLAAlert[];
  dismissAlert: (alertId: string) => void;

  // Campanhas e Respostas Rápidas
  campaigns: Campaign[];
  createCampaign: (campaign: Partial<Campaign>) => void;
  quickReplies: QuickReplyTemplate[];

  // Propostas Comerciais & Aceite Digital
  proposals: Proposal[];
  createProposal: (proposalData: Partial<Proposal>) => Promise<Proposal>;
  updateProposal: (proposalId: string, updates: Partial<Proposal>) => void;
  deleteProposal: (proposalId: string) => void;
  acceptProposal: (proposalId: string, clientIp?: string) => Promise<Proposal>;

  // Painel Financeiro & Integração Asaas
  transactions: FinancialTransaction[];
  createFinancialTransaction: (txData: Partial<FinancialTransaction>) => FinancialTransaction;
  updateFinancialTransaction: (txId: string, updates: Partial<FinancialTransaction>) => void;
  markTransactionPaid: (txId: string, paymentMethod?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'TRANSFER') => void;
  syncAsaasTransactions: () => Promise<void>;

  // Portal SaaS Master (Gestão Global)
  saasPlans: SaaSPlan[];
  createSaaSPlan: (plan: Partial<SaaSPlan>) => SaaSPlan;
  updateSaaSPlan: (planId: string, updates: Partial<SaaSPlan>) => void;
  deleteSaaSPlan: (planId: string) => void;

  masterUsers: MasterUser[];
  createMasterUser: (userData: Partial<MasterUser>) => MasterUser;
  updateMasterUser: (userId: string, updates: Partial<MasterUser>) => void;
  deleteMasterUser: (userId: string) => void;

  saasApiConfig: SaaSApiConfig;
  updateSaaSApiConfig: (updates: Partial<SaaSApiConfig>) => void;

  // Z-API Sincronização em Tempo Real & Importação Inteligente
  isSyncingWhatsApp: boolean;
  syncWhatsAppChats: (targetInstanceId?: string, historyDays?: number) => Promise<{ success: boolean; count: number }>;
  syncZapiInstance: (instanceId: string, phone?: string) => void;
  resetCRMDatabase: (resyncAfter?: boolean) => Promise<{ success: boolean; message: string }>;
  importWhatsAppBatch: (payload: { contacts: Contact[]; conversations: Conversation[]; messages: Message[] }) => void;
  importFileContacts: (records: any[], assignedBrokerId?: string, createDeals?: boolean) => { count: number };

  // Motor de Sincronização em Segundo Plano (Background Sync Engine)
  activeSyncJob: {
    id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    pagesScanned: number;
    totalChatsFound: number;
    contactsImported: number;
    currentStepText: string;
    error?: string;
  } | null;
  startBackgroundSync: (options?: { historyDays?: number; importMode?: 'CHATS' | 'PHONEBOOK' | 'ALL' }) => Promise<string | null>;
  dismissSyncJob: () => void;

  // Feature Flags & Módulos
  isFeatureEnabled: (feature: keyof TenantFeatureFlags) => boolean;
  updateTenantFeatureFlags: (flags: Partial<TenantFeatureFlags>) => void;

  // Motor de Metas & Performance
  goalsConfig: TenantGoalsConfig;
  updateMonthlyGoal: (monthKey: string, goal: Partial<MonthlyGoal>) => void;
  updateAnnualTarget: (annualVGV: number) => void;
  getGoalsProgress: (monthKey?: string) => GoalsProgressSummary;

  // Radar de Inatividade & Follow-Up Emergencial
  getContactUrgencyAnalysis: (contactId: string, dealId?: string, conversationId?: string) => ContactUrgencyAnalysis | null;
  getDealUrgencyAnalysis: (deal: Deal) => ContactUrgencyAnalysis;
  getUrgentContactsRadar: () => ContactUrgencyAnalysis[];
}

export function normalizePhoneKey(phone: string | undefined): string {
  return canonicalPhoneKey(phone);
}

export function isLidNumber(phoneOrId: string | undefined): boolean {
  if (!phoneOrId) return false;
  const digits = phoneOrId.replace(/\D/g, '');
  return digits.length >= 14 && (digits.startsWith('13') || digits.startsWith('14') || digits.startsWith('26') || digits.startsWith('90') || digits.startsWith('107') || digits.startsWith('64'));
}

export function deduplicateContactList(list: Contact[]): Contact[] {
  const phoneMap = new Map<string, Contact>();
  const lidMap = new Map<string, Contact>();
  const idMap = new Map<string, Contact>();
  const nameMap = new Map<string, Contact>();
  const result: Contact[] = [];

  list.forEach(contact => {
    if (!contact) return;
    const clean = contact.phone.replace(/\D/g, '');
    const isLid = isLidNumber(clean);
    
    // Se o contato foi salvo com LID no campo de telefone, extrai para contact.lid
    if (isLid && !contact.lid) {
      contact.lid = clean;
    }

    const pKey = !isLid ? normalizePhoneKey(contact.phone) : '';
    const lidKey = contact.lid ? contact.lid.replace(/\D/g, '') : (isLid ? clean : '');
    const normName = contact.name && !contact.name.startsWith('+') && !contact.name.startsWith('WhatsApp') && contact.name !== 'Lead WhatsApp' && contact.name !== 'Cliente'
      ? contact.name.toLowerCase().trim()
      : '';

    const existing = (pKey ? phoneMap.get(pKey) : null) 
      || (lidKey ? lidMap.get(lidKey) : null) 
      || idMap.get(contact.id)
      || (normName ? nameMap.get(normName) : null);

    if (existing) {
      // Prefere o telefone real (não-LID e não-sintético gerado por hash legado)
      const existingIsLid = isLidNumber(existing.phone);
      const isSyntheticA = existing.phone && (existing.phone.includes('554863562855') || existing.id.includes('554863562855'));
      const isSyntheticB = contact.phone && (contact.phone.includes('554863562855') || contact.id.includes('554863562855'));

      const chosenPhone = (!existingIsLid && !isSyntheticA && existing.phone) 
        ? existing.phone 
        : ((!isLid && !isSyntheticB && contact.phone) ? contact.phone : existing.phone);

      const chosenLid = existing.lid || contact.lid || (existingIsLid ? existing.phone.replace(/\D/g, '') : (isLid ? clean : undefined));
      const chosenId = chosenPhone && !isLidNumber(chosenPhone) && !isSyntheticA ? `contact-zapi-${chosenPhone.replace(/\D/g, '')}` : existing.id;

      const merged: Contact = {
        ...existing,
        ...contact,
        id: chosenId,
        phone: chosenPhone,
        lid: chosenLid,
        name: (existing.name && !existing.name.startsWith('+') && !existing.name.startsWith('WhatsApp') && existing.name !== 'Lead WhatsApp' && existing.name !== 'Cliente')
          ? existing.name
          : (contact.name || existing.name),
        monthlyIncome: existing.monthlyIncome || contact.monthlyIncome,
        downPaymentAvailable: existing.downPaymentAvailable || contact.downPaymentAvailable,
        maxPropertyValue: existing.maxPropertyValue || contact.maxPropertyValue,
        preferredPropertyType: existing.preferredPropertyType || contact.preferredPropertyType,
        targetRegions: Array.from(new Set([...(existing.targetRegions || []), ...(contact.targetRegions || [])])),
        tags: Array.from(new Set([...(existing.tags || []), ...(contact.tags || [])])),
        email: existing.email || contact.email,
        assignedUserId: existing.assignedUserId || contact.assignedUserId,
      };

      const realPKey = normalizePhoneKey(chosenPhone);
      if (realPKey && !isLidNumber(chosenPhone)) phoneMap.set(realPKey, merged);
      if (chosenLid) lidMap.set(chosenLid.replace(/\D/g, ''), merged);
      if (normName) nameMap.set(normName, merged);
      idMap.set(merged.id, merged);

      const idx = result.findIndex(c => c.id === existing.id || c.id === contact.id);
      if (idx >= 0) result[idx] = merged;
    } else {
      if (pKey) phoneMap.set(pKey, contact);
      if (lidKey) lidMap.set(lidKey, contact);
      if (normName) nameMap.set(normName, contact);
      idMap.set(contact.id, contact);
      result.push(contact);
    }
  });

  return result;
}

export function getDefaultGoalsConfig(tenantId: string = 'tenant-amabile-barbarotti'): TenantGoalsConfig {
  const currentYear = new Date().getFullYear();
  const months: Record<string, MonthlyGoal> = {};

  for (let m = 1; m <= 12; m++) {
    const padMonth = String(m).padStart(2, '0');
    const monthKey = `${currentYear}-${padMonth}`;
    months[monthKey] = {
      monthKey,
      year: currentYear,
      month: m,
      targetMonthlyVGV: 4500000,
      targetWonDealsCount: 4,
      targetLeads: 50,
      targetClients: 35,
      notes: `Meta de performance comercial ${padMonth}/${currentYear}`,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    tenantId,
    annualVGVTarget: 50000000,
    monthlyGoals: months,
  };
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_auth_session');
        if (saved) {
          const session = JSON.parse(saved);
          return Boolean(session?.userEmail);
        }
      } catch {}
    }
    return false;
  });
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_tenants');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanList = parsed
              .filter((t: Tenant) => t.id !== 'tenant-horizonte-02' && t.id !== 'tenant-alphaville-03' && t.id !== 'tenant-vanguard-01')
              .map((t: Tenant) => {
                if (t.id === 'tenant-amabile-barbarotti') {
                  return {
                    ...t,
                    featureFlags: {
                      ...(t.featureFlags || DEFAULT_FEATURE_FLAGS),
                      proposals: false,
                      asaasBilling: false,
                      campaigns: false,
                      automations: false,
                    },
                  };
                }
                return t;
              });
            if (cleanList.length > 0) return cleanList;
          }
        }
      } catch {}
    }
    return MOCK_TENANTS;
  });

  const [currentTenant, setCurrentTenant] = useState<Tenant>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_tenant');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id !== 'tenant-horizonte-02' && parsed.id !== 'tenant-alphaville-03' && parsed.id !== 'tenant-vanguard-01') {
            if (parsed.id === 'tenant-amabile-barbarotti') {
              parsed.featureFlags = {
                ...(parsed.featureFlags || DEFAULT_FEATURE_FLAGS),
                proposals: false,
                asaasBilling: false,
                campaigns: false,
                automations: false,
              };
              try { localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(parsed)); } catch {}
            }
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_TENANTS[0];
  });

  const updateTenant = (updates: Partial<Tenant>) => {
    setCurrentTenant(prev => {
      const updated = { ...prev, ...updates };
      try { localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setTenants(prev => {
      const updatedList = prev.map(t => t.id === currentTenant.id ? { ...t, ...updates } : t);
      try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(updatedList)); } catch {}
      return updatedList;
    });
  };

  const createTenant = (tenantData: Partial<Tenant>): Tenant => {
    const newTenantId = `tenant-${Date.now()}`;
    const newTenant: Tenant = {
      id: newTenantId,
      name: tenantData.name || 'Nova Imobiliária',
      slug: tenantData.slug || `empresa-${Date.now().toString(36)}`,
      documentCnpj: tenantData.documentCnpj || '00.000.000/0001-00',
      logoUrl: tenantData.logoUrl,
      primaryColor: tenantData.primaryColor || '#059669',
      timezone: tenantData.timezone || 'America/Sao_Paulo',
      status: tenantData.status || 'TRIAL',
      plan: tenantData.plan || 'PROFESSIONAL',
      monthlyFee: tenantData.monthlyFee || 890.00,
      maxBrokers: tenantData.maxBrokers || 15,
      maxInstances: tenantData.maxInstances || 3,
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
      },
      ...tenantData,
    };

    // Cria funil de vendas inicial exclusivo deste novo tenant
    const newTenantPipeline: Pipeline = {
      id: `pipe-${newTenant.id}-default`,
      tenantId: newTenant.id,
      name: 'Funil Geral de Vendas',
      isDefault: true,
      stages: [
        { id: `stage-${newTenant.id}-1`, pipelineId: `pipe-${newTenant.id}-default`, name: '1. Novo Lead WhatsApp', order: 1, slaHours: 2, colorHex: '#3b82f6' },
        { id: `stage-${newTenant.id}-2`, pipelineId: `pipe-${newTenant.id}-default`, name: '2. Primeiro Contato', order: 2, slaHours: 12, colorHex: '#6366f1' },
        { id: `stage-${newTenant.id}-3`, pipelineId: `pipe-${newTenant.id}-default`, name: '3. Em Qualificação', order: 3, slaHours: 24, colorHex: '#8b5cf6' },
        { id: `stage-${newTenant.id}-4`, pipelineId: `pipe-${newTenant.id}-default`, name: '4. Visita Agendada', order: 4, slaHours: 48, colorHex: '#d97706' },
        { id: `stage-${newTenant.id}-5`, pipelineId: `pipe-${newTenant.id}-default`, name: '5. Proposta em Mesa', order: 5, slaHours: 48, colorHex: '#f59e0b' },
        { id: `stage-${newTenant.id}-6`, pipelineId: `pipe-${newTenant.id}-default`, name: '6. Contrato Fechado', order: 6, slaHours: 0, colorHex: '#059669', isWon: true },
        { id: `stage-${newTenant.id}-7`, pipelineId: `pipe-${newTenant.id}-default`, name: 'Perdido / Descarte', order: 7, slaHours: 0, colorHex: '#ef4444', isLost: true },
      ]
    };

    setPipelines(prev => {
      const updated = [...prev, newTenantPipeline];
      try { localStorage.setItem('vanguard_crm_pipelines', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setTenants(prev => {
      const updated = [...prev, newTenant];
      try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newTenant;
  };

  const updateTenantStatus = (tenantId: string, status: TenantStatus) => {
    setTenants(prev => {
      const updated = prev.map(t => t.id === tenantId ? { ...t, status } : t);
      try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (currentTenant.id === tenantId) {
      setCurrentTenant(prev => ({ ...prev, status }));
    }
  };

  const deleteTenant = (tenantId: string) => {
    setTenants(prev => {
      const updated = prev.filter(t => t.id !== tenantId);
      try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const isFeatureEnabled = (feature: keyof TenantFeatureFlags): boolean => {
    if (!currentTenant.featureFlags) return true; // Habilitado por padrão se não especificado
    return currentTenant.featureFlags[feature] ?? true;
  };

  const updateTenantFeatureFlags = (flags: Partial<TenantFeatureFlags>) => {
    const updatedTenant: Tenant = {
      ...currentTenant,
      featureFlags: {
        ...(currentTenant.featureFlags || DEFAULT_FEATURE_FLAGS),
        ...flags,
      },
    };
    setCurrentTenant(updatedTenant);
    setTenants(prev => {
      const updatedList = prev.map(t => t.id === updatedTenant.id ? updatedTenant : t);
      try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(updatedList)); } catch {}
      return updatedList;
    });
    try { localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(updatedTenant)); } catch {}
  };

  // -------------------------------------------------------------
  // MOTOR DE METAS & PERFORMANCE COMERCIAL
  // -------------------------------------------------------------
  const [goalsConfig, setGoalsConfig] = useState<TenantGoalsConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_goals');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.monthlyGoals) {
            return parsed;
          }
        }
      } catch {}
    }
    return getDefaultGoalsConfig();
  });

  const updateMonthlyGoal = (monthKey: string, partialGoal: Partial<MonthlyGoal>) => {
    setGoalsConfig(prev => {
      const existing = prev.monthlyGoals[monthKey] || {
        monthKey,
        year: Number(monthKey.split('-')[0]) || new Date().getFullYear(),
        month: Number(monthKey.split('-')[1]) || (new Date().getMonth() + 1),
        targetMonthlyVGV: 4500000,
        targetWonDealsCount: 4,
        targetLeads: 50,
        targetClients: 35,
      };

      const updated: TenantGoalsConfig = {
        ...prev,
        monthlyGoals: {
          ...prev.monthlyGoals,
          [monthKey]: {
            ...existing,
            ...partialGoal,
            updatedAt: new Date().toISOString(),
          },
        },
      };

      try {
        localStorage.setItem('vanguard_crm_goals', JSON.stringify(updated));
      } catch {}

      return updated;
    });
  };

  const updateAnnualTarget = (annualVGV: number) => {
    setGoalsConfig(prev => {
      const updated: TenantGoalsConfig = {
        ...prev,
        annualVGVTarget: annualVGV,
      };
      try {
        localStorage.setItem('vanguard_crm_goals', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };
  
  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_users');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed.filter((u: User) => 
              u.email?.toLowerCase() === 'rafael@faithhubs.com' ||
              u.role === 'SUPERADMIN' ||
              (!u.email?.includes('vanguardprime') && !u.email?.includes('camila') && !u.email?.includes('lucas') && !u.email?.includes('juliana'))
            );
            if (!parsed.some((u: User) => u.email?.toLowerCase() === 'rafael@faithhubs.com')) {
              parsed.unshift(MOCK_USERS[0]);
            }
            // Deduplica estritamente por e-mail (nunca permite mais de 1 usuário por e-mail)
            const seenEmails = new Set<string>();
            const uniqueUsers: User[] = [];
            for (const u of parsed) {
              const emailKey = (u.email || '').trim().toLowerCase();
              if (emailKey && !seenEmails.has(emailKey)) {
                seenEmails.add(emailKey);
                uniqueUsers.push(u);
              }
            }
            parsed = uniqueUsers;
            try { localStorage.setItem('vanguard_crm_users', JSON.stringify(parsed)); } catch {}
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_auth_session');
        if (saved) {
          const session = JSON.parse(saved);
          if (session.userEmail) {
            const found = MOCK_USERS.find(x => x.email.toLowerCase() === session.userEmail.toLowerCase());
            if (found) return found;
            if (session.userEmail.toLowerCase().includes('rafael') || session.userEmail.toLowerCase().includes('admin')) {
              return MOCK_USERS[0];
            }
          }
        }
      } catch {}
    }
    return MOCK_USERS[0];
  });

  const updateUser = (userId: string, updates: Partial<User>) => {
    if (updates.email) {
      const targetEmail = updates.email.trim().toLowerCase();
      const isDuplicate = users.some(u => u.id !== userId && (u.email || '').trim().toLowerCase() === targetEmail);
      if (isDuplicate) {
        throw new Error(`O e-mail "${updates.email}" já está cadastrado para outro usuário.`);
      }
    }

    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, ...updates } : u);
      try { localStorage.setItem('vanguard_crm_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
  };

  const createUser = (userData: Partial<User>): User => {
    const rawEmail = (userData.email || '').trim().toLowerCase();
    if (!rawEmail) {
      throw new Error('O e-mail é obrigatório para convidar ou cadastrar um usuário.');
    }

    // Validação estrita: impede múltiplos usuários com o mesmo e-mail
    const emailAlreadyRegistered = users.some(u => (u.email || '').trim().toLowerCase() === rawEmail);
    if (emailAlreadyRegistered) {
      throw new Error(`Já existe um usuário cadastrado com o e-mail "${userData.email}". Cada usuário deve possuir um e-mail único.`);
    }

    const brokerName = userData.name?.trim() || 'Novo Corretor';
    const brokerPhone = userData.phone?.trim() || '+55 11 99999-0000';

    const nowIso = new Date().toISOString();
    const hasManualPassword = Boolean(userData.password && userData.password.trim().length > 0);

    const newUser: User = {
      id: `user-${Date.now()}`,
      tenantId: currentTenant.id,
      name: brokerName,
      email: (userData.email || '').trim(),
      phone: brokerPhone,
      role: userData.role || 'BROKER',
      isActive: true,
      status: hasManualPassword ? 'ACTIVE' : 'INVITED',
      passwordSet: hasManualPassword,
      password: userData.password ? userData.password.trim() : undefined,
      mustChangePassword: userData.mustChangePassword ?? false,
      invitedAt: nowIso,
      lastInviteSentAt: nowIso,
      aiPersonaPrompt: userData.aiPersonaPrompt || `Você é o copiloto comercial de ${brokerName}, especialista imobiliário na ${currentTenant.name}. Adote tom consultivo, polido e empático. Tire dúvidas sobre o imóvel com clareza, esclareça condições de pagamento e conduza o cliente para agendamento de visita presencial ou reunião com o corretor.`,
      aiTone: userData.aiTone || 'CONSULTATIVE',
      aiDirectives: userData.aiDirectives || [
        'Sempre propor um café executivo ou agendamento de visita ao imóvel',
        'Destacar acabamento, localização nobre e segurança do condomínio',
        'Manter tom profissional, prestativo e cordial'
      ],
      aiModel: userData.aiModel || 'anthropic.claude-3-5-sonnet',
      ...userData,
    };

    setUsers(prev => {
      // Garante unicidade antes de adicionar
      if (prev.some(u => (u.email || '').trim().toLowerCase() === rawEmail)) {
        return prev;
      }
      const updated = [...prev, newUser];
      try { localStorage.setItem('vanguard_crm_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Cria automaticamente a linha direta de WhatsApp para o novo corretor
    const newDirectInst: WhatsAppInstance = {
      id: `inst-${newUser.id}`,
      tenantId: currentTenant.id,
      name: `${brokerName} (Linha Direta)`,
      phoneNumber: brokerPhone,
      zapiInstanceId: `INST-${Date.now().toString(36).toUpperCase()}`,
      status: 'DISCONNECTED',
      type: 'BROKER_DIRECT',
      assignedUserId: newUser.id,
      batteryLevel: 100,
      lastSyncAt: new Date().toISOString(),
    };

    setInstances(prev => {
      const updatedInst = [...prev, newDirectInst];
      try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updatedInst)); } catch {}
      return updatedInst;
    });

    // Dispara o envio real do e-mail de convite via API
    if (typeof window !== 'undefined') {
      fetch('/api/v1/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          tenantName: currentTenant.name,
          tenantId: currentTenant.id,
          temporaryPassword: userData.password ? userData.password.trim() : undefined,
          isResend: false,
        }),
      }).catch(err => {
        console.error('[CRMContext] Erro ao disparar e-mail de convite:', err);
      });
    }

    return newUser;
  };

  const resendUserInvite = async (userId: string): Promise<{ success: boolean; message: string }> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      throw new Error('Usuário não encontrado.');
    }

    const res = await fetch('/api/v1/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        tenantName: currentTenant.name,
        tenantId: currentTenant.id,
        temporaryPassword: targetUser.password,
        isResend: true,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao reenviar e-mail de convite.');
    }

    const now = new Date().toISOString();
    updateUser(userId, { lastInviteSentAt: now });

    return {
      success: true,
      message: data.message || `E-mail de convite reenviado com sucesso para ${targetUser.email}!`,
    };
  };

  const resetUserPassword = async (
    userId: string, 
    newPassword: string, 
    options?: { notifyEmail?: boolean; mustChangePassword?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      throw new Error('Usuário não encontrado.');
    }

    const cleanPass = newPassword.trim();
    if (cleanPass.length < 3) {
      throw new Error('A nova senha deve ter pelo menos 3 caracteres.');
    }

    const notifyEmail = options?.notifyEmail !== false;
    const mustChange = options?.mustChangePassword === true;

    updateUser(userId, {
      password: cleanPass,
      passwordSet: true,
      status: 'ACTIVE',
      mustChangePassword: mustChange,
    });

    if (typeof window !== 'undefined' && notifyEmail) {
      fetch('/api/v1/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetUser.email,
          name: targetUser.name,
          newPassword: cleanPass,
          tenantName: currentTenant.name,
          notifyEmail: true,
        }),
      }).catch(err => console.error('[CRMContext] Erro ao enviar notificação de redefinição de senha:', err));
    }

    return {
      success: true,
      message: `Senha de ${targetUser.name} redefinida com sucesso!`,
    };
  };

  const deleteUser = (userId: string) => {
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      try { localStorage.setItem('vanguard_crm_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateUserAIPersona = (userId: string, data: { aiPersonaPrompt?: string; aiTone?: any; aiDirectives?: string[]; aiModel?: string }) => {
    updateUser(userId, data);
  };

  // Checa se já existe sessão salva no navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vanguard_auth_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session?.userEmail) {
          const u = users.find(x => x.email.toLowerCase() === session.userEmail.toLowerCase());
          if (u) setCurrentUser(u);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsAuthReady(true);
    }
  }, [users]);

  const login = (email: string, role?: string) => {
    let targetUser = currentUser;
    const cleanEmail = email.trim().toLowerCase();
    const foundUser = users.find(u => u.email.toLowerCase() === cleanEmail) ||
      (cleanEmail === 'rafael@faithhubs.com' || cleanEmail.includes('rafael') || cleanEmail.includes('admin') || cleanEmail === 'admin@faithhubs.com' || cleanEmail === 'superadmin@faithhubs.com'
        ? (users.find(u => u.email.toLowerCase() === 'rafael@faithhubs.com') || users.find(u => u.role === 'SUPERADMIN') || MOCK_USERS[0])
        : null);

    if (foundUser) {
      targetUser = foundUser;
      setCurrentUser(foundUser);
    } else if (role) {
      const roleUser = users.find(u => u.role === role);
      if (roleUser) {
        targetUser = roleUser;
        setCurrentUser(roleUser);
      }
    }

    try {
      localStorage.setItem('vanguard_auth_session', JSON.stringify({ userEmail: targetUser.email, userId: targetUser.id }));
      // Ao logar na plataforma, sempre direciona para a tela de Dashboard & Vendas e modo CRM
      localStorage.setItem('vanguard_crm_current_tab', 'dashboard');
      localStorage.setItem('faithhubs_view_mode', 'TENANT_CRM');

      // Sincroniza sessão no servidor com HttpOnly Cookie
      fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetUser.email,
          userId: targetUser.id,
          role: targetUser.role,
          tenantId: currentTenant.id,
        }),
      }).catch(() => {});
    } catch {}
    setIsAuthenticated(true);
  };

  const logout = () => {
    try {
      localStorage.removeItem('vanguard_auth_session');
      // Ao deslogar, reseta a próxima entrada para o Dashboard & Vendas
      localStorage.setItem('vanguard_crm_current_tab', 'dashboard');
      localStorage.setItem('faithhubs_view_mode', 'TENANT_CRM');
      fetch('/api/v1/auth/session', { method: 'DELETE' }).catch(() => {});
    } catch {}
    setIsAuthenticated(false);
  };

  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_contacts');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed
              .filter((c: Contact) => c.tenantId !== 'tenant-vanguard-01' && isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt || c.updatedAt }))
              .map((c: Contact) => ({
                ...c,
                targetRegions: (c.targetRegions || []).filter(r => r !== 'Região Metropolitana' && r !== 'São Paulo' && r !== 'Geral'),
              }));
            return deduplicateContactList(parsed);
          }
        }
      } catch {}
    }
    return deduplicateContactList(MOCK_CONTACTS);
  });

  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [currentPipeline, setCurrentPipeline] = useState<Pipeline>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_pipeline');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.stages) && parsed.stages.length > 0 && parsed.tenantId !== 'tenant-vanguard-01') return parsed;
        }
      } catch {}
    }
    return MOCK_PIPELINES[0];
  });
  const [deals, setDeals] = useState<Deal[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_deals');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed.filter((d: Deal) => d.tenantId !== 'tenant-vanguard-01');
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_DEALS;
  });

  const [instances, setInstances] = useState<WhatsAppInstance[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_instances');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed
              .filter((i: WhatsAppInstance) => i.tenantId !== 'tenant-vanguard-01' && i.id !== 'inst-lucas' && i.id !== 'inst-juliana')
              .map((i: WhatsAppInstance) => {
                if (i.zapiInstanceId === '3F1B67FC8139425171C79ED390C0144C' || !i.zapiInstanceId || i.zapiInstanceId.startsWith('INST-')) {
                  return { ...i, zapiInstanceId: '3F8144490C66805B4E3FD64A35E2F2DC' };
                }
                return i;
              });
            try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(parsed)); } catch {}
            if (parsed.length > 0) return parsed;
          }
        }
      } catch {}
    }
    return MOCK_INSTANCES;
  });

  const [activeInstanceId, setActiveInstanceId] = useState<string>(() => {
    return MOCK_INSTANCES[0]?.id || 'inst-amabile-central';
  });

  const createInstance = (data: Partial<WhatsAppInstance>): WhatsAppInstance => {
    const newInst: WhatsAppInstance = {
      id: `inst-${Date.now()}`,
      tenantId: currentTenant.id,
      name: data.name || 'Nova Linha WhatsApp',
      phoneNumber: data.phoneNumber || 'Aguardando pareamento',
      zapiInstanceId: data.zapiInstanceId || `INST-${Date.now().toString(36).toUpperCase()}`,
      status: data.status || 'CONNECTED',
      type: data.type || 'BROKER_DIRECT',
      assignedUserId: data.assignedUserId,
      batteryLevel: 100,
      lastSyncAt: new Date().toISOString(),
      ...data,
    };
    setInstances(prev => {
      const updated = [...prev, newInst];
      try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newInst;
  };

  const updateInstance = (instanceId: string, updates: Partial<WhatsAppInstance>) => {
    setInstances(prev => {
      const updated = prev.map(inst => inst.id === instanceId ? { ...inst, ...updates } : inst);
      try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteInstance = (instanceId: string) => {
    setInstances(prev => {
      const updated = prev.filter(inst => inst.id !== instanceId);
      try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const transferConversationInstance = (conversationId: string, targetInstanceId: string, sendTransitionMessage = true) => {
    const targetInst = instances.find(i => i.id === targetInstanceId);
    if (!targetInst) return;

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            instanceId: targetInstanceId,
            assignedUserId: targetInst.assignedUserId || c.assignedUserId,
          };
        }
        return c;
      });
      try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (sendTransitionMessage) {
      const broker = users.find(u => u.id === targetInst.assignedUserId) || currentUser;
      const text = `Olá! Sou o(a) ${broker.name}, seu corretor exclusivo na ${currentTenant.name}. A partir de agora vamos conversar diretamente por este meu número pessoal (${targetInst.phoneNumber}) para um atendimento mais ágil e personalizado!`;
      sendMessage(conversationId, text, false, false);
    }
  };
  
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_conversations');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed
              .filter((c: Conversation) => c.tenantId !== 'tenant-vanguard-01' && isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt }))
              .map((c: Conversation) => {
                if (c.lastMessagePreview && isWhatsAppSystemMessage(c.lastMessagePreview)) {
                  return { ...c, lastMessagePreview: 'Conversa sincronizada via WhatsApp' };
                }
                return c;
              });
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_messages');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed.filter((m: Message) => m.tenantId !== 'tenant-vanguard-01' && !isWhatsAppSystemMessage(m.content));
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(parsed)); } catch {}
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_MESSAGES;
  });

  // Função para remover mensagens duplicadas, limpar placeholders genéricos, avisos de sistema e corrigir lado do remetente
  const deduplicateMessages = (msgs: Message[]): Message[] => {
    const map = new Map<string, Message>();
    msgs.forEach(m => {
      const content = (m.content || '').trim();
      if (
        !content ||
        isWhatsAppSystemMessage(content) ||
        content === 'Mensagem recebida pelo WhatsApp' ||
        content === 'Olá! Conversa sincronizada do WhatsApp.' ||
        content === 'Conversa sincronizada do WhatsApp.' ||
        content === 'Conversa ativa no WhatsApp' ||
        content.includes('Gostaria de receber mais informações sobre os imóveis disponíveis') ||
        content.includes('Temos excelentes oportunidades residenciais e comerciais') ||
        content.includes('Separei opções que atendem exatamente ao seu perfil') ||
        content.includes('Busco apartamento de 2 a 3 dormitórios')
      ) {
        return;
      }
      const timeKey = m.timestamp ? m.timestamp.slice(0, 16) : '';
      const key = `${m.conversationId}-${content}-${timeKey}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, m);
      } else {
        // Se a mensagem já existia marcada erroneamente como CONTACT e agora veio como USER, corrige para USER!
        if (existing.senderType === 'CONTACT' && m.senderType === 'USER') {
          map.set(key, m);
        }
      }
    });

    return Array.from(map.values());
  };

  // Hidrata dados salvos no servidor e no localStorage (funciona 100% em aba anônima e novos dispositivos)
  const isHydratedRef = useRef(false);

  useEffect(() => {
    const initializeCRMState = async () => {
      try {
        // 1. Busca estado inicial do servidor (persistência cross-device e aba anônima)
        let serverData: any = null;
        try {
          const res = await fetch('/api/v1/crm/state');
          if (res.ok) {
            serverData = await res.json();
          }
        } catch {}

        // 2. Lê localStorage
        const savedContacts = localStorage.getItem('vanguard_crm_contacts');
        const parsedLocalContacts = savedContacts ? JSON.parse(savedContacts) : null;

        const savedDeals = localStorage.getItem('vanguard_crm_deals');
        const parsedLocalDeals = savedDeals ? JSON.parse(savedDeals) : null;

        const savedConvs = localStorage.getItem('vanguard_crm_conversations');
        const parsedLocalConvs = savedConvs ? JSON.parse(savedConvs) : null;

        const savedMsgs = localStorage.getItem('vanguard_crm_messages');
        const parsedLocalMsgs = savedMsgs ? JSON.parse(savedMsgs) : null;

        const savedInsights = localStorage.getItem('vanguard_crm_ai_insights');
        const parsedLocalInsights = savedInsights ? JSON.parse(savedInsights) : null;

        // Mescla ou carrega contatos com deduplicação estrita
        if (serverData && Array.isArray(serverData.contacts) && serverData.contacts.length > 0) {
          setContacts(prev => {
            const list = parsedLocalContacts || prev;
            const combined = [...list, ...serverData.contacts];
            const deduped = deduplicateContactList(combined);
            try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduped)); } catch {}
            return deduped;
          });
        } else if (parsedLocalContacts && parsedLocalContacts.length > 0) {
          const deduped = deduplicateContactList(parsedLocalContacts);
          setContacts(deduped);
          try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduped)); } catch {}
        }

        // Deals
        if (parsedLocalDeals && parsedLocalDeals.length > 0) {
          setDeals(parsedLocalDeals);
        } else if (serverData && Array.isArray(serverData.deals) && serverData.deals.length > 0) {
          setDeals(serverData.deals);
        }

        // Conversas
        if (parsedLocalConvs && parsedLocalConvs.length > 0) {
          setConversations(parsedLocalConvs);
        } else if (serverData && Array.isArray(serverData.conversations) && serverData.conversations.length > 0) {
          setConversations(serverData.conversations);
        }

        // Mensagens
        const mergedMsgs = deduplicateMessages([
          ...(parsedLocalMsgs || []),
          ...(serverData?.messages || [])
        ]);
        if (mergedMsgs.length > 0) {
          setMessages(mergedMsgs);
          try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(mergedMsgs)); } catch {}
        }

        // Insights
        if (serverData?.aiInsights) {
          setAiInsights(prev => ({
            ...prev,
            ...(parsedLocalInsights || {}),
            ...serverData.aiInsights,
          }));
        } else if (parsedLocalInsights) {
          setAiInsights(parsedLocalInsights);
        }

        const savedActive = localStorage.getItem('vanguard_crm_active_conv_id');
        if (savedActive) {
          setActiveConversationId(savedActive);
        } else if (serverData?.conversations?.[0]?.id) {
          setActiveConversationId(serverData.conversations[0].id);
        }
      } catch (err) {
        console.error('Erro na hidratação do CRM:', err);
      } finally {
        isHydratedRef.current = true;
      }
    };

    initializeCRMState();
  }, []);

  // Listener em tempo real para sincronizações recebidas diretamente da Extensão Brokiva
  useEffect(() => {
    const handleExtensionDirectSync = (event: MessageEvent) => {
      if (event.data?.type === 'BROKIVA_EXTENSION_SYNC' && event.data?.data) {
        console.log('[Brokiva CRM] Mensagens sincronizadas recebidas da extensão:', event.data.data);
        const { messages: incomingMsgs, contacts: incomingContacts, conversations: incomingConvs } = event.data.data;

        if (Array.isArray(incomingMsgs) && incomingMsgs.length > 0) {
          setMessages(prev => {
            const merged = deduplicateMessages([...prev, ...incomingMsgs]);
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (Array.isArray(incomingContacts) && incomingContacts.length > 0) {
          setContacts(prev => {
            const merged = deduplicateContactList([...prev, ...incomingContacts]);
            try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (Array.isArray(incomingConvs) && incomingConvs.length > 0) {
          setConversations(prev => {
            const map = new Map(prev.map(c => [c.id, c]));
            incomingConvs.forEach((c: any) => {
              const existing = map.get(c.id);
              const preview = (c.lastMessagePreview && isWhatsAppSystemMessage(c.lastMessagePreview))
                ? 'Conversa sincronizada via WhatsApp'
                : c.lastMessagePreview;
              map.set(c.id, existing ? { ...existing, ...c, lastMessagePreview: preview || existing.lastMessagePreview } : { ...c, lastMessagePreview: preview });
            });
            const updated = Array.from(map.values());
            try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
            return updated;
          });
        }
      }
    };

    window.addEventListener('message', handleExtensionDirectSync);
    return () => window.removeEventListener('message', handleExtensionDirectSync);
  }, []);

  // Salva no localStorage quando o estado mudar (somente APÓS hidratação para nunca sobrescrever)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (contacts.length > 0) localStorage.setItem('vanguard_crm_contacts', JSON.stringify(contacts));
    } catch {}
  }, [contacts]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (deals.length > 0) localStorage.setItem('vanguard_crm_deals', JSON.stringify(deals));
    } catch {}
  }, [deals]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (conversations.length > 0) localStorage.setItem('vanguard_crm_conversations', JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (messages.length > 0) localStorage.setItem('vanguard_crm_messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (activeConversationId) localStorage.setItem('vanguard_crm_active_conv_id', activeConversationId);
    } catch {}
  }, [activeConversationId]);
  
  const [aiInsights, setAiInsights] = useState<Record<string, AIInsight>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_ai_insights');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return MOCK_AI_INSIGHTS;
  });

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (Object.keys(aiInsights).length > 0) localStorage.setItem('vanguard_crm_ai_insights', JSON.stringify(aiInsights));
    } catch {}
  }, [aiInsights]);
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_tasks');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return MOCK_TASKS;
  });
  const [alerts, setAlerts] = useState<SLAAlert[]>(MOCK_ALERTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [quickReplies] = useState<QuickReplyTemplate[]>(MOCK_QUICK_REPLIES);

  // Manipulação de Contatos
  const addContact = (data: Partial<Contact>): Contact => {
    const phone = data.phone || '+5511900000000';
    const pKey = normalizePhoneKey(phone);

    let resultContact: Contact;

    setContacts(prev => {
      // 1. Verifica se já existe contato com o mesmo telefone ou ID
      const existingIndex = prev.findIndex(c => 
        (pKey && normalizePhoneKey(c.phone) === pKey) || 
        (data.id && c.id === data.id)
      );

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        resultContact = {
          ...existing,
          ...data,
          id: existing.id,
          name: (data.name && data.name !== 'Lead WhatsApp' && !data.name.startsWith('+')) ? data.name : existing.name,
          monthlyIncome: data.monthlyIncome || existing.monthlyIncome,
          downPaymentAvailable: data.downPaymentAvailable || existing.downPaymentAvailable,
          maxPropertyValue: data.maxPropertyValue || existing.maxPropertyValue,
          preferredPropertyType: data.preferredPropertyType || existing.preferredPropertyType,
          targetRegions: Array.from(new Set([...(existing.targetRegions || []), ...(data.targetRegions || [])])),
          tags: Array.from(new Set([...(existing.tags || []), ...(data.tags || [])])),
          email: data.email || existing.email,
          assignedUserId: data.assignedUserId || existing.assignedUserId,
          updatedAt: new Date().toISOString(),
        };

        const updated = [...prev];
        updated[existingIndex] = resultContact;
        const deduped = deduplicateContactList(updated);

        try {
          localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduped));
          fetch('/api/v1/crm/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: deduped }),
          }).catch(() => {});
        } catch {}
        return deduped;
      }

      // 2. Se for novo contato
      resultContact = {
        id: data.id || `contact-${Date.now()}`,
        tenantId: currentTenant.id,
        name: data.name || 'Lead WhatsApp',
        phone: phone,
        email: data.email,
        source: data.source || 'WHATSAPP',
        temperature: data.temperature || 'WARM',
        aiPriorityScore: data.aiPriorityScore || 70,
        tags: data.tags || ['Novo Lead'],
        targetRegions: data.targetRegions || [],
        notesCount: 0,
        consentGiven: true,
        hasOptedOut: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };

      const updated = deduplicateContactList([resultContact, ...prev]);
      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });

    // Cria/garante conversa no Inbox WhatsApp
    if (resultContact!) {
      const contactToUse = resultContact;
      setConversations(prev => {
        const exists = prev.some(c => c.contactId === contactToUse.id);
        if (exists) return prev;

        const newConv: Conversation = {
          id: `conv-${contactToUse.id}`,
          tenantId: currentTenant.id,
          instanceId: instances[0]?.id || 'instance-01',
          contactId: contactToUse.id,
          assignedUserId: contactToUse.assignedUserId || currentUser.id,
          status: 'OPEN',
          unreadCount: 0,
          lastMessagePreview: 'Lead cadastrado no CRM',
          lastMessageAt: new Date().toISOString(),
          slaBreached: false,
          isPinned: false,
          isArchived: false,
        };

        const updated = [newConv, ...prev];
        try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }

    return resultContact!;
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    setContacts(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c);
      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  const deleteContact = (id: string) => {
    setContacts(prev => {
      const updated = prev.filter(c => c.id !== id);
      try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const toggleContactPersonal = (contactId: string) => {
    let nextPersonalState = false;

    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId) {
          nextPersonalState = !c.isPersonal;
          return {
            ...c,
            isPersonal: nextPersonalState,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });

    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.contactId === contactId) {
          return {
            ...conv,
            isPersonal: nextPersonalState,
          };
        }
        return conv;
      });

      try {
        localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addPresentedProperty = (contactId: string, propertyData: Omit<PresentedProperty, 'id' | 'presentedAt'>) => {
    const newProp: PresentedProperty = {
      ...propertyData,
      id: `prop-${Date.now()}`,
      presentedAt: new Date().toISOString(),
      status: propertyData.status || 'PRESENTED',
    };

    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId) {
          const list = c.presentedProperties || [];
          return {
            ...c,
            presentedProperties: [newProp, ...list],
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });

    setDeals(prev => {
      const updated = prev.map(deal => {
        if (deal.contactId === contactId) {
          const currentProps = deal.presentedProperties || [];
          return {
            ...deal,
            propertyInterest: newProp.name,
            expectedValue: newProp.price || deal.expectedValue,
            presentedProperties: [newProp, ...currentProps],
            updatedAt: new Date().toISOString(),
          };
        }
        return deal;
      });

      try {
        localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deals: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  const updatePresentedProperty = (contactId: string, propertyId: string, updates: Partial<PresentedProperty>) => {
    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId && c.presentedProperties) {
          return {
            ...c,
            presentedProperties: c.presentedProperties.map(p => p.id === propertyId ? { ...p, ...updates } : p),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });

    setDeals(prev => {
      const updated = prev.map(deal => {
        if (deal.contactId === contactId && deal.presentedProperties) {
          return {
            ...deal,
            presentedProperties: deal.presentedProperties.map(p => p.id === propertyId ? { ...p, ...updates } : p),
            updatedAt: new Date().toISOString(),
          };
        }
        return deal;
      });
      try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const removePresentedProperty = (contactId: string, propertyId: string) => {
    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId && c.presentedProperties) {
          return {
            ...c,
            presentedProperties: c.presentedProperties.filter(p => p.id !== propertyId),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });

    setDeals(prev => {
      const updated = prev.map(deal => {
        if (deal.contactId === contactId && deal.presentedProperties) {
          return {
            ...deal,
            presentedProperties: deal.presentedProperties.filter(p => p.id !== propertyId),
            updatedAt: new Date().toISOString(),
          };
        }
        return deal;
      });
      try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const addBrokerNote = (contactId: string, content: string, category?: BrokerNote['category']) => {
    if (!content.trim()) return;
    const newNote: BrokerNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      content: content.trim(),
      category: category || 'GENERAL',
      createdAt: new Date().toISOString(),
    };

    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId) {
          const list = c.brokerNotes || [];
          return {
            ...c,
            brokerNotes: [newNote, ...list],
            notesCount: list.length + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  const removeBrokerNote = (contactId: string, noteId: string) => {
    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId && c.brokerNotes) {
          const filtered = c.brokerNotes.filter(n => n.id !== noteId);
          return {
            ...c,
            brokerNotes: filtered,
            notesCount: filtered.length,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  // Manipulação de Deals / Kanban
  const moveDealStage = (dealId: string, targetStageId: string) => {
    const stage = currentPipeline.stages.find(s => s.id === targetStageId);
    setDeals(prev => {
      const updated = prev.map(deal => {
        if (deal.id === dealId) {
          return {
            ...deal,
            stageId: targetStageId,
            status: (stage?.isWon ? 'WON' : stage?.isLost ? 'LOST' : 'OPEN') as any,
            closedAt: stage?.isWon || stage?.isLost ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString()
          };
        }
        return deal;
      });
      try {
        localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deals: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  const createDeal = (data: Partial<Deal>): Deal => {
    const contactId = data.contactId || contacts[0]?.id || 'contact-01';
    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      tenantId: currentTenant.id,
      contactId: contactId,
      pipelineId: currentPipeline.id,
      stageId: data.stageId || currentPipeline.stages[0].id,
      assignedUserId: data.assignedUserId || currentUser.id,
      title: data.title || 'Novo Negócio Imobiliário',
      expectedValue: data.expectedValue || 1000000,
      manualProbability: data.manualProbability || 50,
      aiProbabilityScore: 65,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    setDeals(prev => {
      const filtered = prev.filter(d => d.id !== newDeal.id);
      const updated = [newDeal, ...filtered];
      try {
        localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deals: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
    return newDeal;
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setDeals(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d);
      try {
        localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated));
        fetch('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deals: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  const deleteDeal = (id: string) => {
    setDeals(prev => {
      const updated = prev.filter(d => d.id !== id);
      try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updatePipelineStages = (newStages: PipelineStage[]) => {
    const ordered = newStages.map((s, idx) => ({ ...s, order: idx + 1 }));
    const updatedPipeline: Pipeline = {
      ...currentPipeline,
      stages: ordered,
    };
    setCurrentPipeline(updatedPipeline);
    setPipelines(prev => prev.map(p => p.id === updatedPipeline.id ? updatedPipeline : p));
    try {
      localStorage.setItem('vanguard_crm_current_pipeline', JSON.stringify(updatedPipeline));
    } catch {}
  };

  // Envio de Mensagem WhatsApp / Nota Interna
  const sendMessage = (
    conversationId: string, 
    content: string, 
    isInternalNote = false, 
    aiSuggested = false,
    attachments?: Attachment[],
    messageType: MessageType = 'TEXT'
  ) => {
    const cleanContent = (content || '').trim();
    if (!cleanContent && (!attachments || attachments.length === 0)) return;

    const actualType: MessageType = messageType || (attachments && attachments.length > 0 
      ? (attachments[0].mimeType?.startsWith('image/') ? 'IMAGE' : attachments[0].mimeType?.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT')
      : 'TEXT');

    const previewText = cleanContent || (actualType === 'IMAGE' ? '📷 Foto' : actualType === 'AUDIO' ? '🎵 Áudio' : actualType === 'DOCUMENT' ? '📄 Documento' : 'Mensagem');

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: currentTenant.id,
      conversationId,
      senderType: 'USER',
      senderUserId: currentUser.id,
      senderName: currentUser.name,
      messageType: actualType,
      content: cleanContent || previewText,
      attachments,
      status: isInternalNote ? 'SENT' : 'DELIVERED',
      isInternalNote,
      timestamp: new Date().toISOString(),
      aiSuggested,
    };

    setMessages(prev => {
      const next = [...prev, newMessage];
      try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(next)); } catch {}
      return next;
    });

    if (!isInternalNote) {
      // Atualiza conversa localmente (zera unreadCount e muda status para PENDING_CLIENT)
      setConversations(prev => {
        const next = prev.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              lastMessagePreview: previewText,
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
              status: 'PENDING_CLIENT' as const,
              slaBreached: false,
            };
          }
          return conv;
        });
        try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(next)); } catch {}
        return next;
      });

      // Envia diretamente para a Z-API se for um contato real do WhatsApp
      const conv = conversations.find(c => c.id === conversationId);
      const contact = contacts.find(cnt => cnt.id === conv?.contactId);

      let targetPhone = contact?.phone ? contact.phone.replace(/\D/g, '') : '';
      if (!targetPhone && conversationId.includes('zapi-')) {
        targetPhone = conversationId.split('zapi-')[1]?.replace(/\D/g, '') || '';
      }
      if (!targetPhone && conv?.contactId?.includes('zapi-')) {
        targetPhone = conv.contactId.split('zapi-')[1]?.replace(/\D/g, '') || '';
      }
      if (!targetPhone) {
        const rawDigits = conversationId.replace(/\D/g, '');
        if (rawDigits.length >= 8) targetPhone = rawDigits;
      }
      if (targetPhone && !targetPhone.startsWith('55') && (targetPhone.length === 10 || targetPhone.length === 11)) {
        targetPhone = `55${targetPhone}`;
      }

      if (targetPhone) {
        // Procura a linha individual do corretor logado ou a da conversa
        const brokerInstance = instances.find(i => i.assignedUserId === currentUser.id) || instances.find(i => i.id === conv?.instanceId) || instances[0];

        fetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: cleanContent || previewText,
            messageType: actualType,
            mediaUrl: attachments?.[0]?.url,
            fileName: attachments?.[0]?.fileName,
            phone: targetPhone,
            senderUserId: currentUser.id,
            instanceId: brokerInstance?.zapiInstanceId || '3F8144490C66805B4E3FD64A35E2F2DC',
          }),
        }).catch(err => console.error('Erro ao enviar mensagem via Z-API:', err));
      }

      // Confirmação de entrega
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'DELIVERED' } : m));
      }, 1200);
    }
  };

  // Marca conversa como lida (remove contadores de pendência e badges)
  const markConversationAsRead = (conversationId: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId && (conv.unreadCount > 0 || conv.status === 'PENDING_TEAM')) {
        return {
          ...conv,
          unreadCount: 0,
          status: conv.status === 'PENDING_TEAM' ? 'OPEN' : conv.status,
        };
      }
      return conv;
    }));
  };

  // Limpar histórico de mensagens da conversa (Z-API + Local)
  const clearChatMessages = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    const contact = contacts.find(cnt => cnt.id === conv?.contactId);
    const phone = contact?.phone || (conversationId.includes('zapi-') ? conversationId.split('zapi-')[1] : '');

    // Limpa mensagens locais
    setMessages(prev => prev.filter(m => m.conversationId !== conversationId));

    if (phone) {
      try {
        await fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear', phone }),
        });
      } catch (err) {
        console.error('Erro ao limpar conversa na Z-API:', err);
      }
    }
  };

  // Arquivar ou Desarquivar conversa (Z-API + Local)
  const archiveConversation = async (conversationId: string, archive = true) => {
    const conv = conversations.find(c => c.id === conversationId);
    const contact = contacts.find(cnt => cnt.id === conv?.contactId);
    const phone = contact?.phone || (conversationId.includes('zapi-') ? conversationId.split('zapi-')[1] : '');

    setConversations(prev => prev.map(c => c.id === conversationId ? { 
      ...c, 
      isArchived: archive, 
      status: archive ? 'CLOSED' : 'OPEN' 
    } : c));

    if (phone) {
      try {
        await fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: archive ? 'archive' : 'unarchive', phone }),
        });
      } catch (err) {
        console.error('Erro ao arquivar conversa na Z-API:', err);
      }
    }
  };

  // Deletar conversa completamente (Z-API + Local)
  const deleteConversation = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    const contact = contacts.find(cnt => cnt.id === conv?.contactId);
    const phone = contact?.phone || (conversationId.includes('zapi-') ? conversationId.split('zapi-')[1] : '');

    setConversations(prev => prev.filter(c => c.id !== conversationId));
    setMessages(prev => prev.filter(m => m.conversationId !== conversationId));
    
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
    }

    if (phone) {
      try {
        await fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', phone }),
        });
      } catch (err) {
        console.error('Erro ao deletar conversa na Z-API:', err);
      }
    }
  };

  // Fixar ou Desafixar conversa no topo (Z-API + Local)
  const pinConversation = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    const contact = contacts.find(cnt => cnt.id === conv?.contactId);
    const phone = contact?.phone || (conversationId.includes('zapi-') ? conversationId.split('zapi-')[1] : '');
    const newPinned = !conv?.isPinned;

    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, isPinned: newPinned } : c));

    if (phone) {
      try {
        await fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: newPinned ? 'pin' : 'unpin', phone }),
        });
      } catch (err) {
        console.error('Erro ao fixar conversa na Z-API:', err);
      }
    }
  };

  // Atribuição de Conversa
  const assignConversation = (conversationId: string, userId?: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          assignedUserId: userId,
          status: userId ? 'OPEN' : 'UNASSIGNED',
        };
      }
      return conv;
    }));
  };

  // Simulador de Ingestão de Webhook Z-API
  const simulateIncomingMessage = (phone: string, name: string, content: string) => {
    // 1. Localiza ou cria contato
    let contact = contacts.find(c => c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!contact) {
      contact = addContact({
        name,
        phone,
        source: 'WHATSAPP',
        temperature: 'HOT',
        aiPriorityScore: 85,
        tags: ['Entrada WhatsApp', 'Lead Webhook Z-API']
      });
    }

    // 2. Localiza ou cria conversa
    let conv = conversations.find(c => c.contactId === contact!.id);
    const convId = conv ? conv.id : `conv-${Date.now()}`;

    if (!conv) {
      const newConv: Conversation = {
        id: convId,
        tenantId: currentTenant.id,
        instanceId: instances[0].id,
        contactId: contact.id,
        assignedUserId: currentTenant.settings.autoAssignRule === 'ROUND_ROBIN' ? currentUser.id : undefined,
        status: 'PENDING_TEAM',
        lastMessagePreview: content,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 1,
        slaBreached: false,
      };
      setConversations(prev => [newConv, ...prev]);
    } else {
      setConversations(prev => prev.map(c => c.id === convId ? {
        ...c,
        lastMessagePreview: content,
        lastMessageAt: new Date().toISOString(),
        unreadCount: c.unreadCount + 1,
        status: 'PENDING_TEAM'
      } : c));
    }

    // 3. Adiciona a mensagem recebida
    const incomingMsg: Message = {
      id: `msg-${Date.now()}`,
      tenantId: currentTenant.id,
      conversationId: convId,
      externalId: `zapi-webhook-${Date.now()}`,
      senderType: 'CONTACT',
      messageType: 'TEXT',
      content,
      status: 'READ',
      isInternalNote: false,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, incomingMsg]);

    // 4. Dispara IA Copiloto simulado
    setTimeout(() => {
      const generatedInsight: AIInsight = {
        id: `ai-${Date.now()}`,
        tenantId: currentTenant.id,
        conversationId: convId,
        contactId: contact!.id,
        summary: `O lead ${name} enviou mensagem com alto interesse imobiliário: "${content.slice(0, 80)}...".`,
        extractedData: {
          urgencyLevel: 'ALTA',
          preferredRegion: 'Região Nobre / Central',
          detectedObjections: ['Confirmar disponibilidade de visita imediata'],
        },
        sentiment: 'POSITIVE',
        intent: 'AGENDAR_VISITA',
        suggestedResponse: `Olá ${name}! Que excelente notícia. Temos unidades exclusivas disponíveis nessa configuração. Gostaria de receber um vídeo do imóvel ou prefere agendar uma visita presencial?`,
        confidenceScore: 94,
        createdAt: new Date().toISOString(),
      };

      setAiInsights(prev => ({ ...prev, [convId]: generatedInsight }));
    }, 1200);
  };

  const openChatForContact = (contactId: string): string => {
    // 1. Procura conversa direta pelo contactId
    let targetConv = conversations.find(c => c.contactId === contactId);

    // 2. Se não achou, procura se existe conversa para o telefone do contato
    const contact = contacts.find(c => c.id === contactId);
    if (!targetConv && contact?.phone) {
      const cleanPhone = contact.phone.replace(/\D/g, '');
      targetConv = conversations.find(c => {
        const cnt = contacts.find(x => x.id === c.contactId);
        return cnt?.phone?.replace(/\D/g, '') === cleanPhone;
      });
    }

    // 3. Se ainda não existir conversa, cria e registra agora mesmo
    if (!targetConv && contact) {
      const newConv: Conversation = {
        id: `conv-${contact.id}`,
        tenantId: currentTenant.id,
        instanceId: instances[0]?.id || 'instance-01',
        contactId: contact.id,
        assignedUserId: contact.assignedUserId || currentUser.id,
        status: 'OPEN',
        unreadCount: 0,
        lastMessagePreview: 'Conversa iniciada pelo CRM',
        lastMessageAt: new Date().toISOString(),
        slaBreached: false,
        isPinned: false,
        isArchived: false,
      };

      setConversations(prev => {
        const updated = [newConv, ...prev.filter(c => c.id !== newConv.id)];
        try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
        return updated;
      });
      targetConv = newConv;
    }

    if (targetConv) {
      setActiveConversationId(targetConv.id);
      try { localStorage.setItem('vanguard_crm_active_conv_id', targetConv.id); } catch {}
      return targetConv.id;
    }

    return '';
  };

  // Salvar Extrações de IA no Perfil do Lead
  const applyAIExtractionToContact = (conversationId: string, contactId: string) => {
    const insight = aiInsights[conversationId];
    if (!insight) return;

    const updates: Partial<Contact> = {
      aiPriorityScore: 95,
      temperature: 'HOT',
    };
    if (insight.extractedData.monthlyIncome) updates.monthlyIncome = insight.extractedData.monthlyIncome;
    if (insight.extractedData.downPayment) updates.downPaymentAvailable = insight.extractedData.downPayment;
    if (insight.extractedData.maxBudget) updates.maxPropertyValue = insight.extractedData.maxBudget;
    if (insight.extractedData.propertyType) updates.preferredPropertyType = (insight.extractedData.propertyType as any);
    if (insight.extractedData.preferredRegion) {
      updates.targetRegions = insight.extractedData.preferredRegion.split(',').map((r: string) => r.trim());
    }

    updateContact(contactId, updates);

    setAiInsights(prev => {
      const next: Record<string, AIInsight> = {
        ...prev,
        [conversationId]: {
          ...prev[conversationId],
          userFeedback: 'ACCEPTED' as const
        }
      };
      try { localStorage.setItem('vanguard_crm_ai_insights', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const updateAIInsight = (conversationId: string, insight: Partial<AIInsight>) => {
    setAiInsights(prev => {
      const existing = prev[conversationId] || {
        id: `ai-${Date.now()}`,
        tenantId: currentTenant.id,
        conversationId,
        contactId: '',
        summary: '',
        extractedData: { detectedObjections: [] },
        sentiment: 'POSITIVE' as const,
        intent: 'DUVIDA_GERAL' as const,
        suggestedResponse: '',
        confidenceScore: 92,
        createdAt: new Date().toISOString(),
      };

      const updated: AIInsight = {
        ...existing,
        ...insight,
        extractedData: {
          ...existing.extractedData,
          ...(insight.extractedData || {}),
        },
      };

      const next = { ...prev, [conversationId]: updated };
      try {
        localStorage.setItem('vanguard_crm_ai_insights', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const recordAIFeedback = (conversationId: string, feedback: 'ACCEPTED' | 'EDITED' | 'REJECTED') => {
    if (aiInsights[conversationId]) {
      setAiInsights(prev => {
        const next = {
          ...prev,
          [conversationId]: {
            ...prev[conversationId],
            userFeedback: feedback
          }
        };
        try { localStorage.setItem('vanguard_crm_ai_insights', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  // Tarefas e Alertas
  const toggleTask = (taskId: string) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? {
        ...t,
        isCompleted: !t.isCompleted,
        completedAt: !t.isCompleted ? new Date().toISOString() : undefined
      } : t);
      try { localStorage.setItem('vanguard_crm_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const createTask = (data: Partial<Task>) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      tenantId: currentTenant.id,
      contactId: data.contactId || contacts[0]?.id || 'contact-01',
      assignedUserId: data.assignedUserId || currentUser.id,
      title: data.title || 'Nova Tarefa',
      taskType: data.taskType || 'FOLLOW_UP',
      dueDate: data.dueDate || new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      priority: data.priority || 'MEDIUM',
      isCompleted: false,
      ...data,
    };
    setTasks(prev => {
      const updated = [newTask, ...prev];
      try { localStorage.setItem('vanguard_crm_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, ...updates } : t);
      try { localStorage.setItem('vanguard_crm_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== taskId);
      try { localStorage.setItem('vanguard_crm_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const createCampaign = (data: Partial<Campaign>) => {
    const newCamp: Campaign = {
      id: `camp-${Date.now()}`,
      tenantId: currentTenant.id,
      name: data.name || 'Nova Campanha WhatsApp',
      instanceId: instances[0].id,
      targetSegment: data.targetSegment || 'Todos os contatos válidos',
      totalRecipients: data.totalRecipients || 50,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      repliedCount: 0,
      optOutCount: 0,
      status: 'RUNNING',
      messageTemplate: data.messageTemplate || 'Olá {{nome}}!',
      sendRatePerMinute: 20,
      createdAt: new Date().toISOString(),
      ...data,
    };
    setCampaigns(prev => [newCamp, ...prev]);
  };

  const loadChatHistory = async (phone: string, conversationId: string, page = 1, historyDays = 15) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const conv = conversations.find(c => c.id === conversationId);
      const brokerInst = instances.find(i => i.id === conv?.instanceId) || instances[0];

      const res = await fetch('/api/v1/zapi/sync-chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          conversationId,
          tenantId: currentTenant.id,
          page,
          historyDays,
          instanceId: brokerInst?.zapiInstanceId || brokerInst?.id,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const existingKeys = new Set(prev.map(m => `${m.conversationId}-${m.senderType}-${(m.content || '').trim()}`));

          const newOnes = data.messages.filter((m: Message) => {
            if (existingIds.has(m.id)) return false;
            const key = `${m.conversationId}-${m.senderType}-${(m.content || '').trim()}`;
            if (existingKeys.has(key)) return false;
            return true;
          });

          if (newOnes.length === 0) return prev;
          const merged = deduplicateMessages([...prev, ...newOnes]);
          try {
            localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    } catch (err) {
      console.warn('Erro ao carregar histórico Z-API:', err);
    }
  };

  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState(false);
  const [activeSyncJob, setActiveSyncJob] = useState<{
    id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    pagesScanned: number;
    totalChatsFound: number;
    contactsImported: number;
    currentStepText: string;
    error?: string;
  } | null>(null);

  const startBackgroundSync = async (options?: { historyDays?: number; importMode?: 'CHATS' | 'PHONEBOOK' | 'ALL' }): Promise<string | null> => {
    try {
      const brokerInst = instances.find(i => i.assignedUserId === currentUser.id) || instances[0];
      const res = await fetch('/api/v1/zapi/background-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: brokerInst?.zapiInstanceId || brokerInst?.id,
          historyDays: options?.historyDays ?? 0,
          importMode: options?.importMode ?? 'CHATS',
        }),
      });
      const data = await res.json();
      if (data.success && data.job) {
        setActiveSyncJob(data.job);
        return data.job.id;
      }
    } catch (err) {
      console.error('Falha ao disparar sincronização em background:', err);
    }
    return null;
  };

  const dismissSyncJob = () => {
    setActiveSyncJob(null);
  };

  // Monitoramento Não-Intrusivo do Job de Sincronização em Segundo Plano
  useEffect(() => {
    if (!activeSyncJob || (activeSyncJob.status !== 'RUNNING' && activeSyncJob.status !== 'PENDING')) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/zapi/background-sync?jobId=${activeSyncJob.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.job) {
          setActiveSyncJob(data.job);

          // Quando o job termina, aplica imediatamente os contatos, conversas e mensagens gerados
          if (data.job.status === 'COMPLETED') {
            try {
              if (Array.isArray(data.job.resultContacts) && data.job.resultContacts.length > 0) {
                const validContacts = data.job.resultContacts.filter((c: Contact) => 
                  isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt })
                );
                setContacts(prev => {
                  const combined = deduplicateContactList([...validContacts, ...prev]);
                  try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(combined)); } catch {}
                  return combined;
                });
              }

              if (Array.isArray(data.job.resultConversations) && data.job.resultConversations.length > 0) {
                const validConvs = data.job.resultConversations.filter((c: Conversation) => 
                  isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt })
                );
                setConversations(prev => {
                  const map = new Map(prev.map(c => [c.id, c]));
                  validConvs.forEach((c: Conversation) => {
                    const old = map.get(c.id) || prev.find(x => x.contactId === c.contactId);
                    if (old) {
                      map.set(old.id, {
                        ...old,
                        ...c,
                        lastMessagePreview: c.lastMessagePreview || old.lastMessagePreview,
                        lastMessageAt: c.lastMessageAt || old.lastMessageAt,
                      });
                    } else {
                      map.set(c.id, c);
                    }
                  });
                  const sorted = Array.from(map.values()).sort((a, b) => 
                    parseWhatsAppTimestamp(b.lastMessageAt) - parseWhatsAppTimestamp(a.lastMessageAt)
                  );
                  try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(sorted)); } catch {}
                  return sorted;
                });
              }

              if (Array.isArray(data.job.resultMessages) && data.job.resultMessages.length > 0) {
                setMessages(prev => {
                  const existingIds = new Set(prev.map(m => m.id));
                  const newMsgs = data.job.resultMessages.filter((m: Message) => !existingIds.has(m.id));
                  const combined = [...prev, ...newMsgs];
                  try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(combined)); } catch {}
                  return combined;
                });
              }
            } catch (mergeErr) {
              console.error('Erro ao atualizar estado local pós-sync:', mergeErr);
            }
          }
        }
      } catch (err) {
        console.error('Erro no polling de background sync:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeSyncJob?.id, activeSyncJob?.status]);

  const syncWhatsAppChats = async (targetInstanceId?: string, historyDays = 15): Promise<{ success: boolean; count: number }> => {
    try {
      setIsSyncingWhatsApp(true);
      const chosenInst = targetInstanceId 
        ? instances.find(i => i.id === targetInstanceId || i.zapiInstanceId === targetInstanceId)
        : (instances.find(i => i.assignedUserId === currentUser.id) || instances[0]);

      const res = await fetch('/api/v1/zapi/sync-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: chosenInst?.zapiInstanceId || chosenInst?.id,
          tenantId: currentTenant.id,
          assignedUserId: chosenInst?.assignedUserId || currentUser.id,
          fetchHistoryMessages: true,
          historyDays,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (Array.isArray(data.contacts) && data.contacts.length > 0) {
          const validIncoming = data.contacts.filter((c: Contact) => isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt }));
          // Merge e higienização completa de contatos com resolução de LID para telefone real
          setContacts(prev => {
            const cleanPrev = prev.filter(c => isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt }));
            const combined = [...cleanPrev, ...validIncoming];
            const deduplicated = deduplicateContactList(combined);
            try {
              localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduplicated));
            } catch {}
            return deduplicated;
          });
        }

        // 2. Merge de Conversas
        let finalConversations: Conversation[] = [];
        if (Array.isArray(data.conversations)) {
          const validConvs = data.conversations.filter((c: Conversation) => isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt }));
          setConversations(prev => {
            const cleanPrev = prev.filter(c => isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt }));
            const map = new Map(cleanPrev.map(c => [c.id, c]));
            validConvs.forEach((c: Conversation) => {
              const old = map.get(c.id) || cleanPrev.find(x => x.contactId === c.contactId);
              if (old) {
                map.set(old.id, {
                  ...old,
                  ...c,
                  lastMessagePreview: c.lastMessagePreview || old.lastMessagePreview,
                  lastMessageAt: c.lastMessageAt || old.lastMessageAt,
                });
              } else {
                map.set(c.id, c);
              }
            });
            const result = Array.from(map.values()).sort((a, b) => {
              return parseWhatsAppTimestamp(b.lastMessageAt) - parseWhatsAppTimestamp(a.lastMessageAt);
            });
            finalConversations = result;
            try {
              localStorage.setItem('vanguard_crm_conversations', JSON.stringify(result));
            } catch {}
            return result;
          });
        }

        // 3. Merge de Mensagens (NUNCA apaga mensagens!)
        let finalMessages: Message[] = [];
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = data.messages.filter((m: Message) => !existingIds.has(m.id));
            const merged = deduplicateMessages([...prev, ...newOnes]);
            finalMessages = merged;
            try {
              localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // 4. Sincroniza Snapshot com a API de Estado do Servidor
        try {
          fetch('/api/v1/crm/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contacts: data.contacts,
              conversations: finalConversations,
              messages: finalMessages,
            }),
          }).catch(() => {});
        } catch {}

        setActiveConversationId(prev => prev ? prev : (data.conversations?.[0]?.id || null));
        return { success: true, count: data.contacts?.length || 0 };
      }
      return { success: true, count: 0 };
    } catch (err) {
      console.error('Erro ao sincronizar conversas:', err);
      return { success: false, count: 0 };
    } finally {
      setIsSyncingWhatsApp(false);
    }
  };

  const syncZapiInstance = (instanceId: string, phone?: string) => {
    setInstances(prev => {
      let changed = false;
      const updated = prev.map(i => {
        if (i.id === instanceId || i.zapiInstanceId === instanceId) {
          if (i.status !== 'CONNECTED' || (phone && i.phoneNumber !== phone)) {
            changed = true;
            return {
              ...i,
              status: 'CONNECTED' as const,
              phoneNumber: phone || i.phoneNumber,
              lastSyncAt: new Date().toISOString()
            };
          }
        }
        return i;
      });
      if (changed) {
        try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
        return updated;
      }
      return prev;
    });
  };

  const resetCRMDatabase = async (resyncAfter = true): Promise<{ success: boolean; message: string }> => {
    try {
      setIsSyncingWhatsApp(true);
      // 1. Limpa o servidor via endpoint dedicado
      await fetch('/api/v1/crm/reset', { method: 'POST' }).catch(() => {});

      // 2. Limpa estados no frontend
      setContacts([]);
      setConversations([]);
      setMessages([]);
      setDeals([]);
      setActiveConversationId(null);

      // 3. Limpa chaves do localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('vanguard_crm_contacts');
          localStorage.removeItem('vanguard_crm_conversations');
          localStorage.removeItem('vanguard_crm_messages');
          localStorage.removeItem('vanguard_crm_deals');
          localStorage.removeItem('vanguard_crm_ai_insights');
          localStorage.removeItem('vanguard_crm_active_conv_id');
        } catch {}
      }

      // 4. Se solicitado, resincroniza imediatamente o WhatsApp de forma 100% limpa
      if (resyncAfter) {
        await syncWhatsAppChats();
      }

      return {
        success: true,
        message: 'Base de dados resetada com sucesso e sincronização limpa concluída.',
      };
    } catch (err: any) {
      console.error('Erro ao resetar base do CRM:', err);
      return {
        success: false,
        message: err.message || 'Falha ao resetar base de dados.',
      };
    } finally {
      setIsSyncingWhatsApp(false);
    }
  };

  const importWhatsAppBatch = (payload: { contacts: Contact[]; conversations: Conversation[]; messages: Message[] }) => {
    if (payload.contacts && payload.contacts.length > 0) {
      setContacts(prev => {
        const combined = [...prev, ...payload.contacts];
        const deduplicated = deduplicateContactList(combined);
        try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduplicated)); } catch {}
        return deduplicated;
      });
    }

    if (payload.conversations && payload.conversations.length > 0) {
      setConversations(prev => {
        const map = new Map(prev.map(c => [c.id, c]));
        payload.conversations.forEach((c: Conversation) => {
          const old = map.get(c.id) || prev.find(x => x.contactId === c.contactId);
          if (old) {
            map.set(old.id, {
              ...c,
              ...old,
              lastMessagePreview: old.lastMessagePreview || c.lastMessagePreview,
              lastMessageAt: old.lastMessageAt || c.lastMessageAt,
            });
          } else {
            map.set(c.id, c);
          }
        });
        const result = Array.from(map.values());
        try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(result)); } catch {}
        return result;
      });
    }

    if (payload.messages && payload.messages.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = payload.messages.filter((m: Message) => !existingIds.has(m.id));
        const merged = deduplicateMessages([...prev, ...newOnes]);
        try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged)); } catch {}
        return merged;
      });
    }
  };

  const importFileContacts = (records: any[], assignedBrokerId?: string, createDeals = true): { count: number } => {
    if (!Array.isArray(records) || records.length === 0) return { count: 0 };

    const newContacts: Contact[] = [];
    const newDeals: Deal[] = [];

    records.forEach((rec) => {
      const clean = (rec.phone || '').replace(/\D/g, '');
      if (!clean || clean.length < 8) return;

      const contactId = `contact-file-${clean}`;
      const newContact: Contact = {
        id: contactId,
        tenantId: currentTenant.id,
        name: rec.name || `Lead ${rec.phone}`,
        phone: rec.phone,
        email: rec.email,
        assignedUserId: assignedBrokerId || currentUser.id,
        source: (rec.source as any) || 'IMPORT_CSV',
        temperature: (rec.temperature as any) || 'WARM',
        aiPriorityScore: 75,
        tags: Array.from(new Set(['Importação de Arquivo', ...(rec.tags || [])])),
        notesCount: rec.notes ? 1 : 0,
        consentGiven: true,
        consentDate: new Date().toISOString(),
        hasOptedOut: false,
        monthlyIncome: rec.monthlyIncome,
        downPaymentAvailable: rec.downPaymentAvailable,
        maxPropertyValue: rec.maxPropertyValue,
        preferredPropertyType: rec.preferredPropertyType,
        targetRegions: rec.targetRegions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newContacts.push(newContact);

      if (createDeals && currentPipeline?.stages?.[0]) {
        const firstStage = currentPipeline.stages[0];
        newDeals.push({
          id: `deal-${Date.now()}-${clean.slice(-4)}`,
          tenantId: currentTenant.id,
          contactId,
          pipelineId: currentPipeline.id,
          stageId: firstStage.id,
          title: `Interesse • ${newContact.name}`,
          expectedValue: Number(rec.maxPropertyValue) || 650000,
          manualProbability: 40,
          aiProbabilityScore: 50,
          status: 'OPEN',
          assignedUserId: assignedBrokerId || currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    if (newContacts.length > 0) {
      setContacts(prev => {
        const combined = [...prev, ...newContacts];
        const deduplicated = deduplicateContactList(combined);
        try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduplicated)); } catch {}
        return deduplicated;
      });
    }

    if (newDeals.length > 0) {
      setDeals(prev => {
        const updated = [...prev, ...newDeals];
        try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }

    return { count: newContacts.length };
  };

  // Consulta e atualiza o status de conexão da Z-API em tempo real
  const refreshLiveZapiStatus = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/v1/zapi/status');
      const data = await res.json();
      if (data.success && data.connected) {
        setInstances(prev => {
          const updated = prev.map(i => ({
            ...i,
            status: 'CONNECTED' as const,
            phoneNumber: data.phone || i.phoneNumber,
            lastSyncAt: new Date().toISOString()
          }));
          try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
          return updated;
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Checa status de conexão da Z-API ao carregar e periodicamente
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      if (!isMounted) return;
      await refreshLiveZapiStatus();
    };

    checkStatus();
    const interval = setInterval(checkStatus, 25000);
    return () => { 
      isMounted = false; 
      clearInterval(interval);
    };
  }, []);

  // Polling contínuo de novos eventos e mensagens do Webhook Z-API em tempo real (a cada 2.5s)
  const lastPollTimeRef = useRef<number>(Date.now() - 60000);

  useEffect(() => {
    const pollWebhookMessages = async () => {
      try {
        const res = await fetch('/api/v1/webhooks/zapi/events');
        const data = await res.json();

        if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          data.messages.forEach((incoming: any) => {
            if (isWhatsAppChannelOrGroup(incoming)) return;
            const rawPhone = incoming.phone.replace(/\D/g, '');
            const phoneSuffix = rawPhone.length >= 8 ? rawPhone.slice(-8) : rawPhone;
            const formattedPhone = incoming.phone.startsWith('+') ? incoming.phone : `+${incoming.phone}`;

            // 1. Encontra ou cria contato
            setContacts(prevContacts => {
              const pKey = normalizePhoneKey(rawPhone);
              const existing = prevContacts.find(c => {
                const cPKey = normalizePhoneKey(c.phone);
                if (cPKey && pKey && (cPKey === pKey || cPKey.endsWith(pKey) || pKey.endsWith(cPKey))) return true;
                if (phoneSuffix && c.phone.replace(/\D/g, '').endsWith(phoneSuffix)) return true;
                return false;
              });

              if (existing) {
                return prevContacts.map(c => c.id === existing.id ? {
                  ...c,
                  name: (existing.name && !existing.name.startsWith('WhatsApp') && !existing.name.startsWith('+') && existing.name !== 'Cliente') ? existing.name : (incoming.senderName || existing.name),
                  avatarUrl: incoming.senderPhoto || c.avatarUrl,
                  lastClientInteractionAt: incoming.timestamp || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } : c);
              }

              const newContact: Contact = {
                id: `contact-zapi-${rawPhone}`,
                tenantId: currentTenant.id,
                name: incoming.senderName || `WhatsApp ${rawPhone.slice(-4)}`,
                phone: formattedPhone,
                avatarUrl: incoming.senderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(incoming.senderName || 'Cliente')}&background=059669&color=fff`,
                source: 'WHATSAPP',
                temperature: 'HOT',
                aiPriorityScore: 85,
                tags: ['Novo Lead WhatsApp', 'Z-API Live'],
                targetRegions: [],
                notesCount: 0,
                consentGiven: true,
                hasOptedOut: false,
                lastClientInteractionAt: incoming.timestamp || new Date().toISOString(),
                lastTeamInteractionAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              return [newContact, ...prevContacts];
            });

            // Localiza a linha/instância e o corretor correspondente
            const matchingInst = instances.find(i => 
              i.zapiInstanceId === incoming.instanceId || 
              i.id === incoming.instanceId ||
              (i.phoneNumber && incoming.phone && i.phoneNumber.replace(/\D/g, '') === incoming.phone.replace(/\D/g, ''))
            );
            const assignedBroker = matchingInst?.assignedUserId 
              ? users.find(u => u.id === matchingInst.assignedUserId)
              : undefined;

            // 2. Atualiza ou cria a conversa
            setConversations(prevConvs => {
              const existingConv = prevConvs.find(c => {
                if (c.id === `conv-zapi-${rawPhone}`) return true;
                if (c.contactId === `contact-zapi-${rawPhone}`) return true;
                const cDigits = (c.contactId?.replace(/\D/g, '') || '') + (c.id.replace(/\D/g, '') || '');
                if (cDigits && phoneSuffix && cDigits.includes(phoneSuffix)) return true;
                return false;
              });

              if (existingConv) {
                const updated = prevConvs.map(c => c.id === existingConv.id ? {
                  ...c,
                  assignedUserId: c.assignedUserId || matchingInst?.assignedUserId,
                  lastMessagePreview: incoming.content,
                  lastMessageAt: incoming.timestamp || new Date().toISOString(),
                  status: incoming.fromMe ? ('PENDING_CLIENT' as const) : ('PENDING_TEAM' as const),
                  unreadCount: incoming.fromMe ? 0 : (c.unreadCount || 0) + 1,
                  slaBreached: false,
                } : c).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
                try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
                return updated;
              }

              const newConv: Conversation = {
                id: `conv-zapi-${rawPhone}`,
                tenantId: currentTenant.id,
                instanceId: incoming.instanceId || matchingInst?.id || instances[0]?.id || '3F8144490C66805B4E3FD64A35E2F2DC',
                contactId: `contact-zapi-${rawPhone}`,
                assignedUserId: matchingInst?.assignedUserId,
                status: incoming.fromMe ? ('PENDING_CLIENT' as const) : ('PENDING_TEAM' as const),
                unreadCount: incoming.fromMe ? 0 : 1,
                lastMessagePreview: incoming.content,
                lastMessageAt: incoming.timestamp || new Date().toISOString(),
                slaBreached: false,
              };
              const updated = [newConv, ...prevConvs].sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
              try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
              return updated;
            });

            // 3. Adiciona a mensagem em setMessages com ID unificado
            const mType: MessageType = incoming.mediaType === 'audio' 
              ? 'AUDIO' 
              : incoming.mediaType === 'image' 
                ? 'IMAGE' 
                : incoming.mediaType === 'document' 
                  ? 'DOCUMENT' 
                  : 'TEXT';

            const newMsg: Message = {
              id: incoming.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              tenantId: currentTenant.id,
              conversationId: `conv-zapi-${rawPhone}`,
              senderType: incoming.fromMe ? 'USER' : 'CONTACT',
              senderUserId: incoming.fromMe ? (assignedBroker?.id || currentUser.id) : undefined,
              senderName: incoming.fromMe ? (assignedBroker?.name || currentUser.name || 'Corretor') : incoming.senderName,
              messageType: mType,
              attachments: incoming.mediaUrl ? [{
                id: `att-${Date.now()}`,
                url: incoming.mediaUrl,
                fileName: incoming.fileName || (incoming.mediaType === 'audio' ? 'Mensagem de Voz.ogg' : incoming.mediaType === 'image' ? 'Foto.jpg' : 'Documento.pdf'),
                fileSize: incoming.fileSize || 1024,
                mimeType: incoming.mimeType || (incoming.mediaType === 'audio' ? 'audio/ogg' : incoming.mediaType === 'image' ? 'image/jpeg' : 'application/pdf'),
              }] : undefined,
              content: incoming.content,
              status: 'DELIVERED',
              isInternalNote: false,
              timestamp: incoming.timestamp || new Date().toISOString(),
            };

            setMessages(prevMsgs => {
              // 1. Evita duplicata se o ID for idêntico
              if (prevMsgs.some(m => m.id === newMsg.id)) return prevMsgs;

              // 2. Se for mensagem enviada (fromMe = true), verifica se já enviamos no portal
              if (incoming.fromMe) {
                const isAlreadyPresent = prevMsgs.some(m =>
                  m.senderType === 'USER' &&
                  (m.content || '').trim() === (newMsg.content || '').trim() &&
                  Math.abs(new Date(m.timestamp || 0).getTime() - new Date(newMsg.timestamp || 0).getTime()) < 60000
                );
                if (isAlreadyPresent) return prevMsgs;
              }

              // 3. Evita duplicatas gerais de mesmo conteúdo e mesmo remetente em menos de 60s
              const isDuplicateContent = prevMsgs.some(m =>
                m.senderType === newMsg.senderType &&
                (m.content || '').trim() === (newMsg.content || '').trim() &&
                Math.abs(new Date(m.timestamp || 0).getTime() - new Date(newMsg.timestamp || 0).getTime()) < 60000
              );
              if (isDuplicateContent) return prevMsgs;

              const updated = [...prevMsgs, newMsg];
              try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(updated)); } catch {}
              return updated;
            });
          });
        }
      } catch {}
    };

    const interval = setInterval(pollWebhookMessages, 2000);

    // Sincronização em segundo plano de novas mensagens e status de clientes a cada 5s
    const syncInterval = setInterval(async () => {
      try {
        const chosenInst = instances.find(i => i.assignedUserId === currentUser.id) || instances[0];
        const res = await fetch('/api/v1/zapi/sync-chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: chosenInst?.zapiInstanceId || '3F8144490C66805B4E3FD64A35E2F2DC',
            tenantId: currentTenant.id,
            assignedUserId: chosenInst?.assignedUserId || currentUser.id,
            fetchHistoryMessages: false,
          }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(prev => {
            const seenIds = new Set(prev.map(m => m.id));
            const newOnes = data.messages.filter((m: any) => {
              if (seenIds.has(m.id)) return false;
              const isEcho = prev.some(existing => 
                existing.senderType === m.senderType &&
                (existing.content || '').trim() === (m.content || '').trim() &&
                Math.abs(new Date(existing.timestamp || 0).getTime() - new Date(m.timestamp || 0).getTime()) < 60000
              );
              return !isEcho;
            });
            if (newOnes.length === 0) return prev;
            const updated = [...prev, ...newOnes];
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(updated)); } catch {}
            return updated;
          });
        }

        if (data.success && Array.isArray(data.conversations) && data.conversations.length > 0) {
          setConversations(prev => {
            const mapById = new Map<string, Conversation>();
            prev.forEach(c => mapById.set(c.id, c));
            data.conversations.forEach((newC: Conversation) => {
              const existing = mapById.get(newC.id);
              if (existing) {
                mapById.set(newC.id, {
                  ...existing,
                  lastMessagePreview: newC.lastMessagePreview || existing.lastMessagePreview,
                  lastMessageAt: newC.lastMessageAt || existing.lastMessageAt,
                  unreadCount: newC.unreadCount !== undefined ? newC.unreadCount : existing.unreadCount,
                  status: newC.status || existing.status,
                });
              } else {
                mapById.set(newC.id, newC);
              }
            });
            const updated = Array.from(mapById.values()).sort((a, b) => {
              const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return timeB - timeA;
            });
            try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
            return updated;
          });
        }

        // Ingestão imediata de atualizações enviadas pela extensão para o servidor
        try {
          const stateRes = await fetch('/api/v1/crm/state');
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            if (stateData.success && Array.isArray(stateData.messages) && stateData.messages.length > 0) {
              setMessages(prev => {
                const merged = deduplicateMessages([...prev, ...stateData.messages]);
                if (merged.length !== prev.length) {
                  try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged)); } catch {}
                  return merged;
                }
                return prev;
              });
            }
          }
        } catch {}
      } catch {}
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [currentTenant.id, instances]);

  // -------------------------------------------------------------
  // PROPOSTAS COMERCIAIS & ACEITE DIGITAL
  // -------------------------------------------------------------
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_proposals');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed.filter((p: Proposal) => p.tenantId !== 'tenant-vanguard-01');
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_PROPOSALS;
  });

  const createProposal = async (data: Partial<Proposal>): Promise<Proposal> => {
    const total = data.totalValue || 1000000;
    const commPercent = data.brokerCommissionPercent !== undefined ? data.brokerCommissionPercent : 50;
    const totalCommission = total * 0.06; // Padrão 6% de corretagem
    const brokerVal = (totalCommission * commPercent) / 100;
    const agencyVal = totalCommission - brokerVal;

    const propId = `prop-${Date.now()}`;
    const asaasPayId = `pay_asaas_${Date.now().toString(36)}`;
    const newProposal: Proposal = {
      id: propId,
      tenantId: currentTenant.id,
      dealId: data.dealId,
      contactId: data.contactId || 'contact-01',
      contactName: data.contactName || 'Cliente Proposta',
      contactPhone: data.contactPhone || '+55 11 99999-0000',
      assignedUserId: data.assignedUserId || currentUser.id,
      propertyName: data.propertyName || 'Empreendimento Exclusivo',
      unit: data.unit || 'Unidade Principal',
      propertyAddress: data.propertyAddress || 'Endereço Nobre',
      totalValue: total,
      downPayment: data.downPayment || total * 0.2,
      downPaymentMethod: data.downPaymentMethod || 'PIX',
      installmentCount: data.installmentCount || 36,
      installmentValue: data.installmentValue || ((total * 0.5) / (data.installmentCount || 36)),
      baloonValue: data.baloonValue || 0,
      baloonCount: data.baloonCount || 0,
      bankFinancingValue: data.bankFinancingValue || (total * 0.3),
      brokerCommissionPercent: commPercent,
      brokerCommissionValue: brokerVal,
      agencyCommissionValue: agencyVal,
      status: 'SENT',
      notes: data.notes || '',
      asaasPaymentId: asaasPayId,
      asaasInvoiceUrl: `https://sandbox.asaas.com/i/${Date.now()}`,
      asaasQrCode: `00020126580014br.gov.bcb.pix0136${Date.now()}5204000053039865409${(data.downPayment || 10000).toFixed(2)}5802BR5922${encodeURIComponent(currentTenant.name)}6009Sao Paulo62070503***6304ABCD`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      ...data,
    };

    setProposals(prev => {
      const updated = [newProposal, ...prev];
      try { localStorage.setItem('vanguard_crm_proposals', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Registra transação pendente do sinal de entrada no financeiro
    if (newProposal.downPayment > 0) {
      createFinancialTransaction({
        proposalId: newProposal.id,
        dealId: newProposal.dealId,
        contactId: newProposal.contactId,
        contactName: newProposal.contactName,
        description: `Sinal de Entrada - ${newProposal.unit || ''} (${newProposal.propertyName})`,
        amount: newProposal.downPayment,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'PENDING',
        type: 'PROPERTY_PAYMENT',
        category: 'ENTRADA',
        paymentMethod: newProposal.downPaymentMethod,
        asaasPaymentId: asaasPayId,
        asaasInvoiceUrl: newProposal.asaasInvoiceUrl,
      });
    }

    return newProposal;
  };

  const updateProposal = (proposalId: string, updates: Partial<Proposal>) => {
    setProposals(prev => {
      const updated = prev.map(p => p.id === proposalId ? { ...p, ...updates } : p);
      try { localStorage.setItem('vanguard_crm_proposals', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteProposal = (proposalId: string) => {
    setProposals(prev => {
      const updated = prev.filter(p => p.id !== proposalId);
      try { localStorage.setItem('vanguard_crm_proposals', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const acceptProposal = async (proposalId: string, clientIp?: string): Promise<Proposal> => {
    const prop = proposals.find(p => p.id === proposalId);
    const acceptedAt = new Date().toISOString();
    const updatedProp: Proposal = prop ? {
      ...prop,
      status: 'ACCEPTED',
      clientAcceptedAt: acceptedAt,
      clientIp: clientIp || '189.40.72.115',
    } : ({} as Proposal);

    setProposals(prev => {
      const updated = prev.map(p => p.id === proposalId ? updatedProp : p);
      try { localStorage.setItem('vanguard_crm_proposals', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Baixa a transação de sinal no financeiro
    setTransactions(prev => {
      const updated = prev.map(tx => tx.proposalId === proposalId && tx.category === 'ENTRADA' ? {
        ...tx,
        status: 'PAID' as TransactionStatus,
        paidAt: acceptedAt,
      } : tx);
      try { localStorage.setItem('vanguard_crm_transactions', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Lança comissão do corretor no financeiro
    if (prop && prop.brokerCommissionValue > 0) {
      const brokerUser = users.find(u => u.id === prop.assignedUserId);
      createFinancialTransaction({
        proposalId: prop.id,
        dealId: prop.dealId,
        contactId: prop.contactId,
        contactName: prop.contactName,
        description: `Comissão Corretor - ${brokerUser?.name || 'Corretor'} (${prop.brokerCommissionPercent}% de 6%)`,
        amount: prop.brokerCommissionValue,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'PAID',
        type: 'COMMISSION_PAYOUT',
        category: 'COMISSAO_CORRETOR',
        paymentMethod: 'PIX',
        recipientUserId: prop.assignedUserId,
        recipientName: brokerUser?.name,
      });
    }

    // Se houver Deal vinculado, move para estágio 7 ou 8 (Contrato / Fechado)
    if (prop?.dealId) {
      moveDealStage(prop.dealId, 'stage-07');
    }

    return updatedProp;
  };

  // -------------------------------------------------------------
  // GESTÃO FINANCEIRA & TRANSAÇÕES (INTEGRAÇÃO ASAAS)
  // -------------------------------------------------------------
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_transactions');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed.filter((t: FinancialTransaction) => t.tenantId !== 'tenant-vanguard-01');
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_FINANCIAL_TRANSACTIONS;
  });

  const createFinancialTransaction = (txData: Partial<FinancialTransaction>): FinancialTransaction => {
    const newTx: FinancialTransaction = {
      id: `tx-${Date.now()}`,
      tenantId: currentTenant.id,
      description: txData.description || 'Lançamento Financeiro',
      amount: txData.amount || 0,
      dueDate: txData.dueDate || new Date().toISOString().split('T')[0],
      status: txData.status || 'PENDING',
      type: txData.type || 'PROPERTY_PAYMENT',
      category: txData.category || 'PARCELA',
      paymentMethod: txData.paymentMethod || 'PIX',
      createdAt: new Date().toISOString(),
      ...txData,
    };

    setTransactions(prev => {
      const updated = [newTx, ...prev];
      try { localStorage.setItem('vanguard_crm_transactions', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newTx;
  };

  const updateFinancialTransaction = (txId: string, updates: Partial<FinancialTransaction>) => {
    setTransactions(prev => {
      const updated = prev.map(t => t.id === txId ? { ...t, ...updates } : t);
      try { localStorage.setItem('vanguard_crm_transactions', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const markTransactionPaid = (txId: string, paymentMethod?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'TRANSFER') => {
    const now = new Date().toISOString();
    setTransactions(prev => {
      const updated = prev.map(t => t.id === txId ? {
        ...t,
        status: 'PAID' as TransactionStatus,
        paidAt: now,
        paymentMethod: paymentMethod || t.paymentMethod,
      } : t);
      try { localStorage.setItem('vanguard_crm_transactions', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const syncAsaasTransactions = async () => {
    await new Promise(r => setTimeout(r, 600));
  };

  // -------------------------------------------------------------
  // PORTAL SAAS MASTER (GESTÃO GLOBAL)
  // -------------------------------------------------------------
  const [saasPlans, setSaasPlans] = useState<SaaSPlan[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_saas_plans');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return MOCK_SAAS_PLANS;
  });

  const createSaaSPlan = (planData: Partial<SaaSPlan>): SaaSPlan => {
    const newPlan: SaaSPlan = {
      id: `plan-${Date.now()}`,
      name: planData.name || 'Novo Plano SaaS',
      slug: planData.slug || 'custom',
      monthlyPrice: planData.monthlyPrice || 990.00,
      annualPrice: planData.annualPrice || 9900.00,
      maxBrokers: planData.maxBrokers || 10,
      maxInstances: planData.maxInstances || 2,
      aiCopilotEnabled: planData.aiCopilotEnabled ?? true,
      features: planData.features || ['Recursos Essenciais'],
      isActive: planData.isActive ?? true,
      isPopular: planData.isPopular ?? false,
      ...planData,
    };

    setSaasPlans(prev => {
      const updated = [...prev, newPlan];
      try { localStorage.setItem('vanguard_crm_saas_plans', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newPlan;
  };

  const updateSaaSPlan = (planId: string, updates: Partial<SaaSPlan>) => {
    setSaasPlans(prev => {
      const updated = prev.map(p => p.id === planId ? { ...p, ...updates } : p);
      try { localStorage.setItem('vanguard_crm_saas_plans', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteSaaSPlan = (planId: string) => {
    setSaasPlans(prev => {
      const updated = prev.filter(p => p.id !== planId);
      try { localStorage.setItem('vanguard_crm_saas_plans', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const [masterUsers, setMasterUsers] = useState<MasterUser[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_master_users');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed.filter((u: MasterUser) => u.email?.toLowerCase() === 'rafael@faithhubs.com');
            if (parsed.length > 0) return parsed;
          }
        }
      } catch {}
    }
    return MOCK_MASTER_USERS;
  });

  const createMasterUser = (userData: Partial<MasterUser>): MasterUser => {
    const newUser: MasterUser = {
      id: `master-${Date.now()}`,
      name: userData.name || 'Novo Administrador Master',
      email: userData.email || '',
      phone: userData.phone || '',
      avatarUrl: userData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: userData.role || 'SUPERADMIN_GLOBAL',
      permissions: userData.permissions || ['ALL_PERMISSIONS'],
      isActive: true,
      createdAt: new Date().toISOString(),
      ...userData,
    };

    setMasterUsers(prev => {
      const updated = [...prev, newUser];
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newUser;
  };

  const updateMasterUser = (userId: string, updates: Partial<MasterUser>) => {
    setMasterUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, ...updates } : u);
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteMasterUser = (userId: string) => {
    setMasterUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const [saasApiConfig, setSaasApiConfig] = useState<SaaSApiConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_saas_api_config');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return MOCK_SAAS_API_CONFIG;
  });

  const updateSaaSApiConfig = (updates: Partial<SaaSApiConfig>) => {
    setSaasApiConfig(prev => {
      const updated = { ...prev, ...updates };
      try { localStorage.setItem('vanguard_crm_saas_api_config', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // -------------------------------------------------------------
  // ISOLAMENTO MULTI-TENANCY SEGURO (SEGREGAÇÃO TOTAL POR IMOBILIÁRIA)
  // -------------------------------------------------------------
  const scopedContacts = useMemo(() => {
    return contacts.filter(c => c.tenantId === currentTenant.id);
  }, [contacts, currentTenant.id]);

  const scopedConversations = useMemo(() => {
    return conversations.filter(c => c.tenantId === currentTenant.id);
  }, [conversations, currentTenant.id]);

  const scopedInstances = useMemo(() => {
    return instances.filter(i => i.tenantId === currentTenant.id);
  }, [instances, currentTenant.id]);

  const effectiveActiveInstanceId = useMemo(() => {
    if (activeInstanceId && scopedInstances.some(i => i.id === activeInstanceId)) {
      return activeInstanceId;
    }
    return scopedInstances[0]?.id || '';
  }, [scopedInstances, activeInstanceId]);

  const effectiveActiveConversationId = useMemo(() => {
    if (activeConversationId && scopedConversations.some(c => c.id === activeConversationId)) {
      return activeConversationId;
    }
    return scopedConversations[0]?.id || null;
  }, [scopedConversations, activeConversationId]);

  const scopedDeals = useMemo(() => {
    return deals.filter(d => d.tenantId === currentTenant.id);
  }, [deals, currentTenant.id]);

  const scopedPipelines = useMemo(() => {
    const pipes = pipelines.filter(p => p.tenantId === currentTenant.id);
    if (pipes.length > 0) return pipes;

    const defaultP: Pipeline = {
      id: `pipe-${currentTenant.id}-default`,
      tenantId: currentTenant.id,
      name: 'Funil Geral de Vendas',
      isDefault: true,
      stages: [
        { id: `stage-${currentTenant.id}-1`, pipelineId: `pipe-${currentTenant.id}-default`, name: '1. Novo Lead WhatsApp', order: 1, slaHours: 2, colorHex: '#3b82f6' },
        { id: `stage-${currentTenant.id}-2`, pipelineId: `pipe-${currentTenant.id}-default`, name: '2. Primeiro Contato', order: 2, slaHours: 12, colorHex: '#6366f1' },
        { id: `stage-${currentTenant.id}-3`, pipelineId: `pipe-${currentTenant.id}-default`, name: '3. Em Qualificação', order: 3, slaHours: 24, colorHex: '#8b5cf6' },
        { id: `stage-${currentTenant.id}-4`, pipelineId: `pipe-${currentTenant.id}-default`, name: '4. Visita Agendada', order: 4, slaHours: 48, colorHex: '#d97706' },
        { id: `stage-${currentTenant.id}-5`, pipelineId: `pipe-${currentTenant.id}-default`, name: '5. Proposta em Mesa', order: 5, slaHours: 48, colorHex: '#f59e0b' },
        { id: `stage-${currentTenant.id}-6`, pipelineId: `pipe-${currentTenant.id}-default`, name: '6. Contrato Fechado', order: 6, slaHours: 0, colorHex: '#059669', isWon: true },
        { id: `stage-${currentTenant.id}-7`, pipelineId: `pipe-${currentTenant.id}-default`, name: 'Perdido / Descarte', order: 7, slaHours: 0, colorHex: '#ef4444', isLost: true },
      ]
    };
    return [defaultP];
  }, [pipelines, currentTenant.id]);

  const effectiveCurrentPipeline = useMemo(() => {
    if (currentPipeline && currentPipeline.tenantId === currentTenant.id) {
      return currentPipeline;
    }
    return scopedPipelines[0];
  }, [currentPipeline, scopedPipelines, currentTenant.id]);

  const scopedTasks = useMemo(() => {
    return tasks.filter(t => t.tenantId === currentTenant.id);
  }, [tasks, currentTenant.id]);

  const scopedProposals = useMemo(() => {
    return proposals.filter(p => p.tenantId === currentTenant.id);
  }, [proposals, currentTenant.id]);

  const scopedTransactions = useMemo(() => {
    return transactions.filter(t => t.tenantId === currentTenant.id);
  }, [transactions, currentTenant.id]);

  const scopedCampaigns = useMemo(() => {
    return campaigns.filter(c => c.tenantId === currentTenant.id);
  }, [campaigns, currentTenant.id]);

  const scopedAlerts = useMemo(() => {
    return alerts.filter(a => a.tenantId === currentTenant.id);
  }, [alerts, currentTenant.id]);

  const scopedQuickReplies = useMemo(() => {
    return quickReplies.filter(q => q.tenantId === currentTenant.id);
  }, [quickReplies, currentTenant.id]);

  const getGoalsProgress = (targetMonthKey?: string): GoalsProgressSummary => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const currentPadMonth = String(currentMonthNum).padStart(2, '0');
    const monthKey = targetMonthKey || `${currentYear}-${currentPadMonth}`;

    const [yStr, mStr] = monthKey.split('-');
    const year = Number(yStr) || currentYear;
    const month = Number(mStr) || currentMonthNum;

    const goal: MonthlyGoal = goalsConfig.monthlyGoals[monthKey] || {
      monthKey,
      year,
      month,
      targetMonthlyVGV: 4500000,
      targetWonDealsCount: 4,
      targetLeads: 50,
      targetClients: 35,
      notes: `Meta de performance comercial ${String(month).padStart(2, '0')}/${year}`,
      updatedAt: new Date().toISOString(),
    };

    // 1. VGV e Vendas Fechadas do Mês (apenas contatos comerciais)
    const monthWonDeals = scopedDeals.filter(d => {
      if (d.status !== 'WON') return false;
      const contact = scopedContacts.find(c => c.id === d.contactId);
      if (contact?.isPersonal) return false;
      const dDate = d.closedAt || d.createdAt || d.updatedAt || '';
      return dDate.startsWith(monthKey);
    });

    const monthAchievedVGV = monthWonDeals.reduce((acc, d) => acc + (d.expectedValue || 0), 0);
    const monthWonDealsCount = monthWonDeals.length;

    // 2. Novos Leads criados no Mês (exclui contatos pessoais)
    const monthLeadsCount = scopedContacts.filter(c => {
      if (c.isPersonal) return false;
      const cDate = c.createdAt || c.firstSyncedAt || '';
      return cDate.startsWith(monthKey);
    }).length;

    // 3. Clientes Atendidos no Mês (com conversas ativas ou interações no mês, exclui contatos pessoais)
    const monthClientsCount = scopedConversations.filter(cv => {
      const contact = scopedContacts.find(c => c.id === cv.contactId);
      if (contact?.isPersonal || cv.isPersonal) return false;
      const cvDate = cv.lastMessageAt || '';
      return cvDate.startsWith(monthKey);
    }).length || Math.min(scopedContacts.filter(c => !c.isPersonal).length, Math.max(monthLeadsCount, 1));

    // 4. VGV Acumulado no Ano
    const yearWonDeals = scopedDeals.filter(d => {
      if (d.status !== 'WON') return false;
      const dDate = d.closedAt || d.createdAt || d.updatedAt || '';
      return dDate.startsWith(String(year));
    });
    const annualAchievedVGV = yearWonDeals.reduce((acc, d) => acc + (d.expectedValue || 0), 0);
    const annualTargetVGV = goalsConfig.annualVGVTarget || 50000000;
    const annualPercentage = annualTargetVGV > 0 ? Math.round((annualAchievedVGV / annualTargetVGV) * 100) : 0;
    const annualRemaining = Math.max(0, annualTargetVGV - annualAchievedVGV);

    // Cálculos de Progresso
    const calcItem = (achieved: number, target: number, unit?: string, prefix?: string): GoalProgressItem => {
      const pct = target > 0 ? Math.round((achieved / target) * 100) : 0;
      let status: 'EXCEEDED' | 'ON_TRACK' | 'ATTENTION' | 'CRITICAL' = 'CRITICAL';
      if (pct >= 100) status = 'EXCEEDED';
      else if (pct >= 80) status = 'ON_TRACK';
      else if (pct >= 50) status = 'ATTENTION';

      return {
        target,
        achieved,
        percentage: pct,
        remaining: Math.max(0, target - achieved),
        status,
        unit,
        prefix,
      };
    };

    // 5. Inteligência Preditiva de Funil Imobiliário (Weighted Pipeline Forecast)
    const openDeals = scopedDeals.filter(d => d.status === 'OPEN');
    const pipelineTotalVGV = openDeals.reduce((sum, d) => sum + (d.expectedValue || 0), 0);

    let pipelineWeightedVGV = 0;
    let monthClosableWeightedVGV = 0;

    openDeals.forEach(deal => {
      const val = deal.expectedValue || 0;
      if (val <= 0) return;

      // Probabilidade do negócio e fator de fechamento no mês corrente
      let prob = 20;
      let monthClosureFactor = 0.3;

      if (deal.manualProbability && deal.manualProbability > 0) {
        prob = deal.manualProbability;
        monthClosureFactor = prob >= 70 ? 0.85 : prob >= 40 ? 0.55 : 0.25;
      } else if (deal.aiProbabilityScore && deal.aiProbabilityScore > 0) {
        prob = deal.aiProbabilityScore;
        monthClosureFactor = prob >= 70 ? 0.85 : prob >= 40 ? 0.55 : 0.25;
      } else {
        // Probabilidade padrão do funil imobiliário Sovereign por estágio
        switch (deal.stageId) {
          case 'stage-6': // Proposta em Mesa
            prob = 80;
            monthClosureFactor = 0.90;
            break;
          case 'stage-5': // Visita Agendada
            prob = 50;
            monthClosureFactor = 0.65;
            break;
          case 'stage-4': // Imóveis Apresentados
            prob = 30;
            monthClosureFactor = 0.40;
            break;
          case 'stage-3': // Em Qualificação
            prob = 15;
            monthClosureFactor = 0.20;
            break;
          case 'stage-1': // Novo Lead
          case 'stage-2': // Primeiro Contato
          default:
            prob = 8;
            monthClosureFactor = 0.10;
            break;
        }
      }

      const weightedValue = Math.round(val * (prob / 100));
      pipelineWeightedVGV += weightedValue;
      monthClosableWeightedVGV += Math.round(weightedValue * monthClosureFactor);
    });

    // Run-rate diário do mês
    const isCurrentMonth = monthKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = isCurrentMonth ? Math.max(1, now.getDate()) : new Date(year, month, 0).getDate();
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
    const dailyRunRateVGV = monthAchievedVGV > 0 ? Math.round(monthAchievedVGV / dayOfMonth) : 0;

    // Cálculo da Projeção de Fim de Mês Inteligente:
    let projectedMonthEndVGV = monthAchievedVGV;

    if (isCurrentMonth) {
      if (monthAchievedVGV > 0 && dailyRunRateVGV > 0) {
        // Combinação Híbrida: Realizado + Média Ponderada (Run-Rate Linear dos dias restantes + Funil Ponderado)
        const linearRemaining = dailyRunRateVGV * daysRemaining;
        const closableRemaining = Math.round((linearRemaining * 0.4) + (monthClosableWeightedVGV * 0.6));
        projectedMonthEndVGV = monthAchievedVGV + closableRemaining;
      } else {
        // Início do mês ou sem vendas ainda: Projeção orientada pelo pipeline ponderado fechável
        projectedMonthEndVGV = monthClosableWeightedVGV > 0 
          ? monthClosableWeightedVGV 
          : Math.round(goal.targetMonthlyVGV * 0.6);
      }
    }

    const projectionConfidence: 'HIGH' | 'MEDIUM' | 'ESTIMATED' = 
      openDeals.length >= 5 ? 'HIGH' : openDeals.length >= 2 ? 'MEDIUM' : 'ESTIMATED';

    const monthDateObj = new Date(year, month - 1, 1);
    const rawMonthName = monthDateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

    return {
      monthKey,
      monthName,
      year,
      annualTargetVGV,
      annualAchievedVGV,
      annualPercentage,
      annualRemaining,
      monthlyVGV: calcItem(monthAchievedVGV, goal.targetMonthlyVGV, undefined, 'R$ '),
      wonDeals: calcItem(monthWonDealsCount, goal.targetWonDealsCount, 'contratos'),
      leads: calcItem(monthLeadsCount, goal.targetLeads, 'leads'),
      clients: calcItem(monthClientsCount, goal.targetClients, 'clientes'),
      dailyRunRateVGV,
      projectedMonthEndVGV,
      pipelineTotalVGV,
      pipelineWeightedVGV,
      projectionConfidence,
      projectionMethod: 'WEIGHTED_PIPELINE_HYBRID'
    };
  };

  // -------------------------------------------------------------
  // MOTOR DE INATIVIDADE & PAREAMENTO EMERGENCIAL DE CONTATOS
  // -------------------------------------------------------------
  const getContactUrgencyAnalysis = (
    contactId: string, 
    dealId?: string, 
    conversationId?: string
  ): ContactUrgencyAnalysis | null => {
    const contact = scopedContacts.find(c => c.id === contactId);
    if (!contact || contact.isPersonal) return null;

    const conv = conversationId 
      ? scopedConversations.find(c => c.id === conversationId)
      : scopedConversations.find(c => c.contactId === contactId);

    if (conv?.isPersonal) return null;

    const deal = dealId 
      ? scopedDeals.find(d => d.id === dealId)
      : scopedDeals.find(d => d.contactId === contactId && d.status === 'OPEN');

    const stage = deal ? currentPipeline.stages.find(s => s.id === deal.stageId) : undefined;

    // Busca mensagens da conversa para identificar a última
    const convMessages = conv ? messages.filter(m => m.conversationId === conv.id) : [];
    const lastMsg = convMessages.length > 0 ? convMessages[convMessages.length - 1] : null;

    // Timestamp da última interação
    const lastInteractionDateStr = 
      conv?.lastMessageAt || 
      lastMsg?.timestamp || 
      contact.lastClientInteractionAt || 
      contact.lastTeamInteractionAt || 
      contact.updatedAt || 
      contact.createdAt;

    const lastDate = lastInteractionDateStr ? new Date(lastInteractionDateStr).getTime() : Date.now();
    const nowMs = Date.now();
    const diffMs = Math.max(0, nowMs - lastDate);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Formatação de tempo amigável
    let formattedTimeAgo = 'recentemente';
    if (diffMinutes < 60) {
      formattedTimeAgo = `há ${Math.max(1, diffMinutes)}m`;
    } else if (diffHours < 24) {
      formattedTimeAgo = `há ${diffHours}h`;
    } else if (diffDays === 1) {
      formattedTimeAgo = 'ontem';
    } else {
      formattedTimeAgo = `há ${diffDays}d`;
    }

    // Verifica se a última mensagem foi enviada pelo cliente e não respondida
    const hasUnread = conv ? (conv.unreadCount || 0) > 0 : false;
    const isLastFromContact = lastMsg ? lastMsg.senderType === 'CONTACT' : hasUnread;
    const isUnansweredByTeam = isLastFromContact;
    const unansweredMinutes = isUnansweredByTeam ? diffMinutes : 0;

    let urgencyLevel: InactivityUrgencyLevel = 'HEALTHY';
    let urgencyScore = 10;
    let urgencyReason = 'Interação recente em dia';
    let suggestedAction = 'Acompanhamento normal';

    // REGRA 1: CLIENTE AGUARDANDO RESPOSTA (NO VÁCUO)
    if (isUnansweredByTeam) {
      if (diffHours >= 2) {
        urgencyLevel = 'CRITICAL_UNANSWERED';
        urgencyScore = Math.min(100, 80 + Math.floor(diffHours * 2));
        urgencyReason = `Cliente aguardando resposta da equipe ${formattedTimeAgo}`;
        suggestedAction = 'Responder dúvida no WhatsApp com prioridade máxima';
      } else if (diffMinutes >= 30) {
        urgencyLevel = 'HIGH_STALE_DEAL';
        urgencyScore = 75;
        urgencyReason = `Mensagem nova aguardando retorno (${formattedTimeAgo})`;
        suggestedAction = 'Acolher atendimento com agilidade';
      } else {
        urgencyLevel = 'MEDIUM_FOLLOW_UP';
        urgencyScore = 55;
        urgencyReason = `Aguardando retorno recente (${formattedTimeAgo})`;
        suggestedAction = 'Responder quando possível';
      }
    }
    // REGRA 2: NEGOCIAÇÃO PARADA / ESFRIANDO NO FUNIL
    else if (deal && deal.status === 'OPEN') {
      const isHotStage = stage?.id === 'stage-6' || stage?.id === 'stage-5'; // Proposta em Mesa ou Visita
      if (isHotStage) {
        if (diffHours >= 48) {
          urgencyLevel = 'HIGH_STALE_DEAL';
          urgencyScore = Math.min(95, 70 + diffDays * 5);
          urgencyReason = `${stage?.name || 'Proposta'} sem contato ${formattedTimeAgo}`;
          suggestedAction = 'Cobrar retorno sobre a proposta ou visita agendada';
        } else if (diffHours >= 24) {
          urgencyLevel = 'MEDIUM_FOLLOW_UP';
          urgencyScore = 60;
          urgencyReason = `Negociação quente sem contato há 24h`;
          suggestedAction = 'Enviar mensagem de acompanhamento';
        }
      } else {
        // Estágios de Imóveis Apresentados, Qualificação ou Novo Lead
        if (diffDays >= 7) {
          urgencyLevel = 'HIGH_STALE_DEAL';
          urgencyScore = Math.min(85, 50 + diffDays * 3);
          urgencyReason = `Lead no funil sem interação ${formattedTimeAgo}`;
          suggestedAction = 'Reengajar com nova opção de imóvel ou condições especiais';
        } else if (diffDays >= 4) {
          urgencyLevel = 'MEDIUM_FOLLOW_UP';
          urgencyScore = 50;
          urgencyReason = `Sem contato ${formattedTimeAgo}`;
          suggestedAction = 'Realizar follow-up de rotina';
        }
      }
    }
    // REGRA 3: CONTATO SEM NEGÓCIO ABERTO MAS COM INATIVIDADE PROLONGADA
    else if (diffDays >= 10) {
      urgencyLevel = 'MEDIUM_FOLLOW_UP';
      urgencyScore = 40;
      urgencyReason = `Contato inativo ${formattedTimeAgo}`;
      suggestedAction = 'Disparar oportunidade ou novidade';
    }

    return {
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      conversationId: conv?.id,
      dealId: deal?.id,
      dealTitle: deal?.title,
      dealValue: deal?.expectedValue,
      stageId: stage?.id,
      stageName: stage?.name,
      urgencyLevel,
      urgencyScore,
      isUnansweredByTeam,
      unansweredMinutes,
      hoursSinceLastInteraction: diffHours,
      daysSinceLastInteraction: diffDays,
      formattedTimeAgo,
      urgencyReason,
      suggestedAction,
      assignedUserId: deal?.assignedUserId || contact.assignedUserId,
    };
  };

  const getDealUrgencyAnalysis = (deal: Deal): ContactUrgencyAnalysis => {
    const analysis = getContactUrgencyAnalysis(deal.contactId, deal.id);
    if (analysis) return analysis;

    return {
      contactId: deal.contactId,
      contactName: 'Cliente',
      contactPhone: '',
      dealId: deal.id,
      dealTitle: deal.title,
      dealValue: deal.expectedValue,
      stageId: deal.stageId,
      urgencyLevel: 'HEALTHY',
      urgencyScore: 10,
      isUnansweredByTeam: false,
      unansweredMinutes: 0,
      hoursSinceLastInteraction: 0,
      daysSinceLastInteraction: 0,
      formattedTimeAgo: 'hoje',
      urgencyReason: 'Em dia',
      suggestedAction: 'Acompanhamento normal',
      assignedUserId: deal.assignedUserId,
    };
  };

  const getUrgentContactsRadar = (): ContactUrgencyAnalysis[] => {
    const list: ContactUrgencyAnalysis[] = [];
    const seenContactIds = new Set<string>();

    // 1. Analisa conversas ativas
    scopedConversations.forEach(conv => {
      const analysis = getContactUrgencyAnalysis(conv.contactId, undefined, conv.id);
      if (analysis && analysis.urgencyLevel !== 'HEALTHY') {
        list.push(analysis);
        seenContactIds.add(conv.contactId);
      }
    });

    // 2. Analisa negócios abertos ainda não contemplados
    scopedDeals.forEach(deal => {
      if (deal.status !== 'OPEN') return;
      if (seenContactIds.has(deal.contactId)) return;

      const analysis = getContactUrgencyAnalysis(deal.contactId, deal.id);
      if (analysis && analysis.urgencyLevel !== 'HEALTHY') {
        list.push(analysis);
        seenContactIds.add(deal.contactId);
      }
    });

    return list.sort((a, b) => b.urgencyScore - a.urgencyScore);
  };

  const scopedUsers = useMemo(() => {
    return users.filter(u => 
      u.role === 'SUPERADMIN' || 
      u.role === 'ADMIN_MASTER' || 
      (u.tenantId ? u.tenantId === currentTenant.id : true)
    );
  }, [users, currentTenant.id]);

  return (
    <CRMContext.Provider value={{
      isAuthenticated,
      isAuthReady,
      login,
      logout,
      tenants,
      currentTenant,
      setCurrentTenant,
      updateTenant,
      createTenant,
      updateTenantStatus,
      deleteTenant,
      users: scopedUsers,
      currentUser,
      setCurrentUser,
      updateUser,
      createUser,
      deleteUser,
      resendUserInvite,
      resetUserPassword,
      updateUserAIPersona,
      contacts: scopedContacts,
      addContact,
      updateContact,
      deleteContact,
      toggleContactPersonal,
      addPresentedProperty,
      updatePresentedProperty,
      removePresentedProperty,
      addBrokerNote,
      removeBrokerNote,
      pipelines: scopedPipelines,
      currentPipeline: effectiveCurrentPipeline,
      setCurrentPipeline,
      deals: scopedDeals,
      moveDealStage,
      createDeal,
      updateDeal,
      deleteDeal,
      updatePipelineStages,
      instances: scopedInstances,
      activeInstanceId: effectiveActiveInstanceId,
      setActiveInstanceId,
      createInstance,
      updateInstance,
      deleteInstance,
      refreshLiveZapiStatus,
      transferConversationInstance,
      conversations: scopedConversations,
      activeConversationId: effectiveActiveConversationId,
      setActiveConversationId,
      openChatForContact,
      loadChatHistory,
      messages,
      sendMessage,
      markConversationAsRead,
      clearChatMessages,
      archiveConversation,
      deleteConversation,
      pinConversation,
      assignConversation,
      simulateIncomingMessage,
      aiInsights,
      updateAIInsight,
      applyAIExtractionToContact,
      recordAIFeedback,
      tasks: scopedTasks,
      toggleTask,
      createTask,
      updateTask,
      deleteTask,
      alerts: scopedAlerts,
      dismissAlert,
      campaigns: scopedCampaigns,
      createCampaign,
      quickReplies: scopedQuickReplies,
      proposals: scopedProposals,
      createProposal,
      updateProposal,
      deleteProposal,
      acceptProposal,
      transactions: scopedTransactions,
      createFinancialTransaction,
      updateFinancialTransaction,
      markTransactionPaid,
      syncAsaasTransactions,
      saasPlans,
      createSaaSPlan,
      updateSaaSPlan,
      deleteSaaSPlan,
      masterUsers,
      createMasterUser,
      updateMasterUser,
      deleteMasterUser,
      saasApiConfig,
      updateSaaSApiConfig,
      isSyncingWhatsApp,
      syncWhatsAppChats,
      syncZapiInstance,
      resetCRMDatabase,
      importWhatsAppBatch,
      importFileContacts,
      activeSyncJob,
      startBackgroundSync,
      dismissSyncJob,
      isFeatureEnabled,
      updateTenantFeatureFlags,
      goalsConfig,
      updateMonthlyGoal,
      updateAnnualTarget,
      getGoalsProgress,
      getContactUrgencyAnalysis,
      getDealUrgencyAnalysis,
      getUrgentContactsRadar,
    }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
