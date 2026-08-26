-- ==============================================================================
-- VANGUARD CRM IMOBILIÁRIO • ROW-LEVEL SECURITY (RLS) & AUDITORIA LGPD (POSTGRESQL)
-- ==============================================================================
-- Este script ativa o isolamento criptográfico por Tenant (Multi-Tenant RLS)
-- e cria a infraestrutura de auditoria em conformidade com a LGPD (Lei 13.709/2018).
-- ==============================================================================

-- 1. TABELA DE AUDITORIA LGPD & PRIVACIDADE
CREATE TABLE IF NOT EXISTS lgpd_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- DATA_ACCESS, DATA_EXPORT, CONSENT_GRANTED, CONSENT_REVOKED, DATA_ANONYMIZED, DATA_DELETED
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name_masked VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida de auditoria
CREATE INDEX IF NOT EXISTS idx_lgpd_tenant_date ON lgpd_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lgpd_contact ON lgpd_audit_logs(contact_id);

-- -------------------------------------------------------------
-- 2. HABILITAÇÃO DE ROW-LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- -------------------------------------------------------------

-- Habilita RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_audit_logs ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 3. POLÍTICAS DE ISOLAMENTO POR TENANT (POLICIES)
-- -------------------------------------------------------------

-- Política para Contatos (Leads)
DROP POLICY IF EXISTS tenant_isolation_contacts ON contacts;
CREATE POLICY tenant_isolation_contacts ON contacts
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- Política para Conversas
DROP POLICY IF EXISTS tenant_isolation_conversations ON conversations;
CREATE POLICY tenant_isolation_conversations ON conversations
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- Política para Mensagens
DROP POLICY IF EXISTS tenant_isolation_messages ON messages;
CREATE POLICY tenant_isolation_messages ON messages
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- Política para Deals (Funil Kanban)
DROP POLICY IF EXISTS tenant_isolation_deals ON deals;
CREATE POLICY tenant_isolation_deals ON deals
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- Política para Transações Financeiras (Asaas)
DROP POLICY IF EXISTS tenant_isolation_transactions ON financial_transactions;
CREATE POLICY tenant_isolation_transactions ON financial_transactions
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- Política para Logs de Auditoria LGPD
DROP POLICY IF EXISTS tenant_isolation_lgpd_logs ON lgpd_audit_logs;
CREATE POLICY tenant_isolation_lgpd_logs ON lgpd_audit_logs
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
    );
