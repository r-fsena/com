-- ==============================================================================
-- VANGUARD CRM IMOBILIÁRIO • SCRIPTS DE CRUD & ACIONAMENTOS NO BANCO AWS
-- ==============================================================================
-- Contém queries de INSERT, UPDATE (Qualificação) e SELECTs ancorados em phone_normalized
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEED INICIAL: EMPRESA E CORRETOR PADRÃO
-- ------------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, document_cnpj)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Vanguard Prime Imóveis',
    'vanguard-prime',
    '34.567.890/0001-12'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, email, full_name, phone)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'lucas.corretor@vanguardprime.com.br',
    'Lucas Brandão (Corretor)',
    '+55 (11) 96655-4433'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO memberships (tenant_id, user_id, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'BROKER'
) ON CONFLICT (tenant_id, user_id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 2. ACIONAMENTO: UPSERT DE CONTATO (NUNCA PERDE QUALIFICAÇÃO)
-- ------------------------------------------------------------------------------
-- Se o contato não existir, cria com dados iniciais.
-- Se já existir pelo telefone, atualiza apenas campos não nulos e PRESERVA a renda.
INSERT INTO contacts (
    tenant_id,
    name,
    phone_normalized,
    phone_display,
    email,
    monthly_income,
    down_payment_available,
    max_property_value,
    preferred_property_type,
    target_regions,
    temperature,
    ai_priority_score,
    assigned_user_id,
    tags
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Rafael Sena',
    '554891079478',
    '+55 (48) 9107-9478',
    'rafael.sena@exemplo.com',
    45000.00,                      -- Renda Mensal: R$ 45.000,00
    300000.00,                     -- Entrada: R$ 300.000,00
    1200000.00,                    -- Orçamento Máx: R$ 1.200.000,00
    'APARTMENT',
    '["Batel", "Região Nobre"]'::jsonb,
    'HOT',
    95,
    '00000000-0000-0000-0000-000000000002',
    '["#Lead Quente", "#Apartamento Alto Padrão", "Z-API Live"]'::jsonb
)
ON CONFLICT (tenant_id, phone_normalized) 
DO UPDATE SET
    name = EXCLUDED.name,
    email = COALESCE(EXCLUDED.email, contacts.email),
    monthly_income = COALESCE(EXCLUDED.monthly_income, contacts.monthly_income),
    down_payment_available = COALESCE(EXCLUDED.down_payment_available, contacts.down_payment_available),
    max_property_value = COALESCE(EXCLUDED.max_property_value, contacts.max_property_value),
    preferred_property_type = COALESCE(EXCLUDED.preferred_property_type, contacts.preferred_property_type),
    target_regions = COALESCE(EXCLUDED.target_regions, contacts.target_regions),
    temperature = COALESCE(EXCLUDED.temperature, contacts.temperature),
    ai_priority_score = GREATEST(EXCLUDED.ai_priority_score, contacts.ai_priority_score),
    tags = contacts.tags || EXCLUDED.tags,
    last_client_interaction_at = NOW(),
    updated_at = NOW();


-- ------------------------------------------------------------------------------
-- 3. ACIONAMENTO: REGISTRO DE MENSAGEM DO WHATSAPP (VIA WEBHOOK Z-API)
-- ------------------------------------------------------------------------------
-- 3.1 Garante que a conversa exista para o telefone
INSERT INTO conversations (
    tenant_id,
    contact_id,
    phone_normalized,
    last_message_preview,
    last_message_at
)
SELECT 
    c.tenant_id,
    c.id,
    c.phone_normalized,
    'Olá! Busco um apartamento com renda de 45 mil.',
    NOW()
FROM contacts c
WHERE c.phone_normalized = '554891079478'
ON CONFLICT (tenant_id, contact_id) DO UPDATE SET
    last_message_preview = EXCLUDED.last_message_preview,
    last_message_at = NOW();

-- 3.2 Insere a mensagem no histórico permanente
INSERT INTO messages (
    tenant_id,
    conversation_id,
    phone_normalized,
    external_zapi_id,
    sender_type,
    sender_name,
    message_type,
    content,
    timestamp
)
SELECT 
    conv.tenant_id,
    conv.id,
    conv.phone_normalized,
    'zapi-msg-' || extract(epoch from now()),
    'CONTACT',
    'Rafael Sena',
    'TEXT',
    'Olá! Busco um apartamento de alto padrão na região nobre. Tenho renda mensal de 45 mil reais e entrada de 300 mil reais.',
    NOW()
FROM conversations conv
WHERE conv.phone_normalized = '554891079478'
LIMIT 1;


-- ------------------------------------------------------------------------------
-- 4. ACIONAMENTO: ATUALIZAR QUALIFICAÇÃO APÓS ANÁLISE DA IA COPILOTO
-- ------------------------------------------------------------------------------
UPDATE contacts
SET 
    monthly_income = 45000.00,
    down_payment_available = 300000.00,
    max_property_value = 1200000.00,
    preferred_property_type = 'APARTMENT',
    target_regions = '["Região Nobre", "Batel"]'::jsonb,
    temperature = 'HOT',
    ai_priority_score = 95,
    email = COALESCE(email, 'rafael.sena@exemplo.com'),
    updated_at = NOW()
WHERE phone_normalized = '554891079478';


-- ------------------------------------------------------------------------------
-- 5. ACIONAMENTO: LANÇAR OPORTUNIDADE NO KANBAN / FUNIL
-- ------------------------------------------------------------------------------
-- 5.1 Garante que o pipeline padrão exista
INSERT INTO pipelines (id, tenant_id, name)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Funil de Vendas Residencial'
) ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (id, pipeline_id, name, order_index, color_hex)
VALUES 
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', '1. Novo Lead', 1, '#3b82f6'),
    ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000010', '2. Qualificação', 2, '#8b5cf6'),
    ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000010', '3. Visita Agendada', 3, '#f59e0b'),
    ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000010', '4. Contrato Fechado', 4, '#059669')
ON CONFLICT DO NOTHING;

-- 5.2 Cria negócio associado ao contato
INSERT INTO deals (
    tenant_id,
    contact_id,
    pipeline_id,
    stage_id,
    assigned_user_id,
    title,
    expected_value,
    manual_probability,
    ai_probability_score,
    status
)
SELECT 
    c.tenant_id,
    c.id,
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000022', -- Etapa 2: Qualificação
    '00000000-0000-0000-0000-000000000002', -- Corretor Lucas
    'Apartamento Alto Padrão - ' || c.name,
    COALESCE(c.max_property_value, 1200000.00),
    80,
    c.ai_priority_score,
    'OPEN'
FROM contacts c
WHERE c.phone_normalized = '554891079478';


-- ------------------------------------------------------------------------------
-- 6. CONSULTAS CHAVE DE ALTA PERFORMANCE (USADAS NO CRM)
-- ------------------------------------------------------------------------------

-- 6.1 Buscar Perfil Completo 360º por Telefone
SELECT 
    c.id,
    c.name,
    c.phone_normalized,
    c.phone_display,
    c.email,
    c.monthly_income,
    c.down_payment_available,
    c.max_property_value,
    c.preferred_property_type,
    c.target_regions,
    c.temperature,
    c.ai_priority_score,
    u.full_name AS broker_name,
    d.title AS deal_title,
    d.expected_value AS deal_value,
    ps.name AS deal_stage
FROM contacts c
LEFT JOIN users u ON u.id = c.assigned_user_id
LEFT JOIN deals d ON d.contact_id = c.id
LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
WHERE c.phone_normalized = '554891079478';

-- 6.2 Buscar Histórico Cronológico de Mensagens por Telefone
SELECT 
    m.id,
    m.sender_type,
    m.sender_name,
    m.content,
    m.media_url,
    m.timestamp
FROM messages m
WHERE m.phone_normalized = '554891079478'
ORDER BY m.timestamp ASC;

-- 6.3 Listagem de Leads para a Barra Lateral do Inbox com Última Mensagem
SELECT 
    c.id AS contact_id,
    c.name,
    c.phone_display,
    c.temperature,
    c.ai_priority_score,
    conv.id AS conversation_id,
    conv.last_message_preview,
    conv.last_message_at,
    conv.unread_count
FROM contacts c
JOIN conversations conv ON conv.contact_id = c.id
ORDER BY conv.last_message_at DESC;
