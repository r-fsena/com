-- ==============================================================================
-- VANGUARD CRM IMOBILIÁRIO • SCRIPT DDL OFICIAL POSTGRESQL (AWS RDS / AURORA)
-- ==============================================================================
-- Arquitetura: Multi-tenant com ancoragem universal no número de telefone (E.164)
-- Data de Criação: 2026-08-21
-- ==============================================================================

-- 1. Extensões Essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMs do Domínio Imobiliário & Comercial
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE instance_status AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'QRCODE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_temperature AS ENUM ('HOT', 'WARM', 'COLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE property_type AS ENUM ('APARTMENT', 'HOUSE', 'PENTHOUSE', 'LAND', 'COMMERCIAL', 'STUDIO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE purchase_purpose AS ENUM ('LIVING', 'INVESTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE deal_status AS ENUM ('OPEN', 'WON', 'LOST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_sender AS ENUM ('CONTACT', 'USER', 'SYSTEM', 'AI_BOT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE conversation_status AS ENUM ('UNASSIGNED', 'OPEN', 'PENDING_CLIENT', 'PENDING_TEAM', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -------------------------------------------------------------
-- 3. TABELA: TENANTS (EMPRESAS / IMOBILIÁRIAS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    document_cnpj VARCHAR(20) NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#059669',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    business_hours JSONB DEFAULT '{"start": "08:30", "end": "19:00", "workDays": [1, 2, 3, 4, 5, 6]}'::jsonb,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 4. TABELA: USERS & MEMBERSHIPS (CORRETORES E GESTORES)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(128) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'BROKER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT memberships_user_tenant_uq UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);

-- -------------------------------------------------------------
-- 5. TABELA PRINCIPAL: CONTACTS (LEADS / QUALIFICAÇÃO IMOBILIÁRIA)
-- -------------------------------------------------------------
-- Ancoragem no número de telefone normalizado (phone_normalized)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_normalized VARCHAR(30) NOT NULL, -- Ex: 554891079478
    phone_display VARCHAR(30),             -- Ex: +55 (48) 9107-9478
    email VARCHAR(255),
    cpf_encrypted TEXT,
    avatar_url TEXT,
    
    -- Qualificação Financeira
    monthly_income NUMERIC(14, 2),          -- Renda Mensal do Cliente
    household_income NUMERIC(14, 2),        -- Renda Familiar
    down_payment_available NUMERIC(14, 2),  -- Valor de Entrada Disponível
    estimated_financing NUMERIC(14, 2),     -- Potencial de Financiamento
    min_property_value NUMERIC(14, 2),      -- Valor Mínimo do Imóvel
    max_property_value NUMERIC(14, 2),      -- Orçamento Máximo / Teto
    
    -- Preferências do Imóvel
    preferred_property_type property_type DEFAULT 'APARTMENT',
    purchase_purpose purchase_purpose DEFAULT 'LIVING',
    target_regions JSONB DEFAULT '["Região Nobre"]'::jsonb,
    target_bedrooms INTEGER DEFAULT 3,
    target_parking_spots INTEGER DEFAULT 2,
    purchase_timeline VARCHAR(50) DEFAULT '1_TO_3_MONTHS',
    
    -- Status Comercial & IA
    source VARCHAR(100) NOT NULL DEFAULT 'WHATSAPP',
    temperature lead_temperature NOT NULL DEFAULT 'HOT',
    ai_priority_score INTEGER NOT NULL DEFAULT 85,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tags JSONB DEFAULT '["#Lead Quente"]'::jsonb,
    notes_count INTEGER NOT NULL DEFAULT 0,
    presented_properties JSONB DEFAULT '[]'::jsonb, -- Empreendimentos e unidades apresentadas
    
    -- LGPD & Auditoria
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    has_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
    last_client_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    last_team_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Chave única de unicidade por empresa e telefone
    CONSTRAINT contacts_tenant_phone_uq UNIQUE (tenant_id, phone_normalized)
);

-- Índices de Alta Performance para busca instantânea
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON contacts(tenant_id, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_temperature ON contacts(tenant_id, temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_user ON contacts(tenant_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin (name gin_trgm_ops);

-- -------------------------------------------------------------
-- 6. TABELA: CONVERSATIONS (CAIXA DE ENTRADA WHATSAPP)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone_normalized VARCHAR(30) NOT NULL,
    status conversation_status NOT NULL DEFAULT 'OPEN',
    last_message_preview TEXT DEFAULT 'Conversa iniciada',
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT conversations_tenant_contact_uq UNIQUE (tenant_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(tenant_id, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(tenant_id, last_message_at DESC);

-- -------------------------------------------------------------
-- 7. TABELA: MESSAGES (HISTÓRICO PERMANENTE DE MENSAGENS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    phone_normalized VARCHAR(30) NOT NULL,
    external_zapi_id VARCHAR(128),
    sender_type message_sender NOT NULL,
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(255),
    message_type message_type NOT NULL DEFAULT 'TEXT',
    content TEXT NOT NULL,
    media_url TEXT,
    status message_status NOT NULL DEFAULT 'DELIVERED',
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages(conversation_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(tenant_id, phone_normalized, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(tenant_id, external_zapi_id);

-- -------------------------------------------------------------
-- 8. TABELA: PIPELINES & DEALS (FUNIL DE VENDAS & KANBAN)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL,
    sla_hours INTEGER NOT NULL DEFAULT 24,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    expected_value NUMERIC(14, 2) NOT NULL DEFAULT 1000000.00,
    manual_probability INTEGER NOT NULL DEFAULT 50,
    ai_probability_score INTEGER NOT NULL DEFAULT 75,
    status deal_status NOT NULL DEFAULT 'OPEN',
    loss_reason VARCHAR(255),
    property_interest VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON deals(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);

-- -------------------------------------------------------------
-- 9. TABELA: AI_INSIGHTS (COPILOTO DE VENDAS & EXTRAÇÕES DA IA)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    detected_objections JSONB DEFAULT '[]'::jsonb,
    sentiment VARCHAR(50) DEFAULT 'POSITIVE',
    suggested_response TEXT,
    confidence_score INTEGER DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_insights_conversation_uq UNIQUE (conversation_id)
);

-- -------------------------------------------------------------
-- 10. TRIGGER AUTOMÁTICO DE UPDATED_AT
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_modtime
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER update_deals_modtime
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER update_conversations_modtime
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
