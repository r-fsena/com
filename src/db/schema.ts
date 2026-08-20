import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  boolean, 
  timestamp, 
  decimal, 
  integer, 
  jsonb, 
  index, 
  uniqueIndex, 
  pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -------------------------------------------------------------
// ENUMS
// -------------------------------------------------------------
export const userRoleEnum = pgEnum('user_role', ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER', 'VIEWER']);
export const instanceStatusEnum = pgEnum('instance_status', ['CONNECTED', 'DISCONNECTED', 'CONNECTING', 'QRCODE']);
export const leadTemperatureEnum = pgEnum('lead_temperature', ['HOT', 'WARM', 'COLD']);
export const propertyTypeEnum = pgEnum('property_type', ['APARTMENT', 'HOUSE', 'PENTHOUSE', 'LAND', 'COMMERCIAL', 'STUDIO']);
export const purchasePurposeEnum = pgEnum('purchase_purpose', ['LIVING', 'INVESTMENT']);
export const dealStatusEnum = pgEnum('deal_status', ['OPEN', 'WON', 'LOST']);
export const messageSenderEnum = pgEnum('message_sender', ['CONTACT', 'USER', 'SYSTEM', 'AI_BOT']);
export const messageTypeEnum = pgEnum('message_type', ['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE']);
export const messageStatusEnum = pgEnum('message_status', ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED']);
export const conversationStatusEnum = pgEnum('conversation_status', ['UNASSIGNED', 'OPEN', 'PENDING_CLIENT', 'PENDING_TEAM', 'CLOSED']);
export const taskTypeEnum = pgEnum('task_type', ['CALL', 'WHATSAPP', 'VISIT', 'PROPOSAL', 'FINANCING_SIMULATION', 'FOLLOW_UP']);
export const taskPriorityEnum = pgEnum('task_priority', ['HIGH', 'MEDIUM', 'LOW']);
export const campaignStatusEnum = pgEnum('campaign_status', ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']);
export const aiSentimentEnum = pgEnum('ai_sentiment', ['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export const aiFeedbackEnum = pgEnum('ai_feedback', ['ACCEPTED', 'EDITED', 'REJECTED']);

// -------------------------------------------------------------
// 1. TENANTS & CONFIGURAÇÕES MULTI-EMPRESA
// -------------------------------------------------------------
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  documentCnpj: varchar('document_cnpj', { length: 20 }).notNull(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 20 }).default('#059669'),
  timezone: varchar('timezone', { length: 50 }).default('America/Sao_Paulo'),
  businessHours: jsonb('business_hours').default({
    start: '08:30',
    end: '19:00',
    workDays: [1, 2, 3, 4, 5, 6]
  }),
  status: varchar('status', { length: 50 }).default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tenantSettings = pgTable('tenant_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull().unique(),
  slaFirstResponseMinutes: integer('sla_first_response_minutes').default(15).notNull(),
  slaInactivityHours: integer('sla_inactivity_hours').default(24).notNull(),
  autoAssignRule: varchar('auto_assign_rule', { length: 50 }).default('ROUND_ROBIN').notNull(),
  aiCopilotEnabled: boolean('ai_copilot_enabled').default(true).notNull(),
  requireHumanApprovalForAI: boolean('require_human_approval_for_ai').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// 2. USUÁRIOS & MEMBERSHIPS (RBAC)
// -------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  cognitoSub: varchar('cognito_sub', { length: 128 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: userRoleEnum('role').default('BROKER').notNull(),
  permissionsOverride: jsonb('permissions_override'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('memberships_tenant_idx').on(table.tenantId),
  userTenantUq: uniqueIndex('memberships_user_tenant_uq').on(table.tenantId, table.userId),
}));

// -------------------------------------------------------------
// 3. INSTÂNCIAS DO WHATSAPP (Z-API)
// -------------------------------------------------------------
export const whatsappInstances = pgTable('whatsapp_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 30 }).notNull(),
  zapiInstanceId: varchar('zapi_instance_id', { length: 100 }).notNull(),
  zapiTokenSecretRef: text('zapi_token_secret_ref').notNull(), // Referência ao AWS Secrets Manager
  status: instanceStatusEnum('status').default('DISCONNECTED').notNull(),
  batteryLevel: integer('battery_level'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('whatsapp_instances_tenant_idx').on(table.tenantId),
  zapiInstanceUq: uniqueIndex('whatsapp_instances_zapi_id_uq').on(table.tenantId, table.zapiInstanceId),
}));

// -------------------------------------------------------------
// 4. CONTATOS / LEADS & LGPD
// -------------------------------------------------------------
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNormalized: varchar('phone_normalized', { length: 30 }).notNull(), // E.164
  email: varchar('email', { length: 255 }),
  cpfEncrypted: text('cpf_encrypted'),
  avatarUrl: text('avatar_url'),
  
  // Qualificação Imobiliária & Financeira
  monthlyIncome: decimal('monthly_income', { precision: 14, scale: 2 }),
  householdIncome: decimal('household_income', { precision: 14, scale: 2 }),
  downPaymentAvailable: decimal('down_payment_available', { precision: 14, scale: 2 }),
  estimatedFinancing: decimal('estimated_financing', { precision: 14, scale: 2 }),
  minPropertyValue: decimal('min_property_value', { precision: 14, scale: 2 }),
  maxPropertyValue: decimal('max_property_value', { precision: 14, scale: 2 }),
  
  preferredPropertyType: propertyTypeEnum('preferred_property_type').default('APARTMENT'),
  purchasePurpose: purchasePurposeEnum('purchase_purpose').default('LIVING'),
  targetRegions: jsonb('target_regions').default(['São Paulo']),
  targetBedrooms: integer('target_bedrooms'),
  targetParkingSpots: integer('target_parking_spots'),
  purchaseTimeline: varchar('purchase_timeline', { length: 50 }).default('1_TO_3_MONTHS'),

  // Metadados
  source: varchar('source', { length: 100 }).default('WHATSAPP').notNull(),
  temperature: leadTemperatureEnum('temperature').default('WARM').notNull(),
  aiPriorityScore: integer('ai_priority_score').default(70).notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  tags: jsonb('tags').default([]),
  
  // LGPD Consentimento
  consentGiven: boolean('consent_given').default(true).notNull(),
  consentDate: timestamp('consent_date', { withTimezone: true }).defaultNow(),
  hasOptedOut: boolean('has_opted_out').default(false).notNull(),
  
  // SLAs
  lastClientInteractionAt: timestamp('last_client_interaction_at', { withTimezone: true }),
  lastTeamInteractionAt: timestamp('last_team_interaction_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('contacts_tenant_idx').on(table.tenantId),
  tenantPhoneUq: uniqueIndex('contacts_tenant_phone_uq').on(table.tenantId, table.phoneNormalized),
  scoreIdx: index('contacts_ai_score_idx').on(table.tenantId, table.aiPriorityScore),
}));

// -------------------------------------------------------------
// 5. FUNIS, ETAPAS & NEGÓCIOS (KANBAN)
// -------------------------------------------------------------
export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  displayOrder: integer('display_order').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('pipelines_tenant_idx').on(table.tenantId),
}));

export const pipelineStages = pgTable('pipeline_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  order: integer('order').notNull(),
  slaHours: integer('sla_hours').default(24).notNull(),
  colorHex: varchar('color_hex', { length: 20 }).default('#10b981').notNull(),
  isWon: boolean('is_won').default(false).notNull(),
  isLost: boolean('is_lost').default(false).notNull(),
}, (table) => ({
  pipelineIdx: index('pipeline_stages_pipeline_idx').on(table.pipelineId),
}));

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: 'cascade' }).notNull(),
  stageId: uuid('stage_id').references(() => pipelineStages.id, { onDelete: 'restrict' }).notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  expectedValue: decimal('expected_value', { precision: 14, scale: 2 }).default('0.00').notNull(),
  manualProbability: integer('manual_probability').default(50).notNull(),
  aiProbabilityScore: integer('ai_probability_score').default(60).notNull(),
  status: dealStatusEnum('status').default('OPEN').notNull(),
  lossReason: text('loss_reason'),
  propertyInterest: text('property_interest'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('deals_tenant_idx').on(table.tenantId),
  contactIdx: index('deals_contact_idx').on(table.contactId),
  stageIdx: index('deals_stage_idx').on(table.stageId),
}));

export const dealStageHistory = pgTable('deal_stage_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  fromStageId: uuid('from_stage_id').references(() => pipelineStages.id),
  toStageId: uuid('to_stage_id').references(() => pipelineStages.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  durationMinutes: integer('duration_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// 6. CONVERSAS & MENSAGENS (WHATSAPP Z-API)
// -------------------------------------------------------------
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  instanceId: uuid('instance_id').references(() => whatsappInstances.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: conversationStatusEnum('status').default('UNASSIGNED').notNull(),
  lastMessagePreview: text('last_message_preview').default(''),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
  unreadCount: integer('unread_count').default(0).notNull(),
  slaBreached: boolean('sla_breached').default(false).notNull(),
  slaBreachReason: text('sla_breach_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('conversations_tenant_idx').on(table.tenantId),
  contactIdx: index('conversations_contact_idx').on(table.contactId),
  assignedIdx: index('conversations_assigned_idx').on(table.tenantId, table.assignedUserId),
}));

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  externalId: varchar('external_id', { length: 128 }), // Z-API ID
  senderType: messageSenderEnum('sender_type').notNull(),
  senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
  senderName: varchar('sender_name', { length: 255 }),
  messageType: messageTypeEnum('message_type').default('TEXT').notNull(),
  content: text('content').notNull(),
  status: messageStatusEnum('status').default('SENT').notNull(),
  failureReason: text('failure_reason'),
  isInternalNote: boolean('is_internal_note').default(false).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }),
  aiSuggested: boolean('ai_suggested').default(false),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('messages_tenant_idx').on(table.tenantId),
  convIdx: index('messages_conv_idx').on(table.conversationId),
  idempotencyUq: uniqueIndex('messages_idempotency_uq').on(table.tenantId, table.idempotencyKey),
  externalIdIdx: index('messages_external_id_idx').on(table.tenantId, table.externalId),
}));

// -------------------------------------------------------------
// 7. IA COPILOTO & FEEDBACK
// -------------------------------------------------------------
export const aiInsights = pgTable('ai_insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  summary: text('summary').notNull(),
  extractedData: jsonb('extracted_data').notNull(),
  sentiment: aiSentimentEnum('sentiment').default('NEUTRAL').notNull(),
  intent: varchar('intent', { length: 100 }).notNull(),
  suggestedResponse: text('suggested_response').notNull(),
  confidenceScore: integer('confidence_score').default(90).notNull(),
  modelUsed: varchar('model_used', { length: 100 }).default('anthropic.claude-3-5-sonnet-v2').notNull(),
  latencyMs: integer('latency_ms'),
  tokensUsed: integer('tokens_used'),
  userFeedback: aiFeedbackEnum('user_feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('ai_insights_tenant_idx').on(table.tenantId),
  convIdx: index('ai_insights_conv_idx').on(table.conversationId),
}));

// -------------------------------------------------------------
// 8. TAREFAS, SLAS & NOTIFICAÇÕES
// -------------------------------------------------------------
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  taskType: taskTypeEnum('task_type').default('FOLLOW_UP').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  priority: taskPriorityEnum('priority').default('MEDIUM').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('tasks_tenant_idx').on(table.tenantId),
  assignedIdx: index('tasks_assigned_idx').on(table.assignedUserId),
}));

export const slaAlerts = pgTable('sla_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('WARNING').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  isDismissed: boolean('is_dismissed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('sla_alerts_tenant_idx').on(table.tenantId),
}));

// -------------------------------------------------------------
// 9. CAMPANHAS & AUDITORIA
// -------------------------------------------------------------
export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  instanceId: uuid('instance_id').references(() => whatsappInstances.id, { onDelete: 'cascade' }).notNull(),
  targetSegment: varchar('target_segment', { length: 255 }).notNull(),
  totalRecipients: integer('total_recipients').default(0).notNull(),
  sentCount: integer('sent_count').default(0).notNull(),
  deliveredCount: integer('delivered_count').default(0).notNull(),
  readCount: integer('read_count').default(0).notNull(),
  repliedCount: integer('replied_count').default(0).notNull(),
  optOutCount: integer('opt_out_count').default(0).notNull(),
  status: campaignStatusEnum('status').default('DRAFT').notNull(),
  messageTemplate: text('message_template').notNull(),
  sendRatePerMinute: integer('send_rate_per_minute').default(20).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('campaigns_tenant_idx').on(table.tenantId),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 128 }).notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('audit_logs_tenant_idx').on(table.tenantId),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.tenantId, table.createdAt),
}));
