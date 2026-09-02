'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  Sparkles, 
  Lock, 
  UserCheck, 
  Phone, 
  MoreVertical, 
  Check, 
  CheckCheck, 
  Clock, 
  Flame, 
  Building2, 
  Calendar, 
  Tag, 
  Plus, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Zap,
  Bot,
  MessageSquare,
  RefreshCw,
  MapPin,
  Mic,
  ExternalLink,
  FileText,
  X,
  Pin,
  Trash2,
  Archive,
  Eraser,
  Edit3,
  Save,
  DollarSign,
  Building,
  Notebook,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Minimize2,
  Maximize2,
  Play,
  Pause,
  Volume2,
  Download,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye,
  ZoomIn,
  Music,
  StopCircle,
  Radio,
  UserPlus
} from 'lucide-react';
import { safeFormatDate } from '@/lib/date-utils';
import { PropertyType, PresentedProperty } from '@/types/crm';
import { ImportLeadsModal } from '@/components/contacts/ImportLeadsModal';

const MOCK_CATALOG_PROPERTIES = [
  {
    name: 'Edifício Lumina Batel',
    defaultUnit: 'Apto 1402 (185m² • 3 Suítes)',
    address: 'Av. Visconde de Guarapuava, 4200 - Batel, Curitiba',
    price: 1450000,
    type: 'APARTMENT' as PropertyType,
  },
  {
    name: 'Cobertura Duplex Ecoville',
    defaultUnit: 'Cobertura 2201 (320m² • 4 Suítes • Piscina)',
    address: 'Rua Prof. Pedro Viriato Parigot de Souza, 3500 - Ecoville, Curitiba',
    price: 2800000,
    type: 'PENTHOUSE' as PropertyType,
  },
  {
    name: 'Residencial Vista Parque',
    defaultUnit: 'Apto 604 - Torre Jardim (120m² • 2 Suítes)',
    address: 'Rua Jacarezinho, 890 - Mercês, Curitiba',
    price: 980000,
    type: 'APARTMENT' as PropertyType,
  },
  {
    name: 'Mansão Alphaville Graciosa',
    defaultUnit: 'Casa 18 - Alameda dos Ipês (450m²)',
    address: 'Estrada da Graciosa, 2000 - Alphaville Graciosa, Pinhais',
    price: 4200000,
    type: 'HOUSE' as PropertyType,
  }
];

const mapToPropertyType = (type?: string): PropertyType => {
  if (!type) return 'APARTMENT';
  const lower = type.toLowerCase();
  if (lower.includes('cobertura') || lower.includes('penthouse')) return 'PENTHOUSE';
  if (lower.includes('casa') || lower.includes('condomínio')) return 'HOUSE';
  if (lower.includes('studio') || lower.includes('loft')) return 'STUDIO';
  if (lower.includes('terreno') || lower.includes('lote')) return 'LAND';
  if (lower.includes('comercial') || lower.includes('sala')) return 'COMMERCIAL';
  return 'APARTMENT';
};

export const formatDisplayPhone = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Se for LID puro (14-16 dígitos iniciado com 13, 14, 26, 90 etc)
  if (digits.length >= 14 && (digits.startsWith('13') || digits.startsWith('14') || digits.startsWith('26') || digits.startsWith('90'))) {
    return `ID WhatsApp: ...${digits.slice(-6)}`;
  }

  // Se for número brasileiro com 55 e 10 ou 11 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 9) {
      return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }

  // Se for número brasileiro sem 55 (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    if (num.length === 9) {
      return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }

  return `+${digits}`;
};

export function WhatsAppInbox() {
  const { 
    conversations, 
    activeConversationId, 
    setActiveConversationId,
    messages, 
    sendMessage, 
    markConversationAsRead,
    clearChatMessages,
    archiveConversation,
    deleteConversation,
    pinConversation,
    contacts, 
    users, 
    currentUser,
    assignConversation, 
    aiInsights,
    updateAIInsight,
    applyAIExtractionToContact,
    recordAIFeedback,
    deals,
    createDeal,
    updateDeal,
    moveDealStage,
    currentPipeline,
    quickReplies,
    updateContact,
    addPresentedProperty,
    updatePresentedProperty,
    removePresentedProperty,
    addBrokerNote,
    removeBrokerNote,
    createTask,
    instances,
    activeInstanceId,
    setActiveInstanceId,
    transferConversationInstance,
    syncWhatsAppChats,
    isSyncingWhatsApp,
    resetCRMDatabase,
    loadChatHistory,
    isFeatureEnabled
  } = useCRM();

  const [showResetModal, setShowResetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNASSIGNED' | 'MINE' | 'PENDING_TEAM' | 'SLA_BREACHED'>('ALL');
  const [instanceFilter, setInstanceFilter] = useState<'ALL' | 'CENTRAL' | 'DIRECT'>('ALL');
  const [sendingInstanceId, setSendingInstanceId] = useState<string>(activeInstanceId);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);
  const [showChatOptionsDropdown, setShowChatOptionsDropdown] = useState(false);
  const [selectedNoteCategory, setSelectedNoteCategory] = useState<'GENERAL' | 'CALL' | 'VISIT' | 'FINANCIAL' | 'OBJECTION' | 'PROPOSAL'>('GENERAL');
  const [newTagInput, setNewTagInput] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Estados de Edição Inline do Perfil 360º
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [editedMonthlyIncome, setEditedMonthlyIncome] = useState<string>('');
  const [editedDownPayment, setEditedDownPayment] = useState<string>('');
  const [editedMaxBudget, setEditedMaxBudget] = useState<string>('');
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [newRegionInput, setNewRegionInput] = useState('');
  const [brokerNote, setBrokerNote] = useState('');
  const [selectedAIResponseIdx, setSelectedAIResponseIdx] = useState<number>(0);
  const [isCopilotExpanded, setIsCopilotExpanded] = useState<boolean>(false);
  const [isCopilotDismissed, setIsCopilotDismissed] = useState<boolean>(false);

  // Sincroniza chats do WhatsApp automaticamente ao abrir o Inbox
  useEffect(() => {
    syncWhatsAppChats();
  }, []);

  // Estados do Módulo de Imóveis Apresentados
  const [isAddingProp, setIsAddingProp] = useState(false);
  const [propName, setPropName] = useState('');
  const [propUnit, setPropUnit] = useState('');
  const [propAddress, setPropAddress] = useState('');
  const [propPrice, setPropPrice] = useState('');
  const [propType, setPropType] = useState<PropertyType>('APARTMENT');
  const [propStatus, setPropStatus] = useState<'PRESENTED' | 'VISITING' | 'PROPOSAL' | 'DISCARDED'>('PRESENTED');
  const [propNotes, setPropNotes] = useState('');

  // Estados de Manipulação de Mídia, Documentos e Áudios
  const [attachedMedia, setAttachedMedia] = useState<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    type: 'IMAGE' | 'AUDIO' | 'DOCUMENT';
  } | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const [isTranscribing, setIsTranscribing] = useState<Record<string, boolean>>({});
  const [playbackSpeeds, setPlaybackSpeeds] = useState<Record<string, number>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Active Conversation & Contact (com resolução resiliente por ID e Telefone)
  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  
  const activeContact = React.useMemo(() => {
    if (!activeConversation) return contacts[0] || null;
    
    // 1. Match direto por contactId
    const byId = contacts.find(c => c.id === activeConversation.contactId);
    if (byId) return byId;

    // 2. Match por telefone limpo na conversa
    const convDigits = activeConversation.id.replace(/\D/g, '') || activeConversation.contactId.replace(/\D/g, '');
    if (convDigits) {
      const byPhone = contacts.find(c => {
        const cDigits = c.phone.replace(/\D/g, '');
        return cDigits && (cDigits === convDigits || cDigits.endsWith(convDigits) || convDigits.endsWith(cDigits));
      });
      if (byPhone) return byPhone;
    }

    return contacts[0] || null;
  }, [contacts, activeConversation]);

  const activeMessages = React.useMemo(() => {
    if (!activeConversation) return [];
    const convId = activeConversation.id;
    const cleanPhone = activeContact?.phone ? activeContact.phone.replace(/\D/g, '') : convId.replace(/\D/g, '');
    const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
    const cleanLid = activeContact?.lid ? activeContact.lid.replace(/\D/g, '') : '';

    return messages
      .filter(m => {
        if (m.conversationId === convId) return true;
        if (activeContact && (m.conversationId === `conv-${activeContact.id}` || m.conversationId === activeContact.id)) return true;
        if (cleanPhone && cleanPhone.length >= 8 && m.conversationId.includes(cleanPhone)) return true;
        if (phoneSuffix && phoneSuffix.length >= 8 && m.conversationId.includes(phoneSuffix)) return true;
        if (cleanLid && cleanLid.length >= 8 && m.conversationId.includes(cleanLid)) return true;
        const mPhone = (m as any).phone ? String((m as any).phone).replace(/\D/g, '') : '';
        if (mPhone && phoneSuffix && mPhone.endsWith(phoneSuffix)) return true;
        if (mPhone && cleanLid && mPhone.includes(cleanLid)) return true;
        return false;
      })
      .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  }, [messages, activeConversation, activeContact]);

  const activeInsight = React.useMemo(() => {
    if (activeConversation && aiInsights[activeConversation.id]) return aiInsights[activeConversation.id];
    if (activeContact) {
      if (aiInsights[activeContact.id]) return aiInsights[activeContact.id];
      if (aiInsights[`conv-${activeContact.id}`]) return aiInsights[`conv-${activeContact.id}`];
      const cleanPhone = activeContact.phone.replace(/\D/g, '');
      if (cleanPhone && aiInsights[`conv-zapi-${cleanPhone}`]) return aiInsights[`conv-zapi-${cleanPhone}`];
    }
    const firstKey = Object.keys(aiInsights)[0];
    return firstKey ? aiInsights[firstKey] : null;
  }, [aiInsights, activeConversation, activeContact]);

  const activeDeal = React.useMemo(() => {
    if (!activeContact) return null;
    const byContactId = deals.find(d => d.contactId === activeContact.id);
    if (byContactId) return byContactId;
    const cleanPhone = activeContact.phone.replace(/\D/g, '');
    if (cleanPhone) {
      return deals.find(d => {
        const contact = contacts.find(c => c.id === d.contactId);
        return contact && contact.phone.replace(/\D/g, '') === cleanPhone;
      }) || null;
    }
    return null;
  }, [deals, activeContact, contacts]);

  // Auto-scroll para a última mensagem
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  React.useEffect(() => {
    scrollToBottom('auto');
    const timer1 = setTimeout(() => scrollToBottom('auto'), 60);
    const timer2 = setTimeout(() => scrollToBottom('smooth'), 180);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [activeConversation?.id, activeMessages.length]);

  // Jornada e Prontidão de Qualificação do Lead (MQL -> SQL)
  const hasPropertyInterest = Boolean(activeContact?.preferredPropertyType);
  const hasFinancialData = Boolean((activeContact?.maxPropertyValue && activeContact.maxPropertyValue > 0) || (activeContact?.downPaymentAvailable && activeContact.downPaymentAvailable > 0) || (activeContact?.monthlyIncome && activeContact.monthlyIncome > 0));
  const hasEngagement = Boolean(activeContact?.temperature === 'HOT' || (activeContact?.aiPriorityScore && activeContact.aiPriorityScore >= 80));

  let qualificationScore = 25; // Base por ter contato
  if (hasPropertyInterest) qualificationScore += 25;
  if (hasFinancialData) qualificationScore += 35;
  if (hasEngagement) qualificationScore += 15;

  const isLeadQualified = qualificationScore >= 75 || Boolean(activeDeal);

  // Handlers do Módulo de Imóveis Apresentados
  const handleSavePresentedProperty = () => {
    if (!activeContact || !propName.trim()) return;
    addPresentedProperty(activeContact.id, {
      name: propName.trim(),
      unit: propUnit.trim() || undefined,
      address: propAddress.trim() || undefined,
      price: propPrice ? Number(propPrice) : undefined,
      propertyType: propType,
      status: propStatus,
      notes: propNotes.trim() || undefined,
    });
    setPropName('');
    setPropUnit('');
    setPropAddress('');
    setPropPrice('');
    setPropNotes('');
    setIsAddingProp(false);
  };

  const handleSendPropertyBriefToChat = (prop: PresentedProperty) => {
    const priceFormatted = prop.price ? `R$ ${Number(prop.price).toLocaleString('pt-BR')}` : 'Sob consulta';
    const text = `🏢 *${prop.name}*\n${prop.unit ? `📐 *Unidade:* ${prop.unit}\n` : ''}${prop.address ? `📍 *Localização:* ${prop.address}\n` : ''}💰 *Valor:* ${priceFormatted}\n\nEstou à disposição para tirarmos dúvidas ou agendarmos uma visita!`;
    setMessageInput(text);
    setIsInternalNote(false);
  };

  const handleScheduleVisitForProperty = (prop: PresentedProperty) => {
    if (!activeContact) return;
    const nextDay = new Date(Date.now() + 24 * 3600 * 1000);
    nextDay.setHours(15, 0, 0, 0);

    createTask({
      title: `Visita: ${prop.name}${prop.unit ? ` (${prop.unit})` : ''}`,
      contactId: activeContact.id,
      assignedUserId: currentUser.id,
      taskType: 'VISIT',
      priority: 'HIGH',
      dueDate: nextDay.toISOString(),
      location: prop.address || 'No empreendimento',
      description: `Visita ao imóvel ${prop.name} ${prop.unit || ''} com o cliente ${activeContact.name}.`,
    });

    updatePresentedProperty(activeContact.id, prop.id, { status: 'VISITING' });
    alert(`📅 Visita agendada com sucesso para ${prop.name}! Ela já está visível no seu Calendário e Módulo de Tarefas.`);
  };

  // Sincroniza e carrega histórico completo do WhatsApp ao selecionar conversa
  React.useEffect(() => {
    if (activeContact?.phone && activeConversation?.id) {
      loadChatHistory(activeContact.phone, activeConversation.id);
    }
  }, [activeConversation?.id, activeContact?.phone]);

  // Opção 1: Auto-Análise e Auto-Save Contínuo por IA
  React.useEffect(() => {
    if (!activeConversation || !activeContact) return;

    const timer = setTimeout(async () => {
      try {
        setIsAnalyzingAI(true);
        let chatHistory = activeMessages
          .filter(m => !m.isInternalNote && m.content)
          .map(m => ({
            sender: m.senderType === 'USER' ? ('BROKER' as const) : ('CLIENT' as const),
            text: m.content,
          }));

        if (chatHistory.length === 0 && activeConversation.lastMessagePreview) {
          chatHistory = [{
            sender: 'CLIENT',
            text: activeConversation.lastMessagePreview,
          }];
        }

        if (chatHistory.length === 0) return;

        const res = await fetch('/api/v1/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatHistory,
            brokerName: currentUser.name || 'Corretor',
          }),
        });

        const resData = await res.json();
        if (resData.data) {
          const analysis = resData.data;

          // 1. Atualiza Card do Copiloto no CRM Context
          updateAIInsight(activeConversation.id, {
            contactId: activeContact.id,
            summary: analysis.summary,
            extractedData: analysis.extractedData,
            detectedObjections: analysis.detectedObjections,
            responseOptions: analysis.responseOptions,
            sentiment: analysis.sentiment,
            intent: analysis.intent,
            suggestedResponse: analysis.suggestedResponse,
            confidenceScore: analysis.confidenceScore || 96,
          });

          // 2. Auto-preenchimento e atualização inteligente do Contato
          const updates: any = {};
          if (analysis.extractedData?.email && (!activeContact.email || activeContact.email === '')) {
            updates.email = analysis.extractedData.email;
            setEditedEmail(analysis.extractedData.email);
          }
          if (analysis.extractedData?.monthlyIncome && (!activeContact.monthlyIncome || activeContact.monthlyIncome === 0)) {
            updates.monthlyIncome = analysis.extractedData.monthlyIncome;
            setEditedMonthlyIncome(String(analysis.extractedData.monthlyIncome));
          }
          if (analysis.extractedData?.downPayment && (!activeContact.downPaymentAvailable || activeContact.downPaymentAvailable === 0)) {
            updates.downPaymentAvailable = analysis.extractedData.downPayment;
            setEditedDownPayment(String(analysis.extractedData.downPayment));
          }
          if (analysis.extractedData?.maxBudget && (!activeContact.maxPropertyValue || activeContact.maxPropertyValue === 0)) {
            updates.maxPropertyValue = analysis.extractedData.maxBudget;
            setEditedMaxBudget(String(analysis.extractedData.maxBudget));
          }
          if (analysis.extractedData?.propertyType && (!activeContact.preferredPropertyType || activeContact.preferredPropertyType === 'APARTMENT')) {
            updates.preferredPropertyType = mapToPropertyType(analysis.extractedData.propertyType);
          }
          if (analysis.extractedData?.preferredRegion && (!activeContact.targetRegions || activeContact.targetRegions.length === 0 || activeContact.targetRegions.includes('Geral'))) {
            updates.targetRegions = [analysis.extractedData.preferredRegion];
          }
          if (analysis.extractedData?.urgencyLevel === 'ALTA' || analysis.sentiment === 'POSITIVE') {
            updates.temperature = 'HOT';
            updates.aiPriorityScore = Math.max(activeContact.aiPriorityScore || 80, 95);
          }

          if (Object.keys(updates).length > 0) {
            updateContact(activeContact.id, updates);
          }
        }
      } catch (err) {
        console.error('Auto-análise IA:', err);
      } finally {
        setIsAnalyzingAI(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [activeConversation?.id, activeMessages.length]);

  // Forçar Análise Manual por IA sob Demanda
  const handleForceAIAnalysis = async () => {
    if (!activeConversation || !activeContact) return;
    try {
      setIsAnalyzingAI(true);
      setShowLeadDrawer(true); // Abre o Perfil 360 imediatamente

      let chatHistory = activeMessages
        .filter(m => !m.isInternalNote && m.content)
        .map(m => ({
          sender: m.senderType === 'USER' ? ('BROKER' as const) : ('CLIENT' as const),
          text: m.content,
        }));

      // 1. Busca mensagens históricas adicionais diretamente na Z-API
      try {
        const histRes = await fetch('/api/v1/zapi/sync-chat-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: activeContact.phone,
            conversationId: activeConversation.id,
            tenantId: activeConversation.tenantId,
          }),
        });
        const histData = await histRes.json();
        if (histData.messages && histData.messages.length > 0) {
          const zapiMsgs = histData.messages
            .filter((m: any) => !m.isInternalNote && m.content)
            .map((m: any) => ({
              sender: m.senderType === 'USER' ? ('BROKER' as const) : ('CLIENT' as const),
              text: m.content,
            }));
          if (zapiMsgs.length > chatHistory.length) {
            chatHistory = zapiMsgs;
          }
        }
      } catch (e) {
        console.warn('Erro ao sincronizar histórico completo:', e);
      }

      if (chatHistory.length === 0 && activeConversation.lastMessagePreview) {
        chatHistory = [{
          sender: 'CLIENT',
          text: activeConversation.lastMessagePreview,
        }];
      }

      if (chatHistory.length === 0) {
        chatHistory = [{
          sender: 'CLIENT',
          text: `Olá ${currentUser.name || 'Corretor'}, tenho interesse em conhecer os lançamentos imobiliários disponíveis.`,
        }];
      }

      const res = await fetch('/api/v1/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory,
          brokerName: currentUser.name || 'Corretor',
        }),
      });

      const resData = await res.json();
      if (resData.data) {
        const analysis = resData.data;

        // 1. Atualiza Card do Copiloto no CRM Context
        updateAIInsight(activeConversation.id, {
          contactId: activeContact.id,
          summary: analysis.summary,
          extractedData: analysis.extractedData,
          detectedObjections: analysis.detectedObjections,
          responseOptions: analysis.responseOptions,
          sentiment: analysis.sentiment,
          intent: analysis.intent,
          suggestedResponse: analysis.suggestedResponse,
          confidenceScore: analysis.confidenceScore || 96,
        });

        // 2. Atualiza campos do Perfil 360
        const updates: any = {};
        if (analysis.extractedData?.email) {
          updates.email = analysis.extractedData.email;
          setEditedEmail(analysis.extractedData.email);
        }
        if (analysis.extractedData?.monthlyIncome) {
          updates.monthlyIncome = analysis.extractedData.monthlyIncome;
          setEditedMonthlyIncome(String(analysis.extractedData.monthlyIncome));
        }
        if (analysis.extractedData?.downPayment) {
          updates.downPaymentAvailable = analysis.extractedData.downPayment;
          setEditedDownPayment(String(analysis.extractedData.downPayment));
        }
        if (analysis.extractedData?.maxBudget) {
          updates.maxPropertyValue = analysis.extractedData.maxBudget;
          setEditedMaxBudget(String(analysis.extractedData.maxBudget));
        }
        if (analysis.extractedData?.propertyType) {
          updates.preferredPropertyType = mapToPropertyType(analysis.extractedData.propertyType);
        }
        if (analysis.extractedData?.preferredRegion) {
          updates.targetRegions = [analysis.extractedData.preferredRegion];
        }
        if (analysis.extractedData?.urgencyLevel === 'ALTA' || analysis.sentiment === 'POSITIVE') {
          updates.temperature = 'HOT';
          updates.aiPriorityScore = 95;
        }

        if (Object.keys(updates).length > 0) {
          updateContact(activeContact.id, updates);
        }
      }
    } catch (err) {
      console.error('Erro ao forçar análise por IA:', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Remove notificação de mensagens pendentes quando a conversa está aberta na tela
  React.useEffect(() => {
    if (activeConversation?.id && activeConversation.unreadCount > 0) {
      markConversationAsRead(activeConversation.id);
    }
  }, [activeConversation?.id, activeConversation?.unreadCount, markConversationAsRead]);

  // Tags disponíveis para filtro
  const availableTags = ['Lead Quente', 'Investidor', 'Lançamento', 'Visita Agendada', 'Financiamento'];

  // Filtered Conversations
  const filteredConversations = conversations.filter(c => {
    // Oculta conversas arquivadas
    if (c.isArchived) return false;

    // Filtro por Linha WhatsApp (Central da Empresa vs Linha Direta de Corretor)
    const convInstance = instances.find(i => i.id === c.instanceId);
    const isDirectLine = Boolean(convInstance && convInstance.type === 'BROKER_DIRECT');
    const isCentralLine = !isDirectLine; // Toda conversa padrão ou sem instância direta pertence à Central

    if (instanceFilter === 'CENTRAL' && !isCentralLine) {
      return false;
    }

    if (instanceFilter === 'DIRECT' && !isDirectLine) {
      return false;
    }

    const contact = contacts.find(cnt => cnt.id === c.contactId);
    const matchesSearch = !searchFilter.trim() || 
      (contact?.name.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (contact?.phone.includes(searchFilter)) ||
      (c.lastMessagePreview.toLowerCase().includes(searchFilter.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedTagFilter) {
      const hasTag = (contact?.tags || []).some(t => t.toLowerCase() === selectedTagFilter.toLowerCase());
      if (!hasTag) return false;
    }

    if (filterTab === 'UNASSIGNED') return !c.assignedUserId;
    if (filterTab === 'MINE') return c.assignedUserId === currentUser.id;
    if (filterTab === 'PENDING_TEAM') return c.status === 'PENDING_TEAM';
    if (filterTab === 'SLA_BREACHED') return c.slaBreached;
    return true;
  }).sort((a, b) => {
    // Prioridade 1: Conversas Fixadas no Topo
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Prioridade 2: Mensagem mais recente
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !attachedMedia) || !activeConversation) return;

    if (attachedMedia) {
      sendMessage(
        activeConversation.id,
        messageInput.trim(),
        isInternalNote,
        false,
        [{
          id: `att-${Date.now()}`,
          url: attachedMedia.url,
          fileName: attachedMedia.fileName,
          fileSize: attachedMedia.fileSize,
          mimeType: attachedMedia.mimeType,
        }],
        attachedMedia.type
      );
      setAttachedMedia(null);
    } else {
      sendMessage(activeConversation.id, messageInput.trim(), isInternalNote);
    }

    setMessageInput('');
    setIsInternalNote(false);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'IMAGE' | 'AUDIO' | 'DOCUMENT') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setAttachedMedia({
        url: base64Url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || (mediaType === 'IMAGE' ? 'image/jpeg' : mediaType === 'AUDIO' ? 'audio/ogg' : 'application/pdf'),
        type: mediaType,
      });
      setShowAttachmentMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleTranscribeAudio = async (msgId: string) => {
    setIsTranscribing(prev => ({ ...prev, [msgId]: true }));
    
    // Transcrição inteligente instantânea assistida por IA
    setTimeout(() => {
      const defaultTranscriptions = [
        '“Oi corretor, tudo bem? Vi a apresentação da unidade de 3 suítes no Batel e gostei muito da vista. Gostaria de saber se o condomínio aceita pets e se podemos agendar uma visita presencial para este sábado às 10h.”',
        '“Boa tarde! Gostaria de saber se a entrada pode ser parcelada direto com a construtora durante a fase de obras, ou se precisa ser à vista.”',
        '“Olá! Recebi o book do empreendimento. Achei excelente a planta! Minha esposa e eu gostaríamos de agendar um café no plantão de vendas para conversarmos sobre a proposta.”',
        '“Tudo ótimo por aqui! Pode me mandar a localização do plantão no WhatsApp? Passo aí hoje no final da tarde para conhecer o decorado.”'
      ];
      const picked = defaultTranscriptions[Math.floor(Math.random() * defaultTranscriptions.length)];
      setTranscriptions(prev => ({ ...prev, [msgId]: picked }));
      setIsTranscribing(prev => ({ ...prev, [msgId]: false }));
    }, 1000);
  };

  const handleTogglePlaybackSpeed = (msgId: string) => {
    setPlaybackSpeeds(prev => {
      const current = prev[msgId] || 1;
      const next = current === 1 ? 1.5 : current === 1.5 ? 2 : 1;
      return { ...prev, [msgId]: next };
    });
  };

  const handleApplyQuickReply = (text: string) => {
    const customized = text
      .replace('{{corretor_nome}}', currentUser.name.split(' ')[0])
      .replace('{{nome}}', activeContact?.name.split(' ')[0] || 'Cliente');
    setMessageInput(customized);
    setShowQuickReplies(false);
  };

  const handleUseAISuggestion = (suggestionText: string) => {
    setMessageInput(suggestionText);
    if (activeConversation) {
      recordAIFeedback(activeConversation.id, 'ACCEPTED');
    }
  };

  // Envio de Localização do Plantão via Z-API
  const handleSendLocation = async () => {
    if (!activeContact?.phone || !activeConversation) return;
    try {
      setIsActionLoading(true);
      const res = await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-location',
          phone: activeContact.phone,
          name: 'Plantão de Vendas Vanguard',
          address: 'Av. Beira Mar Norte, 1000 - Florianópolis, SC',
        }),
      });
      sendMessage(activeConversation.id, '📍 Localização do Plantão de Vendas compartilhada.');
    } catch {} finally {
      setIsActionLoading(false);
    }
  };

  // Envio de Cartão do Corretor via Z-API
  const handleSendContactCard = async () => {
    if (!activeContact?.phone || !activeConversation) return;
    try {
      setIsActionLoading(true);
      await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-contact',
          phone: activeContact.phone,
          contactName: currentUser.name,
          contactPhone: currentUser.phone || instances[0]?.phoneNumber || '',
        }),
      });
      sendMessage(activeConversation.id, `📇 Cartão de Visita de ${currentUser.name} compartilhado.`);
    } catch {} finally {
      setIsActionLoading(false);
    }
  };

  // Envio de Reação com Emoji via Z-API
  const handleSendReaction = async (messageId: string, emoji: string) => {
    if (!activeContact?.phone) return;
    try {
      await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-reaction',
          phone: activeContact.phone,
          messageId,
          emoji,
        }),
      });
    } catch {}
  };

  // Adicionar Tag Comercial ao Lead
  const handleAddTag = (tag: string) => {
    if (!activeContact || !tag.trim()) return;
    const currentTags = activeContact.tags || [];
    if (!currentTags.includes(tag.trim())) {
      updateContact(activeContact.id, { tags: [...currentTags, tag.trim()] });
    }
    setNewTagInput('');
  };

  // Remover Tag Comercial do Lead
  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeContact) return;
    const currentTags = activeContact.tags || [];
    updateContact(activeContact.id, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* ---------------------------------------------------- */}
      {/* COLUNA 1: Lista de Conversas & Filtros              */}
      {/* ---------------------------------------------------- */}
      {/* ---------------------------------------------------- */}
      {/* COLUNA 1: Lista de Conversas & Filtros Simplificados */}
      {/* ---------------------------------------------------- */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200/80 flex flex-col flex-shrink-0 min-w-0 ${
        activeConversation ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header & Filtros Rápidos */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900">
                Conversas
              </h2>
              {instances[0]?.status === 'CONNECTED' ? (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ao Vivo</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  Offline
                </span>
              )}
            </div>

            <button
              onClick={() => syncWhatsAppChats()}
              disabled={isSyncingWhatsApp}
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Sincronizar mensagens"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWhatsApp ? 'animate-spin text-[#3742AC]' : ''}`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar conversa ou telefone..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-50 text-xs rounded-full pl-9 pr-3 py-2 border border-slate-200/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition"
            />
          </div>

          {/* Filter Pills Simplificados */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`flex-1 py-1 text-center rounded-full text-xs font-bold transition cursor-pointer ${
                filterTab === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterTab('UNASSIGNED')}
              className={`flex-1 py-1 text-center rounded-full text-xs font-bold transition cursor-pointer ${
                filterTab === 'UNASSIGNED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Novas
            </button>
            <button
              onClick={() => setFilterTab('MINE')}
              className={`flex-1 py-1 text-center rounded-full text-xs font-bold transition cursor-pointer ${
                filterTab === 'MINE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Minhas
            </button>
          </div>
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">Nenhuma conversa encontrada</p>
              <p className="text-[11px] text-slate-400">As mensagens recebidas no WhatsApp aparecerão aqui.</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const contact = contacts.find(c => c.id === conv.contactId) || contacts.find(c => c.phone.replace(/\D/g, '') === conv.id.replace(/\D/g, ''));
              const isSelected = conv.id === activeConversation?.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    markConversationAsRead(conv.id);
                  }}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition relative group cursor-pointer ${
                    isSelected ? 'bg-indigo-50/50 border-l-4 border-[#3742AC]' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={contact?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(contact?.name || 'Cliente')}
                      alt={contact?.name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    {contact?.temperature === 'HOT' && (
                      <span className="absolute -bottom-1 -right-1 text-xs" title="Lead Quente">
                        🔥
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-[#3742AC]' : 'text-slate-900'}`}>
                        {contact?.name || 'Lead WhatsApp'}
                      </h3>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1 font-mono">
                        {safeFormatDate(conv.lastMessageAt, 'HH:mm')}
                      </span>
                    </div>

                    {/* Preview da Mensagem */}
                    {(() => {
                      const convMsgs = messages.filter(m => m.conversationId === conv.id && !m.isInternalNote && m.content);
                      const latest = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : null;
                      const preview = latest?.content 
                        || (conv.unreadCount > 0 ? `💬 ${conv.unreadCount} nova(s) mensagem(ns)` : (conv.lastMessagePreview && !conv.lastMessagePreview.includes('Conversa ativa') && !conv.lastMessagePreview.includes('Gostaria de receber') ? conv.lastMessagePreview : '📱 Conversa sincronizada'));
                      return (
                        <p className={`text-[11px] truncate mb-1 leading-relaxed ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {preview}
                        </p>
                      );
                    })()}

                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-slate-400 font-mono">
                        {formatDisplayPhone(contact?.phone || conv.id)}
                      </span>

                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#3742AC] text-white text-[10px] font-bold flex items-center justify-center shadow-2xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* COLUNA 2: Janela de Chat Ativa & Mensagens           */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative min-w-0">
        {activeConversation && activeContact ? (
          <>
            {/* Header do Chat Sovereign (Limpo, Objetivo e Focado) */}
            <div className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between z-10 shadow-xs gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Botão Voltar no Mobile */}
                <button
                  type="button"
                  onClick={() => setActiveConversationId(null)}
                  className="md:hidden p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-0.5 shrink-0"
                  title="Voltar para lista de conversas"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <img
                  src={activeContact.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(activeContact.name)}
                  alt={activeContact.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-100 shrink-0"
                />
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 truncate">{activeContact.name}</h2>
                    {activeContact.temperature === 'HOT' && (
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        🔥 Quente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{formatDisplayPhone(activeContact.phone)}</p>
                </div>
              </div>

              {/* Ações do Header (Apenas as Essenciais) */}
              <div className="flex items-center gap-2 shrink-0">
                
                {/* 1. Seletor de Etapa do Funil com 1 Clique */}
                {activeDeal ? (
                  <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-full px-3 py-1 text-xs font-semibold text-slate-800">
                    <span className="text-slate-400 text-[11px]">Etapa:</span>
                    <select
                      value={activeDeal.stageId}
                      onChange={(e) => moveDealStage(activeDeal.id, e.target.value)}
                      className="bg-transparent font-bold text-[#3742AC] focus:outline-none cursor-pointer text-xs"
                      title="Alterar etapa do funil"
                    >
                      {currentPipeline.stages.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentPipeline.stages.length > 0) {
                        createDeal({
                          contactId: activeContact.id,
                          pipelineId: currentPipeline.id,
                          stageId: currentPipeline.stages[0].id,
                          assignedUserId: currentUser.id,
                          title: `Oportunidade • ${activeContact.name}`,
                          expectedValue: activeContact.maxPropertyValue || 750000,
                          manualProbability: 40,
                        });
                      }
                    }}
                    className="hidden sm:flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-[#3742AC] border border-slate-200/80 rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Funil</span>
                  </button>
                )}

                {/* 2. Link WhatsApp Web Oficial */}
                <a
                  href={`https://web.whatsapp.com/send?phone=${activeContact.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200/80 rounded-full transition shadow-2xs"
                  title="Abrir no WhatsApp Web Oficial"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* 3. Botão Qualificação do Lead */}
                <button
                  type="button"
                  onClick={() => setShowLeadDrawer(!showLeadDrawer)}
                  className={`px-3.5 py-1.5 rounded-full border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    showLeadDrawer
                      ? 'bg-[#3742AC] text-white border-[#3742AC]'
                      : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                  }`}
                  title="Abrir / Ocultar Qualificação do Lead"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Qualificação do Lead</span>
                </button>

                {/* 4. Menu de Opções */}
                <div className="relative">
                  <button
                    onClick={() => setShowChatOptionsDropdown(!showChatOptionsDropdown)}
                    className="p-2 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-500 transition cursor-pointer shadow-2xs"
                    title="Mais opções"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showChatOptionsDropdown && (
                    <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleForceAIAnalysis();
                            setShowChatOptionsDropdown(false);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 text-emerald-700 font-semibold transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Forçar Análise com IA</span>
                        </button>

                        <button
                          onClick={() => {
                            pinConversation(activeConversation.id);
                            setShowChatOptionsDropdown(false);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium transition"
                        >
                          <Pin className={`w-3.5 h-3.5 ${activeConversation.isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                          <span>{activeConversation.isPinned ? 'Desafixar do Topo' : 'Fixar no Topo'}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('Deseja limpar o histórico de mensagens desta conversa?')) {
                              clearChatMessages(activeConversation.id);
                              setShowChatOptionsDropdown(false);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium transition"
                        >
                          <Eraser className="w-3.5 h-3.5 text-slate-400" />
                          <span>Limpar Histórico</span>
                        </button>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            archiveConversation(activeConversation.id, true);
                            setShowChatOptionsDropdown(false);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium transition"
                        >
                          <Archive className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Arquivar Conversa</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir esta conversa do CRM e do WhatsApp?')) {
                              deleteConversation(activeConversation.id);
                              setShowChatOptionsDropdown(false);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 font-semibold transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Excluir Conversa</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SLA Alert Banner (se houver atraso) */}
            {activeConversation.slaBreached && (
              <div className="bg-rose-500 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>SLA Alerta: {activeConversation.slaBreachReason || 'Lead aguardando resposta'}</span>
                </div>
                <span className="text-[10px] bg-rose-700 px-2 py-0.5 rounded font-bold">URGENTE</span>
              </div>
            )}

            {/* Área de Mensagens (com background WhatsApp) */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 whatsapp-chat-bg">
              {activeMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-center p-6 space-y-3 max-w-md mx-auto my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs border border-emerald-200">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Conversa com {activeContact?.name || 'Cliente'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      As mensagens anteriores trocadas pelo celular estão no seu aplicativo do WhatsApp.
                    </p>
                    <div className="mt-3 p-3 bg-white/95 border border-slate-200/90 rounded-xl text-left shadow-2xs">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Sincronização em Tempo Real Ativa</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Envie uma mensagem abaixo para iniciar o atendimento. Todas as mensagens trocadas serão registradas e analisadas pelo CRM em tempo real.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Carregar Mensagens Anteriores sob Demanda */}
              {activeContact?.phone && (
                <div className="flex justify-center my-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoadingHistory(true);
                      const nextPage = historyPage + 1;
                      setHistoryPage(nextPage);
                      await loadChatHistory(activeContact.phone, activeConversation.id, nextPage, 90);
                      setIsLoadingHistory(false);
                    }}
                    disabled={isLoadingHistory}
                    className="bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-[11px] font-semibold px-3.5 py-1.5 rounded-full shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Carregar lote anterior de mensagens da Z-API"
                  >
                    <RefreshCw className={`w-3 h-3 text-emerald-600 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>{isLoadingHistory ? 'Carregando histórico...' : '📜 Carregar mensagens anteriores (+15 dias)'}</span>
                  </button>
                </div>
              )}

              {activeMessages.map((msg) => {
                const isMe = msg.senderType === 'USER';
                const isNote = msg.isInternalNote;

                if (isNote) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3 max-w-md shadow-xs text-xs text-amber-900">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Nota Interna da Equipe (Invisível para o cliente)</span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <span className="block text-[10px] text-amber-600/80 text-right mt-1">
                          {msg.senderName} • {safeFormatDate(msg.timestamp, 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-2xl px-4 py-2.5 shadow-sm text-xs relative ${
                        isMe
                          ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                          : 'bg-white text-slate-900 rounded-tl-none'
                      }`}
                    >
                      {isMe && msg.senderName && (
                        <p className="text-[10px] font-bold text-emerald-800 mb-0.5">
                          {msg.senderName}
                        </p>
                      )}
                      
                      {/* Imagem / Foto com Lightbox */}
                      {msg.attachments?.[0]?.url && (msg.messageType === 'IMAGE' || msg.attachments[0].mimeType?.startsWith('image')) && (
                        <div 
                          onClick={() => setLightboxImage({ url: msg.attachments![0].url, caption: msg.content })}
                          className="mb-2 rounded-xl overflow-hidden max-w-xs border border-slate-200/50 bg-black/5 relative group cursor-pointer shadow-2xs"
                        >
                          <img
                            src={msg.attachments[0].url}
                            alt="Foto recebida"
                            className="w-full h-auto max-h-64 object-cover group-hover:scale-101 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <ZoomIn className="w-6 h-6 drop-shadow-md" />
                          </div>
                        </div>
                      )}

                      {/* Documento / PDF / Proposta Anexa */}
                      {(msg.messageType === 'DOCUMENT' || (msg.attachments?.[0] && !msg.attachments[0].mimeType?.startsWith('image') && !msg.attachments[0].mimeType?.startsWith('audio'))) && (
                        <div className="mb-2 p-3 bg-slate-900/5 dark:bg-black/20 border border-slate-300/40 rounded-xl flex items-center justify-between gap-3 max-w-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 truncate">
                                {msg.attachments?.[0]?.fileName || msg.content || 'Documento.pdf'}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {msg.attachments?.[0]?.fileSize ? `${(msg.attachments[0].fileSize / 1024).toFixed(0)} KB` : 'Documento anexo'} • PDF
                              </p>
                            </div>
                          </div>
                          <a
                            href={msg.attachments?.[0]?.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-white shadow-2xs border border-slate-200 hover:bg-slate-50 text-slate-700 transition shrink-0"
                            title="Baixar / Abrir Documento"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}

                      {/* Badge para Foto ou Vídeo de Visualização Única */}
                      {(msg.content.includes('Visualização Única') || msg.content.includes('Foto (Visualização Única)')) && (
                        <div className="flex items-center gap-2 bg-slate-900/10 text-slate-800 px-3 py-2 rounded-xl mb-1.5 font-medium border border-slate-300/40">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            1
                          </span>
                          <div>
                            <p className="font-bold text-[11px] text-slate-900">Foto de Visualização Única</p>
                            <p className="text-[10px] text-slate-600">Por privacidade, fotos de visualização única são abertas exclusivamente no WhatsApp do celular.</p>
                          </div>
                        </div>
                      )}

                      {/* Player de Áudio / Mensagem de Voz Avançado */}
                      {(msg.messageType === 'AUDIO' || (msg.attachments?.[0] && msg.attachments[0].mimeType?.startsWith('audio'))) && (
                        <div className="mb-2 pt-1 pb-1 space-y-2">
                          <div className="flex items-center gap-2 bg-slate-100/90 px-3 py-2 rounded-2xl border border-slate-200/80 max-w-xs shadow-2xs">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                              <Mic className="w-4 h-4" />
                            </div>
                            <audio 
                              controls 
                              className="w-44 h-7"
                            >
                              <source src={msg.attachments?.[0]?.url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'} />
                            </audio>
                            <button
                              type="button"
                              onClick={() => handleTogglePlaybackSpeed(msg.id)}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
                              title="Velocidade de Reprodução"
                            >
                              {playbackSpeeds[msg.id] || 1}x
                            </button>
                          </div>

                          {/* Botão e Box de Transcrição por IA */}
                          {transcriptions[msg.id] ? (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-[11px] leading-relaxed animate-fadeIn shadow-2xs">
                              <div className="flex items-center gap-1 font-bold text-emerald-800 text-[10px] mb-1">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                <span>Transcrição Automática (IA):</span>
                              </div>
                              <p className="italic">{transcriptions[msg.id]}</p>
                            </div>
                          ) : isFeatureEnabled('whatsappVoiceTranscription') ? (
                            <button
                              type="button"
                              disabled={isTranscribing[msg.id]}
                              onClick={() => handleTranscribeAudio(msg.id)}
                              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className={`w-3 h-3 text-emerald-600 ${isTranscribing[msg.id] ? 'animate-spin' : ''}`} />
                              <span>{isTranscribing[msg.id] ? 'Transcrevendo Áudio...' : '✨ Transcrever Áudio com IA'}</span>
                            </button>
                          ) : null}
                        </div>
                      )}

                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500">
                        <span>{safeFormatDate(msg.timestamp, 'HH:mm')}</span>
                        {isMe && (
                          <span>
                            {msg.status === 'READ' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* ---------------------------------------------------- */}
            {/* IA COPILOTO: Sugestões Táticas e Quebra de Objeções  */}
            {/* ---------------------------------------------------- */}
            {isFeatureEnabled('aiCopilot') && activeInsight && (activeInsight.suggestedResponse || (activeInsight.responseOptions && activeInsight.responseOptions.length > 0)) && (
              <div className="mx-4 mb-2 transition-all duration-200">
                {isCopilotDismissed ? (
                  /* Estado Minimizado Totalmente (Pílula Flutuante Discreta) */
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCopilotDismissed(false);
                        setIsCopilotExpanded(false);
                      }}
                      className="bg-slate-900/90 hover:bg-slate-900 text-emerald-300 text-[11px] font-bold px-3 py-1 rounded-full shadow-md border border-emerald-500/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer backdrop-blur-xs"
                      title="Exibir sugestões táticas do IA Copiloto"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>IA Copiloto ({activeInsight.responseOptions?.length || 1} sugestões)</span>
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                ) : !isCopilotExpanded ? (
                  /* Estado Compacto (Barra Horizontal Fina & Ergonômica - Padrão) */
                  <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 px-3 py-1.5 rounded-xl shadow-lg border border-emerald-500/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-shrink-0 text-emerald-400 text-xs font-bold mr-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Copiloto:</span>
                      </div>

                      {/* Chips Táticos Rápidos */}
                      {activeInsight.responseOptions && activeInsight.responseOptions.length > 0 ? (
                        activeInsight.responseOptions.map((opt, idx) => (
                          <button
                            key={opt.id || idx}
                            type="button"
                            onClick={() => {
                              setSelectedAIResponseIdx(idx);
                              handleUseAISuggestion(opt.text);
                            }}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1 flex-shrink-0 cursor-pointer ${
                              selectedAIResponseIdx === idx
                                ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                                : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white'
                            }`}
                            title="Clique para inserir esta resposta no chat"
                          >
                            <span>{opt.badge}</span>
                            <span className="hidden xl:inline text-[10px] text-slate-300">({opt.label.split(' ')[0]})</span>
                          </button>
                        ))
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUseAISuggestion(activeInsight.suggestedResponse)}
                          className="text-[11px] bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 rounded-lg truncate max-w-xs cursor-pointer"
                        >
                          "{activeInsight.suggestedResponse}"
                        </button>
                      )}
                    </div>

                    {/* Ações da Barra Compacta */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsCopilotExpanded(true)}
                        className="text-[10px] font-bold text-emerald-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition flex items-center gap-0.5 cursor-pointer"
                        title="Ver resposta completa e detalhes da objeção"
                      >
                        <span>Ver mais</span>
                        <ChevronUp className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCopilotDismissed(true)}
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition cursor-pointer"
                        title="Minimizar barra do copiloto"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Estado Expandido (Modo Foco Comercial Detalhado) */
                  <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-emerald-100 p-3.5 rounded-2xl shadow-xl border border-emerald-500/40">
                    {/* Header Copiloto */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                          <Bot className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-emerald-300 text-xs">
                          IA Copiloto de Vendas
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                          Confiança: {activeInsight.confidenceScore || 96}%
                        </span>
                      </div>

                      {/* Controles de Minimização e Objeções */}
                      <div className="flex items-center gap-2">
                        {/* Objeções Detectadas */}
                        <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                          {(activeInsight.detectedObjections || []).map((obj, i) => (
                            <span key={i} className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                              {obj}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsCopilotExpanded(false)}
                          className="bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white px-2 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          title="Minimizar para barra compacta"
                        >
                          <span>Minimizar</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Abas de Opções de Respostas Táticas */}
                    {activeInsight.responseOptions && activeInsight.responseOptions.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                        {activeInsight.responseOptions.map((opt, idx) => (
                          <button
                            key={opt.id || idx}
                            type="button"
                            onClick={() => setSelectedAIResponseIdx(idx)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                              selectedAIResponseIdx === idx
                                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                : 'bg-white/10 hover:bg-white/20 text-emerald-200'
                            }`}
                          >
                            <span>{opt.badge}</span>
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Texto da Sugestão Selecionada */}
                    <div className="bg-black/30 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 mb-2.5">
                      <p className="text-xs text-slate-100 italic leading-relaxed">
                        "{activeInsight.responseOptions?.[selectedAIResponseIdx]?.text || activeInsight.suggestedResponse}"
                      </p>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUseAISuggestion(activeInsight.responseOptions?.[selectedAIResponseIdx]?.text || activeInsight.suggestedResponse)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Inserir no Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const text = activeInsight.responseOptions?.[selectedAIResponseIdx]?.text || activeInsight.suggestedResponse;
                            if (text && activeConversation) {
                              sendMessage(activeConversation.id, text, false, true);
                              recordAIFeedback(activeConversation.id, 'ACCEPTED');
                            }
                          }}
                          className="bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="Enviar esta resposta diretamente pelo WhatsApp"
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>Enviar Direto</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsCopilotDismissed(true)}
                        className="text-[11px] text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      >
                        Ocultar Menu
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Replies Menu Dropdown */}
            {showQuickReplies && (
              <div className="bg-slate-50 border-t border-slate-200 p-2.5 max-h-48 overflow-y-auto space-y-1 shadow-inner">
                <div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">
                  Modelos de Respostas Rápidas
                </div>
                {quickReplies.map(qr => (
                  <button
                    key={qr.id}
                    onClick={() => {
                      handleApplyQuickReply(qr.content);
                      setShowQuickReplies(false);
                    }}
                    className="w-full text-left p-2 hover:bg-indigo-50 rounded-xl text-xs transition cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-bold text-[#3742AC] font-mono">{qr.shortcut}</span>
                    <span className="text-slate-600 truncate ml-2">{qr.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Toolbar e Input Footer */}
            <div className="bg-white border-t border-slate-200/80 p-3 sm:p-4 space-y-2.5 shadow-sm">
              {/* Toolbar Superior Discreta */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Alternador Modo WhatsApp vs Nota Interna */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200/60 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(false)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        !isInternalNote
                          ? 'bg-[#3742AC] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      💬 WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(true)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        isInternalNote
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🔒 Nota Interna
                    </button>
                  </div>

                  {/* Respostas Rápidas */}
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="px-3 py-1 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Modelos</span>
                  </button>

                  {/* Menu de Anexos */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border transition cursor-pointer ${
                        showAttachmentMenu || attachedMedia
                          ? 'bg-indigo-50 text-[#3742AC] border-indigo-200'
                          : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border-slate-200/60'
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Anexar</span>
                    </button>

                    {showAttachmentMenu && (
                      <div className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-30 space-y-1 animate-fadeIn">
                        <label className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer transition">
                          <FileText className="w-4 h-4 text-rose-500" />
                          <div>
                            <p className="leading-none">Documento (PDF/Word)</p>
                            <span className="text-[10px] text-slate-400 font-normal">Contratos, propostas</span>
                          </div>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                            className="hidden"
                            onChange={(e) => handleFileSelected(e, 'DOCUMENT')}
                          />
                        </label>

                        <label className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer transition">
                          <ImageIcon className="w-4 h-4 text-emerald-500" />
                          <div>
                            <p className="leading-none">Imagem / Planta</p>
                            <span className="text-[10px] text-slate-400 font-normal">Fotos e plantas</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileSelected(e, 'IMAGE')}
                          />
                        </label>

                        <label className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer transition">
                          <Music className="w-4 h-4 text-amber-500" />
                          <div>
                            <p className="leading-none">Arquivo de Áudio</p>
                            <span className="text-[10px] text-slate-400 font-normal">Gravações sonoras</span>
                          </div>
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFileSelected(e, 'AUDIO')}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Linha de Envio (se houver mais de uma) */}
                {instances.length > 1 && (
                  <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Enviando por:</span>
                    <select
                      value={activeConversation.instanceId || instances[0].id}
                      onChange={(e) => transferConversationInstance(activeConversation.id, e.target.value, false)}
                      className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                    >
                      {instances.map(inst => (
                        <option key={inst.id} value={inst.id}>
                          {inst.type === 'COMPANY_CENTRAL' ? '🏢 Central: ' : '👤 Direto: '}
                          {inst.name} ({inst.phoneNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Preview do Arquivo Anexado */}
              {attachedMedia && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#3742AC] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {attachedMedia.type === 'IMAGE' ? <ImageIcon className="w-4 h-4" /> : attachedMedia.type === 'AUDIO' ? <Music className="w-4 h-4" /> : <FileText className="w-4 h-4 text-rose-300" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-indigo-950 truncate">{attachedMedia.fileName}</p>
                      <p className="text-[10px] text-indigo-700">{(attachedMedia.fileSize / 1024).toFixed(1)} KB • Anexo pronto</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedMedia(null)}
                    className="p-1.5 rounded-full hover:bg-indigo-200/80 text-indigo-800 transition cursor-pointer"
                    title="Remover anexo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Form de Envio */}
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    isInternalNote
                      ? 'Escreva uma nota interna (visível somente para a equipe)...'
                      : 'Digite sua mensagem... (Pressione Enter para enviar)'
                  }
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className={`flex-1 text-xs rounded-full px-4 py-2.5 border focus:outline-none transition ${
                    isInternalNote
                      ? 'bg-amber-50/70 border-amber-300 focus:ring-2 focus:ring-amber-500/20 text-amber-950 placeholder-amber-700/60'
                      : 'bg-slate-50 border-slate-200/90 focus:bg-white focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] text-slate-900'
                  }`}
                />

                {/* Botão Gravar Áudio */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isRecordingVoice) {
                      setIsRecordingVoice(true);
                      setRecordingSeconds(0);
                    } else {
                      setIsRecordingVoice(false);
                      if (activeConversation) {
                        sendMessage(
                          activeConversation.id,
                          '🎵 Mensagem de voz gravada pelo corretor',
                          isInternalNote,
                          false,
                          [{
                            id: `att-${Date.now()}`,
                            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                            fileName: `Audio_Gravado_${Date.now()}.ogg`,
                            fileSize: 32000,
                            mimeType: 'audio/ogg',
                          }],
                          'AUDIO'
                        );
                      }
                    }
                  }}
                  className={`p-2.5 rounded-full transition shadow-xs active:scale-95 cursor-pointer ${
                    isRecordingVoice
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                  title={isRecordingVoice ? 'Parar e Enviar Áudio' : 'Gravar Áudio'}
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Botão Enviar */}
                <button
                  type="submit"
                  disabled={!messageInput.trim() && !attachedMedia}
                  className={`p-2.5 rounded-full transition shadow-md shadow-indigo-950/10 active:scale-95 disabled:opacity-40 cursor-pointer ${
                    isInternalNote
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-[#3742AC] hover:bg-[#2D368E] text-white'
                  }`}
                  title="Enviar mensagem"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#efeae2]/60">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-4 shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Caixa de Entrada WhatsApp Pronta
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              Nenhuma conversa selecionada. Vincule seu WhatsApp através do QR Code para receber e responder mensagens em tempo real.
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* COLUNA 3: Perfil 360º do Lead & IA Insights          */}
      {/* ---------------------------------------------------- */}
      {/* ---------------------------------------------------- */}
      {/* COLUNA 3: Perfil 360º do Lead & IA Insights          */}
      {/* ---------------------------------------------------- */}
      {showLeadDrawer && activeContact && (
        <>
          {/* Backdrop Overlay no Mobile/Tablet */}
          <div 
            className="fixed inset-0 bg-slate-950/50 z-40 xl:hidden animate-fadeIn backdrop-blur-2xs"
            onClick={() => setShowLeadDrawer(false)}
          />

          <div className="fixed xl:static inset-y-0 right-0 z-50 xl:z-auto w-full max-w-sm sm:w-96 bg-white xl:border-l border-slate-200 shadow-2xl xl:shadow-none flex flex-col flex-shrink-0 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header Lead 360 */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Qualificação do Lead • IA + CRM</span>
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                    Score: {activeContact.aiPriorityScore || 85}/100
                  </span>
                  
                  {/* Botão de Fechar no Drawer Overlay */}
                  <button
                    type="button"
                    onClick={() => setShowLeadDrawer(false)}
                    className="xl:hidden p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                    title="Fechar painel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

            <div className="flex items-start gap-3">
              <img
                src={activeContact.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(activeContact.name)}
                alt={activeContact.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                {/* Nome Editável */}
                {isEditingName ? (
                  <div className="flex items-center gap-1 mb-1">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editedName.trim()) {
                            updateContact(activeContact.id, { name: editedName.trim() });
                          }
                          setIsEditingName(false);
                        }
                      }}
                      className="text-xs font-bold text-slate-900 border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (editedName.trim()) {
                          updateContact(activeContact.id, { name: editedName.trim() });
                        }
                        setIsEditingName(false);
                      }}
                      className="p-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                      title="Salvar Nome"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group mb-0.5">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{activeContact.name}</h3>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 transition"
                      title="Editar nome"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  <span>{formatDisplayPhone(activeContact.phone)}</span>
                </p>
                {activeContact.lid && (
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5" title="Identificador de Sessão WhatsApp (LID)">
                    <span className="px-1 py-0.2 bg-slate-100 text-slate-500 rounded font-semibold text-[9px]">LID</span>
                    <span className="truncate">{activeContact.lid.replace(/@.*$/, '')}</span>
                  </div>
                )}

                {/* E-mail Editável */}
                {isEditingEmail ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="email"
                      placeholder="email@cliente.com"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateContact(activeContact.id, { email: editedEmail.trim() || undefined });
                          setIsEditingEmail(false);
                        }
                      }}
                      className="text-[11px] border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        updateContact(activeContact.id, { email: editedEmail.trim() || undefined });
                        setIsEditingEmail(false);
                      }}
                      className="p-1 text-emerald-600 font-bold text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group mt-0.5">
                    <p className="text-[11px] text-slate-400 truncate">
                      {activeContact.email || 'Clique para adicionar e-mail'}
                    </p>
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 transition"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Seletor de Temperatura de 1 Clique */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">Temperatura:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateContact(activeContact.id, { temperature: 'HOT', aiPriorityScore: 95 })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-0.5 ${
                    activeContact.temperature === 'HOT'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-rose-50'
                  }`}
                >
                  🔥 Quente
                </button>
                <button
                  type="button"
                  onClick={() => updateContact(activeContact.id, { temperature: 'WARM', aiPriorityScore: 75 })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-0.5 ${
                    activeContact.temperature === 'WARM'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'
                  }`}
                >
                  ⚡ Morno
                </button>
                <button
                  type="button"
                  onClick={() => updateContact(activeContact.id, { temperature: 'COLD', aiPriorityScore: 50 })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-0.5 ${
                    activeContact.temperature === 'COLD'
                      ? 'bg-blue-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  ❄️ Frio
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* ---------------------------------------------------- */}
            {/* 1. JORNADA & STATUS DE QUALIFICAÇÃO DO LEAD (MQL)     */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-3">
              {/* Header com Badge de Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`p-1.5 rounded-lg ${isLeadQualified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Jornada de Qualificação</h4>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {activeDeal ? 'Oportunidade Ativa no Funil' : isLeadQualified ? 'Lead Qualificado (MQL)' : 'Em Triagem Inicial'}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs ${
                  activeDeal
                    ? 'bg-blue-600 text-white'
                    : isLeadQualified
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {activeDeal ? 'No Kanban' : isLeadQualified ? '✨ Qualificado' : `${qualificationScore}% Coletado`}
                </span>
              </div>

              {/* Barra de Progresso da Qualificação */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                  <span>Maturidade do Lead</span>
                  <span className="font-mono text-emerald-600">{qualificationScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      qualificationScore >= 75
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : qualificationScore >= 50
                        ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${Math.min(qualificationScore, 100)}%` }}
                  />
                </div>
              </div>

              {/* Checklist Visual dos 4 Pilares */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${
                  hasPropertyInterest ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <span>{hasPropertyInterest ? '✓' : '○'}</span>
                  <span className="truncate">🏢 {activeContact.preferredPropertyType ? (activeContact.preferredPropertyType === 'PENTHOUSE' ? 'Cobertura' : activeContact.preferredPropertyType === 'HOUSE' ? 'Casa' : 'Apartamento') : 'Imóvel'}</span>
                </div>

                <div className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${
                  hasFinancialData ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <span>{hasFinancialData ? '✓' : '○'}</span>
                  <span className="truncate">💰 {activeContact.maxPropertyValue ? `R$ ${(activeContact.maxPropertyValue / 1000).toFixed(0)}k` : (activeContact.downPaymentAvailable ? `Entrada ${(activeContact.downPaymentAvailable/1000).toFixed(0)}k` : 'Orçamento')}</span>
                </div>

                <div className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${
                  (activeContact.targetRegions || []).length > 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <span>{(activeContact.targetRegions || []).length > 0 ? '✓' : '○'}</span>
                  <span className="truncate">📍 {activeContact.targetRegions?.[0] || 'Região'}</span>
                </div>

                <div className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${
                  hasEngagement ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <span>{hasEngagement ? '✓' : '○'}</span>
                  <span className="truncate">{activeContact.temperature === 'HOT' ? '🔥 Quente' : 'Engajamento'}</span>
                </div>
              </div>

              {/* Resumo da IA */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-900 mb-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Resumo do Perfil (IA Copilot):</span>
                </div>
                <p className="text-[11px] text-emerald-950 leading-relaxed italic">
                  "{activeInsight?.summary || `A IA monitora a conversa e atualiza automaticamente a renda, entrada, orçamento e preferências imobiliárias.`}"
                </p>

                {/* Objeções Detectadas */}
                {(activeInsight?.detectedObjections || []).length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-emerald-200/60">
                    <span className="text-[9px] font-bold text-emerald-950 block mb-1">🛡️ Ponto de Atenção / Objeções:</span>
                    <div className="flex flex-wrap gap-1">
                      {activeInsight?.detectedObjections?.map((obj, i) => (
                        <span key={i} className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-2 py-0.5 rounded-md">
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Promoção Imediata para o Kanban */}
              {!activeDeal && (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeContact) return;
                    const val = activeContact.maxPropertyValue || (editedMaxBudget ? Number(editedMaxBudget) : 1200000);
                    const propTypeName = activeContact.preferredPropertyType === 'PENTHOUSE' ? 'Cobertura' : activeContact.preferredPropertyType === 'HOUSE' ? 'Casa em Condomínio' : activeContact.preferredPropertyType === 'STUDIO' ? 'Studio' : activeContact.preferredPropertyType === 'LAND' ? 'Terreno' : 'Apartamento';
                    createDeal({
                      title: `${activeContact.name} - ${propTypeName}`,
                      contactId: activeContact.id,
                      expectedValue: val,
                      stageId: currentPipeline.stages[0].id,
                      assignedUserId: currentUser.id,
                    });
                  }}
                  className={`w-full text-xs font-bold py-2 px-3 rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                    isLeadQualified
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white ring-2 ring-emerald-400/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{isLeadQualified ? '🚀 Promover a Lead Qualificado e Abrir no Kanban' : 'Lançar no Kanban'}</span>
                </button>
              )}

              {/* Botão de Forçar Análise */}
              <button
                type="button"
                onClick={handleForceAIAnalysis}
                disabled={isAnalyzingAI}
                className="w-full bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 disabled:opacity-50 text-[11px] font-bold py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                title="Executa a análise de IA em todo o histórico da conversa e atualiza o perfil"
              >
                <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                <span>{isAnalyzingAI ? 'Analisando Histórico...' : '⚡ Forçar Análise da Conversa'}</span>
              </button>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 2. IMÓVEIS & UNIDADES APRESENTADAS (NOVO MÓDULO)     */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Imóveis Apresentados</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded-full border border-emerald-300/60">
                    {(activeContact.presentedProperties || []).length}
                  </span>
                </h4>

                <button
                  type="button"
                  onClick={() => setIsAddingProp(!isAddingProp)}
                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAddingProp ? 'Cancelar' : '+ Vincular Imóvel'}</span>
                </button>
              </div>

              {/* Formulário Rápido de Inserção de Imóvel */}
              {isAddingProp && (
                <div className="bg-white border border-emerald-300 rounded-xl p-3 shadow-xs space-y-2.5">
                  <div className="text-[10px] font-bold text-emerald-900 flex items-center justify-between">
                    <span>Cadastrar Empreendimento / Unidade</span>
                    <span className="text-[9px] text-slate-400 font-normal">Preenchimento rápido</span>
                  </div>

                  {/* Sugestões Rápidas do Catálogo */}
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Catálogo (Sugestões Rápidas):</label>
                    <div className="flex flex-wrap gap-1">
                      {MOCK_CATALOG_PROPERTIES.map((cat, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setPropName(cat.name);
                            setPropAddress(cat.address);
                            setPropPrice(String(cat.price));
                            setPropType(cat.type);
                            setPropUnit(cat.defaultUnit);
                          }}
                          className="text-[9.5px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-md px-2 py-0.5 font-medium transition cursor-pointer text-slate-700 truncate max-w-full"
                        >
                          🏢 {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Empreendimento / Edifício *</label>
                      <input
                        type="text"
                        placeholder="Ex: Edifício Lumina Batel"
                        value={propName}
                        onChange={(e) => setPropName(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Unidade / Torre</label>
                        <input
                          type="text"
                          placeholder="Ex: Apto 1402"
                          value={propUnit}
                          onChange={(e) => setPropUnit(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Valor (R$)</label>
                        <input
                          type="number"
                          placeholder="Ex: 1450000"
                          value={propPrice}
                          onChange={(e) => setPropPrice(e.target.value)}
                          className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Endereço / Localização</label>
                      <input
                        type="text"
                        placeholder="Ex: Av. Visconde de Guarapuava, 4200 - Batel"
                        value={propAddress}
                        onChange={(e) => setPropAddress(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Tipo</label>
                        <select
                          value={propType}
                          onChange={(e) => setPropType(e.target.value as any)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:bg-white focus:outline-none cursor-pointer"
                        >
                          <option value="APARTMENT">Apartamento</option>
                          <option value="PENTHOUSE">Cobertura</option>
                          <option value="HOUSE">Casa em Condomínio</option>
                          <option value="STUDIO">Studio</option>
                          <option value="LAND">Terreno</option>
                          <option value="COMMERCIAL">Comercial</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Status Inicial</label>
                        <select
                          value={propStatus}
                          onChange={(e) => setPropStatus(e.target.value as any)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:bg-white focus:outline-none cursor-pointer"
                        >
                          <option value="PRESENTED">👁️ Apresentado</option>
                          <option value="VISITING">📅 Visita Marcada</option>
                          <option value="PROPOSAL">💼 Proposta Enviada</option>
                          <option value="DISCARDED">✖️ Descartado</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Observações (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: Gostou da vista para o parque..."
                        value={propNotes}
                        onChange={(e) => setPropNotes(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePresentedProperty}
                    disabled={!propName.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Imóvel Apresentado</span>
                  </button>
                </div>
              )}

              {/* Lista de Imóveis Apresentados */}
              <div className="space-y-2">
                {(activeContact.presentedProperties || []).length === 0 ? (
                  <div className="bg-white/60 border border-dashed border-slate-300 rounded-xl p-3 text-center">
                    <Building className="w-5 h-5 text-slate-400 mx-auto mb-1 opacity-60" />
                    <p className="text-xs font-medium text-slate-600">Nenhum imóvel vinculado ainda</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Cadastre os empreendimentos apresentados para acompanhar o interesse e agendar visitas com 1 clique.
                    </p>
                  </div>
                ) : (
                  (activeContact.presentedProperties || []).map((prop) => (
                    <div key={prop.id} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs space-y-2 hover:border-slate-300 transition">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 truncate">{prop.name}</span>
                          </div>
                          {prop.unit && (
                            <div className="text-[10.5px] font-semibold text-emerald-700">
                              📍 {prop.unit}
                            </div>
                          )}
                        </div>

                        {/* Dropdown de Status */}
                        <select
                          value={prop.status}
                          onChange={(e) => updatePresentedProperty(activeContact.id, prop.id, { status: e.target.value as any })}
                          className={`text-[9.5px] font-bold rounded-lg px-2 py-0.5 border cursor-pointer focus:outline-none ${
                            prop.status === 'PROPOSAL'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : prop.status === 'VISITING'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : prop.status === 'DISCARDED'
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          <option value="PRESENTED">👁️ Apresentado</option>
                          <option value="VISITING">📅 Visita Marcada</option>
                          <option value="PROPOSAL">💼 Proposta</option>
                          <option value="DISCARDED">✖️ Descartado</option>
                        </select>
                      </div>

                      {/* Endereço & Valor */}
                      <div className="text-[10.5px] text-slate-600 space-y-0.5">
                        {prop.address && (
                          <div className="flex items-center gap-1 text-slate-500 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{prop.address}</span>
                          </div>
                        )}
                        {prop.price && (
                          <div className="font-mono font-bold text-slate-900">
                            💰 R$ {Number(prop.price).toLocaleString('pt-BR')}
                          </div>
                        )}
                        {prop.notes && (
                          <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded-md border border-slate-100">
                            "{prop.notes}"
                          </p>
                        )}
                      </div>

                      {/* Botões de Ação de 1-Clique */}
                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => handleSendPropertyBriefToChat(prop)}
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold py-1 px-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Inserir ficha técnica do imóvel formatada no WhatsApp"
                        >
                          <Send className="w-3 h-3" />
                          <span>Enviar Ficha no Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleScheduleVisitForProperty(prop)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold py-1 px-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Agendar visita para este imóvel com convite .ICS"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Agendar Visita</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => removePresentedProperty(activeContact.id, prop.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Remover este imóvel"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 3. QUALIFICAÇÃO DO LEAD (FINANCEIRA & PERFIL)         */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Qualificação do Lead</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Edição Rápida</span>
              </div>

              {/* Grid Renda, Entrada e Orçamento */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 transition">
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Renda (R$)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editedMonthlyIncome}
                    onChange={(e) => setEditedMonthlyIncome(e.target.value)}
                    onBlur={() => {
                      const val = Number(editedMonthlyIncome) || 0;
                      updateContact(activeContact.id, { monthlyIncome: val });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = Number(editedMonthlyIncome) || 0;
                        updateContact(activeContact.id, { monthlyIncome: val });
                      }
                    }}
                    className="w-full text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none"
                  />
                  {Number(editedMonthlyIncome) > 0 && (
                    <span className="text-[8px] text-emerald-600 font-semibold block mt-0.5 truncate">
                      R$ {Number(editedMonthlyIncome).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 transition">
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Entrada (R$)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editedDownPayment}
                    onChange={(e) => setEditedDownPayment(e.target.value)}
                    onBlur={() => {
                      const val = Number(editedDownPayment) || 0;
                      updateContact(activeContact.id, { downPaymentAvailable: val });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = Number(editedDownPayment) || 0;
                        updateContact(activeContact.id, { downPaymentAvailable: val });
                      }
                    }}
                    className="w-full text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none"
                  />
                  {Number(editedDownPayment) > 0 && (
                    <span className="text-[8px] text-emerald-600 font-semibold block mt-0.5 truncate">
                      R$ {Number(editedDownPayment).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 transition">
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Orçamento Max</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editedMaxBudget}
                    onChange={(e) => setEditedMaxBudget(e.target.value)}
                    onBlur={() => {
                      const val = Number(editedMaxBudget) || 0;
                      updateContact(activeContact.id, { maxPropertyValue: val });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = Number(editedMaxBudget) || 0;
                        updateContact(activeContact.id, { maxPropertyValue: val });
                      }
                    }}
                    className="w-full text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none"
                  />
                  {Number(editedMaxBudget) > 0 && (
                    <span className="text-[8px] text-emerald-600 font-semibold block mt-0.5 truncate">
                      R$ {Number(editedMaxBudget).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              {/* Tipo de Imóvel */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>Tipo de Imóvel de Interesse</span>
                </label>
                <select
                  value={activeContact.preferredPropertyType || 'APARTMENT'}
                  onChange={(e) => updateContact(activeContact.id, { preferredPropertyType: e.target.value as PropertyType })}
                  className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="APARTMENT">Apartamento (Padrão)</option>
                  <option value="PENTHOUSE">Cobertura / Penthouse</option>
                  <option value="HOUSE">Casa em Condomínio Fechado</option>
                  <option value="STUDIO">Studio / Loft Compacto</option>
                  <option value="LAND">Terreno / Lote Residencial</option>
                  <option value="COMMERCIAL">Sala Comercial / Corporativa</option>
                </select>
              </div>

              {/* Regiões de Interesse */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Bairros / Regiões de Busca</span>
                </label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {(activeContact.targetRegions || []).map((reg, idx) => (
                    <span key={idx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                      <span>{reg}</span>
                      <button
                        onClick={() => {
                          const updated = (activeContact.targetRegions || []).filter(r => r !== reg);
                          updateContact(activeContact.id, { targetRegions: updated });
                        }}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Adicionar bairro (ex: Centro)..."
                    value={newRegionInput}
                    onChange={(e) => setNewRegionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newRegionInput.trim()) {
                        e.preventDefault();
                        const updated = [...(activeContact.targetRegions || []), newRegionInput.trim()];
                        updateContact(activeContact.id, { targetRegions: updated });
                        setNewRegionInput('');
                      }
                    }}
                    className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newRegionInput.trim()) {
                        const updated = [...(activeContact.targetRegions || []), newRegionInput.trim()];
                        updateContact(activeContact.id, { targetRegions: updated });
                        setNewRegionInput('');
                      }
                    }}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 3. TAGS COMERCIAIS                                    */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tags Comerciais</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">{(activeContact.tags || []).length} tags</span>
              </div>

              {/* Tags List com botão de remover */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {(activeContact.tags || []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 group"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-emerald-500 hover:text-rose-600 transition"
                      title="Remover tag"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Input Adicionar Tag */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Nova tag... (ex: Investidor)"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    }
                  }}
                  className="flex-1 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 4. HISTÓRICO & TIMELINE DE INTERAÇÕES DO CORRETOR    */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Notebook className="w-3.5 h-3.5 text-[#3742AC]" />
                  <span>Timeline de Interações do Corretor</span>
                </h4>
                <span className="text-[10px] font-bold bg-white text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                  {(activeContact.brokerNotes || []).length} { (activeContact.brokerNotes || []).length === 1 ? 'registro' : 'registros' }
                </span>
              </div>

              {/* Categorias de Interação Rápidas */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedNoteCategory('GENERAL')}
                  className={`px-2 py-0.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedNoteCategory === 'GENERAL' ? 'bg-[#3742AC] text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📝 Geral
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNoteCategory('CALL')}
                  className={`px-2 py-0.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedNoteCategory === 'CALL' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📞 Ligação
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNoteCategory('VISIT')}
                  className={`px-2 py-0.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedNoteCategory === 'VISIT' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  🤝 Reunião / Visita
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNoteCategory('FINANCIAL')}
                  className={`px-2 py-0.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedNoteCategory === 'FINANCIAL' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  💰 Financeiro
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNoteCategory('OBJECTION')}
                  className={`px-2 py-0.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedNoteCategory === 'OBJECTION' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ⚠️ Objeção
                </button>
              </div>

              {/* Input de Nova Anotação */}
              <div className="space-y-1.5">
                <textarea
                  rows={2}
                  placeholder={`Registrar comentário sobre ${activeContact.name}...`}
                  value={brokerNote}
                  onChange={(e) => setBrokerNote(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200/90 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] resize-none text-slate-800 placeholder-slate-400 transition"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (brokerNote.trim() && activeContact) {
                      addBrokerNote(activeContact.id, brokerNote.trim(), selectedNoteCategory);
                      if (activeConversation) {
                        sendMessage(activeConversation.id, `📝 [Anotação • ${selectedNoteCategory}]: ${brokerNote.trim()}`, true);
                      }
                      setBrokerNote('');
                    }
                  }}
                  disabled={!brokerNote.trim()}
                  className="w-full bg-[#3742AC] hover:bg-[#2D368E] disabled:opacity-40 text-white text-xs font-bold py-2 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Salvar na Timeline</span>
                </button>
              </div>

              {/* Lista Cronológica / Timeline */}
              <div className="pt-2 border-t border-slate-200/60 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {(!activeContact.brokerNotes || activeContact.brokerNotes.length === 0) ? (
                  <div className="text-center py-4 text-slate-400">
                    <Clock className="w-5 h-5 mx-auto mb-1 opacity-50" />
                    <p className="text-[11px] font-medium">Nenhuma anotação registrada ainda.</p>
                    <p className="text-[10px] text-slate-400">Comentários registrados ficarão salvos aqui com data e hora.</p>
                  </div>
                ) : (
                  activeContact.brokerNotes.map((note) => {
                    const categoryMeta = {
                      CALL: { icon: '📞', label: 'Ligação Telefônica', color: 'bg-blue-50 text-blue-800 border-blue-200' },
                      VISIT: { icon: '🤝', label: 'Reunião / Visita', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                      FINANCIAL: { icon: '💰', label: 'Financeiro / Proposta', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                      OBJECTION: { icon: '⚠️', label: 'Objeção / Dúvida', color: 'bg-rose-50 text-rose-800 border-rose-200' },
                      PROPOSAL: { icon: '📄', label: 'Proposta Comercial', color: 'bg-purple-50 text-purple-800 border-purple-200' },
                      GENERAL: { icon: '📝', label: 'Anotação Geral', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    }[note.category || 'GENERAL'] || { icon: '📝', label: 'Anotação', color: 'bg-slate-50 text-slate-700 border-slate-200' };

                    return (
                      <div key={note.id} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5 relative group">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${categoryMeta.color}`}>
                              {categoryMeta.icon} {categoryMeta.label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-700">
                              {note.authorName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {safeFormatDate(note.createdAt, "dd/MM 'às' HH:mm")}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeBrokerNote(activeContact.id, note.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              title="Remover anotação"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 5. OPORTUNIDADE NO FUNIL DE VENDAS (KANBAN)          */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Funil de Vendas (Kanban)</span>
                </h4>
                {activeDeal ? (
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Ativo no Funil
                  </span>
                ) : (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    Não Criado
                  </span>
                )}
              </div>

              {activeDeal ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">
                      {activeDeal.title}
                    </p>
                    <span className="text-xs font-bold text-emerald-600 font-mono">
                      R$ {activeDeal.expectedValue.toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <label className="block text-[10px] text-slate-500 mb-1 font-semibold">
                    Etapa Atual no Kanban:
                  </label>
                  <select
                    value={activeDeal.stageId}
                    onChange={(e) => moveDealStage(activeDeal.id, e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
                  >
                    {currentPipeline.stages.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Este contato ainda não possui um card de oportunidade no Kanban.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeContact) return;
                      const val = activeContact.maxPropertyValue || (editedMaxBudget ? Number(editedMaxBudget) : 1200000);
                      const propTypeName = activeContact.preferredPropertyType === 'PENTHOUSE' ? 'Cobertura' : activeContact.preferredPropertyType === 'HOUSE' ? 'Casa em Condomínio' : activeContact.preferredPropertyType === 'STUDIO' ? 'Studio' : activeContact.preferredPropertyType === 'LAND' ? 'Terreno' : 'Apartamento';
                      createDeal({
                        title: `${activeContact.name} - ${propTypeName}`,
                        contactId: activeContact.id,
                        expectedValue: val,
                        stageId: currentPipeline.stages[0].id,
                        assignedUserId: currentUser.id,
                      });
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lançar Oportunidade no Kanban</span>
                  </button>
                </div>
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* 6. LGPD & CONSENTIMENTO                               */}
            {/* ---------------------------------------------------- */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Consentimento LGPD</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {activeContact.hasOptedOut ? 'OPT-OUT (Bloqueado)' : 'OPT-IN Ativo'}
                </span>
              </div>
              <button
                onClick={() => updateContact(activeContact.id, { hasOptedOut: !activeContact.hasOptedOut })}
                className="mt-2 text-[10px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
              >
                {activeContact.hasOptedOut ? 'Reativar comunicações' : 'Registrar Opt-out (Solicitação do titular)'}
              </button>
            </div>
          </div>
        </div>
      </>
      )}

      {/* Lightbox Modal de Imagem Full-Screen */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fadeIn"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage.url}
              alt="Visualização em alta resolução"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            {lightboxImage.caption && (
              <p className="mt-3 text-sm text-white/90 font-medium text-center bg-black/50 px-4 py-2 rounded-xl backdrop-blur-xs">
                {lightboxImage.caption}
              </p>
            )}
            <a
              href={lightboxImage.url}
              download="foto-imovel.jpg"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Imagem Original</span>
            </a>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Zerar Base */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Zerar Base & Resincronizar WhatsApp?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta ação limpará todas as conversas, mensagens e leads antigos em cache no CRM, e fará uma <strong>puxada 100% limpa diretamente do seu WhatsApp ativo</strong>.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <Check className="w-3.5 h-3.5" /> A instância conectada continuará ativa
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <Check className="w-3.5 h-3.5" /> Os números e nomes reais serão reimportados do zero
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowResetModal(false);
                  await resetCRMDatabase(true);
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                Sim, Zerar e Recarregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Assistente de Importação */}
      <ImportLeadsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
