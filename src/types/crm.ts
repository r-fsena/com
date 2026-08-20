export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'BROKER' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  documentCnpj: string;
  logoUrl?: string;
  primaryColor: string;
  timezone: string;
  businessHours: {
    start: string; // e.g. "08:00"
    end: string;   // e.g. "19:00"
    workDays: number[]; // [1, 2, 3, 4, 5, 6]
  };
  settings: {
    slaFirstResponseMinutes: number;
    slaInactivityHours: number;
    autoAssignRule: 'ROUND_ROBIN' | 'UNASSIGNED_QUEUE' | 'BY_REGION';
    aiCopilotEnabled: boolean;
    requireHumanApprovalForAI: boolean;
  };
}

export interface WhatsAppInstance {
  id: string;
  tenantId: string;
  name: string;
  phoneNumber: string;
  zapiInstanceId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QRCODE';
  batteryLevel?: number;
  lastSyncAt: string;
  qrCodeUrl?: string;
}

export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'PENTHOUSE' | 'LAND' | 'COMMERCIAL' | 'STUDIO';
export type PurchasePurpose = 'LIVING' | 'INVESTMENT';

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  phone: string; // Formato E.164: +5511999999999
  email?: string;
  cpf?: string;
  avatarUrl?: string;
  
  // Perfil Financeiro e Comercial Imobiliário
  monthlyIncome?: number;
  householdIncome?: number;
  downPaymentAvailable?: number;
  estimatedFinancing?: number;
  minPropertyValue?: number;
  maxPropertyValue?: number;
  
  // Preferências
  preferredPropertyType?: PropertyType;
  purchasePurpose?: PurchasePurpose;
  targetRegions: string[];
  targetBedrooms?: number;
  targetParkingSpots?: number;
  purchaseTimeline?: 'IMMEDIATE' | '1_TO_3_MONTHS' | '3_TO_6_MONTHS' | 'INVESTOR_OPPORTUNITY';
  
  // Metadados de Gestão
  source: 'WHATSAPP' | 'INSTAGRAM_ADS' | 'FACEBOOK_ADS' | 'GOOGLE' | 'PORTAL_ZAP' | 'PORTAL_VIVAREAL' | 'INDICATION' | 'WEBSITE' | 'MANUAL';
  temperature: LeadTemperature;
  aiPriorityScore: number; // 0 a 100
  assignedUserId?: string;
  tags: string[];
  notesCount: number;
  
  // LGPD & Consentimento
  consentGiven: boolean;
  consentDate?: string;
  hasOptedOut: boolean;
  
  // Datas e SLAs
  lastClientInteractionAt?: string;
  lastTeamInteractionAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  slaHours: number;
  colorHex: string;
  isWon?: boolean;
  isLost?: boolean;
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
}

export interface Deal {
  id: string;
  tenantId: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  assignedUserId: string;
  title: string; // Ex: "Apto 3 Quartos - Jardins (Residencial Horizon)"
  expectedValue: number;
  manualProbability: number; // 0 - 100%
  aiProbabilityScore: number; // 0 - 100
  status: 'OPEN' | 'WON' | 'LOST';
  lossReason?: string;
  propertyInterest?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export type MessageSenderType = 'CONTACT' | 'USER' | 'SYSTEM' | 'AI_BOT';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'TEMPLATE';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface Attachment {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationSeconds?: number; // Para áudios
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  externalId?: string; // Z-API ID
  senderType: MessageSenderType;
  senderUserId?: string;
  senderName?: string;
  messageType: MessageType;
  content: string;
  attachments?: Attachment[];
  status: MessageStatus;
  isInternalNote: boolean;
  idempotencyKey?: string;
  timestamp: string;
  aiSuggested?: boolean;
}

export interface Conversation {
  id: string;
  tenantId: string;
  instanceId: string;
  contactId: string;
  assignedUserId?: string;
  status: 'UNASSIGNED' | 'OPEN' | 'PENDING_CLIENT' | 'PENDING_TEAM' | 'CLOSED';
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  slaBreached: boolean;
  slaBreachReason?: string;
}

export interface AIInsight {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string;
  summary: string;
  extractedData: {
    monthlyIncome?: number;
    downPayment?: number;
    maxBudget?: number;
    preferredRegion?: string;
    propertyType?: string;
    urgencyLevel?: 'ALTA' | 'MEDIA' | 'BAIXA';
    detectedObjections?: string[];
  };
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  intent: 'AGENDAR_VISITA' | 'SIMULAR_FINANCIAMENTO' | 'PEDIR_FOTOS' | 'NEGOCIAR_VALOR' | 'DUVIDA_GERAL' | 'DESINTERESSE';
  suggestedResponse: string;
  confidenceScore: number;
  userFeedback?: 'ACCEPTED' | 'EDITED' | 'REJECTED';
  createdAt: string;
}

export interface Task {
  id: string;
  tenantId: string;
  contactId: string;
  dealId?: string;
  assignedUserId: string;
  title: string;
  description?: string;
  taskType: 'CALL' | 'WHATSAPP' | 'VISIT' | 'PROPOSAL' | 'FINANCING_SIMULATION' | 'FOLLOW_UP';
  dueDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  isCompleted: boolean;
  completedAt?: string;
}

export interface SLAAlert {
  id: string;
  tenantId: string;
  type: 'FIRST_RESPONSE_OVERDUE' | 'INACTIVE_LEAD' | 'OVERDUE_TASK' | 'STAGE_SLA_EXCEEDED' | 'DISCONNECTED_INSTANCE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  contactId?: string;
  conversationId?: string;
  dealId?: string;
  assignedUserId?: string;
  createdAt: string;
  isDismissed: boolean;
}

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  instanceId: string;
  targetSegment: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  optOutCount: number;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  messageTemplate: string;
  sendRatePerMinute: number;
  scheduledFor?: string;
  createdAt: string;
}

export interface QuickReplyTemplate {
  id: string;
  tenantId: string;
  shortcut: string; // ex: "/apresentacao"
  title: string;
  content: string;
  category: 'GREETING' | 'QUALIFICATION' | 'PROPERTIES' | 'VISIT' | 'CLOSING';
}
