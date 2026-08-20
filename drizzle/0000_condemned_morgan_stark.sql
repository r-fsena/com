CREATE TYPE "public"."ai_feedback" AS ENUM('ACCEPTED', 'EDITED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ai_sentiment" AS ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('UNASSIGNED', 'OPEN', 'PENDING_CLIENT', 'PENDING_TEAM', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('OPEN', 'WON', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."instance_status" AS ENUM('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'QRCODE');--> statement-breakpoint
CREATE TYPE "public"."lead_temperature" AS ENUM('HOT', 'WARM', 'COLD');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('CONTACT', 'USER', 'SYSTEM', 'AI_BOT');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('APARTMENT', 'HOUSE', 'PENTHOUSE', 'LAND', 'COMMERCIAL', 'STUDIO');--> statement-breakpoint
CREATE TYPE "public"."purchase_purpose" AS ENUM('LIVING', 'INVESTMENT');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('CALL', 'WHATSAPP', 'VISIT', 'PROPOSAL', 'FINANCING_SIMULATION', 'FOLLOW_UP');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER', 'VIEWER');--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"extracted_data" jsonb NOT NULL,
	"sentiment" "ai_sentiment" DEFAULT 'NEUTRAL' NOT NULL,
	"intent" varchar(100) NOT NULL,
	"suggested_response" text NOT NULL,
	"confidence_score" integer DEFAULT 90 NOT NULL,
	"model_used" varchar(100) DEFAULT 'anthropic.claude-3-5-sonnet-v2' NOT NULL,
	"latency_ms" integer,
	"tokens_used" integer,
	"user_feedback" "ai_feedback",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"instance_id" uuid NOT NULL,
	"target_segment" varchar(255) NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"replied_count" integer DEFAULT 0 NOT NULL,
	"opt_out_count" integer DEFAULT 0 NOT NULL,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"message_template" text NOT NULL,
	"send_rate_per_minute" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone_normalized" varchar(30) NOT NULL,
	"email" varchar(255),
	"cpf_encrypted" text,
	"avatar_url" text,
	"monthly_income" numeric(14, 2),
	"household_income" numeric(14, 2),
	"down_payment_available" numeric(14, 2),
	"estimated_financing" numeric(14, 2),
	"min_property_value" numeric(14, 2),
	"max_property_value" numeric(14, 2),
	"preferred_property_type" "property_type" DEFAULT 'APARTMENT',
	"purchase_purpose" "purchase_purpose" DEFAULT 'LIVING',
	"target_regions" jsonb DEFAULT '["São Paulo"]'::jsonb,
	"target_bedrooms" integer,
	"target_parking_spots" integer,
	"purchase_timeline" varchar(50) DEFAULT '1_TO_3_MONTHS',
	"source" varchar(100) DEFAULT 'WHATSAPP' NOT NULL,
	"temperature" "lead_temperature" DEFAULT 'WARM' NOT NULL,
	"ai_priority_score" integer DEFAULT 70 NOT NULL,
	"assigned_user_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"consent_given" boolean DEFAULT true NOT NULL,
	"consent_date" timestamp with time zone DEFAULT now(),
	"has_opted_out" boolean DEFAULT false NOT NULL,
	"last_client_interaction_at" timestamp with time zone,
	"last_team_interaction_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"status" "conversation_status" DEFAULT 'UNASSIGNED' NOT NULL,
	"last_message_preview" text DEFAULT '',
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"sla_breached" boolean DEFAULT false NOT NULL,
	"sla_breach_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"user_id" uuid,
	"duration_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"title" varchar(255) NOT NULL,
	"expected_value" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"manual_probability" integer DEFAULT 50 NOT NULL,
	"ai_probability_score" integer DEFAULT 60 NOT NULL,
	"status" "deal_status" DEFAULT 'OPEN' NOT NULL,
	"loss_reason" text,
	"property_interest" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'BROKER' NOT NULL,
	"permissions_override" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"external_id" varchar(128),
	"sender_type" "message_sender" NOT NULL,
	"sender_user_id" uuid,
	"sender_name" varchar(255),
	"message_type" "message_type" DEFAULT 'TEXT' NOT NULL,
	"content" text NOT NULL,
	"status" "message_status" DEFAULT 'SENT' NOT NULL,
	"failure_reason" text,
	"is_internal_note" boolean DEFAULT false NOT NULL,
	"idempotency_key" varchar(128),
	"ai_suggested" boolean DEFAULT false,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order" integer NOT NULL,
	"sla_hours" integer DEFAULT 24 NOT NULL,
	"color_hex" varchar(20) DEFAULT '#10b981' NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"severity" varchar(20) DEFAULT 'WARNING' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"contact_id" uuid,
	"conversation_id" uuid,
	"deal_id" uuid,
	"assigned_user_id" uuid,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"deal_id" uuid,
	"assigned_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"task_type" "task_type" DEFAULT 'FOLLOW_UP' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"priority" "task_priority" DEFAULT 'MEDIUM' NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sla_first_response_minutes" integer DEFAULT 15 NOT NULL,
	"sla_inactivity_hours" integer DEFAULT 24 NOT NULL,
	"auto_assign_rule" varchar(50) DEFAULT 'ROUND_ROBIN' NOT NULL,
	"ai_copilot_enabled" boolean DEFAULT true NOT NULL,
	"require_human_approval_for_ai" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"document_cnpj" varchar(20) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(20) DEFAULT '#059669',
	"timezone" varchar(50) DEFAULT 'America/Sao_Paulo',
	"business_hours" jsonb DEFAULT '{"start":"08:30","end":"19:00","workDays":[1,2,3,4,5,6]}'::jsonb,
	"status" varchar(50) DEFAULT 'ACTIVE',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cognito_sub" varchar(128),
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(30),
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone_number" varchar(30) NOT NULL,
	"zapi_instance_id" varchar(100) NOT NULL,
	"zapi_token_secret_ref" text NOT NULL,
	"status" "instance_status" DEFAULT 'DISCONNECTED' NOT NULL,
	"battery_level" integer,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_instance_id_whatsapp_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."whatsapp_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_instance_id_whatsapp_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."whatsapp_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_from_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_to_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_insights_tenant_idx" ON "ai_insights" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_insights_conv_idx" ON "ai_insights" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tenant_phone_uq" ON "contacts" USING btree ("tenant_id","phone_normalized");--> statement-breakpoint
CREATE INDEX "contacts_ai_score_idx" ON "contacts" USING btree ("tenant_id","ai_priority_score");--> statement-breakpoint
CREATE INDEX "conversations_tenant_idx" ON "conversations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "conversations_contact_idx" ON "conversations" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "conversations_assigned_idx" ON "conversations" USING btree ("tenant_id","assigned_user_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_idx" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deals_contact_idx" ON "deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_idx" ON "memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_tenant_uq" ON "memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "messages_tenant_idx" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_idempotency_uq" ON "messages" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "messages_external_id_idx" ON "messages" USING btree ("tenant_id","external_id");--> statement-breakpoint
CREATE INDEX "pipeline_stages_pipeline_idx" ON "pipeline_stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipelines_tenant_idx" ON "pipelines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sla_alerts_tenant_idx" ON "sla_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tasks_tenant_idx" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_idx" ON "tasks" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "whatsapp_instances_tenant_idx" ON "whatsapp_instances" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_instances_zapi_id_uq" ON "whatsapp_instances" USING btree ("tenant_id","zapi_instance_id");