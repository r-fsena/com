'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Tenant, 
  TenantStatus,
  User, 
  WhatsAppInstance, 
  Contact, 
  PropertyType,
  PresentedProperty,
  BrokerNote,
  Pipeline, 
  PipelineStage,
  Deal, 
  LossReason,
  LeadSourceGroup,
  LeadSource,
  Conversation, 
  Message, 
  Attachment,
  MessageType,
  AIInsight, 
  Task, 
  SLAAlert, 
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
  MOCK_LOSS_REASONS,
  MOCK_LEAD_SOURCE_GROUPS,
  MOCK_LEAD_SOURCES,
  MOCK_DEALS, 
  MOCK_CONVERSATIONS, 
  MOCK_MESSAGES, 
  MOCK_AI_INSIGHTS, 
  MOCK_TASKS, 
  MOCK_ALERTS, 
  MOCK_QUICK_REPLIES,
  MOCK_PROPOSALS,
  MOCK_FINANCIAL_TRANSACTIONS,
  MOCK_SAAS_PLANS,
  MOCK_MASTER_USERS,
  MOCK_SAAS_API_CONFIG
} from './mock-data';
import { 
  isWhatsAppChannelOrGroup, 
  isRealWhatsAppConversation, 
  canonicalPhoneKey, 
  arePhonesEquivalent, 
  isWhatsAppSystemMessage,
  isLidIdentifier,
  cleanLid,
  formatCanonicalPhone,
  KNOWN_LID_PHONE_MAP,
  resolveKnownPhone
} from '@/lib/whatsapp-filter';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';
import { reconcileIdentities, reconcileMessageHistory, reconcileConversationHistory, tenantSnapshotRecords } from '@/lib/crm-history';
import type { CommercialConfig } from '@/lib/commercial-config';
import { crmEventCursor, mergeSyncedRecords } from '@/lib/crm-event-cursor';
import { reconcileTenantCatalog, catalogTenantForSelection, tenantForAuthenticatedSession, TenantCatalogEntry } from '@/lib/tenant-catalog';

interface CRMContextType {
  // Autenticação & Sessão Cognito
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (email: string, role?: string) => Promise<void>;
  logout: () => void;

  // Gestão de Ambientes SaaS (SuperAdmin) & Tenant
  tenants: Tenant[];
  tenantCatalogLoading: boolean;
  tenantCatalogError: string | null;
  refreshTenantCatalog: () => void;
  currentTenant: Tenant;
  setCurrentTenant: (tenant: Tenant) => void;
  saveCommercialService: (data: Pick<Tenant, 'timezone' | 'businessHours' | 'settings'>) => Promise<void>;
  updateTenant: (updates: Partial<Tenant>) => void;
  updateTenantById: (tenantId: string, updates: Partial<Tenant>) => void;
  createTenant: (tenantData: Partial<Tenant>) => Tenant;
  updateTenantStatus: (tenantId: string, status: TenantStatus) => void;
  deleteTenant: (tenantId: string) => void;
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  createUser: (userData: Partial<User>) => User;
  deleteUser: (userId: string) => void;
  toggleUserStatus: (userId: string) => void;
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
  setCurrentPipelineById: (id: string) => void;
  createPipeline: (data: { name: string; stages?: Partial<PipelineStage>[] }) => Promise<Pipeline>;
  updatePipeline: (id: string, updates: Partial<Pipeline>) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  moveDealToPipeline: (dealId: string, targetPipelineId: string, targetStageId: string) => void;
  deals: Deal[];
  moveDealStage: (dealId: string, targetStageId: string) => void;
  createDeal: (deal: Partial<Deal>) => Deal;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  updatePipelineStages: (stages: PipelineStage[]) => Promise<void>;

  // Motivos de Perda
  lossReasons: LossReason[];
  createLossReason: (data: Omit<LossReason, 'id' | 'tenantId' | 'createdAt'>) => Promise<LossReason>;
  updateLossReason: (id: string, updates: Partial<LossReason>) => Promise<void>;
  deleteLossReason: (id: string) => Promise<void>;

  // Origens & Grupos de Origens de Leads
  leadSourceGroups: LeadSourceGroup[];
  createLeadSourceGroup: (data: Omit<LeadSourceGroup, 'id' | 'tenantId' | 'createdAt'>) => Promise<LeadSourceGroup>;
  updateLeadSourceGroup: (id: string, updates: Partial<LeadSourceGroup>) => Promise<void>;
  deleteLeadSourceGroup: (id: string) => Promise<void>;

  leadSources: LeadSource[];
  createLeadSource: (data: Omit<LeadSource, 'id' | 'tenantId' | 'createdAt'>) => Promise<LeadSource>;
  updateLeadSource: (id: string, updates: Partial<LeadSource>) => Promise<void>;
  deleteLeadSource: (id: string) => Promise<void>;

  // WhatsApp e Mensagens
  instances: WhatsAppInstance[];
  activeInstanceId: string;
  setActiveInstanceId: (id: string) => void;
  createInstance: (data: Partial<WhatsAppInstance>) => WhatsAppInstance;
  updateInstance: (instanceId: string, updates: Partial<WhatsAppInstance>) => void;
  deleteInstance: (instanceId: string) => void;
  refreshLiveZapiStatus: () => Promise<boolean>;
  isZapiConnected: boolean;
  zapiLiveDetails: {
    connected: boolean;
    phone?: string;
    name?: string;
    avatarUrl?: string | null;
    deviceModel?: string;
    battery?: number;
    isBusiness?: boolean;
  } | null;
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
    messageType?: MessageType,
    explicitPhone?: string
  ) => void;
  markConversationAsRead: (conversationId: string) => void;
  clearChatMessages: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string, archive?: boolean) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  toggleConversationAI: (conversationId: string, enabled?: boolean) => void;
  deletedChatKeys: Set<string>;
  pinConversation: (conversationId: string) => Promise<void>;
  assignConversation: (conversationId: string, userId?: string) => void;
  simulateIncomingMessage: (phone: string, name: string, content: string) => void;

  // IA Copiloto
  aiInsights: Record<string, AIInsight>;
  updateAIInsight: (conversationId: string, insight: Partial<AIInsight>) => void;
  applyAIExtractionToContact: (conversationId: string, contactId: string) => void;
  applyBatchAIQualifications: (qualifications: any[]) => void;
  recordAIFeedback: (conversationId: string, feedback: 'ACCEPTED' | 'EDITED' | 'REJECTED') => void;

  // Tarefas e Alertas
  tasks: Task[];
  toggleTask: (taskId: string) => Promise<void>;
  createTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  alerts: SLAAlert[];
  dismissAlert: (alertId: string) => void;

  // Campanhas e Respostas Rápidas
  quickReplies: QuickReplyTemplate[];
  createQuickReply: (template: Omit<QuickReplyTemplate, 'id' | 'tenantId' | 'createdAt'>) => Promise<QuickReplyTemplate>;
  updateQuickReply: (id: string, updates: Partial<QuickReplyTemplate>, expected?: { updatedAt?: string }) => Promise<void>;
  toggleQuickReplyActive: (id: string) => Promise<void>;
  deleteQuickReply: (id: string) => Promise<void>;

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
  toggleMasterUserStatus: (userId: string) => void;
  resendMasterUserInvite: (userId: string) => Promise<{ success: boolean; message: string; inviteLink?: string }>;

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
  return isLidIdentifier(phoneOrId);
}

export function deduplicateContactList(list: Contact[]): Contact[] {
  return reconcileIdentities(list);
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

export const INITIAL_DELETED_CHAT_KEYS: string[] = [];

export function getStoredDeletedChatKeys(): Set<string> {
  const set = new Set<string>(INITIAL_DELETED_CHAT_KEYS);
  const LEGACY_IGNORED_KEYS = new Set([
    '554899797603', '4899797603', '55489797603', 'contact-zapi-554899797603', 'conv-zapi-554899797603',
    '5511915361868', '11915361868', 'contact-zapi-5511915361868', 'conv-zapi-5511915361868',
    '554896290235', '4896290235', '5548996290235', 'contact-zapi-554896290235', 'conv-zapi-554896290235',
  ]);
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('vanguard_crm_deleted_chats');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          let cleanedAny = false;
          arr.forEach((k: any) => {
            const clean = String(k).trim();
            if (clean && !LEGACY_IGNORED_KEYS.has(clean) && !clean.includes('554899797603')) {
              set.add(clean);
            } else {
              cleanedAny = true;
            }
          });
          if (cleanedAny) {
            localStorage.setItem('vanguard_crm_deleted_chats', JSON.stringify(Array.from(set)));
          }
        }
      }
    } catch {}
  }
  return set;
}

export function isChatKeyDeleted(idOrPhone?: string | null, deletedSet?: Set<string>): boolean {
  if (!idOrPhone) return false;
  const set = deletedSet || getStoredDeletedChatKeys();
  const clean = idOrPhone.trim();
  if (set.has(clean)) return true;
  const digits = clean.replace(/\D/g, '');
  if (digits && set.has(digits)) return true;
  if (digits.startsWith('55') && set.has(digits.slice(2))) return true;
  if (!digits.startsWith('55') && digits.length >= 10 && set.has(`55${digits}`)) return true;
  return false;
}

async function fetchCRMState(url: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  const selectedTenant = JSON.parse(localStorage.getItem('vanguard_crm_current_tenant') || '{}').id;
  if (selectedTenant && !headers.has('x-tenant-id')) headers.set('x-tenant-id', selectedTenant);
  options = { ...options, headers };
  if (options?.method === 'POST' && typeof options.body === 'string') {
    const tenantId = new Headers(options.headers).get('x-tenant-id') || JSON.parse(localStorage.getItem('vanguard_crm_current_tenant') || '{}').id;
    const payload = JSON.parse(options.body);
    for (const key of ['contacts', 'conversations', 'messages', 'deals', 'quickReplies']) {
      if (Array.isArray(payload[key])) payload[key] = payload[key].filter((item: any) => item.tenantId === tenantId);
    }
    return fetch(url, { ...options, body: JSON.stringify(payload) });
  }
  return fetch(url, options);
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_tenants');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const seenIds = new Set<string>();
            const cleanList: Tenant[] = [];

            for (const t of parsed) {
              if (!t || !t.id) continue;
              if (t.id === 'tenant-horizonte-02' || t.id === 'tenant-alphaville-03' || t.id === 'tenant-vanguard-01') continue;

              const isAmabile = t.id === 'tenant-amabile-barbarotti' || 
                                t.slug === 'amabile-barbarotti' || 
                                (t.name && t.name.toLowerCase().includes('amabile'));

              if (isAmabile) {
                if (seenIds.has('tenant-amabile-barbarotti')) continue;
                seenIds.add('tenant-amabile-barbarotti');
                cleanList.push({
                  ...t,
                  id: 'tenant-amabile-barbarotti',
                  name: t.name || 'Amábile Barbarotti Imóveis',
                  slug: 'amabile-barbarotti',
                  featureFlags: {
                    ...(t.featureFlags || DEFAULT_FEATURE_FLAGS),
                    proposals: false,
                    asaasBilling: false,
                  },
                });
              } else {
                if (seenIds.has(t.id)) continue;
                seenIds.add(t.id);
                cleanList.push(t);
              }
            }

            if (!seenIds.has('tenant-amabile-barbarotti')) {
              const amabile = MOCK_TENANTS.find(tenant => tenant.slug === 'amabile-barbarotti');
              if (amabile) cleanList.unshift(amabile);
            }

            if (cleanList.length > 0) {
              try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(cleanList)); } catch {}
              return cleanList;
            }
          }
        }
      } catch {}
    }
    return MOCK_TENANTS;
  });
  const [tenantCatalogLoading, setTenantCatalogLoading] = useState(true);
  const [tenantCatalogError, setTenantCatalogError] = useState<string | null>(null);
  const [tenantCatalogRevision, setTenantCatalogRevision] = useState(0);
  const refreshTenantCatalog = useCallback(() => setTenantCatalogRevision(value => value + 1), []);

  const [pipelines, setPipelines] = useState<Pipeline[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_pipelines');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Garante que novos funis padrão do mock sejam mesclados
            const existingIds = new Set(parsed.map((p: Pipeline) => p.id));
            const merged = [...parsed];
            for (const mockP of MOCK_PIPELINES) {
              if (!existingIds.has(mockP.id)) {
                merged.push(mockP);
              }
            }
            return merged.map((p: Pipeline) => {
              const isAmabilePipe = !p.tenantId || p.tenantId === 'tenant-amabile-barbarotti' || p.tenantId.includes('amabile');
              return {
                ...p,
                tenantId: isAmabilePipe ? 'tenant-amabile-barbarotti' : p.tenantId,
              };
            });
          }
        }
      } catch {}
    }
    return MOCK_PIPELINES;
  });

  const [currentPipeline, setCurrentPipeline] = useState<Pipeline>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_pipeline');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.stages) && parsed.stages.length > 0) {
            parsed.tenantId = 'tenant-amabile-barbarotti';
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_PIPELINES[0];
  });

  const [lossReasons, setLossReasons] = useState<LossReason[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_loss_reasons');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return MOCK_LOSS_REASONS;
  });

  const [leadSourceGroups, setLeadSourceGroups] = useState<LeadSourceGroup[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_lead_source_groups');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return MOCK_LEAD_SOURCE_GROUPS;
  });

  const [leadSources, setLeadSources] = useState<LeadSource[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_lead_sources');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return MOCK_LEAD_SOURCES;
  });

  const [currentTenant, setCurrentTenantState] = useState<Tenant>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_tenant');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id !== 'tenant-horizonte-02' && parsed.id !== 'tenant-alphaville-03') {
            const isAmabile = parsed.id === 'tenant-amabile-barbarotti' || 
                              parsed.id === 'tenant-vanguard-01' ||
                              parsed.slug === 'amabile-barbarotti' || 
                              (parsed.name && parsed.name.toLowerCase().includes('amabile'));
            if (isAmabile) {
              parsed.id = 'tenant-amabile-barbarotti';
              parsed.featureFlags = {
                ...(parsed.featureFlags || DEFAULT_FEATURE_FLAGS),
                proposals: false,
                asaasBilling: false,
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

  const setCurrentTenant = (tenantOrFn: Tenant | ((prev: Tenant) => Tenant)) => {
    setCurrentTenantState(prev => {
      const raw = typeof tenantOrFn === 'function' ? tenantOrFn(prev) : tenantOrFn;
      if (!raw) return prev;

      const isAmabile = raw.id === 'tenant-amabile-barbarotti' || raw.slug === 'amabile-barbarotti';
      
      const foundInList = catalogTenantForSelection(raw, tenants) || (isAmabile ? MOCK_TENANTS.find(tenant => tenant.slug === 'amabile-barbarotti') : null);
      const canonicalId = foundInList?.id === `tenant-${raw.slug}` ? foundInList.id : isAmabile ? 'tenant-amabile-barbarotti' : raw.id;

      const resolvedFlags = isAmabile ? {
        ...(foundInList?.featureFlags || raw.featureFlags || DEFAULT_FEATURE_FLAGS),
        proposals: false,
        asaasBilling: false,
      } : {
        ...DEFAULT_FEATURE_FLAGS,
        ...(foundInList?.featureFlags || raw.featureFlags || {}),
      };

      const updated: Tenant = {
        ...raw,
        ...(foundInList || {}),
        id: canonicalId,
        featureFlags: resolvedFlags,
      };

      try {
        localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(updated));
      } catch {}

      // Sincroniza pipeline imediatamente com o tenant selecionado
      const matchingPipes = pipelines.filter(p => p.tenantId === canonicalId);
      if (matchingPipes.length > 0) {
        setCurrentPipeline(matchingPipes[0]);
        try {
          localStorage.setItem('vanguard_crm_current_pipeline', JSON.stringify(matchingPipes[0]));
        } catch {}
      }

      return updated;
    });
  };

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

  const scopedLossReasons = useMemo(() => lossReasons.filter(item => item.tenantId === currentTenant.id), [lossReasons, currentTenant.id]);
  const scopedLeadSourceGroups = useMemo(() => leadSourceGroups.filter(item => item.tenantId === currentTenant.id), [leadSourceGroups, currentTenant.id]);
  const scopedLeadSources = useMemo(() => leadSources.filter(item => item.tenantId === currentTenant.id), [leadSources, currentTenant.id]);
  const commercialRevisions = useRef<Record<string, number>>({});
  const applyCommercialConfig = (tenantId: string, config: CommercialConfig, confirmedWrite = false) => {
    // Keep the editing baseline stable. A remote edit must produce a conflict,
    // not silently refresh the revision underneath an open configuration form.
    if (!confirmedWrite && commercialRevisions.current[tenantId] !== undefined) return;
    if (config.revision < (commercialRevisions.current[tenantId] || 0)) return;
    commercialRevisions.current[tenantId] = config.revision;
    setPipelines(previous => [...previous.filter(item => item.tenantId !== tenantId), ...config.pipelines]);
    setLossReasons(previous => [...previous.filter(item => item.tenantId !== tenantId), ...config.lossReasons]);
    setLeadSources(previous => [...previous.filter(item => item.tenantId !== tenantId), ...config.leadSources]);
    setLeadSourceGroups(previous => [...previous.filter(item => item.tenantId !== tenantId), ...config.leadSourceGroups]);
    setCurrentPipeline(previous => previous.tenantId === tenantId ? config.pipelines.find(item => item.id === previous.id) || config.pipelines[0] || previous : previous);
    if (config.service) {
      setCurrentTenantState(previous => previous.id === tenantId ? { ...previous, ...config.service } : previous);
      setTenants(previous => previous.map(item => item.id === tenantId ? { ...item, ...config.service } : item));
    }
  };
  const saveCommercialCommand = async (command: any) => {
    const tenantId = currentTenant.id;
    const revision = commercialRevisions.current[tenantId] || 0;
    const response = await fetch('/api/v1/commercial', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ ...command, revision, ...(revision === 0 ? { seed: { pipelines: scopedPipelines, lossReasons: scopedLossReasons, leadSources: scopedLeadSources, leadSourceGroups: scopedLeadSourceGroups } } : {}) }) });
    const data = await response.json();
    if (!response.ok || !data.success || data.tenantId !== tenantId) throw new Error(data.error || 'A configuração não foi salva.');
    applyCommercialConfig(tenantId, data.commercial, true);
    return data.commercial as CommercialConfig;
  };
  const saveCommercialService = async (data: Pick<Tenant, 'timezone' | 'businessHours' | 'settings'>) => {
    await saveCommercialCommand({ collection: 'service', operation: 'save', data });
  };

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

  const updateTenantById = (tenantId: string, updates: Partial<Tenant>) => {
    setTenants(prev => {
      const updatedList = prev.map(t => t.id === tenantId ? { ...t, ...updates } : t);
      try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(updatedList)); } catch {}
      return updatedList;
    });
    if (currentTenant && currentTenant.id === tenantId) {
      setCurrentTenant(prev => {
        const updated = { ...prev, ...updates };
        try { localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
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
    if (!currentTenant) return true;
    const isAmabile = currentTenant.id === 'tenant-amabile-barbarotti' || 
                      currentTenant.slug === 'amabile-barbarotti' || 
                      (currentTenant.name && currentTenant.name.toLowerCase().includes('amabile'));

    if (isAmabile) {
      if (feature === 'proposals' || feature === 'asaasBilling' || feature === 'campaigns' || feature === 'automations') {
        return currentTenant.featureFlags?.[feature] === true;
      }
    }

    if (!currentTenant.featureFlags) return true;
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
              u.email?.toLowerCase() === 'amabile.barbarotti@gmail.com' ||
              u.role === 'SUPERADMIN' ||
              (!u.email?.includes('vanguardprime') && !u.email?.includes('camila') && !u.email?.includes('lucas') && !u.email?.includes('juliana'))
            );
            // Garante que TODOS os usuários essenciais de MOCK_USERS (Rafael e Amábile) existam
            for (const mockU of MOCK_USERS) {
              if (!parsed.some((u: User) => u.email?.toLowerCase() === mockU.email?.toLowerCase())) {
                parsed.push(mockU);
              }
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
            const clean = session.userEmail.toLowerCase().trim();
            // 1. Procura primeiro nos usuários salvos localmente
            try {
              const savedUsersRaw = localStorage.getItem('vanguard_crm_users');
              if (savedUsersRaw) {
                const parsedUsers = JSON.parse(savedUsersRaw);
                const foundInParsed = parsedUsers.find((x: User) => x.email?.toLowerCase().trim() === clean);
                if (foundInParsed) return foundInParsed;
              }
            } catch {}
            // 2. Procura em MOCK_USERS (Rafael e Amábile)
            const found = MOCK_USERS.find(x => x.email.toLowerCase().trim() === clean);
            if (found) return found;
            if (clean.includes('rafael') || clean.includes('admin')) {
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
      // Persistência central no servidor para todos os navegadores/dispositivos
      if (typeof window !== 'undefined') {
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: updated }),
        }).catch(err => console.warn('[CRMContext] Aviso ao sincronizar atualização de usuário com servidor:', err));
      }
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
      aiPersonaPrompt: userData.aiPersonaPrompt || `Você é a Brok.ia comercial de ${brokerName}, especialista imobiliário na ${currentTenant.name}. Adote tom consultivo, polido e empático. Tire dúvidas sobre o imóvel com clareza, esclareça condições de pagamento e conduza o cliente para agendamento de visita presencial ou reunião com o corretor.`,
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
      if (typeof window !== 'undefined') {
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: updated }),
        }).catch(err => console.warn('[CRMContext] Aviso ao sincronizar novo usuário com servidor:', err));
      }
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

  const toggleUserStatus = (userId: string) => {
    setUsers(prev => {
      const updated = prev.map(u => {
        if (u.id === userId) {
          const newStatus: 'ACTIVE' | 'INACTIVE' = u.isActive === false || u.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
          return {
            ...u,
            isActive: newStatus === 'ACTIVE',
            status: newStatus,
          };
        }
        return u;
      });
      try { localStorage.setItem('vanguard_crm_users', JSON.stringify(updated)); } catch {}
      if (typeof window !== 'undefined') {
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: updated }),
        }).catch(err => console.warn('[CRMContext] Aviso ao sincronizar status com servidor:', err));
      }
      return updated;
    });
  };

  const resendUserInvite = async (userId: string): Promise<{ success: boolean; message: string }> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      throw new Error('Usuário não encontrado.');
    }

    const res = await fetch('/api/v1/users/invite', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': currentTenant.id,
        'x-user-id': currentUser.id,
        'x-user-email': currentUser.email,
      },
      body: JSON.stringify({
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        tenantName: currentTenant.name,
        tenantId: currentTenant.id,
        temporaryPassword: targetUser.password,
        isResend: true,
        isMaster: targetUser.role === 'SUPERADMIN' || targetUser.role === 'ADMIN_MASTER',
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
      if (typeof window !== 'undefined') {
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: updated }),
        }).catch(err => console.warn('[CRMContext] Aviso ao sincronizar exclusão com servidor:', err));
      }
      return updated;
    });
  };

  const updateUserAIPersona = (userId: string, data: { aiPersonaPrompt?: string; aiTone?: any; aiDirectives?: string[]; aiModel?: string }) => {
    updateUser(userId, data);
  };

  const [masterUsers, setMasterUsers] = useState<MasterUser[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_master_users');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Garante que o usuário Rafael Master sempre esteja presente como âncora root
            const hasRoot = parsed.some((u: MasterUser) => u.email?.toLowerCase() === 'rafael@faithhubs.com');
            const merged = hasRoot ? parsed : [...MOCK_MASTER_USERS, ...parsed];
            return merged;
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
      email: (userData.email || '').trim().toLowerCase(),
      phone: userData.phone || '',
      avatarUrl: userData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'Master')}&background=3742AC&color=ffffff`,
      role: userData.role || 'SUPPORT_LEAD',
      permissions: userData.permissions || ['MANAGE_TENANTS', 'IMPERSONATE_CRM', 'VIEW_FINANCIALS'],
      isActive: userData.isActive !== false,
      createdAt: new Date().toISOString(),
      ...userData,
    };

    setMasterUsers(prev => {
      const updated = [...prev.filter(u => u.id !== newUser.id), newUser];
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Envia convite de acesso master
    if (newUser.email && typeof window !== 'undefined') {
      fetch('/api/v1/users/invite', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenant.id,
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({
          email: newUser.email,
          name: newUser.name,
          role: 'SUPERADMIN',
          tenantName: 'FaithHubs SaaS Master',
          tenantId: 'master-portal',
          isMaster: true,
          isResend: false,
        }),
      }).catch(err => console.error('[CRMContext] Erro ao disparar convite master:', err));
    }

    return newUser;
  };

  const updateMasterUser = (userId: string, updates: Partial<MasterUser>) => {
    setMasterUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, ...updates } : u);
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const toggleMasterUserStatus = (userId: string) => {
    setMasterUsers(prev => {
      const updated = prev.map(u => {
        if (u.id === userId) {
          const nextActive = u.isActive === false ? true : false;
          return { ...u, isActive: nextActive };
        }
        return u;
      });
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const resendMasterUserInvite = async (userId: string): Promise<{ success: boolean; message: string; inviteLink?: string }> => {
    const targetUser = masterUsers.find(u => u.id === userId);
    if (!targetUser) {
      throw new Error('Administrador Master não encontrado.');
    }

    const res = await fetch('/api/v1/users/invite', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': currentTenant.id,
        'x-user-id': currentUser.id,
        'x-user-email': currentUser.email,
      },
      body: JSON.stringify({
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role === 'SUPERADMIN_GLOBAL' ? 'SUPERADMIN' : targetUser.role,
        tenantName: 'FaithHubs SaaS Master',
        tenantId: 'master-portal',
        isMaster: true,
        isResend: true,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Não foi possível reenviar as instruções de acesso.');
    }

    return {
      success: true,
      message: data.message || `Instruções de acesso master reenviadas com sucesso para ${targetUser.email}!`,
      inviteLink: data.inviteLink,
    };
  };

  const deleteMasterUser = (userId: string) => {
    setMasterUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      try { localStorage.setItem('vanguard_crm_master_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const applyServerSession = (session: any) => {
    const authenticatedUser: User = { id: session.userId, email: session.userEmail, name: session.userName,
      phone: '', role: session.role, tenantId: session.tenantId, isActive: true };
    setCurrentUser(authenticatedUser);
    setUsers(prev => [...prev.filter(user => user.id !== authenticatedUser.id), authenticatedUser]);
    setCurrentTenant(tenantForAuthenticatedSession(session.tenantId, tenants));
    localStorage.setItem('vanguard_auth_session', JSON.stringify({ userEmail: session.userEmail, userId: session.userId, tenantId: session.tenantId }));
    setIsAuthenticated(true);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (cancelled) return;
      if (response.ok && data.authenticated) applyServerSession(data.user);
      else { localStorage.removeItem('vanguard_auth_session'); setIsAuthenticated(false); }
    }).catch(() => { if (!cancelled) setIsAuthenticated(false); })
      .finally(() => { if (!cancelled) setIsAuthReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || currentUser?.role !== 'SUPERADMIN') { setTenantCatalogLoading(false); return; }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setTenantCatalogLoading(true); setTenantCatalogError(null);
    fetch('/api/v1/master/tenants', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.success || !Array.isArray(data.tenants)) throw new Error('Não foi possível atualizar a lista de ambientes do servidor.');
        const catalog = data.tenants as TenantCatalogEntry[];
        setTenants(previous => {
          const next = reconcileTenantCatalog(catalog, previous);
          try { localStorage.setItem('vanguard_crm_tenants', JSON.stringify(next)); } catch {}
          return next;
        });
        setCurrentTenantState(previous => {
          const entry = catalogTenantForSelection(previous, catalog) || catalog.find(tenant => tenant.id === currentUser.tenantId);
          if (!entry) return previous;
          const next = reconcileTenantCatalog([entry], [previous])[0];
          try { localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .catch(() => { if (!cancelled) setTenantCatalogError('Não foi possível atualizar a lista de ambientes do servidor.'); })
      .finally(() => { clearTimeout(timeout); if (!cancelled) setTenantCatalogLoading(false); });
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [isAuthenticated, currentUser?.id, currentUser?.role, currentUser?.tenantId, tenantCatalogRevision]);

  const login = async (_email: string, _role?: string) => {
    const response = await fetch('/api/v1/auth/session', { credentials: 'include', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.authenticated) throw new Error('Autenticação necessária. Informe e-mail e senha.');
    applyServerSession(data.user);
    localStorage.setItem('vanguard_crm_current_tab', 'dashboard');
    localStorage.setItem('faithhubs_view_mode', data.user.isSuperAdmin ? 'SAAS_MASTER' : 'TENANT_CRM');
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

  const [deletedChatKeys, setDeletedChatKeys] = useState<Set<string>>(() => getStoredDeletedChatKeys());

  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_contacts');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const initialDel = getStoredDeletedChatKeys();
            parsed = parsed
              .filter((c: Contact) => !isChatKeyDeleted(c.id, initialDel) && !isChatKeyDeleted(c.phone, initialDel) && !isChatKeyDeleted(c.lid, initialDel) && isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt || c.updatedAt }))
              .map((c: Contact) => {
                const isAmabileContact = !c.tenantId || c.tenantId === 'tenant-amabile-barbarotti' || c.tenantId === 'tenant-vanguard-01' || c.tenantId.includes('amabile');
                return {
                  ...c,
                  tenantId: isAmabileContact ? 'tenant-amabile-barbarotti' : c.tenantId,
                  isPersonal: c.isPersonal === true ? true : false,
                  targetRegions: (c.targetRegions || []).filter(r => r !== 'Região Metropolitana' && r !== 'São Paulo' && r !== 'Geral'),
                };
              });
            return deduplicateContactList(parsed);
          }
        }
      } catch {}
    }
    return deduplicateContactList(MOCK_CONTACTS);
  });

  const [deals, setDeals] = useState<Deal[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_deals');
        if (saved) {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed
              .map((d: Deal) => {
                const isAmabileDeal = !d.tenantId || d.tenantId === 'tenant-amabile-barbarotti' || d.tenantId === 'tenant-vanguard-01' || d.tenantId.includes('amabile');
                return {
                  ...d,
                  tenantId: isAmabileDeal ? 'tenant-amabile-barbarotti' : d.tenantId,
                  pipelineId: (!d.pipelineId || d.pipelineId === 'pipe-vendas-residencial') ? 'pipe-amabile-default' : d.pipelineId,
                };
              });
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_DEALS;
  });

  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  useEffect(() => {
    if (!isAuthenticated) { setInstances([]); return; }
    let cancelled = false;
    setInstances([]);
    fetch('/api/v1/zapi/instances', { headers: { 'x-tenant-id': currentTenant.id }, cache: 'no-store' })
      .then(response => response.json()).then(data => { if (!cancelled && data.success) setInstances(data.instances); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, currentTenant.id]);

  const [activeInstanceId, setActiveInstanceId] = useState<string>(() => {
    return MOCK_INSTANCES[0]?.id || 'inst-rafael-individual';
  });

  const [isZapiConnected, setIsZapiConnected] = useState(false);

  const [zapiLiveDetails, setZapiLiveDetails] = useState<{
    connected: boolean;
    phone?: string;
    name?: string;
    avatarUrl?: string | null;
    deviceModel?: string;
    battery?: number;
    isBusiness?: boolean;
  } | null>(null);

  const createInstance = (data: Partial<WhatsAppInstance>): WhatsAppInstance => {
    const newInst: WhatsAppInstance = {
      id: `inst-${Date.now()}`,
      tenantId: currentTenant.id,
      name: data.name || 'Nova Linha WhatsApp',
      phoneNumber: data.phoneNumber || 'Aguardando pareamento',
      zapiInstanceId: data.zapiInstanceId || `INST-${Date.now().toString(36).toUpperCase()}`,
      status: 'DISCONNECTED',
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
      const updated = prev.map(inst => (inst.id === instanceId || inst.zapiInstanceId === instanceId) ? { ...inst, ...updates } : inst);
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
            const initialDel = getStoredDeletedChatKeys();
            parsed = parsed
              .filter((c: Conversation) => {
                if (isChatKeyDeleted(c.id, initialDel) || isChatKeyDeleted(c.contactId, initialDel)) return false;
                const digits = (c.id + (c.contactId || '')).replace(/\D/g, '');
                if (digits && isChatKeyDeleted(digits, initialDel)) return false;
                // Conversas válidas do WhatsApp
                return isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt }) || Boolean(c.lastMessagePreview && c.lastMessagePreview.length > 0);
              })
              .map((c: Conversation) => {
                const isAmabileConv = !c.tenantId || c.tenantId === 'tenant-amabile-barbarotti' || c.tenantId === 'tenant-vanguard-01' || c.tenantId.includes('amabile');
                const cleanPreview = (c.lastMessagePreview && isWhatsAppSystemMessage(c.lastMessagePreview)) ? 'Conversa sincronizada via WhatsApp' : c.lastMessagePreview;
                return {
                  ...c,
                  tenantId: isAmabileConv ? 'tenant-amabile-barbarotti' : c.tenantId,
                  isPersonal: c.isPersonal === true ? true : false,
                  lastMessagePreview: cleanPreview,
                };
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
            const initialDel = getStoredDeletedChatKeys();
            parsed = reconcileMessageHistory(parsed.filter((m: Message) => !isChatKeyDeleted(m.conversationId, initialDel)));
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(parsed)); } catch {}
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_MESSAGES;
  });

  // Preserva IDs, datas, autoria e conteúdo confirmados no servidor.
  const deduplicateMessages = (records: Message[], _contactList?: Contact[]) => reconcileMessageHistory(records);
  const deduplicateConversations = (records: Conversation[], _contactList?: Contact[]) => reconcileConversationHistory(records);

  // Salva no localStorage de forma assíncrona/debounced em segundo plano (evita congelamentos de UI e estouro de cota)
  const storageTimeoutMap = useRef<Record<string, NodeJS.Timeout>>({});
  const saveToStorageDebounced = useCallback((key: string, data: any, delay = 800) => {
    if (typeof window === 'undefined') return;
    if (storageTimeoutMap.current[key]) {
      clearTimeout(storageTimeoutMap.current[key]);
    }
    storageTimeoutMap.current[key] = setTimeout(() => {
      const doSave = () => {
        try {
          // Proteção de Quota e Performance: mensagens locais limitadas a 300 mais recentes
          let payloadToSave = data;
          if (key === 'vanguard_crm_messages' && Array.isArray(data) && data.length > 300) {
            payloadToSave = data.slice(-300);
          } else if (key === 'vanguard_crm_contacts' && Array.isArray(data) && data.length > 800) {
            payloadToSave = data.slice(0, 800);
          }
          const serialized = JSON.stringify(payloadToSave);
          localStorage.setItem(key, serialized);
        } catch (err) {
          console.warn(`[Brokiva Storage] Erro controlado ao salvar ${key}:`, err);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(doSave, { timeout: 3000 });
      } else {
        setTimeout(doSave, 0);
      }
    }, delay);
  }, []);

  // Hidrata dados salvos no servidor e no localStorage (funciona 100% em aba anônima, Safari e novos dispositivos)
  const isHydratedRef = useRef(false);
  const currentTenantRef = useRef(currentTenant);
  const currentUserRef = useRef(currentUser);
  const activeInstanceIdRef = useRef(activeInstanceId);

  useEffect(() => {
    currentTenantRef.current = currentTenant;
  }, [currentTenant]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeInstanceIdRef.current = activeInstanceId;
  }, [activeInstanceId]);

  useEffect(() => {
    const initializeCRMState = async () => {
      try {
        // 1. Busca estado inicial do servidor (persistência cross-device, outro navegador e aba anônima)
        let serverData: any = null;
        try {
          const res = await fetchCRMState('/api/v1/crm/state', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': currentTenant.id,
              'x-user-id': currentUser.id,
              'x-user-email': currentUser.email,
            }
          });
          if (res.ok) {
            serverData = await res.json();
          }
        } catch (err) {
          console.warn('[CRM] Aviso ao buscar estado inicial do servidor:', err);
        }

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

        // 3. Atualiza chaves excluídas combinadas do servidor e locais
        const serverDeleted = Array.isArray(serverData?.deletedKeys) ? serverData.deletedKeys : [];
        let combinedDeleted = new Set(deletedChatKeys);
        serverDeleted.forEach((k: string) => combinedDeleted.add(k));
        setDeletedChatKeys(combinedDeleted);
        try {
          localStorage.setItem('vanguard_crm_deleted_chats', JSON.stringify(Array.from(combinedDeleted)));
        } catch {}

        // 3.1 Sincroniza usuários do servidor (persistência cross-device de equipe e corretores)
        if (Array.isArray(serverData?.users) && serverData.users.length > 0) {
          setUsers(prev => {
            const map = new Map<string, User>();
            for (const u of MOCK_USERS) {
              if (u.email) map.set(u.email.toLowerCase().trim(), { ...u });
            }
            for (const u of prev) {
              if (u.email) {
                const k = u.email.toLowerCase().trim();
                const existing = map.get(k);
                map.set(k, { ...(existing || {}), ...u });
              }
            }
            for (const u of serverData.users) {
              if (u.email) {
                const k = u.email.toLowerCase().trim();
                const existing = map.get(k);
                map.set(k, { ...(existing || {}), ...u });
              }
            }
            const finalUsers = Array.from(map.values());
            try { localStorage.setItem('vanguard_crm_users', JSON.stringify(finalUsers)); } catch {}
            return finalUsers;
          });
        }

        // 4. Mescla contatos com prioridade para o Servidor Central
        const otherTenantContacts = (Array.isArray(parsedLocalContacts) ? parsedLocalContacts : []).filter(c => c.tenantId && c.tenantId !== currentTenant.id);
        const serverTenantContacts = Array.isArray(serverData?.contacts) ? serverData.contacts : [];
        const localTenantContacts = (Array.isArray(parsedLocalContacts) ? parsedLocalContacts : []).filter(c => !c.tenantId || c.tenantId === currentTenant.id);

        const combinedContacts = tenantSnapshotRecords(
          Array.isArray(parsedLocalContacts) ? parsedLocalContacts : [], serverTenantContacts,
          currentTenant.id, serverData?.success === true,
        ).filter(c => !isChatKeyDeleted(c.id, combinedDeleted) && !isChatKeyDeleted(c.phone, combinedDeleted) && !isChatKeyDeleted(c.lid, combinedDeleted));

        const finalContacts = deduplicateContactList(combinedContacts);
        setContacts(finalContacts);
        saveToStorageDebounced('vanguard_crm_contacts', finalContacts, 800);

        // 5. Mescla conversas garantindo unificação de LIDs e precedência do Servidor
        const otherTenantConvs = (Array.isArray(parsedLocalConvs) ? parsedLocalConvs : []).filter(cv => cv.tenantId && cv.tenantId !== currentTenant.id);
        const serverTenantConvs = Array.isArray(serverData?.conversations) ? serverData.conversations : [];
        const localTenantConvs = (Array.isArray(parsedLocalConvs) ? parsedLocalConvs : []).filter(cv => !cv.tenantId || cv.tenantId === currentTenant.id);

        const combinedConvs = tenantSnapshotRecords(
          Array.isArray(parsedLocalConvs) ? parsedLocalConvs : [], serverTenantConvs,
          currentTenant.id, serverData?.success === true,
        ).filter(cv => !isChatKeyDeleted(cv.id, combinedDeleted) && !isChatKeyDeleted(cv.contactId, combinedDeleted));

        const finalConvs = deduplicateConversations(combinedConvs, finalContacts);
        setConversations(finalConvs);
        saveToStorageDebounced('vanguard_crm_conversations', finalConvs, 1000);

        // 6. Mescla mensagens
        const activeConvIds = new Set(localTenantConvs.map(cv => cv.id));
        const combinedMsgs = tenantSnapshotRecords(
          Array.isArray(parsedLocalMsgs) ? parsedLocalMsgs : [], Array.isArray(serverData?.messages) ? serverData.messages : [],
          currentTenant.id, serverData?.success === true,
        ).filter(m => !isChatKeyDeleted(m.conversationId, combinedDeleted));

        const finalMsgs = deduplicateMessages(combinedMsgs, finalContacts);
        setMessages(finalMsgs);
        saveToStorageDebounced('vanguard_crm_messages', finalMsgs, 1500);

        // 7. Mescla deals com autoridade do servidor
        const otherTenantDeals = (Array.isArray(parsedLocalDeals) ? parsedLocalDeals : []).filter(d => d.tenantId && d.tenantId !== currentTenant.id);
        const serverTenantDeals = Array.isArray(serverData?.deals) ? serverData.deals : [];
        const localTenantDeals = (Array.isArray(parsedLocalDeals) ? parsedLocalDeals : []).filter(d => !d.tenantId || d.tenantId === currentTenant.id);

        const dealMap = new Map<string, Deal>();
        otherTenantDeals.forEach(d => dealMap.set(d.id, d));
        localTenantDeals.forEach(d => dealMap.set(d.id, d));
        serverTenantDeals.forEach((d: Deal) => {
          if (d && d.id) dealMap.set(d.id, d);
        });
        const finalDeals = Array.from(dealMap.values()).filter(d => !isChatKeyDeleted(d.contactId, combinedDeleted));
        setDeals(finalDeals);
        saveToStorageDebounced('vanguard_crm_deals', finalDeals, 800);

        // 8. Insights
        const finalInsights = {
          ...(parsedLocalInsights || {}),
          ...(serverData?.aiInsights || {})
        };
        setAiInsights(finalInsights);
        saveToStorageDebounced('vanguard_crm_ai_insights', finalInsights, 1200);

        // 8.1 Models come from the acknowledged tenant snapshot. A deleted model
        // must not return from mocks or the cache on the next page load.
        if (serverData?.success && serverData.tenantId === currentTenant.id && Array.isArray(serverData.quickReplies)) {
          const confirmed = serverData.quickReplies.filter((template: QuickReplyTemplate) => template.tenantId === currentTenant.id);
          setQuickReplies(previous => [...previous.filter(template => template.tenantId !== currentTenant.id), ...confirmed]);
        }

        // Dados legados do navegador não são republicados automaticamente sobre o snapshot confirmado.

        // 10. Conversa ativa
        const savedActive = localStorage.getItem('vanguard_crm_active_conv_id');
        if (savedActive && finalConvs.some(c => c.id === savedActive)) {
          setActiveConversationId(savedActive);
        } else if (finalConvs.length > 0) {
          setActiveConversationId(finalConvs[0].id);
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
      // Blindagem contra Cross-Window Injection & iframes maliciosos
      if (typeof window !== 'undefined') {
        if (event.source !== window) return;
        if (event.origin && event.origin !== window.location.origin) return;
      }

      if (event.data?.type === 'BROKIVA_EXTENSION_SYNC' && event.data?.data) {
        console.log('[Brokiva CRM] Mensagens sincronizadas recebidas da extensão:', event.data.data);
        const { messages: incomingMsgs, contacts: incomingContacts, conversations: incomingConvs } = event.data.data;

        const effectiveTenantId = currentTenantRef.current?.id;
        if (!effectiveTenantId || event.data.data.tenantId !== effectiveTenantId) return;
        const sanitizedContacts = (incomingContacts || []).filter((c: Contact) => c.tenantId === effectiveTenantId);
        const sanitizedConvs = (incomingConvs || []).filter((c: Conversation) => c.tenantId === effectiveTenantId);
        const sanitizedMsgs = (incomingMsgs || []).filter((m: Message) => m.tenantId === effectiveTenantId);

        let updatedContactsList: Contact[] = [];
        if (sanitizedContacts.length > 0) {
          setContacts(prev => {
            const next = deduplicateContactList([...prev, ...sanitizedContacts]);
            updatedContactsList = next;
            saveToStorageDebounced('vanguard_crm_contacts', next, 200);
            try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(next)); } catch {}
            return next;
          });
        }

        if (sanitizedConvs.length > 0) {
          setConversations(prev => {
            const next = deduplicateConversations([...prev, ...sanitizedConvs], updatedContactsList.length > 0 ? updatedContactsList : contacts);
            saveToStorageDebounced('vanguard_crm_conversations', next, 200);
            try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(next)); } catch {}
            return next;
          });
          // Se nenhuma conversa estiver ativa, foca na primeira do lote recebido
          setActiveConversationId(prev => prev || sanitizedConvs[0]?.id || null);
        }

        if (sanitizedMsgs.length > 0) {
          setMessages(prev => {
            const next = deduplicateMessages([...prev, ...sanitizedMsgs], updatedContactsList.length > 0 ? updatedContactsList : contacts);
            saveToStorageDebounced('vanguard_crm_messages', next, 200);
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(next)); } catch {}
            return next;
          });
        }


      }
    };

    window.addEventListener('message', handleExtensionDirectSync);
    return () => window.removeEventListener('message', handleExtensionDirectSync);
  }, [contacts, saveToStorageDebounced]);



  // Salva no localStorage quando o estado mudar (somente APÓS hidratação para nunca sobrescrever) com Debounce Assíncrono
  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveToStorageDebounced('vanguard_crm_contacts', contacts, 800);
  }, [contacts, saveToStorageDebounced]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveToStorageDebounced('vanguard_crm_deals', deals, 800);
  }, [deals, saveToStorageDebounced]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveToStorageDebounced('vanguard_crm_conversations', conversations, 1000);
  }, [conversations, saveToStorageDebounced]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveToStorageDebounced('vanguard_crm_messages', messages, 1200);
  }, [messages, saveToStorageDebounced]);

  useEffect(() => {
    if (!isHydratedRef.current || !activeConversationId) return;
    saveToStorageDebounced('vanguard_crm_active_conv_id', activeConversationId, 400);
    // Zera imediatamente o unreadCount da conversa que o usuário está visualizando ativamente
    setConversations(prev => {
      const target = prev.find(c => c.id === activeConversationId || c.contactId === activeConversationId);
      if (!target || target.unreadCount === 0) return prev;
      return prev.map(c => (c.id === target.id) ? { ...c, unreadCount: 0 } : c);
    });
  }, [activeConversationId, saveToStorageDebounced]);
  
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<SLAAlert[]>(MOCK_ALERTS);
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([]);

  const saveTemplateCommand = async (command: any) => {
    const tenantId = currentTenant.id;
    const response = await fetch('/api/v1/message-templates', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, body: JSON.stringify(command) });
    const data = await response.json();
    if (!response.ok || !data.success || data.tenantId !== tenantId) throw new Error(data.error || 'Modelo não salvo. Tente novamente.');
    setQuickReplies(previous => [...previous.filter(item => item.tenantId !== tenantId), ...data.quickReplies]);
    return data.quickReplies as QuickReplyTemplate[];
  };
  const createQuickReply = async (template: Omit<QuickReplyTemplate, 'id' | 'tenantId' | 'createdAt'>) => {
    const shortcut = template.shortcut.startsWith('/') ? template.shortcut : `/${template.shortcut}`;
    const saved = await saveTemplateCommand({ operation: 'save', data: { ...template, shortcut } });
    return saved.find(item => item.shortcut === shortcut)!;
  };
  const updateQuickReply = async (id: string, updates: Partial<QuickReplyTemplate>, expected?: { updatedAt?: string }) => {
    const previous = quickReplies.find(item => item.id === id && item.tenantId === currentTenant.id);
    if (!previous) throw new Error('Modelo não encontrado. Atualize a página.');
    await saveTemplateCommand({ operation: 'save', id, updatedAt: expected ? expected.updatedAt : previous.updatedAt, data: updates });
  };
  const toggleQuickReplyActive = async (id: string) => {
    const previous = quickReplies.find(item => item.id === id && item.tenantId === currentTenant.id);
    if (previous) await updateQuickReply(id, { isActive: previous.isActive === false });
  };
  const deleteQuickReply = async (id: string) => {
    const previous = quickReplies.find(item => item.id === id && item.tenantId === currentTenant.id);
    await saveTemplateCommand({ operation: 'delete', id, updatedAt: previous?.updatedAt });
  };

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
          monthlyIncome: data.monthlyIncome !== undefined ? data.monthlyIncome : existing.monthlyIncome,
          downPaymentAvailable: data.downPaymentAvailable !== undefined ? data.downPaymentAvailable : existing.downPaymentAvailable,
          maxPropertyValue: data.maxPropertyValue !== undefined ? data.maxPropertyValue : existing.maxPropertyValue,
          targetBedrooms: data.targetBedrooms !== undefined ? data.targetBedrooms : existing.targetBedrooms,
          preferredPropertyType: data.preferredPropertyType || existing.preferredPropertyType,
          purchasePurpose: data.purchasePurpose || existing.purchasePurpose,
          purchaseTimeline: data.purchaseTimeline || existing.purchaseTimeline,
          householdIncome: data.householdIncome !== undefined ? data.householdIncome : existing.householdIncome,
          estimatedFinancing: data.estimatedFinancing !== undefined ? data.estimatedFinancing : existing.estimatedFinancing,
          targetRegions: Array.from(new Set([...(existing.targetRegions || []), ...(data.targetRegions || [])])),
          tags: Array.from(new Set([...(existing.tags || []), ...(data.tags || [])])),
          email: data.email || existing.email,
          assignedUserId: data.assignedUserId || existing.assignedUserId,
          updatedAt: new Date().toISOString(),
        };

        const updated = [...prev];
        updated[existingIndex] = resultContact;
        const deduped = deduplicateContactList(updated);
        const resolved = deduped.find(c => (pKey && normalizePhoneKey(c.phone) === pKey) || (data.id && c.id === data.id) || c.id === existing.id);
        if (resolved) resultContact = resolved;

        try {
          localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduped));
          fetchCRMState('/api/v1/crm/state', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': currentTenant.id,
              'x-user-id': currentUser.id,
              'x-user-email': currentUser.email,
            },
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
        consentGiven: false,
        hasOptedOut: false,
        isPersonal: data.isPersonal !== undefined ? data.isPersonal : false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };

      const updated = deduplicateContactList([resultContact, ...prev]);
      const resolved = updated.find(c => (pKey && normalizePhoneKey(c.phone) === pKey) || (resultContact.id && c.id === resultContact.id));
      if (resolved) resultContact = resolved;

      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ contacts: updated, automationEvent: { trigger: 'LEAD_CREATED', entityId: resultContact.id } }),
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
          isPersonal: contactToUse.isPersonal ?? false,
        };

        const updated = [newConv, ...prev];
        try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }

    return resultContact!;
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    if (!id && !updates.phone) return;

    const rawTargetId = (id || '').replace(/^(contact|conv)-zapi-/, '');
    const targetDigits = (id || '').replace(/\D/g, '') || (updates.phone ? updates.phone.replace(/\D/g, '') : '');
    const targetPKey = normalizePhoneKey(updates.phone || (targetDigits ? (targetDigits.startsWith('55') ? `+${targetDigits}` : `+55${targetDigits}`) : ''));

    let matchedCanonicalId = id;

    setContacts(prev => {
      // 1. Encontra contato existente por: id exato, id limpo, chave canônica de telefone, dígitos equivalentes ou LID
      const existingIdx = prev.findIndex(c => {
        if (c.id === id) return true;
        if (rawTargetId && c.id.replace(/^(contact|conv)-zapi-/, '') === rawTargetId) return true;
        if (targetPKey && normalizePhoneKey(c.phone) === targetPKey) return true;
        if (targetDigits && targetDigits.length >= 8 && arePhonesEquivalent(c.phone, targetDigits)) return true;
        if (targetDigits && targetDigits.length >= 8 && c.phone && c.phone.replace(/\D/g, '').endsWith(targetDigits.slice(-8))) return true;
        if (c.lid && (c.lid === id || (targetDigits && c.lid.includes(targetDigits)))) return true;
        return false;
      });

      let updatedList: Contact[];

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        matchedCanonicalId = existing.id;
        const mergedContact: Contact = {
          ...existing,
          ...updates,
          id: existing.id,
          monthlyIncome: updates.monthlyIncome !== undefined ? updates.monthlyIncome : existing.monthlyIncome,
          downPaymentAvailable: updates.downPaymentAvailable !== undefined ? updates.downPaymentAvailable : existing.downPaymentAvailable,
          maxPropertyValue: updates.maxPropertyValue !== undefined ? updates.maxPropertyValue : existing.maxPropertyValue,
          targetBedrooms: updates.targetBedrooms !== undefined ? updates.targetBedrooms : existing.targetBedrooms,
          preferredPropertyType: updates.preferredPropertyType !== undefined ? updates.preferredPropertyType : existing.preferredPropertyType,
          purchasePurpose: updates.purchasePurpose !== undefined ? updates.purchasePurpose : existing.purchasePurpose,
          purchaseTimeline: updates.purchaseTimeline !== undefined ? updates.purchaseTimeline : existing.purchaseTimeline,
          householdIncome: updates.householdIncome !== undefined ? updates.householdIncome : existing.householdIncome,
          estimatedFinancing: updates.estimatedFinancing !== undefined ? updates.estimatedFinancing : existing.estimatedFinancing,
          name: updates.name ? updates.name : existing.name,
          phone: updates.phone ? updates.phone : existing.phone,
          email: updates.email !== undefined ? updates.email : existing.email,
          tags: updates.tags || existing.tags,
          targetRegions: updates.targetRegions || existing.targetRegions,
          updatedAt: new Date().toISOString(),
        };

        for (const field of ['monthlyIncome', 'downPaymentAvailable', 'maxPropertyValue', 'preferredPropertyType', 'targetRegions', 'email']) {
          if (!Object.prototype.hasOwnProperty.call(updates, field)) continue;
          (mergedContact as any)[field] = (updates as any)[field];
          mergedContact.qualificationFields = { ...mergedContact.qualificationFields, [field]: { source: 'HUMAN', value: (updates as any)[field] ?? '', messageId: '', quote: '', at: new Date().toISOString(), confidence: 1 } };
        }
        const copy = [...prev];
        copy[existingIdx] = mergedContact;
        updatedList = deduplicateContactList(copy);
      } else {
        // UPSERT: Se o contato não existia no array (ex: fallback sintetizado do WhatsApp), cria sem perder nenhum dado
        const fullPhone = updates.phone || (targetDigits ? (targetDigits.startsWith('55') ? `+${targetDigits}` : `+55${targetDigits}`) : '+5511900000000');
        const fallbackName = updates.name || (targetDigits ? `Contato ${targetDigits.slice(-4)}` : 'Lead Qualificado');
        const newContact: Contact = {
          id: id.startsWith('contact-') ? id : `contact-zapi-${targetDigits || Date.now()}`,
          tenantId: currentTenant.id,
          name: fallbackName,
          phone: fullPhone,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=059669&color=fff`,
          source: updates.source || 'WHATSAPP',
          temperature: updates.temperature || 'WARM',
          aiPriorityScore: updates.aiPriorityScore || 75,
          tags: updates.tags || ['Lead Qualificado'],
          targetRegions: updates.targetRegions || [],
          notesCount: 0,
          consentGiven: false,
          hasOptedOut: false,
          isPersonal: updates.isPersonal ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...updates,
        };
        matchedCanonicalId = newContact.id;
        updatedList = deduplicateContactList([newContact, ...prev]);
      }

      // Persistência local imediata
      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updatedList));
      } catch {}

      // Persistência imediata no servidor
      try {
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ contacts: updatedList, qualificationEdits: { contactId: matchedCanonicalId,
              values: Object.fromEntries(['monthlyIncome', 'downPaymentAvailable', 'maxPropertyValue', 'preferredPropertyType', 'targetRegions', 'email'].filter(field => Object.prototype.hasOwnProperty.call(updates, field)).map(field => [field, (updates as any)[field] ?? null])) } }),
        }).catch(err => console.warn('[CRM] Aviso ao persistir contatos:', err));
      } catch {}

      return updatedList;
    });

    // Reconcilia também deals e conversas garantindo alinhamento do contactId
    if (matchedCanonicalId) {
      setDeals(prevDeals => {
        let changed = false;
        const updatedDeals = prevDeals.map(d => {
          const isMatch = d.contactId === id ||
                          (rawTargetId && d.contactId.replace(/^(contact|conv)-zapi-/, '') === rawTargetId) ||
                          (targetDigits && targetDigits.length >= 8 && d.contactId.includes(targetDigits));
          if (isMatch && d.contactId !== matchedCanonicalId) {
            changed = true;
            return { ...d, contactId: matchedCanonicalId };
          }
          return d;
        });
        if (changed) {
          try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updatedDeals)); } catch {}
          return updatedDeals;
        }
        return prevDeals;
      });

      setConversations(prevConvs => {
        let changed = false;
        const updatedConvs = prevConvs.map(cv => {
          const isMatch = cv.contactId === id ||
                          cv.id === id ||
                          (rawTargetId && (cv.contactId.replace(/^(contact|conv)-zapi-/, '') === rawTargetId || cv.id.replace(/^(contact|conv)-zapi-/, '') === rawTargetId)) ||
                          (targetDigits && targetDigits.length >= 8 && (cv.id.includes(targetDigits) || cv.contactId.includes(targetDigits)));
          if (isMatch && cv.contactId !== matchedCanonicalId) {
            changed = true;
            return { ...cv, contactId: matchedCanonicalId };
          }
          return cv;
        });
        if (changed) {
          try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updatedConvs)); } catch {}
          return updatedConvs;
        }
        return prevConvs;
      });
    }
  };

  const deleteContact = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    const conv = conversations.find(c => c.contactId === id || (contact?.phone && c.id.includes(contact.phone.replace(/\D/g, ''))));
    if (conv) {
      deleteConversation(conv.id);
    } else {
      deleteConversation(`conv-${id}`);
    }
  };

  const toggleContactPersonal = (contactId: string) => {
    let nextPersonalState = false;
    let updatedContactsList: Contact[] = [];
    let updatedConvsList: Conversation[] = [];

    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId || (c.phone && contactId.replace(/\D/g, '').length >= 8 && arePhonesEquivalent(c.phone, contactId.replace(/\D/g, '')))) {
          nextPersonalState = !c.isPersonal;
          return {
            ...c,
            isPersonal: nextPersonalState,
            // PRESERVA TODOS OS DADOS DE QUALIFICAÇÃO: renda, entrada, orçamento, tipo de imóvel e regiões nunca são perdidos
            ...(!nextPersonalState ? {
              temperature: (c.temperature && c.temperature !== 'COLD') ? c.temperature : 'WARM',
              aiPriorityScore: (c.aiPriorityScore && c.aiPriorityScore > 0) ? c.aiPriorityScore : 75,
            } : {}),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      updatedContactsList = updated;
      try {
        localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setConversations(prev => {
      const targetDigits = contactId.replace(/\D/g, '');
      const updated = prev.map(conv => {
        const isMatch = conv.contactId === contactId || 
                        conv.id === contactId || 
                        (targetDigits && targetDigits.length >= 8 && (conv.id.includes(targetDigits) || conv.contactId.includes(targetDigits)));
        if (isMatch) {
          return {
            ...conv,
            isPersonal: nextPersonalState,
          };
        }
        return conv;
      });

      updatedConvsList = updated;
      try {
        localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Persistência unificada imediata no servidor (banco de dados + store do servidor)
    try {
      fetchCRMState('/api/v1/crm/state', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenant.id,
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ 
          contacts: updatedContactsList, 
          conversations: updatedConvsList 
        }),
      }).catch(err => console.warn('[CRM] Aviso ao sincronizar toggle de contato pessoal:', err));
    } catch {}
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
        fetchCRMState('/api/v1/crm/state', {
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
        fetchCRMState('/api/v1/crm/state', {
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
        fetchCRMState('/api/v1/crm/state', {
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
        fetchCRMState('/api/v1/crm/state', {
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

    const rawTargetId = (contactId || '').replace(/^(contact|conv)-zapi-/, '');
    const targetDigits = (contactId || '').replace(/\D/g, '');

    setContacts(prev => {
      const updated = prev.map(c => {
        const isMatch = c.id === contactId ||
                        (rawTargetId && c.id.replace(/^(contact|conv)-zapi-/, '') === rawTargetId) ||
                        (targetDigits && targetDigits.length >= 8 && arePhonesEquivalent(c.phone, targetDigits));
        if (isMatch) {
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
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  const removeBrokerNote = (contactId: string, noteId: string) => {
    const rawTargetId = (contactId || '').replace(/^(contact|conv)-zapi-/, '');
    const targetDigits = (contactId || '').replace(/\D/g, '');

    setContacts(prev => {
      const updated = prev.map(c => {
        const isMatch = c.id === contactId ||
                        (rawTargetId && c.id.replace(/^(contact|conv)-zapi-/, '') === rawTargetId) ||
                        (targetDigits && targetDigits.length >= 8 && arePhonesEquivalent(c.phone, targetDigits));
        if (isMatch && c.brokerNotes) {
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
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ contacts: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  // Manipulação de Deals / Kanban
  const moveDealStage = (dealId: string, targetStageId: string) => {
    const stage = effectiveCurrentPipeline.stages.find(s => s.id === targetStageId);
    let targetContactPhone = '';

    setDeals(prev => {
      const updated = prev.map(deal => {
        if (deal.id === dealId) {
          const matchedContact = contacts.find(c => c.id === deal.contactId);
          if (matchedContact?.phone) {
            targetContactPhone = matchedContact.phone.replace(/\D/g, '');
          }
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
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ deals: updated, automationEvent: { trigger: 'STAGE_CHANGED', entityId: dealId } }),
        }).catch(() => {});
      } catch {}
      return updated;
    });

    // Sincroniza em background a etiqueta correspondente no WhatsApp Business se houver telefone e etapa
    if (targetContactPhone && stage?.name) {
      fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-tag',
          phone: targetContactPhone,
          tagId: stage.name,
        }),
      }).catch(() => {});
    }
  };

  const createDeal = (data: Partial<Deal>): Deal => {
    let contactId = data.contactId || contacts[0]?.id || 'contact-01';
    const matchedContact = contacts.find(c => 
      c.id === contactId || 
      (contactId && c.phone && arePhonesEquivalent(c.phone, contactId.replace(/\D/g, '')))
    );
    if (matchedContact) {
      contactId = matchedContact.id;
    }

    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      tenantId: currentTenant.id,
      pipelineId: effectiveCurrentPipeline.id,
      stageId: data.stageId || effectiveCurrentPipeline.stages[0]?.id || 'stage-1',
      assignedUserId: data.assignedUserId || currentUser.id,
      title: data.title || 'Novo Negócio Imobiliário',
      expectedValue: typeof data.expectedValue === 'number' ? data.expectedValue : 0,
      manualProbability: typeof data.manualProbability === 'number' ? data.manualProbability : 0,
      aiProbabilityScore: typeof data.aiProbabilityScore === 'number' ? data.aiProbabilityScore : 0,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
      contactId,
    };
    setDeals(prev => {
      const filtered = prev.filter(d => d.id !== newDeal.id);
      const updated = [newDeal, ...filtered];
      try {
        localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated));
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
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
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ deals: updated, ...(updates.stageId ? { automationEvent: { trigger: 'STAGE_CHANGED', entityId: id } } : {}) }),
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

  const updatePipelineStages = async (stages: PipelineStage[]) => {
    await saveCommercialCommand({ collection: 'pipelines', operation: 'save', id: effectiveCurrentPipeline.id,
      data: { stages: stages.map((stage, index) => ({ ...stage, order: index + 1 })) } });
  };

  const setCurrentPipelineById = (id: string) => {
    const found = scopedPipelines.find(p => p.id === id);
    if (found) {
      setCurrentPipeline(found);
      try {
        localStorage.setItem('vanguard_crm_current_pipeline', JSON.stringify(found));
      } catch {}
    }
  };

  const createPipeline = async (data: { name: string; stages?: Partial<PipelineStage>[] }) => {
    const stageNames = ['Novo interessado', 'Em atendimento', 'Negociação', 'Concluído', 'Perdido'];
    const stages = (data.stages?.length ? data.stages : stageNames.map((name, index) => ({ name, isWon: index === 3, isLost: index === 4 })))
      .map((stage: Partial<PipelineStage>, index) => ({ id: stage.id || `stage-${crypto.randomUUID()}`, pipelineId: '', name: stage.name || `Etapa ${index + 1}`,
        order: index + 1, slaHours: stage.slaHours ?? 24, colorHex: stage.colorHex || '#6366f1', isWon: stage.isWon, isLost: stage.isLost }));
    const config = await saveCommercialCommand({ collection: 'pipelines', operation: 'save', data: { name: data.name.trim(), isDefault: false, stages } });
    return config.pipelines[config.pipelines.length - 1];
  };
  const updatePipeline = async (id: string, data: Partial<Pipeline>) => { await saveCommercialCommand({ collection: 'pipelines', operation: 'save', id, data }); };
  const deletePipeline = async (id: string) => { await saveCommercialCommand({ collection: 'pipelines', operation: 'delete', id }); };

  const moveDealToPipeline = (dealId: string, targetPipelineId: string, targetStageId: string) => {
    setDeals(prev => {
      const updated = prev.map(d => {
        if (d.id === dealId) {
          return {
            ...d,
            pipelineId: targetPipelineId,
            stageId: targetStageId,
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      });
      try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated)); } catch {}
      void fetchCRMState('/api/v1/crm/state', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': currentTenant.id },
        body: JSON.stringify({ deals: updated, automationEvent: { trigger: 'STAGE_CHANGED', entityId: dealId } }) }).catch(() => {});
      return updated;
    });
  };

  const createLossReason = async (data: Omit<LossReason, 'id' | 'tenantId' | 'createdAt'>) => {
    const config = await saveCommercialCommand({ collection: 'lossReasons', operation: 'save', data });
    return config.lossReasons[config.lossReasons.length - 1];
  };
  const updateLossReason = async (id: string, data: Partial<LossReason>) => { await saveCommercialCommand({ collection: 'lossReasons', operation: 'save', id, data }); };
  const deleteLossReason = async (id: string) => { await saveCommercialCommand({ collection: 'lossReasons', operation: 'delete', id }); };
  const createLeadSourceGroup = async (data: Omit<LeadSourceGroup, 'id' | 'tenantId' | 'createdAt'>) => {
    const config = await saveCommercialCommand({ collection: 'leadSourceGroups', operation: 'save', data });
    return config.leadSourceGroups[config.leadSourceGroups.length - 1];
  };
  const updateLeadSourceGroup = async (id: string, data: Partial<LeadSourceGroup>) => { await saveCommercialCommand({ collection: 'leadSourceGroups', operation: 'save', id, data }); };
  const deleteLeadSourceGroup = async (id: string) => { await saveCommercialCommand({ collection: 'leadSourceGroups', operation: 'delete', id }); };
  const createLeadSource = async (data: Omit<LeadSource, 'id' | 'tenantId' | 'createdAt'>) => {
    const config = await saveCommercialCommand({ collection: 'leadSources', operation: 'save', data });
    return config.leadSources[config.leadSources.length - 1];
  };
  const updateLeadSource = async (id: string, data: Partial<LeadSource>) => { await saveCommercialCommand({ collection: 'leadSources', operation: 'save', id, data }); };
  const deleteLeadSource = async (id: string) => { await saveCommercialCommand({ collection: 'leadSources', operation: 'delete', id }); };

  // Envio de Mensagem WhatsApp / Nota Interna
  const sendMessage = (
    conversationId: string, 
    content: string, 
    isInternalNote = false, 
    aiSuggested = false,
    attachments?: Attachment[],
    messageType: MessageType = 'TEXT',
    explicitPhone?: string
  ) => {
    const cleanContent = (content || '').trim();
    if (!cleanContent && (!attachments || attachments.length === 0)) return;

    const actualType: MessageType = messageType || (attachments && attachments.length > 0 
      ? (attachments[0].mimeType?.startsWith('image/') ? 'IMAGE' : attachments[0].mimeType?.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT')
      : 'TEXT');

    const previewText = cleanContent || (actualType === 'IMAGE' ? '📷 Foto' : actualType === 'AUDIO' ? '🎵 Áudio' : actualType === 'DOCUMENT' ? '📄 Documento' : 'Mensagem');

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: currentTenant?.id || 'tenant-amabile-barbarotti',
      conversationId,
      senderType: 'USER',
      senderUserId: currentUser?.id,
      senderName: currentUser?.name || 'Corretor',
      messageType: actualType,
      content: cleanContent || previewText,
      attachments,
      status: isInternalNote ? 'SENT' : 'PENDING',
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

      // 1. Resolução robusta de telefone para envio
      let targetPhone = (explicitPhone || '').replace(/\D/g, '');

      // Se explicitPhone tiver resolução canônica direta (LID ou telefone)
      if (explicitPhone) {
        const known = resolveKnownPhone(explicitPhone);
        if (known) targetPhone = known;
      }

      const conv = conversations.find(c => c.id === conversationId);
      let contact = contacts.find(cnt => cnt.id === conv?.contactId);

      // Se não encontrou por contactId direto, busca por equivalência profunda
      if (!contact && conv) {
        contact = contacts.find(c => c.id === conv.id) ||
                  contacts.find(c => c.lid && (conv.id.includes(c.lid) || (conv.contactId && conv.contactId.includes(c.lid)))) ||
                  contacts.find(c => {
                    const cDigits = (conv.id + (conv.contactId || '')).replace(/\D/g, '');
                    return cDigits && cDigits.length >= 8 && c.phone && arePhonesEquivalent(c.phone, cDigits);
                  });
      }

      if (!targetPhone && contact?.phone) {
        const known = resolveKnownPhone(contact.phone);
        targetPhone = known || contact.phone.replace(/\D/g, '');
      }
      if (!targetPhone && contact?.lid) {
        const known = resolveKnownPhone(contact.lid);
        targetPhone = known || cleanLid(contact.lid);
      }
      if (!targetPhone && conversationId.includes('zapi-')) {
        const extracted = conversationId.split('zapi-')[1]?.replace(/\D/g, '') || '';
        const known = resolveKnownPhone(extracted);
        targetPhone = known || extracted;
      }
      if (!targetPhone && conv?.contactId?.includes('zapi-')) {
        const extracted = conv.contactId.split('zapi-')[1]?.replace(/\D/g, '') || '';
        const known = resolveKnownPhone(extracted);
        targetPhone = known || extracted;
      }
      if (!targetPhone) {
        const rawDigits = conversationId.replace(/\D/g, '');
        if (rawDigits.length >= 8) {
          const known = resolveKnownPhone(rawDigits);
          targetPhone = known || rawDigits;
        }
      }

      // Resolução de LID para telefone canônico se necessário
      if (targetPhone && isLidIdentifier(targetPhone)) {
        const lidClean = cleanLid(targetPhone);
        const known = resolveKnownPhone(lidClean);
        if (known) {
          targetPhone = known;
        } else {
          let mapped = '';
          if (typeof window !== 'undefined') {
            try {
              const stored = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
              if (stored[lidClean]) mapped = stored[lidClean];
            } catch {}
          }
          if (!mapped) {
            const matchCnt = contacts.find(c => (c.lid && cleanLid(c.lid) === lidClean) || (c.phone && !isLidIdentifier(c.phone) && c.avatarUrl === contact?.avatarUrl));
            if (matchCnt?.phone && !isLidIdentifier(matchCnt.phone)) {
              mapped = matchCnt.phone.replace(/\D/g, '');
            }
          }
          if (mapped) targetPhone = mapped;
        }
      }

      if (targetPhone && !targetPhone.startsWith('55') && (targetPhone.length === 10 || targetPhone.length === 11)) {
        targetPhone = `55${targetPhone}`;
      }

      if (targetPhone) {
        // Procura a linha individual do corretor logado ou a da conversa
        const brokerInstance = instances.find(i => i.assignedUserId === currentUser?.id) || instances.find(i => i.id === conv?.instanceId) || instances[0];

        fetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant?.id || 'tenant-amabile-barbarotti',
            'x-user-id': currentUser?.id || 'user-1',
            'x-user-email': currentUser?.email || 'admin@amabile.com',
          },
          body: JSON.stringify({
            content: cleanContent || previewText,
            messageType: actualType,
            mediaUrl: attachments?.[0]?.url,
            fileName: attachments?.[0]?.fileName,
            phone: targetPhone,
            senderUserId: currentUser?.id,
            instanceId: brokerInstance?.zapiInstanceId || activeInstanceId || '3F8144490C66805B4E3FD64A35E2F2DC',
            tenantId: currentTenant?.id,
          }),
        }).then(async res => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('[CRM] Falha ao enviar mensagem:', errData);
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'FAILED' } : m));
          } else {
            const resJson = await res.json().catch(() => ({}));
            const extId = resJson?.externalId || resJson?.id;
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { 
              ...m, 
              status: 'DELIVERED',
              externalId: extId || m.externalId,
            } : m));
          }
        }).catch(err => {
          console.error('[CRM] Erro ao enviar mensagem via Z-API:', err);
          setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'FAILED' } : m));
        });
      } else {
        console.error('[CRM] Telefone de destino não encontrado para enviar mensagem no WhatsApp para:', conversationId);
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'FAILED' } : m));
      }
    }
  };

  // Marca conversa como lida (remove contadores de pendência e badges locais + sincroniza com o WhatsApp oficial via Z-API)
  const markConversationAsRead = (conversationId: string) => {
    let targetPhone = '';
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId && (conv.unreadCount > 0 || conv.status === 'PENDING_TEAM')) {
        const contact = contacts.find(c => c.id === conv.contactId);
        targetPhone = contact?.phone || conv.id.replace(/\D/g, '');
        return {
          ...conv,
          unreadCount: 0,
          status: conv.status === 'PENDING_TEAM' ? 'OPEN' : conv.status,
        };
      }
      return conv;
    }));

    if (targetPhone) {
      const clean = targetPhone.replace(/\D/g, '');
      if (clean && clean.length >= 8) {
        fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read', phone: clean }),
        }).catch(() => {});
      }
    }
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

  // Reativar ou Pausar IA Copiloto na Conversa (Human Takeover)
  const toggleConversationAI = (conversationId: string, enabled?: boolean) => {
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === conversationId) {
          const nextVal = enabled !== undefined ? enabled : (c.aiEnabled === false ? true : false);
          return {
            ...c,
            aiEnabled: nextVal,
            humanTakeoverAt: nextVal ? undefined : (c.humanTakeoverAt || new Date().toISOString()),
          };
        }
        return c;
      });
      try {
        localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated));
        fetchCRMState('/api/v1/crm/state', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({ conversations: updated }),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  // Deletar conversa completamente (Z-API + Local + Persistência Total)
  const deleteConversation = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    const contact = contacts.find(cnt => cnt.id === conv?.contactId);
    const rawPhone = contact?.phone || (conversationId.includes('zapi-') ? conversationId.split('zapi-')[1] : '');
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    const lid = contact?.lid;

    const keysToAdd: string[] = [
      conversationId,
      conv?.contactId || '',
      contact?.id || '',
      cleanPhone,
      cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`,
      `contact-zapi-${cleanPhone}`,
      `conv-zapi-${cleanPhone}`,
      lid || '',
      lid ? `conv-zapi-${lid}` : '',
      lid ? `contact-zapi-${lid}` : '',
    ].filter(Boolean);

    setDeletedChatKeys(prev => {
      const next = new Set(prev);
      keysToAdd.forEach(k => next.add(k));
      try {
        localStorage.setItem('vanguard_crm_deleted_chats', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    const isMatch = (val?: string | null) => {
      if (!val) return false;
      const v = val.trim();
      if (keysToAdd.includes(v)) return true;
      const digits = v.replace(/\D/g, '');
      if (digits && keysToAdd.includes(digits)) return true;
      return false;
    };

    setConversations(prev => {
      const updated = prev.filter(c => !isMatch(c.id) && !isMatch(c.contactId));
      try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setContacts(prev => {
      const updated = prev.filter(c => !isMatch(c.id) && !isMatch(c.phone) && !isMatch(c.lid));
      try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setMessages(prev => {
      const updated = prev.filter(m => !isMatch(m.conversationId));
      try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setDeals(prev => {
      const updated = prev.filter(d => !isMatch(d.contactId));
      try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(updated)); } catch {}
      return updated;
    });
    
    if (activeConversationId === conversationId || (activeConversationId && isMatch(activeConversationId))) {
      setActiveConversationId(null);
    }

    // 1. Notifica o servidor para remoção do estado em memória
    try {
      fetchCRMState('/api/v1/crm/state', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, phone: cleanPhone }),
      }).catch(() => {});
    } catch {}

    // 2. Dispara remoção na Z-API para que o WhatsApp Web e celular também purguem
    if (cleanPhone) {
      try {
        fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', phone: cleanPhone }),
        }).catch(() => {});

        fetch('/api/v1/zapi/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear', phone: cleanPhone }),
        }).catch(() => {});
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

    const contact = contacts.find(c => c.id === contactId);
    const cleanPhone = contact?.phone ? contact.phone.replace(/\D/g, '') : '';
    const fullPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';
    const canonicalId = fullPhone ? `conv-zapi-${fullPhone}` : `conv-${contactId}`;

    // 2. Se não achou por contactId direto, procura pelo ID canônico ou equivalência de telefone
    if (!targetConv && cleanPhone) {
      targetConv = conversations.find(c => {
        if (c.id === canonicalId || c.id === `conv-zapi-${cleanPhone}`) return true;
        const cDigits = (c.id + (c.contactId || '')).replace(/\D/g, '');
        return arePhonesEquivalent(cDigits, cleanPhone);
      });
    }

    // 3. Se ainda não existir conversa, cria e registra agora mesmo
    if (!targetConv && contact) {
      const newConv: Conversation = {
        id: canonicalId,
        tenantId: contact.tenantId || currentTenant.id,
        instanceId: instances[0]?.id || 'instance-01',
        contactId: contact.id,
        assignedUserId: contact.assignedUserId || currentUser.id,
        status: 'PENDING_TEAM',
        unreadCount: 0,
        lastMessagePreview: 'Conversa iniciada pelo CRM',
        lastMessageAt: new Date().toISOString(),
        slaBreached: false,
        isPinned: false,
        isArchived: false,
        isPersonal: contact.isPersonal ?? false,
      };

      setConversations(prev => {
        const updated = deduplicateConversations([newConv, ...prev], contacts);
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

  // Qualification is applied atomically on the server. The browser only reconciles acknowledged state.
  const refreshQualificationState = async () => {
    const tenantId = currentTenant.id;
    const response = await fetchCRMState('/api/v1/crm/state', { credentials: 'include', cache: 'no-store', headers: { 'x-tenant-id': tenantId } });
    if (!response.ok || currentTenantRef.current.id !== tenantId) return;
    const state = await response.json();
    if (!state.success || state.tenantId !== tenantId || currentTenantRef.current.id !== tenantId) return;
    setContacts(previous => mergeSyncedRecords(previous, state.contacts || [], tenantId));
    setConversations(previous => mergeSyncedRecords(previous, state.conversations || [], tenantId));
    setAiInsights(previous => ({ ...Object.fromEntries(Object.entries(previous).filter(([, insight]) => insight.tenantId !== tenantId)), ...(state.aiInsights || {}) }));
  };
  const applyAIExtractionToContact = (_conversationId: string, _contactId: string) => { void refreshQualificationState().catch(() => {}); };
  const applyBatchAIQualifications = (_qualifications: any[]) => { void refreshQualificationState().catch(() => {}); };

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
  const saveTaskCommand = async (command: any) => {
    const tenantId = currentTenant.id;
    const response = await fetch('/api/v1/tasks', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }, body: JSON.stringify(command) });
    const data = await response.json();
    if (!response.ok || !data.success || data.tenantId !== tenantId) throw new Error(data.error || 'Tarefa não salva.');
    setTasks(previous => [...previous.filter(task => task.tenantId !== tenantId), ...data.tasks]);
  };
  const toggleTask = async (taskId: string) => {
    const task = tasks.find(item => item.id === taskId && item.tenantId === currentTenant.id);
    if (task) await saveTaskCommand({ operation: 'update', id: taskId, data: { isCompleted: !task.isCompleted } });
  };
  const createTask = async (data: Partial<Task>) => {
    await saveTaskCommand({ operation: 'create', data: { assignedUserId: currentUser.id, title: 'Nova tarefa',
      taskType: 'FOLLOW_UP', dueDate: new Date(Date.now() + 86400000).toISOString(), priority: 'MEDIUM', ...data } });
  };
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await saveTaskCommand({ operation: 'update', id: taskId, data: updates });
  };
  const deleteTask = async (taskId: string) => { await saveTaskCommand({ operation: 'delete', id: taskId }); };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
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
  useEffect(() => {
    if (!isAuthenticated) { setActiveSyncJob(null); return; }
    let cancelled = false;
    fetch('/api/v1/zapi/background-sync', { headers: { 'x-tenant-id': currentTenant.id }, cache: 'no-store' })
      .then(response => response.json()).then(data => { if (!cancelled && data.success) setActiveSyncJob(data.job); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, currentTenant.id]);

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
        const res = await fetch('/api/v1/zapi/background-sync', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: activeSyncJob.id }) });
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

  const syncWhatsAppChats = async (targetInstanceId?: string, historyDays = 0): Promise<{ success: boolean; count: number }> => {
    try {
      setIsSyncingWhatsApp(true);
      const chosenInst = targetInstanceId 
        ? instances.find(i => i.id === targetInstanceId || i.zapiInstanceId === targetInstanceId)
        : (instances.find(i => i.assignedUserId === currentUser.id) || instances[0]);

      const res = await fetch('/api/v1/zapi/sync-chats', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenant.id,
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({
          instanceId: chosenInst?.zapiInstanceId || chosenInst?.id || '',
          token: (chosenInst as any)?.token || '',
          clientToken: (chosenInst as any)?.clientToken || '',
          tenantId: currentTenant.id,
          assignedUserId: chosenInst?.assignedUserId || currentUser.id,
          fetchHistoryMessages: true,
          historyDays,
        }),
      });
      const data = await res.json();

      if (data.success) {
        let mergedContacts: Contact[] = [];
        if (Array.isArray(data.contacts) && data.contacts.length > 0) {
          const validIncoming = data.contacts.filter((c: Contact) => 
            !isChatKeyDeleted(c.id, deletedChatKeys) &&
            !isChatKeyDeleted(c.phone, deletedChatKeys) &&
            !isChatKeyDeleted(c.lid, deletedChatKeys) &&
            isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt })
          );
          // Merge e higienização completa de contatos com resolução de LID para telefone real
          setContacts(prev => {
            const cleanPrev = prev.filter(c => 
              !isChatKeyDeleted(c.id, deletedChatKeys) &&
              !isChatKeyDeleted(c.phone, deletedChatKeys) &&
              !isChatKeyDeleted(c.lid, deletedChatKeys) &&
              isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt })
            );
            const mappedIncoming = validIncoming.map((c: Contact) => ({
              ...c,
              isPersonal: c.isPersonal === true ? true : false,
            }));
            const combined = [...cleanPrev, ...mappedIncoming];
            const deduplicated = deduplicateContactList(combined);
            mergedContacts = deduplicated;
            try {
              localStorage.setItem('vanguard_crm_contacts', JSON.stringify(deduplicated));
            } catch {}
            return deduplicated;
          });
        }

        // 2. Merge e unificação de Conversas
        let finalConversations: Conversation[] = [];
        if (Array.isArray(data.conversations)) {
          const validConvs = data.conversations.filter((c: Conversation) => 
            !isChatKeyDeleted(c.id, deletedChatKeys) &&
            !isChatKeyDeleted(c.contactId, deletedChatKeys) &&
            isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt })
          );
          setConversations(prev => {
            const cleanPrev = prev.filter(c => 
              !isChatKeyDeleted(c.id, deletedChatKeys) &&
              !isChatKeyDeleted(c.contactId, deletedChatKeys) &&
              isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt })
            );
            const combined = [...cleanPrev, ...validConvs];
            const deduplicated = deduplicateConversations(combined, mergedContacts.length > 0 ? mergedContacts : contacts);
            finalConversations = deduplicated;
            try {
              localStorage.setItem('vanguard_crm_conversations', JSON.stringify(deduplicated));
            } catch {}
            return deduplicated;
          });
        }

        // 3. Merge de Mensagens (Substitui histórico da conversa sincronizada pelo lote limpo)
        let finalMessages: Message[] = [];
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const validIncoming = data.messages.filter((m: Message) => !isChatKeyDeleted(m.conversationId, deletedChatKeys));
            const merged = deduplicateMessages([...prev, ...validIncoming]);
            finalMessages = merged;
            try {
              localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // 4. Sincroniza Snapshot com a API de Estado do Servidor
        try {
          fetchCRMState('/api/v1/crm/state', {
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

  const resetCRMDatabase = async (resyncAfter = false): Promise<{ success: boolean; message: string }> => {
    try {
      setIsSyncingWhatsApp(true);
      // 1. Limpa o servidor via endpoint dedicado com autenticação e escopo de tenant
      try {
        await fetch('/api/v1/crm/reset', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({
            tenantId: currentTenant.id,
            wipeAll: false,
          }),
        });
      } catch (netErr) {
        console.warn('Aviso de rede ao resetar dados no servidor:', netErr);
      }

      // 2. Limpa estados no frontend
      setContacts([]);
      setConversations([]);
      setMessages([]);
      setDeals([]);
      setActiveConversationId(null);
      setAiInsights({});

      // 3. Limpa chaves do localStorage e grava arrays vazios para evitar restauração de dados antigos
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('vanguard_crm_contacts');
          localStorage.removeItem('vanguard_crm_conversations');
          localStorage.removeItem('vanguard_crm_messages');
          localStorage.removeItem('vanguard_crm_deals');
          localStorage.removeItem('vanguard_crm_ai_insights');
          localStorage.removeItem('vanguard_crm_active_conv_id');
          localStorage.setItem('vanguard_crm_contacts', JSON.stringify([]));
          localStorage.setItem('vanguard_crm_conversations', JSON.stringify([]));
          localStorage.setItem('vanguard_crm_messages', JSON.stringify([]));
          localStorage.setItem('vanguard_crm_deals', JSON.stringify([]));
          localStorage.setItem('vanguard_crm_ai_insights', JSON.stringify({}));
        } catch {}
      }

      // 4. Se solicitado, resincroniza imediatamente o WhatsApp de forma 100% limpa
      if (resyncAfter) {
        await syncWhatsAppChats();
      }

      return {
        success: true,
        message: resyncAfter
          ? 'Base de dados resetada com sucesso e sincronização limpa concluída.'
          : 'Base de dados de leads e conversas zerada com sucesso!',
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
        consentGiven: false,
        consentDate: new Date().toISOString(),
        hasOptedOut: false,
        isPersonal: false,
        monthlyIncome: rec.monthlyIncome,
        downPaymentAvailable: rec.downPaymentAvailable,
        maxPropertyValue: rec.maxPropertyValue,
        preferredPropertyType: rec.preferredPropertyType,
        targetRegions: rec.targetRegions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newContacts.push(newContact);

      if (createDeals && effectiveCurrentPipeline?.stages?.[0]) {
        const firstStage = effectiveCurrentPipeline.stages[0];
        newDeals.push({
          id: `deal-${Date.now()}-${clean.slice(-4)}`,
          tenantId: currentTenant.id,
          contactId,
          pipelineId: effectiveCurrentPipeline.id,
          stageId: firstStage.id,
          title: `Interesse • ${newContact.name}`,
          expectedValue: !isNaN(Number(rec.maxPropertyValue)) && Number(rec.maxPropertyValue) > 0 ? Number(rec.maxPropertyValue) : 0,
          manualProbability: 0,
          aiProbabilityScore: 0,
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
    const selected = instances.find(i => i.tenantId === currentTenant.id && (i.id === activeInstanceId || i.zapiInstanceId === activeInstanceId)) || instances.find(i => i.tenantId === currentTenant.id);
    try {
      const res = await fetch(`/api/v1/zapi/status?tenantId=${encodeURIComponent(currentTenant.id)}${selected?.zapiInstanceId ? '&instanceId=' + encodeURIComponent(selected.zapiInstanceId) : ''}`, {
        credentials: 'include',
        headers: {
          'x-tenant-id': currentTenant?.id || 'tenant-amabile-barbarotti',
          'x-user-id': currentUser?.id || 'user-1',
          'x-user-email': currentUser?.email || 'admin@amabile.com',
        }
      });
      const data = await res.json();
      if (currentTenantRef.current.id !== currentTenant.id || activeInstanceIdRef.current !== activeInstanceId) return false;
      const connected = Boolean(data.success && data.connected);
      setIsZapiConnected(connected);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vanguard_crm_zapi_connected', connected ? 'true' : 'false');
      }

      if (connected) {
        setZapiLiveDetails({
          connected: true,
          phone: data.phone,
          name: data.name,
          avatarUrl: data.avatarUrl,
          deviceModel: data.deviceModel,
          battery: data.battery,
          isBusiness: data.isBusiness,
        });

        setInstances(prev => {
          const updated = prev.length > 0 
            ? prev.map(i => (i.tenantId !== currentTenant.id || i.zapiInstanceId !== data.instanceId) ? i : ({
                ...i,
                status: 'CONNECTED' as const,
                phoneNumber: data.phone || i.phoneNumber || '+55 (48) 9979-7603',
                name: data.name || i.name || 'Central WhatsApp • Amábile Barbarotti',
                lastSyncAt: new Date().toISOString()
              }))
            : [{
                id: 'inst-amabile-central',
                tenantId: currentTenant?.id || 'tenant-amabile-barbarotti',
                name: data.name || 'Central WhatsApp • Amábile Barbarotti',
                phoneNumber: data.phone || '+55 (48) 9979-7603',
                zapiInstanceId: data.instanceId || '3F8144490C66805B4E3FD64A35E2F2DC',
                status: 'CONNECTED' as const,
                type: 'COMPANY_CENTRAL' as const,
                isDefault: true,
                batteryLevel: 100,
                lastSyncAt: new Date().toISOString()
              }];
          try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
          return updated;
        });
        return true;
      } else {
        setZapiLiveDetails({
          connected: false,
          phone: data.phone,
          name: data.name,
        });

        setInstances(prev => {
          const updated = prev.map(i => (i.tenantId !== currentTenant.id || (data.instanceId && i.zapiInstanceId !== data.instanceId)) ? i : ({
            ...i,
            status: 'DISCONNECTED' as const,
            lastSyncAt: new Date().toISOString()
          }));
          try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updated)); } catch {}
          return updated;
        });
        return false;
      }
    } catch {
      setIsZapiConnected(false);
      setZapiLiveDetails(null);
      return false;
    }
  };

  // Checa status de conexão da Z-API ao carregar e periodicamente a cada 15s (com respeito ao document.hidden)
  useEffect(() => {
    setIsZapiConnected(false);
    setZapiLiveDetails(null);
    let isMounted = true;
    const checkStatus = async () => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      await refreshLiveZapiStatus();
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        checkStatus();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => { 
      isMounted = false; 
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [currentTenant.id, currentUser.id, activeInstanceId, instances.length]);

  // O servidor recebe mesmo sem navegador. A tela retoma pelo cursor persistido e
  // reconcilia o snapshot completo ao abrir, voltar à aba ou recuperar a rede.
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  activeConversationIdRef.current = activeConversationId;

  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || !currentTenant.id) return;
    let isMounted = true;
    let inFlight = false;
    let fullSyncPending = true;
    let cursor = 0;
    const tenantId = currentTenant.id;
    const storageKey = `vanguard_crm_last_sync_timestamp:${tenantId}`;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved >= 0) cursor = saved;
    } catch {}

    const applyServerState = (data: any) => {
      const incomingContacts: Contact[] = Array.isArray(data.contacts) ? data.contacts : [];
      const incomingConversations: Conversation[] = (Array.isArray(data.conversations) ? data.conversations : [])
        .filter((c: Conversation) => !isChatKeyDeleted(c.id, deletedChatKeys) && !isChatKeyDeleted(c.contactId, deletedChatKeys))
        .map((c: Conversation) => c.id === activeConversationIdRef.current ? { ...c, unreadCount: 0 } : c);
      const conversationIds = new Set(incomingConversations.map(c => c.id));
      const incomingMessages: Message[] = data.messages.filter((m: Message) => conversationIds.has(m.conversationId))
        .map(({ phone, instanceId, lid, fromMe, mediaUrl, mediaType, ...message }: any) => message);
      setContacts(prev => mergeSyncedRecords(prev, incomingContacts, tenantId));
      setConversations(prev => mergeSyncedRecords(prev, incomingConversations, tenantId));
      setMessages(prev => mergeSyncedRecords(prev, incomingMessages, tenantId));
      if (Array.isArray(data.deals)) setDeals(prev => mergeSyncedRecords(prev, data.deals, tenantId));
      if (data.aiInsights) setAiInsights(previous => ({ ...Object.fromEntries(Object.entries(previous).filter(([, insight]) => insight.tenantId !== tenantId)), ...data.aiInsights }));
      if (data.commercial) applyCommercialConfig(tenantId, data.commercial);
      if (Array.isArray(data.tasks)) setTasks(prev => [...prev.filter(task => task.tenantId !== tenantId), ...data.tasks.filter((task: Task) => task.tenantId === tenantId)]);
      if (Array.isArray(data.quickReplies)) setQuickReplies(prev => [...prev.filter(item => item.tenantId !== tenantId), ...data.quickReplies.filter((item: QuickReplyTemplate) => item.tenantId === tenantId)]);
    };

    const refresh = async (full = false) => {
      if (full) fullSyncPending = true;
      if (!isMounted || inFlight || document.hidden) return;
      inFlight = true;
      const readSnapshot = fullSyncPending;
      try {
        const url = readSnapshot ? '/api/v1/crm/state'
          : `/api/v1/webhooks/zapi/events?tenantId=${encodeURIComponent(tenantId)}&since=${cursor}`;
        const res = await fetchCRMState(url, { credentials: 'include', cache: 'no-store', headers: { 'x-tenant-id': tenantId } });
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (!isMounted || !data.success || data.tenantId !== tenantId || !Array.isArray(data.messages)) return;
        applyServerState(data);
        const nextCursor = readSnapshot ? crmEventCursor(data) : Number(data.serverTime);
        if (Number.isFinite(nextCursor) && nextCursor >= 0) {
          cursor = nextCursor;
          try { localStorage.setItem(storageKey, String(cursor)); } catch {}
        }
        if (readSnapshot) fullSyncPending = false;
      } catch {
        // Mantém o cursor e repete após a falha, incluindo toda a pausa.
      } finally { inFlight = false; }
    };

    const resume = () => { if (!document.hidden) void refresh(true); };
    void refresh(true);
    const webhookInterval = setInterval(() => void refresh(), 3000);
    const syncInterval = setInterval(() => void refresh(true), 60000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    return () => {
      isMounted = false;
      clearInterval(webhookInterval);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
    };
  }, [currentTenant.id, isAuthenticated, isAuthReady, deletedChatKeys]);

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
            parsed = parsed.map((p: Proposal) => {
              const isAmabileProp = !p.tenantId || p.tenantId === 'tenant-amabile-barbarotti' || p.tenantId === 'tenant-vanguard-01' || p.tenantId.includes('amabile');
              return {
                ...p,
                tenantId: isAmabileProp ? 'tenant-amabile-barbarotti' : p.tenantId,
              };
            });
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
            parsed = parsed.map((t: FinancialTransaction) => {
              const isAmabileTx = !t.tenantId || t.tenantId === 'tenant-amabile-barbarotti' || t.tenantId === 'tenant-vanguard-01' || t.tenantId.includes('amabile');
              return {
                ...t,
                tenantId: isAmabileTx ? 'tenant-amabile-barbarotti' : t.tenantId,
              };
            });
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
  const isCurrentAmabile = currentTenant.id === 'tenant-amabile-barbarotti' || currentTenant.id.includes('amabile');

  const scopedContacts = useMemo(() => {
    return contacts.filter(c => c.tenantId === currentTenant.id);
  }, [contacts, currentTenant.id, isCurrentAmabile]);

  const scopedConversations = useMemo(() => {
    return conversations.filter(c => c.tenantId === currentTenant.id);
  }, [conversations, currentTenant.id, isCurrentAmabile]);

  const scopedInstances = useMemo(() => {
    return instances.filter(i => i.tenantId === currentTenant.id);
  }, [instances, currentTenant.id, isCurrentAmabile]);

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
  }, [deals, currentTenant.id, isCurrentAmabile]);

  const scopedTasks = useMemo(() => {
    return tasks.filter(t => t.tenantId === currentTenant.id);
  }, [tasks, currentTenant.id, isCurrentAmabile]);

  const scopedProposals = useMemo(() => {
    return proposals.filter(p => p.tenantId === currentTenant.id);
  }, [proposals, currentTenant.id, isCurrentAmabile]);

  const scopedTransactions = useMemo(() => {
    return transactions.filter(t => t.tenantId === currentTenant.id);
  }, [transactions, currentTenant.id, isCurrentAmabile]);

  const scopedAlerts = useMemo(() => {
    return alerts.filter(a => a.tenantId === currentTenant.id);
  }, [alerts, currentTenant.id]);

  const scopedQuickReplies = useMemo(() => {
    return quickReplies.filter(q => q.tenantId === currentTenant.id);
  }, [quickReplies, currentTenant.id]);

  // Índices O(1) de alta performance para evitar travamentos de UI e buscas lineares repetidas
  const lastMessageByConvId = useMemo(() => {
    const map = new Map<string, Message>();
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.tenantId !== currentTenant.id) continue;
      if (!map.has(m.conversationId)) {
        map.set(m.conversationId, m);
      }
    }
    return map;
  }, [messages, currentTenant.id]);

  const convByContactIdMap = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const c of scopedConversations) {
      if (!map.has(c.contactId)) {
        map.set(c.contactId, c);
      }
    }
    return map;
  }, [scopedConversations]);

  const convByIdMap = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const c of scopedConversations) {
      map.set(c.id, c);
    }
    return map;
  }, [scopedConversations]);

  const contactByIdMap = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of scopedContacts) {
      map.set(c.id, c);
    }
    return map;
  }, [scopedContacts]);

  const openDealByContactIdMap = useMemo(() => {
    const map = new Map<string, Deal>();
    for (const d of scopedDeals) {
      if (d.status === 'OPEN' && !map.has(d.contactId)) {
        map.set(d.contactId, d);
      }
    }
    return map;
  }, [scopedDeals]);

  const dealByIdMap = useMemo(() => {
    const map = new Map<string, Deal>();
    for (const d of scopedDeals) {
      map.set(d.id, d);
    }
    return map;
  }, [scopedDeals]);

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
  const isCourteousClosingMessage = (text?: string | null): boolean => {
    if (!text) return false;
    const clean = text.toLowerCase().trim().replace(/[.,!?;:()_\-\n\r]/g, '');
    const closings = [
      'obrigado', 'obrigada', 'valeu', 'vlw', 'show', 'ok', 'blz', 'beleza', 
      'combinado', 'fechado', 'perfeito', 'otimo', 'ótimo', 'tks', 'thanks', 
      'tmj', 'certo', 'tudo bem', 'ta bom', 'tá bom', 'ate logo', 'até logo',
      'bom dia', 'boa tarde', 'boa noite', 'opa', 'olá', 'ola', 'sim', 'nao', 'não',
      'muito obrigado', 'muito obrigada', 'de nada', 'disponha', 'top'
    ];
    if (clean.length <= 18 && closings.includes(clean)) return true;
    if (clean.length <= 4) return true;
    return false;
  };

  const getContactUrgencyAnalysis = (
    contactId: string, 
    dealId?: string, 
    conversationId?: string
  ): ContactUrgencyAnalysis | null => {
    const contact = contactByIdMap.get(contactId) || scopedContacts.find(c => c.id === contactId);
    if (!contact || contact.isPersonal) return null;
    if (isWhatsAppChannelOrGroup(contact)) return null;

    const conv = conversationId 
      ? (convByIdMap.get(conversationId) || scopedConversations.find(c => c.id === conversationId))
      : (convByContactIdMap.get(contactId) || scopedConversations.find(c => c.contactId === contactId));

    if (conv?.isPersonal || conv?.isArchived) return null;
    if (conv && isWhatsAppChannelOrGroup(conv)) return null;

    const deal = dealId 
      ? (dealByIdMap.get(dealId) || scopedDeals.find(d => d.id === dealId))
      : (openDealByContactIdMap.get(contactId) || scopedDeals.find(d => d.contactId === contactId && d.status === 'OPEN'));

    const stage = deal ? effectiveCurrentPipeline.stages.find(s => s.id === deal.stageId) : undefined;

    // Busca última mensagem da conversa de forma O(1) instantânea (sem filtrar todo o array de mensagens)
    const lastMsg = conv ? (lastMessageByConvId.get(conv.id) || null) : null;

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

    // Critério Real de "No Vácuo":
    // 1) Tem mensagens NÃO LIDAS pendentes (unreadCount > 0) e não é conversa arquivada
    // 2) OU mensagem recente (menos de 24h) com remetente CONTACT, sem resposta da equipe e que NÃO seja mera cortesia de encerramento
    const hasUnread = conv ? (conv.unreadCount || 0) > 0 : false;
    const isLastFromContact = lastMsg ? lastMsg.senderType === 'CONTACT' : hasUnread;
    const isClosing = isCourteousClosingMessage(lastMsg?.content);
    
    const isUnansweredByTeam = (diffDays < 7) && isLastFromContact && (
      hasUnread || (diffHours < 24 && !isClosing)
    );
    const unansweredMinutes = isUnansweredByTeam ? diffMinutes : 0;

    let urgencyLevel: InactivityUrgencyLevel = 'HEALTHY';
    let urgencyScore = 10;
    let urgencyReason = 'Interação recente em dia';
    let suggestedAction = 'Acompanhamento normal';

    // REGRA 1: CLIENTE AGUARDANDO RESPOSTA (NO VÁCUO REAL)
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
    // REGRA 2: NEGOCIAÇÃO PARADA / ESFRIANDO NO FUNIL (APENAS NEGÓCIOS ABERTOS)
    else if (deal && deal.status === 'OPEN') {
      const isHotStage = stage?.id === 'stage-6' || stage?.id === 'stage-5' || stage?.name?.toLowerCase().includes('proposta') || stage?.name?.toLowerCase().includes('visita');
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
    // REGRA 3: NOVO LEAD RECÉM-CRIADO SEM PRIMEIRO ATENDIMENTO
    else if (!contact.lastTeamInteractionAt && diffHours >= 2 && diffDays <= 5) {
      urgencyLevel = 'CRITICAL_UNANSWERED';
      urgencyScore = 85;
      urgencyReason = `Novo lead aguardando primeiro contato ${formattedTimeAgo}`;
      suggestedAction = 'Realizar primeiro contato no WhatsApp imediatamente';
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

    // 1. Analisa conversas ativas (ignora arquivadas, grupos, canais e pessoais)
    scopedConversations.forEach(conv => {
      if (conv.isArchived || conv.isPersonal) return;
      if (isWhatsAppChannelOrGroup(conv)) return;

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

    // 3. Analisa novos leads cadastrados recentemente sem negócio
    scopedContacts.forEach(contact => {
      if (contact.isPersonal) return;
      if (seenContactIds.has(contact.id)) return;
      if (isWhatsAppChannelOrGroup(contact)) return;

      if (!contact.lastTeamInteractionAt) {
        const analysis = getContactUrgencyAnalysis(contact.id);
        if (analysis && analysis.urgencyLevel !== 'HEALTHY') {
          list.push(analysis);
          seenContactIds.add(contact.id);
        }
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
      tenantCatalogLoading,
      tenantCatalogError,
      refreshTenantCatalog,
      currentTenant,
      setCurrentTenant,
      updateTenant,
      saveCommercialService,
      updateTenantById,
      createTenant,
      updateTenantStatus,
      deleteTenant,
      users: scopedUsers,
      currentUser,
      setCurrentUser,
      updateUser,
      createUser,
      deleteUser,
      toggleUserStatus,
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
      setCurrentPipelineById,
      createPipeline,
      updatePipeline,
      deletePipeline,
      moveDealToPipeline,
      deals: scopedDeals,
      moveDealStage,
      createDeal,
      updateDeal,
      deleteDeal,
      updatePipelineStages,
      lossReasons: scopedLossReasons,
      createLossReason,
      updateLossReason,
      deleteLossReason,
      leadSourceGroups: scopedLeadSourceGroups,
      createLeadSourceGroup,
      updateLeadSourceGroup,
      deleteLeadSourceGroup,
      leadSources: scopedLeadSources,
      createLeadSource,
      updateLeadSource,
      deleteLeadSource,
      instances: scopedInstances,
      activeInstanceId: effectiveActiveInstanceId,
      setActiveInstanceId,
      createInstance,
      updateInstance,
      deleteInstance,
      refreshLiveZapiStatus,
      isZapiConnected,
      zapiLiveDetails,
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
      toggleConversationAI,
      deletedChatKeys,
      pinConversation,
      assignConversation,
      simulateIncomingMessage,
      aiInsights,
      updateAIInsight,
      applyAIExtractionToContact,
      applyBatchAIQualifications,
      recordAIFeedback,
      tasks: scopedTasks,
      toggleTask,
      createTask,
      updateTask,
      deleteTask,
      alerts: scopedAlerts,
      dismissAlert,
      quickReplies: scopedQuickReplies,
      createQuickReply,
      updateQuickReply,
      toggleQuickReplyActive,
      deleteQuickReply,
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
      toggleMasterUserStatus,
      resendMasterUserInvite,
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
