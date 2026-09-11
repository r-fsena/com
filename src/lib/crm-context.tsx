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
import { 
  isWhatsAppChannelOrGroup, 
  isRealWhatsAppConversation, 
  canonicalPhoneKey, 
  arePhonesEquivalent, 
  isWhatsAppSystemMessage,
  isLidIdentifier,
  cleanLid,
  formatCanonicalPhone
} from '@/lib/whatsapp-filter';
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
    messageType?: MessageType
  ) => void;
  markConversationAsRead: (conversationId: string) => void;
  clearChatMessages: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string, archive?: boolean) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  deletedChatKeys: Set<string>;
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
  const phoneMap = new Map<string, Contact>();
  const lidMap = new Map<string, Contact>();
  const idMap = new Map<string, Contact>();
  const nameMap = new Map<string, Contact>();
  const result: Contact[] = [];

  list.forEach(contact => {
    if (!contact) return;
    const isPhoneLid = isLidIdentifier(contact.phone);
    const pureLid = cleanLid(contact.lid || (isPhoneLid ? contact.phone : ''));

    // Se o contato foi salvo com LID no campo de telefone, preserva no campo lid
    if (pureLid && !contact.lid) {
      contact.lid = pureLid;
    }

    const pKey = !isPhoneLid ? canonicalPhoneKey(contact.phone) : '';
    const normName = contact.name && !contact.name.startsWith('+') && !contact.name.startsWith('WhatsApp') && contact.name !== 'Lead WhatsApp' && contact.name !== 'Cliente'
      ? contact.name.toLowerCase().trim()
      : '';

    // Tenta resolver se esse LID já foi mapeado para um telefone conhecido no navegador
    let mappedPhone = '';
    if (pureLid && typeof window !== 'undefined') {
      try {
        const storedMap = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
        if (storedMap[pureLid]) mappedPhone = storedMap[pureLid];
      } catch {}
    }

    // Se o contato atual tem o mesmo avatar de outro contato com telefone real, é o mesmo cliente
    const avatarMatch = (contact.avatarUrl && !contact.avatarUrl.includes('ui-avatars.com')) 
      ? result.find(c => c.avatarUrl === contact.avatarUrl && c.phone && !isLidIdentifier(c.phone))
      : null;

    const existing = (pKey ? phoneMap.get(pKey) : null) 
      || (mappedPhone ? phoneMap.get(canonicalPhoneKey(mappedPhone)) : null)
      || (pureLid ? lidMap.get(pureLid) : null) 
      || avatarMatch
      || idMap.get(contact.id)
      || (normName ? nameMap.get(normName) : null);

    if (existing) {
      const existingIsLid = isLidIdentifier(existing.phone);
      const isSyntheticA = existing.phone && (existing.phone.includes('554863562855') || existing.id.includes('554863562855'));
      const isSyntheticB = contact.phone && (contact.phone.includes('554863562855') || contact.id.includes('554863562855'));

      // Prefere SEMPRE o telefone real
      const chosenPhone = (!existingIsLid && !isSyntheticA && existing.phone) 
        ? existing.phone 
        : ((!isPhoneLid && !isSyntheticB && contact.phone) ? contact.phone : existing.phone);

      const chosenLid = cleanLid(existing.lid || pureLid || (existingIsLid ? existing.phone : '')) || undefined;
      const chosenId = chosenPhone && !isLidIdentifier(chosenPhone) && !isSyntheticA 
        ? `contact-zapi-${chosenPhone.replace(/\D/g, '')}` 
        : existing.id;

      // Se um dos nomes for o nome do corretor (ex: "Rafael Sena" ou "Corretor"), descarta e mantém o nome do cliente ("anna carolina")
      const isBrokerName = (n?: string) => !n || n === 'Rafael Sena' || n.toLowerCase().includes('corretor') || n.startsWith('WhatsApp ') || n === 'Cliente';
      const cleanName = !isBrokerName(existing.name) ? existing.name : (!isBrokerName(contact.name) ? contact.name : (existing.name || contact.name));

      const merged: Contact = {
        ...existing,
        ...contact,
        id: chosenId,
        phone: chosenPhone,
        lid: chosenLid,
        name: cleanName,
        monthlyIncome: existing.monthlyIncome || contact.monthlyIncome,
        downPaymentAvailable: existing.downPaymentAvailable || contact.downPaymentAvailable,
        maxPropertyValue: existing.maxPropertyValue || contact.maxPropertyValue,
        preferredPropertyType: existing.preferredPropertyType || contact.preferredPropertyType,
        targetRegions: Array.from(new Set([...(existing.targetRegions || []), ...(contact.targetRegions || [])])),
        tags: Array.from(new Set([...(existing.tags || []), ...(contact.tags || [])])),
        email: existing.email || contact.email,
        assignedUserId: existing.assignedUserId || contact.assignedUserId,
      };

      if (typeof window !== 'undefined' && chosenLid && chosenPhone && !isLidIdentifier(chosenPhone)) {
        try {
          const storedMap = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
          storedMap[chosenLid] = chosenPhone.replace(/\D/g, '');
          localStorage.setItem('brokiva_lid_phone_map', JSON.stringify(storedMap));
        } catch {}
      }

      const realPKey = canonicalPhoneKey(chosenPhone);
      if (realPKey && !isLidIdentifier(chosenPhone)) phoneMap.set(realPKey, merged);
      if (chosenLid) lidMap.set(chosenLid, merged);
      if (normName) nameMap.set(normName, merged);
      idMap.set(merged.id, merged);

      const idx = result.findIndex(c => c.id === existing.id || c.id === contact.id || c.id === merged.id);
      if (idx >= 0) result[idx] = merged;
    } else {
      const finalLid = pureLid || (isPhoneLid ? cleanLid(contact.phone) : undefined);
      const withTimestamps: Contact = {
        ...contact,
        lid: finalLid,
        isPersonal: contact.isPersonal ?? false,
        firstSyncedAt: contact.firstSyncedAt || new Date().toISOString(),
        lastSyncedAt: contact.lastSyncedAt || new Date().toISOString(),
      };

      if (typeof window !== 'undefined' && finalLid && contact.phone && !isLidIdentifier(contact.phone)) {
        try {
          const storedMap = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
          storedMap[finalLid] = contact.phone.replace(/\D/g, '');
          localStorage.setItem('brokiva_lid_phone_map', JSON.stringify(storedMap));
        } catch {}
      }

      if (pKey) phoneMap.set(pKey, withTimestamps);
      if (finalLid) lidMap.set(finalLid, withTimestamps);
      if (normName) nameMap.set(normName, withTimestamps);
      idMap.set(contact.id, withTimestamps);
      result.push(withTimestamps);
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

export const INITIAL_DELETED_CHAT_KEYS = [
  '5511915361868',
  '11915361868',
  'contact-zapi-5511915361868',
  'conv-zapi-5511915361868',
  '554896290235',
  '4896290235',
  '5548996290235',
  'contact-zapi-554896290235',
  'conv-zapi-554896290235',
];

export function getStoredDeletedChatKeys(): Set<string> {
  const set = new Set<string>(INITIAL_DELETED_CHAT_KEYS);
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('vanguard_crm_deleted_chats');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          arr.forEach((k: any) => {
            const clean = String(k).trim();
            if (clean) set.add(clean);
          });
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
                    campaigns: false,
                    automations: false,
                  },
                });
              } else {
                if (seenIds.has(t.id)) continue;
                seenIds.add(t.id);
                cleanList.push(t);
              }
            }

            if (!seenIds.has('tenant-amabile-barbarotti')) {
              cleanList.unshift(MOCK_TENANTS[0]);
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

  const [pipelines, setPipelines] = useState<Pipeline[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_pipelines');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((p: Pipeline) => {
              const isAmabilePipe = !p.tenantId || p.tenantId === 'tenant-amabile-barbarotti' || p.tenantId.includes('amabile') || p.tenantId.startsWith('tenant-17');
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
          if (parsed && Array.isArray(parsed.stages) && parsed.stages.length > 0 && parsed.tenantId !== 'tenant-vanguard-01') return parsed;
        }
      } catch {}
    }
    return MOCK_PIPELINES[0];
  });

  const [currentTenant, setCurrentTenantState] = useState<Tenant>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_tenant');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id !== 'tenant-horizonte-02' && parsed.id !== 'tenant-alphaville-03' && parsed.id !== 'tenant-vanguard-01') {
            const isAmabile = parsed.id === 'tenant-amabile-barbarotti' || 
                              parsed.slug === 'amabile-barbarotti' || 
                              (parsed.name && parsed.name.toLowerCase().includes('amabile'));
            if (isAmabile) {
              parsed.id = 'tenant-amabile-barbarotti';
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

  const setCurrentTenant = (tenantOrFn: Tenant | ((prev: Tenant) => Tenant)) => {
    setCurrentTenantState(prev => {
      const raw = typeof tenantOrFn === 'function' ? tenantOrFn(prev) : tenantOrFn;
      if (!raw) return prev;

      const isAmabile = raw.id === 'tenant-amabile-barbarotti' || 
                        raw.slug === 'amabile-barbarotti' || 
                        (raw.name && raw.name.toLowerCase().includes('amabile'));
      
      const canonicalId = isAmabile ? 'tenant-amabile-barbarotti' : raw.id;
      const foundInList = tenants.find(t => t.id === canonicalId) || (isAmabile ? MOCK_TENANTS[0] : null);

      const resolvedFlags = isAmabile ? {
        ...(foundInList?.featureFlags || raw.featureFlags || DEFAULT_FEATURE_FLAGS),
        proposals: false,
        asaasBilling: false,
        campaigns: false,
        automations: false,
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

  // Checa se já existe sessão salva no navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vanguard_auth_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session?.userEmail) {
          const cleanEmail = session.userEmail.toLowerCase();
          
          // Verifica se é master user
          const foundMaster = masterUsers.find(m => m.email?.toLowerCase() === cleanEmail);
          if (foundMaster) {
            if (foundMaster.isActive === false) {
              localStorage.removeItem('vanguard_auth_session');
              setIsAuthenticated(false);
              return;
            }
            const masterAsUser: User = {
              id: foundMaster.id,
              name: foundMaster.name,
              email: foundMaster.email,
              phone: foundMaster.phone || '',
              role: 'SUPERADMIN',
              isActive: true,
            };
            setCurrentUser(masterAsUser);
            setIsAuthenticated(true);
            return;
          }

          const u = users.find(x => x.email.toLowerCase() === cleanEmail);
          if (u) {
            if (u.isActive === false || u.status === 'INACTIVE') {
              localStorage.removeItem('vanguard_auth_session');
              setIsAuthenticated(false);
              return;
            }
            setCurrentUser(u);
            // Renova o cookie assinado HttpOnly no servidor para requisições à API
            fetch('/api/v1/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: u.email,
                userId: u.id,
                role: u.role,
                tenantId: currentTenant.id,
              }),
            }).catch(() => {});
          }
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
  }, [users, masterUsers, currentTenant.id]);

  const login = (email: string, role?: string) => {
    let targetUser = currentUser;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verifica se é um usuário Master
    const foundMaster = masterUsers.find(m => m.email?.toLowerCase() === cleanEmail);
    if (foundMaster) {
      if (foundMaster.isActive === false) {
        throw new Error('Esta conta de Administrador Master foi desativada.');
      }
      const masterAsUser: User = {
        id: foundMaster.id,
        name: foundMaster.name,
        email: foundMaster.email,
        phone: foundMaster.phone || '',
        role: 'SUPERADMIN',
        isActive: true,
      };
      targetUser = masterAsUser;
      setCurrentUser(masterAsUser);
    } else {
      // 2. Procura nos usuários regulares da imobiliária
      const foundUser = users.find(u => u.email.toLowerCase() === cleanEmail) ||
        (cleanEmail === 'rafael@faithhubs.com' || cleanEmail.includes('rafael') || cleanEmail.includes('admin') || cleanEmail === 'admin@faithhubs.com' || cleanEmail === 'superadmin@faithhubs.com'
          ? (users.find(u => u.email.toLowerCase() === 'rafael@faithhubs.com') || users.find(u => u.role === 'SUPERADMIN') || MOCK_USERS[0])
          : null);

      if (foundUser) {
        if (foundUser.isActive === false || foundUser.status === 'INACTIVE') {
          throw new Error('Esta conta de usuário foi desativada pelo administrador.');
        }
        targetUser = foundUser;
        setCurrentUser(foundUser);
      } else if (role) {
        const roleUser = users.find(u => u.role === role);
        if (roleUser) {
          if (roleUser.isActive === false || roleUser.status === 'INACTIVE') {
            throw new Error('Esta conta de usuário foi desativada pelo administrador.');
          }
          targetUser = roleUser;
          setCurrentUser(roleUser);
        }
      }
    }

    try {
      localStorage.setItem('vanguard_auth_session', JSON.stringify({ userEmail: targetUser.email, userId: targetUser.id }));
      localStorage.setItem('vanguard_crm_current_tab', 'dashboard');
      
      const isMasterLogin = typeof window !== 'undefined' && window.location.search.includes('action=master-login');
      if (foundMaster || (isMasterLogin && targetUser.role === 'SUPERADMIN')) {
        localStorage.setItem('faithhubs_view_mode', 'SAAS_MASTER');
      } else {
        localStorage.setItem('faithhubs_view_mode', 'TENANT_CRM');
      }

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
              .filter((c: Contact) => c.tenantId !== 'tenant-vanguard-01' && !isChatKeyDeleted(c.id, initialDel) && !isChatKeyDeleted(c.phone, initialDel) && !isChatKeyDeleted(c.lid, initialDel) && isRealWhatsAppConversation({ id: c.id, phone: c.phone, lastMessageTime: c.lastClientInteractionAt || c.updatedAt }))
              .map((c: Contact) => {
                const isAmabileContact = !c.tenantId || c.tenantId === 'tenant-amabile-barbarotti' || c.tenantId.includes('amabile') || c.tenantId.startsWith('tenant-17');
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
              .filter((d: Deal) => d.tenantId !== 'tenant-vanguard-01')
              .map((d: Deal) => {
                const isAmabileDeal = !d.tenantId || d.tenantId === 'tenant-amabile-barbarotti' || d.tenantId.includes('amabile') || d.tenantId.startsWith('tenant-17');
                return {
                  ...d,
                  tenantId: isAmabileDeal ? 'tenant-amabile-barbarotti' : d.tenantId,
                };
              });
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
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((inst: WhatsAppInstance) => {
              const isAmabileInst = !inst.tenantId || inst.tenantId === 'tenant-amabile-barbarotti' || inst.tenantId.includes('amabile') || inst.tenantId.startsWith('tenant-17');
              return {
                ...inst,
                tenantId: isAmabileInst ? 'tenant-amabile-barbarotti' : inst.tenantId,
              };
            });
          }
        }
      } catch {}
    }
    return MOCK_INSTANCES;
  });

  const [activeInstanceId, setActiveInstanceId] = useState<string>(() => {
    return MOCK_INSTANCES[0]?.id || 'inst-amabile-central';
  });

  const [isZapiConnected, setIsZapiConnected] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vanguard_crm_zapi_connected') === 'true';
    }
    return false;
  });

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
            const initialDel = getStoredDeletedChatKeys();
            parsed = parsed
              .filter((c: Conversation) => {
                if (c.tenantId === 'tenant-vanguard-01') return false;
                if (isChatKeyDeleted(c.id, initialDel) || isChatKeyDeleted(c.contactId, initialDel)) return false;
                const digits = (c.id + (c.contactId || '')).replace(/\D/g, '');
                if (digits && isChatKeyDeleted(digits, initialDel)) return false;
                // Conversas válidas do WhatsApp
                return isRealWhatsAppConversation({ id: c.id, phone: c.contactId, lastMessageTime: c.lastMessageAt }) || Boolean(c.lastMessagePreview && c.lastMessagePreview.length > 0);
              })
              .map((c: Conversation) => {
                const isAmabileConv = !c.tenantId || c.tenantId === 'tenant-amabile-barbarotti' || c.tenantId.includes('amabile') || c.tenantId.startsWith('tenant-17');
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
            parsed = parsed.filter((m: Message) => {
              if (m.tenantId === 'tenant-vanguard-01') return false;
              if (isChatKeyDeleted(m.conversationId, initialDel)) return false;
              if (!m.content) return false;
              const clean = m.content.trim().toLowerCase();
              if (isWhatsAppSystemMessage(m.content)) return false;
              if (/^\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]?$/i.test(clean) || clean === '1,0×' || clean === '1,0x') return false;
              if (clean.includes('mensagem apagada') || clean.includes('esta mensagem foi apagada') || clean.includes('message was deleted')) return false;
              if (clean === 'tail-out' || clean === 'tail-in' || clean === 'ic-fast-forward') return false;
              // Descarta mensagens com timestamp no futuro em relação ao momento atual (anomalias de parse)
              if (m.timestamp && new Date(m.timestamp).getTime() > Date.now() + 300000) return false;
              return true;
            });
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(parsed)); } catch {}
            return parsed;
          }
        }
      } catch {}
    }
    return MOCK_MESSAGES;
  });

  // Função para remover mensagens duplicadas, higienizar avisos de sistema e unificar mensagens de LID e Telefone Canônico
  const deduplicateMessages = (msgs: Message[], contactList?: Contact[]): Message[] => {
    const map = new Map<string, Message>();
    const currentContacts = contactList || contacts || [];

    // Mapeamento de LID -> Telefone Canônico para unificar as mensagens sob a mesma conversa
    const lidToPhone = new Map<string, string>();
    currentContacts.forEach(c => {
      if (c.lid && c.phone && !isLidIdentifier(c.phone)) {
        const clean = c.phone.replace(/\D/g, '');
        lidToPhone.set(cleanLid(c.lid), clean.startsWith('55') ? clean : `55${clean}`);
      }
    });

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

      const cleanLower = content.toLowerCase();
      if (
        /^\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]?$/i.test(content) ||
        /^\d+([.,]\d+)?\s*[xX\u00d7\u2715\u2716]?$/i.test(cleanLower) ||
        cleanLower === '1,0×' ||
        cleanLower === '1,0x' ||
        cleanLower.includes('mensagem apagada') ||
        cleanLower.includes('esta mensagem foi apagada') ||
        cleanLower.includes('message was deleted') ||
        cleanLower === 'tail-out' ||
        cleanLower === 'tail-in' ||
        cleanLower === 'ic-fast-forward'
      ) {
        return;
      }

      // Descarta mensagens com timestamp no futuro em relação ao momento atual (anomalias de parse)
      if (m.timestamp && new Date(m.timestamp).getTime() > Date.now() + 300000) {
        return;
      }

      // Reatribui conversationId padronizando para conv-zapi-55...
      let convId = m.conversationId;
      const rawDigits = convId.replace(/\D/g, '');
      if (isLidIdentifier(rawDigits)) {
        let mapped = lidToPhone.get(cleanLid(rawDigits));
        if (!mapped && typeof window !== 'undefined') {
          try {
            const stored = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
            if (stored[cleanLid(rawDigits)]) mapped = stored[cleanLid(rawDigits)];
          } catch {}
        }
        if (mapped) {
          const fullMapped = mapped.startsWith('55') ? mapped : `55${mapped}`;
          convId = `conv-zapi-${fullMapped}`;
        }
      } else if (rawDigits && !isLidIdentifier(rawDigits)) {
        const full = (!rawDigits.startsWith('55') && (rawDigits.length === 10 || rawDigits.length === 11)) ? `55${rawDigits}` : rawDigits;
        convId = `conv-zapi-${full}`;
      }

      const normalizedMsg: Message = convId !== m.conversationId ? { ...m, conversationId: convId } : m;
      const isNativeWppId = Boolean(m.id && (m.id.startsWith('true_') || m.id.startsWith('false_')));
      const timeKey = m.timestamp ? m.timestamp.slice(0, 19) : '';

      const key = isNativeWppId ? m.id! : `${convId}-${content}-${timeKey}-${m.senderType}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, normalizedMsg);
      } else {
        // Se a mensagem já existia marcada erroneamente como CONTACT e agora veio como USER, corrige para USER!
        if (existing.senderType === 'CONTACT' && normalizedMsg.senderType === 'USER') {
          map.set(key, normalizedMsg);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  };

  // Função para deduplicar e fundir conversas de LID e Telefone Canônico no Feed
  const deduplicateConversations = (convList: Conversation[], contactList?: Contact[]): Conversation[] => {
    const map = new Map<string, Conversation>();
    const currentContacts = contactList || contacts || [];

    const contactByPhone = new Map<string, Contact>();
    const contactByLid = new Map<string, Contact>();
    const contactById = new Map<string, Contact>();

    currentContacts.forEach(c => {
      contactById.set(c.id, c);
      if (c.phone && !isLidIdentifier(c.phone)) {
        contactByPhone.set(canonicalPhoneKey(c.phone), c);
      }
      if (c.lid) {
        contactByLid.set(cleanLid(c.lid), c);
      }
    });

    convList.forEach(conv => {
      if (!conv) return;
      const rawDigits = conv.id.replace(/\D/g, '');
      const isLid = isLidIdentifier(rawDigits);
      const lidClean = cleanLid(rawDigits);

      let contact = contactById.get(conv.contactId);
      if (!contact && isLid) {
        contact = contactByLid.get(lidClean);
      }
      if (!contact && rawDigits) {
        contact = contactByPhone.get(canonicalPhoneKey(rawDigits));
      }

      // Consulta no mapa local brokiva_lid_phone_map se não achou contato direto
      if (!contact && isLid && typeof window !== 'undefined') {
        try {
          const stored = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
          if (stored[lidClean]) {
            contact = contactByPhone.get(canonicalPhoneKey(stored[lidClean]));
          }
        } catch {}
      }

      let canonicalPhone = contact?.phone && !isLidIdentifier(contact.phone)
        ? contact.phone.replace(/\D/g, '')
        : '';

      if (!canonicalPhone && isLid && typeof window !== 'undefined') {
        try {
          const stored = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
          if (stored[lidClean]) canonicalPhone = stored[lidClean];
        } catch {}
      }

      if (!canonicalPhone) canonicalPhone = rawDigits;
      if (canonicalPhone && !isLidIdentifier(canonicalPhone) && !canonicalPhone.startsWith('55') && (canonicalPhone.length === 10 || canonicalPhone.length === 11)) {
        canonicalPhone = `55${canonicalPhone}`;
      }

      const canonicalConvId = canonicalPhone && !isLidIdentifier(canonicalPhone) ? `conv-zapi-${canonicalPhone}` : conv.id;
      const cleanPreview = (conv.lastMessagePreview && isWhatsAppSystemMessage(conv.lastMessagePreview))
        ? 'Conversa sincronizada via WhatsApp'
        : conv.lastMessagePreview;

      const existing = map.get(canonicalConvId);
      if (existing) {
        const timeA = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
        const timeB = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
        const useNewer = timeB > timeA;

        map.set(canonicalConvId, {
          ...existing,
          ...conv,
          id: canonicalConvId,
          contactId: contact?.id || existing.contactId || conv.contactId,
          lastMessagePreview: useNewer ? (cleanPreview || existing.lastMessagePreview) : existing.lastMessagePreview,
          lastMessageAt: useNewer ? conv.lastMessageAt : existing.lastMessageAt,
          unreadCount: Math.max(existing.unreadCount || 0, conv.unreadCount || 0),
        });
      } else {
        map.set(canonicalConvId, {
          ...conv,
          id: canonicalConvId,
          contactId: contact?.id || conv.contactId,
          lastMessagePreview: cleanPreview,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });
  };

  // Hidrata dados salvos no servidor e no localStorage (funciona 100% em aba anônima, Safari e novos dispositivos)
  const isHydratedRef = useRef(false);

  useEffect(() => {
    const initializeCRMState = async () => {
      try {
        // 1. Busca estado inicial do servidor (persistência cross-device, outro navegador e aba anônima)
        let serverData: any = null;
        try {
          const res = await fetch('/api/v1/crm/state', {
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

        // 4. Mescla contatos com deduplicação estrita
        const combinedContacts = [
          ...(Array.isArray(parsedLocalContacts) ? parsedLocalContacts : []),
          ...(Array.isArray(serverData?.contacts) ? serverData.contacts : [])
        ].map((c: any) => ({
          ...c,
          isPersonal: c.isPersonal === true ? true : false,
        })).filter(c => !isChatKeyDeleted(c.id, combinedDeleted) && !isChatKeyDeleted(c.phone, combinedDeleted) && !isChatKeyDeleted(c.lid, combinedDeleted));

        const finalContacts = deduplicateContactList(combinedContacts);
        if (finalContacts.length > 0) {
          setContacts(finalContacts);
          try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(finalContacts)); } catch {}
        }

        // 5. Mescla conversas garantindo unificação de LIDs e telefones canônicos
        const combinedConvs = [
          ...(Array.isArray(parsedLocalConvs) ? parsedLocalConvs : []),
          ...(Array.isArray(serverData?.conversations) ? serverData.conversations : [])
        ].map((cv: any) => ({
          ...cv,
          isPersonal: cv.isPersonal === true ? true : false,
        })).filter(cv => !isChatKeyDeleted(cv.id, combinedDeleted) && !isChatKeyDeleted(cv.contactId, combinedDeleted));

        const finalConvs = deduplicateConversations(combinedConvs, finalContacts);
        if (finalConvs.length > 0) {
          setConversations(finalConvs);
          try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(finalConvs)); } catch {}
        }

        // 6. Mescla mensagens
        const combinedMsgs = [
          ...(Array.isArray(parsedLocalMsgs) ? parsedLocalMsgs : []),
          ...(Array.isArray(serverData?.messages) ? serverData.messages : [])
        ].filter(m => !isChatKeyDeleted(m.conversationId, combinedDeleted) && !isWhatsAppSystemMessage(m.content));

        const finalMsgs = deduplicateMessages(combinedMsgs, finalContacts);
        if (finalMsgs.length > 0) {
          setMessages(finalMsgs);
          try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(finalMsgs)); } catch {}
        }

        // 7. Mescla deals
        const combinedDeals = [
          ...(Array.isArray(parsedLocalDeals) ? parsedLocalDeals : []),
          ...(Array.isArray(serverData?.deals) ? serverData.deals : [])
        ].filter(d => !isChatKeyDeleted(d.contactId, combinedDeleted));
        const dealMap = new Map<string, Deal>();
        combinedDeals.forEach(d => {
          if (d && d.id) dealMap.set(d.id, d);
        });
        const finalDeals = Array.from(dealMap.values());
        if (finalDeals.length > 0) {
          setDeals(finalDeals);
          try { localStorage.setItem('vanguard_crm_deals', JSON.stringify(finalDeals)); } catch {}
        }

        // 8. Insights
        const finalInsights = {
          ...(parsedLocalInsights || {}),
          ...(serverData?.aiInsights || {})
        };
        if (Object.keys(finalInsights).length > 0) {
          setAiInsights(finalInsights);
          try { localStorage.setItem('vanguard_crm_ai_insights', JSON.stringify(finalInsights)); } catch {}
        }

        // 9. Sincronização e Re-semeadura Bi-direcional do Servidor
        // Se o navegador local tiver dados no localStorage e o servidor estiver vazio ou com menos registros,
        // envia para o servidor para que o disco seja gravado e outros navegadores/dispositivos (ex: Safari) recebam tudo!
        const serverNeedsSeeding = !serverData || !Array.isArray(serverData.conversations) || serverData.conversations.length < finalConvs.length;
        if (serverNeedsSeeding && finalConvs.length > 0) {
          console.log('[CRM Context] Semeando servidor com histórico consolidado para persistência cross-device...');
          fetch('/api/v1/crm/state', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': currentTenant.id,
              'x-user-id': currentUser.id,
              'x-user-email': currentUser.email,
            },
            body: JSON.stringify({
              contacts: finalContacts,
              conversations: finalConvs,
              messages: finalMsgs,
              deals: finalDeals,
              aiInsights: finalInsights,
            }),
          }).catch(() => {});
        }

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

        let currentContactsList = contacts;
        if (Array.isArray(incomingContacts) && incomingContacts.length > 0) {
          setContacts(prev => {
            const next = deduplicateContactList([...prev, ...incomingContacts]);
            currentContactsList = next;
            try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(next)); } catch {}
            return next;
          });
        }

        if (Array.isArray(incomingMsgs) && incomingMsgs.length > 0) {
          const syncedConvIds = new Set(incomingMsgs.map((m: Message) => m.conversationId));
          setMessages(prev => {
            const otherMessages = prev.filter(m => !syncedConvIds.has(m.conversationId));
            const merged = deduplicateMessages([...otherMessages, ...incomingMsgs], currentContactsList);
            try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (Array.isArray(incomingConvs) && incomingConvs.length > 0) {
          setConversations(prev => {
            const merged = deduplicateConversations([...prev, ...incomingConvs], currentContactsList);
            try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(merged)); } catch {}
            return merged;
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
        isPersonal: data.isPersonal !== undefined ? data.isPersonal : false,
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

    setContacts(prev => {
      const updated = prev.map(c => {
        if (c.id === contactId) {
          nextPersonalState = !c.isPersonal;
          return {
            ...c,
            isPersonal: nextPersonalState,
            ...(nextPersonalState ? {
              preferredPropertyType: undefined,
              monthlyIncome: undefined,
              downPaymentAvailable: undefined,
              maxPropertyValue: undefined,
              targetRegions: [],
              temperature: 'COLD' as const,
              aiPriorityScore: 0,
            } : {}),
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
    const stage = effectiveCurrentPipeline.stages.find(s => s.id === targetStageId);
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
      pipelineId: effectiveCurrentPipeline.id,
      stageId: data.stageId || effectiveCurrentPipeline.stages[0]?.id || 'stage-1',
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
      ...effectiveCurrentPipeline,
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
        // Resolução de LID para telefone canônico antes do disparo
        if (isLidIdentifier(targetPhone)) {
          const lidClean = cleanLid(targetPhone);
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

        if (!targetPhone.startsWith('55') && (targetPhone.length === 10 || targetPhone.length === 11)) {
          targetPhone = `55${targetPhone}`;
        }

        // Procura a linha individual do corretor logado ou a da conversa
        const brokerInstance = instances.find(i => i.assignedUserId === currentUser.id) || instances.find(i => i.id === conv?.instanceId) || instances[0];

        fetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({
            content: cleanContent || previewText,
            messageType: actualType,
            mediaUrl: attachments?.[0]?.url,
            fileName: attachments?.[0]?.fileName,
            phone: targetPhone,
            senderUserId: currentUser.id,
            instanceId: brokerInstance?.zapiInstanceId || '3F8144490C66805B4E3FD64A35E2F2DC',
            instanceToken: (brokerInstance as any)?.token || '550DBC07B2F984AB74E4BCE5',
            clientToken: 'Fc78d61c833db4b50864816b70766aee8S',
          }),
        }).then(async res => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('Falha ao enviar mensagem:', errData);
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'FAILED' } : m));
          } else {
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'DELIVERED' } : m));
          }
        }).catch(err => {
          console.error('Erro ao enviar mensagem via Z-API:', err);
          setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'FAILED' } : m));
        });
      }
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
      fetch('/api/v1/crm/state', {
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

  // Salvar Extrações de IA no Perfil do Lead
  const applyAIExtractionToContact = (conversationId: string, contactId: string) => {
    const insight = aiInsights[conversationId];
    if (!insight) return;

    const isPersonal = insight.conversationType === 'PERSONAL_OR_OTHER';
    const updates: Partial<Contact> = {};

    if (isPersonal) {
      updates.isPersonal = true;
      updates.preferredPropertyType = undefined;
      updates.monthlyIncome = undefined;
      updates.downPaymentAvailable = undefined;
      updates.maxPropertyValue = undefined;
      updates.targetRegions = [];
      updates.temperature = 'COLD';
      updates.aiPriorityScore = 0;
    } else {
      if (insight.extractedData.urgencyLevel === 'ALTA') {
        updates.temperature = 'HOT';
        updates.aiPriorityScore = 95;
      }
      if (insight.extractedData.monthlyIncome) updates.monthlyIncome = insight.extractedData.monthlyIncome;
      if (insight.extractedData.downPayment) updates.downPaymentAvailable = insight.extractedData.downPayment;
      if (insight.extractedData.maxBudget) updates.maxPropertyValue = insight.extractedData.maxBudget;
      if (insight.extractedData.propertyType) updates.preferredPropertyType = (insight.extractedData.propertyType as any);
      if (insight.extractedData.preferredRegion && !insight.extractedData.preferredRegion.includes('Central / Metropolitana')) {
        updates.targetRegions = insight.extractedData.preferredRegion.split(',').map((r: string) => r.trim());
      }
    }

    if (Object.keys(updates).length > 0) {
      updateContact(contactId, updates);
    }

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
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenant.id,
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({
          instanceId: chosenInst?.zapiInstanceId || chosenInst?.id || '3F8144490C66805B4E3FD64A35E2F2DC',
          token: (chosenInst as any)?.token || '550DBC07B2F984AB74E4BCE5',
          clientToken: 'Fc78d61c833db4b50864816b70766aee8S',
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
          const syncedConvIds = new Set(data.messages.map((m: Message) => m.conversationId));
          setMessages(prev => {
            const otherConvsMessages = prev.filter(m => !syncedConvIds.has(m.conversationId));
            const validIncoming = data.messages.filter((m: Message) => !isChatKeyDeleted(m.conversationId, deletedChatKeys));
            const merged = deduplicateMessages([...otherConvsMessages, ...validIncoming]);
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
          const updated = prev.map(i => ({
            ...i,
            status: 'CONNECTED' as const,
            phoneNumber: data.phone || i.phoneNumber,
            name: data.name || i.name,
            lastSyncAt: new Date().toISOString()
          }));
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
          const updated = prev.map(i => ({
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
            let resolvedPhone = incoming.phone ? incoming.phone.replace(/\D/g, '') : '';
            const isLid = isLidIdentifier(incoming.phone) || (incoming.lid && isLidIdentifier(incoming.lid));
            const lidClean = cleanLid(incoming.lid || (isLidIdentifier(incoming.phone) ? incoming.phone : ''));

            if (isLid && lidClean) {
              if (typeof window !== 'undefined') {
                try {
                  const storedMap = JSON.parse(localStorage.getItem('brokiva_lid_phone_map') || '{}');
                  if (storedMap[lidClean]) resolvedPhone = storedMap[lidClean];
                } catch {}
              }
              if (isLidIdentifier(resolvedPhone)) {
                const matchCnt = contacts.find(c => c.lid && cleanLid(c.lid) === lidClean);
                if (matchCnt?.phone && !isLidIdentifier(matchCnt.phone)) {
                  resolvedPhone = matchCnt.phone.replace(/\D/g, '');
                }
              }
            }

            if (resolvedPhone && !isLidIdentifier(resolvedPhone) && !resolvedPhone.startsWith('55') && (resolvedPhone.length === 10 || resolvedPhone.length === 11)) {
              resolvedPhone = `55${resolvedPhone}`;
            }

            const rawPhone = resolvedPhone;
            if (!rawPhone || rawPhone === '0') return;
            if (isChatKeyDeleted(rawPhone, deletedChatKeys) || (lidClean && isChatKeyDeleted(lidClean, deletedChatKeys))) return;

            const formattedPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

            // 1. Encontra ou cria contato
            setContacts(prevContacts => {
              const pKey = normalizePhoneKey(rawPhone);
              const existing = prevContacts.find(c => {
                if (lidClean && c.lid && cleanLid(c.lid) === lidClean) return true;
                if (!isLidIdentifier(rawPhone)) {
                  const cPKey = normalizePhoneKey(c.phone);
                  if (cPKey && pKey && cPKey === pKey) return true;
                }
                return false;
              });

              if (existing) {
                return prevContacts.map(c => c.id === existing.id ? {
                  ...c,
                  lid: lidClean || c.lid,
                  name: incoming.fromMe
                    ? existing.name
                    : ((existing.name && !existing.name.startsWith('WhatsApp') && !existing.name.startsWith('+') && existing.name !== 'Cliente') ? existing.name : (incoming.senderName || existing.name)),
                  avatarUrl: incoming.senderPhoto || c.avatarUrl,
                  lastClientInteractionAt: incoming.timestamp || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } : c);
              }

              const isBroker = incoming.fromMe;
              const contactName = isBroker
                ? (rawPhone.length >= 10 ? `WhatsApp (${rawPhone.slice(-4)})` : 'Cliente WhatsApp')
                : (incoming.senderName || `WhatsApp ${rawPhone.slice(-4)}`);

              const newContact: Contact = {
                id: `contact-zapi-${rawPhone}`,
                tenantId: currentTenant.id,
                name: contactName,
                phone: formattedPhone,
                lid: lidClean || undefined,
                avatarUrl: incoming.senderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=059669&color=fff`,
                source: 'WHATSAPP',
                temperature: 'HOT',
                aiPriorityScore: 85,
                tags: ['Novo Lead WhatsApp', 'Z-API Live'],
                targetRegions: [],
                notesCount: 0,
                consentGiven: true,
                hasOptedOut: false,
                isPersonal: false,
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

            // 2. Atualiza ou cria a conversa canônica de forma estrita
            setConversations(prevConvs => {
              const existingConv = prevConvs.find(c => {
                if (c.id === `conv-zapi-${rawPhone}`) return true;
                if (c.contactId === `contact-zapi-${rawPhone}`) return true;
                if (lidClean && (c.id === `conv-zapi-${lidClean}` || c.contactId === `contact-zapi-${lidClean}`)) return true;
                return false;
              });

              if (existingConv) {
                const updated = prevConvs.map(c => (c.id === existingConv.id || (lidClean && c.id === `conv-zapi-${lidClean}`)) ? {
                  ...c,
                  id: `conv-zapi-${rawPhone}`,
                  contactId: `contact-zapi-${rawPhone}`,
                  assignedUserId: c.assignedUserId || matchingInst?.assignedUserId,
                  lastMessagePreview: incoming.content,
                  lastMessageAt: incoming.timestamp || new Date().toISOString(),
                  status: incoming.fromMe ? ('PENDING_CLIENT' as const) : ('PENDING_TEAM' as const),
                  unreadCount: incoming.fromMe ? 0 : (c.unreadCount || 0) + 1,
                  slaBreached: false,
                } : c).filter((c, idx, arr) => arr.findIndex(x => x.id === c.id) === idx)
                 .sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
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
                isPersonal: false,
              };
              const updated = [newConv, ...prevConvs.filter(c => !lidClean || c.id !== `conv-zapi-${lidClean}`)]
                .sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
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
              // Re-chaveia qualquer mensagem anterior que estivesse presa na conversa temporária de LID
              const rekeyed = lidClean 
                ? prevMsgs.map(m => m.conversationId === `conv-zapi-${lidClean}` ? { ...m, conversationId: `conv-zapi-${rawPhone}` } : m)
                : prevMsgs;

              // 1. Evita duplicata se o ID for idêntico
              if (rekeyed.some(m => m.id === newMsg.id)) return rekeyed;

              // 2. Se for mensagem enviada (fromMe = true), verifica se já enviamos no portal
              if (incoming.fromMe) {
                const isAlreadyPresent = rekeyed.some(m =>
                  m.senderType === 'USER' &&
                  (m.content || '').trim() === (newMsg.content || '').trim() &&
                  Math.abs(new Date(m.timestamp || 0).getTime() - new Date(newMsg.timestamp || 0).getTime()) < 60000
                );
                if (isAlreadyPresent) return rekeyed;
              }

              // 3. Evita duplicatas gerais de mesmo conteúdo e mesmo remetente em menos de 60s
              const isDuplicateContent = rekeyed.some(m =>
                m.senderType === newMsg.senderType &&
                (m.content || '').trim() === (newMsg.content || '').trim() &&
                Math.abs(new Date(m.timestamp || 0).getTime() - new Date(newMsg.timestamp || 0).getTime()) < 60000
              );
              if (isDuplicateContent) return rekeyed;

              const updated = [...rekeyed, newMsg];
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
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenant.id,
            'x-user-id': currentUser.id,
            'x-user-email': currentUser.email,
          },
          body: JSON.stringify({
            instanceId: chosenInst?.zapiInstanceId || '3F8144490C66805B4E3FD64A35E2F2DC',
            token: (chosenInst as any)?.token || '550DBC07B2F984AB74E4BCE5',
            clientToken: 'Fc78d61c833db4b50864816b70766aee8S',
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
              if (isChatKeyDeleted(m.conversationId, deletedChatKeys)) return false;
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
              if (isChatKeyDeleted(newC.id, deletedChatKeys) || isChatKeyDeleted(newC.contactId, deletedChatKeys)) return;
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

        // Ingestão imediata de atualizações enviadas pela extensão ou outro dispositivo para o servidor
        try {
          const stateRes = await fetch('/api/v1/crm/state', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': currentTenant.id,
              'x-user-id': currentUser.id,
              'x-user-email': currentUser.email,
            },
          });
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            if (stateData.success) {
              // 1. Mensagens
              if (Array.isArray(stateData.messages) && stateData.messages.length > 0) {
                setMessages(prev => {
                  const merged = deduplicateMessages([...prev, ...stateData.messages]);
                  const prevKey = prev.length > 0 ? `${prev.length}-${prev[prev.length - 1]?.id}-${prev[prev.length - 1]?.timestamp}` : '';
                  const nextKey = merged.length > 0 ? `${merged.length}-${merged[merged.length - 1]?.id}-${merged[merged.length - 1]?.timestamp}` : '';
                  if (prevKey !== nextKey) {
                    try { localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged)); } catch {}
                    return merged;
                  }
                  return prev;
                });
              }

              // 2. Contatos
              if (Array.isArray(stateData.contacts) && stateData.contacts.length > 0) {
                setContacts(prev => {
                  const merged = deduplicateContactList([...prev, ...stateData.contacts]);
                  const prevKey = prev.map(c => `${c.id}_${c.updatedAt}`).join('|');
                  const nextKey = merged.map(c => `${c.id}_${c.updatedAt}`).join('|');
                  if (prevKey !== nextKey) {
                    try { localStorage.setItem('vanguard_crm_contacts', JSON.stringify(merged)); } catch {}
                    return merged;
                  }
                  return prev;
                });
              }

              // 3. Conversas
              if (Array.isArray(stateData.conversations) && stateData.conversations.length > 0) {
                setConversations(prev => {
                  const merged = deduplicateConversations([...prev, ...stateData.conversations]);
                  const prevKey = prev.map(c => `${c.id}_${c.lastMessagePreview}_${c.lastMessageAt}`).join('|');
                  const nextKey = merged.map(c => `${c.id}_${c.lastMessagePreview}_${c.lastMessageAt}`).join('|');
                  if (prevKey !== nextKey) {
                    try { localStorage.setItem('vanguard_crm_conversations', JSON.stringify(merged)); } catch {}
                    return merged;
                  }
                  return prev;
                });
              }

              // 4. Chaves Deletadas
              if (Array.isArray(stateData.deletedKeys) && stateData.deletedKeys.length > 0) {
                setDeletedChatKeys(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  stateData.deletedKeys.forEach((k: string) => {
                    if (!next.has(k)) {
                      next.add(k);
                      changed = true;
                    }
                  });
                  if (changed) {
                    try { localStorage.setItem('vanguard_crm_deleted_chats', JSON.stringify(Array.from(next))); } catch {}
                    return next;
                  }
                  return prev;
                });
              }
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
    const contact = scopedContacts.find(c => c.id === contactId);
    if (!contact || contact.isPersonal) return null;
    if (isWhatsAppChannelOrGroup(contact)) return null;

    const conv = conversationId 
      ? scopedConversations.find(c => c.id === conversationId)
      : scopedConversations.find(c => c.contactId === contactId);

    if (conv?.isPersonal || conv?.isArchived) return null;
    if (conv && isWhatsAppChannelOrGroup(conv)) return null;

    const deal = dealId 
      ? scopedDeals.find(d => d.id === dealId)
      : scopedDeals.find(d => d.contactId === contactId && d.status === 'OPEN');

    const stage = deal ? effectiveCurrentPipeline.stages.find(s => s.id === deal.stageId) : undefined;

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
      currentTenant,
      setCurrentTenant,
      updateTenant,
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
      deletedChatKeys,
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
