'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  Tenant, 
  User, 
  WhatsAppInstance, 
  Contact, 
  PresentedProperty,
  Pipeline, 
  PipelineStage,
  Deal, 
  Conversation, 
  Message, 
  AIInsight, 
  Task, 
  SLAAlert, 
  Campaign, 
  QuickReplyTemplate 
} from '@/types/crm';
import { 
  MOCK_TENANTS, 
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
  MOCK_QUICK_REPLIES 
} from './mock-data';

interface CRMContextType {
  // Autenticação & Sessão Cognito
  isAuthenticated: boolean;
  login: (email: string, role?: string) => void;
  logout: () => void;

  // Tenant e Usuário
  tenants: Tenant[];
  currentTenant: Tenant;
  setCurrentTenant: (tenant: Tenant) => void;
  updateTenant: (updates: Partial<Tenant>) => void;
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  createUser: (userData: Partial<User>) => User;
  deleteUser: (userId: string) => void;
  updateUserAIPersona: (userId: string, data: { aiPersonaPrompt?: string; aiTone?: any; aiDirectives?: string[]; aiModel?: string }) => void;

  // CRM Leads e Contatos
  contacts: Contact[];
  addContact: (contact: Partial<Contact>) => Contact;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  addPresentedProperty: (contactId: string, property: Omit<PresentedProperty, 'id' | 'presentedAt'>) => void;
  updatePresentedProperty: (contactId: string, propertyId: string, updates: Partial<PresentedProperty>) => void;
  removePresentedProperty: (contactId: string, propertyId: string) => void;

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
  transferConversationInstance: (conversationId: string, targetInstanceId: string, sendTransitionMessage?: boolean) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  openChatForContact: (contactId: string) => string;
  loadChatHistory: (phone: string, conversationId: string) => Promise<void>;
  messages: Message[];
  sendMessage: (conversationId: string, content: string, isInternalNote?: boolean, aiSuggested?: boolean) => void;
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

  // Z-API Sincronização em Tempo Real
  isSyncingWhatsApp: boolean;
  syncWhatsAppChats: () => Promise<void>;
  syncZapiInstance: (instanceId: string, phone?: string) => void;
}

export function normalizePhoneKey(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.slice(2); // Normaliza para DDD + Número (ex: 4891079478)
  }
  return digits;
}

export function deduplicateContactList(list: Contact[]): Contact[] {
  const phoneMap = new Map<string, Contact>();
  const idMap = new Map<string, Contact>();
  const result: Contact[] = [];

  list.forEach(contact => {
    if (!contact) return;
    const pKey = normalizePhoneKey(contact.phone);
    const existing = (pKey ? phoneMap.get(pKey) : null) || idMap.get(contact.id);

    if (existing) {
      const merged: Contact = {
        ...existing,
        ...contact,
        id: existing.id,
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
      if (pKey) phoneMap.set(pKey, merged);
      idMap.set(merged.id, merged);

      const idx = result.findIndex(c => c.id === existing.id);
      if (idx >= 0) result[idx] = merged;
    } else {
      if (pKey) phoneMap.set(pKey, contact);
      idMap.set(contact.id, contact);
      result.push(contact);
    }
  });

  return result;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [tenants, setTenants] = useState<Tenant[]>(MOCK_TENANTS);
  const [currentTenant, setCurrentTenant] = useState<Tenant>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_tenant');
        if (saved) return JSON.parse(saved);
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
  };
  
  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_users');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
          }
        }
      } catch {}
    }
    return MOCK_USERS[0];
  });

  const updateUser = (userId: string, updates: Partial<User>) => {
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
    const brokerName = userData.name?.trim() || 'Novo Corretor';
    const brokerPhone = userData.phone?.trim() || '+55 11 99999-0000';

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: brokerName,
      email: userData.email?.trim() || `corretor${Date.now()}@vanguardprime.com.br`,
      phone: brokerPhone,
      role: userData.role || 'BROKER',
      isActive: true,
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
      const updated = [...prev, newUser];
      try { localStorage.setItem('vanguard_crm_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Cria automaticamente a linha direta de WhatsApp para o novo corretor
    const newDirectInst: WhatsAppInstance = {
      id: `inst-${newUser.id}`,
      tenantId: currentTenant.id,
      name: `${brokerName} (Linha Direta Corretor)`,
      phoneNumber: brokerPhone,
      zapiInstanceId: `INST-${Date.now().toString(36).toUpperCase()}`,
      status: 'CONNECTED',
      type: 'BROKER_DIRECT',
      assignedUserId: newUser.id,
      batteryLevel: 95,
      lastSyncAt: new Date().toISOString(),
    };

    setInstances(prev => {
      const updatedInst = [...prev, newDirectInst];
      try { localStorage.setItem('vanguard_crm_instances', JSON.stringify(updatedInst)); } catch {}
      return updatedInst;
    });

    return newUser;
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
        if (session.userEmail) {
          const u = users.find(x => x.email.toLowerCase() === session.userEmail.toLowerCase());
          if (u) setCurrentUser(u);
          setIsAuthenticated(true);
        }
      }
    } catch {
      // Ignora erro de localStorage
    }
  }, [users]);

  const login = (email: string, role?: string) => {
    let targetUser = currentUser;
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
    } catch {}
    setIsAuthenticated(true);
  };

  const logout = () => {
    try {
      localStorage.removeItem('vanguard_auth_session');
    } catch {}
    setIsAuthenticated(false);
  };

  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_contacts');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
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
          if (parsed && Array.isArray(parsed.stages) && parsed.stages.length > 0) return parsed;
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
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return MOCK_INSTANCES;
  });

  const [activeInstanceId, setActiveInstanceId] = useState<string>(() => {
    return MOCK_INSTANCES[0]?.id || 'inst-central';
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
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return MOCK_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_messages');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return MOCK_MESSAGES;
  });

  // Função para remover mensagens duplicadas e limpar placeholders genéricos
  const deduplicateMessages = (msgs: Message[]): Message[] => {
    const seen = new Set<string>();
    return msgs.filter(m => {
      const content = (m.content || '').trim();
      if (
        content === 'Mensagem recebida pelo WhatsApp' ||
        content === 'Olá! Conversa sincronizada do WhatsApp.' ||
        content === 'Conversa sincronizada do WhatsApp.' ||
        content === 'Conversa ativa no WhatsApp'
      ) {
        return false;
      }
      const timeKey = m.timestamp ? m.timestamp.slice(0, 16) : '';
      const key = `${m.conversationId}-${m.senderType}-${content}-${timeKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
        targetRegions: data.targetRegions || ['São Paulo'],
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
    aiSuggested = false
  ) => {
    if (!content.trim()) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      tenantId: currentTenant.id,
      conversationId,
      senderType: isInternalNote ? 'USER' : 'USER',
      senderUserId: currentUser.id,
      senderName: currentUser.name,
      messageType: 'TEXT',
      content: content.trim(),
      status: isInternalNote ? 'SENT' : 'DELIVERED',
      isInternalNote,
      timestamp: new Date().toISOString(),
      aiSuggested,
    };

    setMessages(prev => [...prev, newMessage]);

    if (!isInternalNote) {
      // Atualiza conversa localmente (zera unreadCount e muda status para PENDING_CLIENT)
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessagePreview: content.trim(),
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
            status: 'PENDING_CLIENT',
            slaBreached: false,
          };
        }
        return conv;
      }));

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

      if (targetPhone) {
        fetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            phone: targetPhone,
            senderUserId: currentUser.id,
          }),
        }).catch(err => console.error('Erro ao enviar mensagem via Z-API:', err));
      }

      // Confirmação de entrega
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'DELIVERED' } : m));
      }, 1500);
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

  const loadChatHistory = async (phone: string, conversationId: string) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res = await fetch('/api/v1/zapi/sync-chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          conversationId,
          tenantId: currentTenant.id,
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

  const syncWhatsAppChats = async () => {
    try {
      setIsSyncingWhatsApp(true);
      const res = await fetch('/api/v1/zapi/sync-chats');
      const data = await res.json();

      if (data.success && Array.isArray(data.contacts) && data.contacts.length > 0) {
        // 1. Merge de Contatos (Preserva 100% dos dados qualificados e históricos de cada contato)
        setContacts(prev => {
          const mapByPhone = new Map<string, Contact>();
          const mapById = new Map<string, Contact>();
          prev.forEach(c => {
            const clean = c.phone.replace(/\D/g, '');
            if (clean) mapByPhone.set(clean, c);
            mapById.set(c.id, c);
          });

          const result: Contact[] = [...prev];

          data.contacts.forEach((newC: Contact) => {
            const clean = newC.phone.replace(/\D/g, '');
            const existing = (clean ? mapByPhone.get(clean) : null) || mapById.get(newC.id);

            if (existing) {
              const merged: Contact = {
                ...newC,
                ...existing,
                id: existing.id,
                name: (existing.name && !existing.name.startsWith('WhatsApp')) ? existing.name : (newC.name || existing.name),
                avatarUrl: newC.avatarUrl || existing.avatarUrl,
                monthlyIncome: existing.monthlyIncome || newC.monthlyIncome,
                downPaymentAvailable: existing.downPaymentAvailable || newC.downPaymentAvailable,
                maxPropertyValue: existing.maxPropertyValue || newC.maxPropertyValue,
                preferredPropertyType: existing.preferredPropertyType || newC.preferredPropertyType,
                targetRegions: (existing.targetRegions && existing.targetRegions.length > 0 && !existing.targetRegions.includes('Geral')) ? existing.targetRegions : (newC.targetRegions || existing.targetRegions),
                email: existing.email || newC.email,
                temperature: existing.temperature || newC.temperature,
                tags: Array.from(new Set([...(existing.tags || []), ...(newC.tags || [])])),
                aiPriorityScore: Math.max(existing.aiPriorityScore || 70, newC.aiPriorityScore || 70),
                updatedAt: new Date().toISOString(),
              };

              const idx = result.findIndex(x => x.id === existing.id);
              if (idx >= 0) result[idx] = merged;
              if (clean) mapByPhone.set(clean, merged);
              mapById.set(existing.id, merged);
            } else {
              result.push(newC);
              if (clean) mapByPhone.set(clean, newC);
              mapById.set(newC.id, newC);
            }
          });

          try {
            localStorage.setItem('vanguard_crm_contacts', JSON.stringify(result));
          } catch {}

          return result;
        });

        // 2. Merge de Conversas
        setConversations(prev => {
          const map = new Map(prev.map(c => [c.id, c]));
          data.conversations.forEach((c: Conversation) => {
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
          try {
            localStorage.setItem('vanguard_crm_conversations', JSON.stringify(result));
          } catch {}
          return result;
        });

        // 3. Merge de Mensagens (NUNCA apaga mensagens!)
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = data.messages.filter((m: Message) => !existingIds.has(m.id));
            const merged = deduplicateMessages([...prev, ...newOnes]);
            try {
              localStorage.setItem('vanguard_crm_messages', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        setActiveConversationId(prev => prev ? prev : (data.conversations[0]?.id || null));
      }
    } catch (err) {
      console.error('Erro ao sincronizar conversas:', err);
    } finally {
      setIsSyncingWhatsApp(false);
    }
  };

  const syncZapiInstance = (instanceId: string, phone?: string) => {
    setInstances(prev => prev.map(i => i.id === instanceId ? {
      ...i,
      status: 'CONNECTED',
      phoneNumber: phone || i.phoneNumber,
      lastSyncAt: new Date().toISOString()
    } : i));
    syncWhatsAppChats();
  };

  // Checa status de conexão da Z-API ao carregar
  useEffect(() => {
    const checkLiveZapiStatus = async () => {
      try {
        const res = await fetch('/api/v1/zapi/status');
        const data = await res.json();
        if (data.success && data.connected) {
          setInstances(prev => prev.map(i => ({
            ...i,
            status: 'CONNECTED',
            phoneNumber: data.phone || '+55 (48) 8877-4408',
            lastSyncAt: new Date().toISOString()
          })));
          syncWhatsAppChats();
        }
      } catch {}
    };

    checkLiveZapiStatus();
  }, []);

  // Polling contínuo de novos eventos e mensagens do Webhook Z-API em tempo real (a cada 2.5s)
  const lastPollTimeRef = useRef<number>(Date.now() - 60000);

  useEffect(() => {
    const pollWebhookMessages = async () => {
      try {
        const res = await fetch(`/api/v1/webhooks/zapi/events?since=${lastPollTimeRef.current}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          lastPollTimeRef.current = data.serverTime || Date.now();

          data.messages.forEach((incoming: any) => {
            const rawPhone = incoming.phone.replace(/\D/g, '');
            const formattedPhone = incoming.phone.startsWith('+') ? incoming.phone : `+${incoming.phone}`;

            // Verifica se o contato já existe
            setContacts(prevContacts => {
              const existing = prevContacts.find(c => c.phone.replace(/\D/g, '') === rawPhone);
              if (existing) {
                return prevContacts.map(c => c.id === existing.id ? {
                  ...c,
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
                targetRegions: ['Geral'],
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

            // Adiciona ou atualiza conversa
            setConversations(prevConvs => {
              const convId = `conv-zapi-${rawPhone}`;
              const existingConv = prevConvs.find(c => c.id === convId || c.contactId === `contact-zapi-${rawPhone}`);

              if (existingConv) {
                return prevConvs.map(c => c.id === existingConv.id ? {
                  ...c,
                  lastMessagePreview: incoming.content,
                  lastMessageAt: incoming.timestamp || new Date().toISOString(),
                  status: 'PENDING_TEAM',
                  unreadCount: (c.unreadCount || 0) + 1,
                  slaBreached: false,
                } : c);
              }

              const newConv: Conversation = {
                id: convId,
                tenantId: currentTenant.id,
                instanceId: incoming.instanceId || instances[0]?.id || '3F1B67FC8139425171C79ED390C0144C',
                contactId: `contact-zapi-${rawPhone}`,
                status: 'PENDING_TEAM',
                unreadCount: 1,
                lastMessagePreview: incoming.content,
                lastMessageAt: incoming.timestamp || new Date().toISOString(),
                slaBreached: false,
              };
              return [newConv, ...prevConvs];
            });

            // Adiciona a nova mensagem à conversa
            const newMsg: Message = {
              id: incoming.id || `msg-${Date.now()}-${Math.random()}`,
              tenantId: currentTenant.id,
              conversationId: `conv-zapi-${rawPhone}`,
              senderType: incoming.fromMe ? 'USER' : 'CONTACT',
              senderName: incoming.fromMe ? 'Corretor' : incoming.senderName,
              messageType: incoming.mediaType === 'audio' ? 'AUDIO' : incoming.mediaType === 'image' ? 'IMAGE' : incoming.mediaType === 'document' ? 'DOCUMENT' : 'TEXT',
              attachments: incoming.mediaUrl ? [{
                id: `att-${Date.now()}`,
                url: incoming.mediaUrl,
                fileName: incoming.mediaType === 'audio' ? 'Áudio' : incoming.mediaType === 'image' ? 'Imagem' : 'Documento',
                fileSize: 1024,
                mimeType: incoming.mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream',
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
                  m.conversationId === newMsg.conversationId &&
                  m.senderType === 'USER' &&
                  m.content.trim() === newMsg.content.trim()
                );
                if (isAlreadyPresent) return prevMsgs;
              }

              // 3. Evita duplicatas gerais de mesmo conteúdo na mesma conversa
              const isDuplicateContent = prevMsgs.some(m =>
                m.conversationId === newMsg.conversationId &&
                m.senderType === newMsg.senderType &&
                m.content.trim() === newMsg.content.trim()
              );
              if (isDuplicateContent) return prevMsgs;

              return [...prevMsgs, newMsg];
            });
          });
        }
      } catch {}
    };

    const interval = setInterval(pollWebhookMessages, 2500);
    return () => clearInterval(interval);
  }, [currentTenant.id, instances]);

  return (
    <CRMContext.Provider value={{
      isAuthenticated,
      login,
      logout,
      tenants,
      currentTenant,
      setCurrentTenant,
      updateTenant,
      users,
      currentUser,
      setCurrentUser,
      updateUser,
      createUser,
      deleteUser,
      updateUserAIPersona,
      contacts,
      addContact,
      updateContact,
      deleteContact,
      addPresentedProperty,
      updatePresentedProperty,
      removePresentedProperty,
      pipelines,
      currentPipeline,
      setCurrentPipeline,
      deals,
      moveDealStage,
      createDeal,
      updateDeal,
      deleteDeal,
      updatePipelineStages,
      instances,
      activeInstanceId,
      setActiveInstanceId,
      createInstance,
      updateInstance,
      deleteInstance,
      transferConversationInstance,
      conversations,
      activeConversationId,
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
      tasks,
      toggleTask,
      createTask,
      updateTask,
      deleteTask,
      alerts,
      dismissAlert,
      campaigns,
      createCampaign,
      quickReplies,
      isSyncingWhatsApp,
      syncWhatsAppChats,
      syncZapiInstance,
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
