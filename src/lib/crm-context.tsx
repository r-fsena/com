'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;

  // CRM Leads e Contatos
  contacts: Contact[];
  addContact: (contact: Partial<Contact>) => Contact;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;

  // Funis e Deals (Kanban)
  pipelines: Pipeline[];
  currentPipeline: Pipeline;
  setCurrentPipeline: (pipeline: Pipeline) => void;
  deals: Deal[];
  moveDealStage: (dealId: string, targetStageId: string) => void;
  createDeal: (deal: Partial<Deal>) => Deal;
  updateDeal: (id: string, updates: Partial<Deal>) => void;

  // WhatsApp e Mensagens
  instances: WhatsAppInstance[];
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  messages: Message[];
  sendMessage: (conversationId: string, content: string, isInternalNote?: boolean, aiSuggested?: boolean) => void;
  assignConversation: (conversationId: string, userId?: string) => void;
  simulateIncomingMessage: (phone: string, name: string, content: string) => void;

  // IA Copiloto
  aiInsights: Record<string, AIInsight>;
  applyAIExtractionToContact: (conversationId: string, contactId: string) => void;
  recordAIFeedback: (conversationId: string, feedback: 'ACCEPTED' | 'EDITED' | 'REJECTED') => void;

  // Tarefas e Alertas
  tasks: Task[];
  toggleTask: (taskId: string) => void;
  createTask: (task: Partial<Task>) => void;
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

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [tenants] = useState<Tenant[]>(MOCK_TENANTS);
  const [currentTenant, setCurrentTenant] = useState<Tenant>(MOCK_TENANTS[0]);
  
  const [users] = useState<User[]>(MOCK_USERS);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]); // Rafael Sena (Admin)

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

  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [pipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [currentPipeline, setCurrentPipeline] = useState<Pipeline>(MOCK_PIPELINES[0]);
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);

  const [instances, setInstances] = useState<WhatsAppInstance[]>(MOCK_INSTANCES);
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  
  const [aiInsights, setAiInsights] = useState<Record<string, AIInsight>>(MOCK_AI_INSIGHTS);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [alerts, setAlerts] = useState<SLAAlert[]>(MOCK_ALERTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [quickReplies] = useState<QuickReplyTemplate[]>(MOCK_QUICK_REPLIES);

  // Manipulação de Contatos
  const addContact = (data: Partial<Contact>): Contact => {
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      tenantId: currentTenant.id,
      name: data.name || 'Lead WhatsApp',
      phone: data.phone || '+5511900000000',
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
    setContacts(prev => [newContact, ...prev]);
    return newContact;
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c));
  };

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  // Manipulação de Deals / Kanban
  const moveDealStage = (dealId: string, targetStageId: string) => {
    const stage = currentPipeline.stages.find(s => s.id === targetStageId);
    setDeals(prev => prev.map(deal => {
      if (deal.id === dealId) {
        return {
          ...deal,
          stageId: targetStageId,
          status: stage?.isWon ? 'WON' : stage?.isLost ? 'LOST' : 'OPEN',
          closedAt: stage?.isWon || stage?.isLost ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return deal;
    }));
  };

  const createDeal = (data: Partial<Deal>): Deal => {
    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      tenantId: currentTenant.id,
      contactId: data.contactId || contacts[0]?.id || 'contact-01',
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
    setDeals(prev => [newDeal, ...prev]);
    return newDeal;
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d));
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
      // Atualiza conversa
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessagePreview: content.trim(),
            lastMessageAt: new Date().toISOString(),
            status: 'PENDING_CLIENT',
            slaBreached: false,
          };
        }
        return conv;
      }));

      // Simula confirmação de leitura do WhatsApp após 2.5s
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'READ' } : m));
      }, 2500);
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

    setActiveConversationId(convId);
  };

  // Salvar Extrações de IA no Perfil do Lead
  const applyAIExtractionToContact = (conversationId: string, contactId: string) => {
    const insight = aiInsights[conversationId];
    if (!insight) return;

    updateContact(contactId, {
      monthlyIncome: insight.extractedData.monthlyIncome,
      downPaymentAvailable: insight.extractedData.downPayment,
      maxPropertyValue: insight.extractedData.maxBudget,
      preferredPropertyType: (insight.extractedData.propertyType as any) || 'APARTMENT',
      aiPriorityScore: 95,
      temperature: 'HOT',
    });

    setAiInsights(prev => ({
      ...prev,
      [conversationId]: {
        ...prev[conversationId],
        userFeedback: 'ACCEPTED'
      }
    }));
  };

  const recordAIFeedback = (conversationId: string, feedback: 'ACCEPTED' | 'EDITED' | 'REJECTED') => {
    if (aiInsights[conversationId]) {
      setAiInsights(prev => ({
        ...prev,
        [conversationId]: {
          ...prev[conversationId],
          userFeedback: feedback
        }
      }));
    }
  };

  // Tarefas e Alertas
  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      isCompleted: !t.isCompleted,
      completedAt: !t.isCompleted ? new Date().toISOString() : undefined
    } : t));
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
    setTasks(prev => [newTask, ...prev]);
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

  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState(false);

  const syncWhatsAppChats = async () => {
    try {
      setIsSyncingWhatsApp(true);
      const res = await fetch('/api/v1/zapi/sync-chats');
      const data = await res.json();

      if (data.success && Array.isArray(data.contacts) && data.contacts.length > 0) {
        setContacts(data.contacts);
        setConversations(data.conversations);
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
        if (!activeConversationId && data.conversations[0]?.id) {
          setActiveConversationId(data.conversations[0].id);
        }
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

  return (
    <CRMContext.Provider value={{
      isAuthenticated,
      login,
      logout,
      tenants,
      currentTenant,
      setCurrentTenant,
      users,
      currentUser,
      setCurrentUser,
      contacts,
      addContact,
      updateContact,
      deleteContact,
      pipelines,
      currentPipeline,
      setCurrentPipeline,
      deals,
      moveDealStage,
      createDeal,
      updateDeal,
      instances,
      conversations,
      activeConversationId,
      setActiveConversationId,
      messages,
      sendMessage,
      assignConversation,
      simulateIncomingMessage,
      aiInsights,
      applyAIExtractionToContact,
      recordAIFeedback,
      tasks,
      toggleTask,
      createTask,
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
