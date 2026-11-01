BEGIN;
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id text PRIMARY KEY, tenant_key text NOT NULL, status text NOT NULL DEFAULT 'DRAFT',
  payload jsonb NOT NULL, scheduled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_campaigns_tenant_idx ON crm_campaigns(tenant_key, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_campaigns_due_idx ON crm_campaigns(status, scheduled_at);
CREATE TABLE IF NOT EXISTS crm_campaign_recipients (
  id text PRIMARY KEY, tenant_key text NOT NULL, campaign_id text NOT NULL REFERENCES crm_campaigns(id),
  contact_id text, phone text NOT NULL, target_key text NOT NULL, status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL, reason text NOT NULL DEFAULT '', external_id text, lease_until timestamptz,
  replied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, target_key)
);
CREATE INDEX IF NOT EXISTS crm_campaign_recipients_due_idx ON crm_campaign_recipients(campaign_id, status, updated_at);
CREATE INDEX IF NOT EXISTS crm_campaign_recipients_receipt_idx ON crm_campaign_recipients(tenant_key, external_id);
CREATE TABLE IF NOT EXISTS crm_campaign_receipts (
  id text PRIMARY KEY, tenant_key text NOT NULL, instance_key text NOT NULL, external_id text NOT NULL,
  status text NOT NULL, occurred_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_key, instance_key, external_id)
);
CREATE TABLE IF NOT EXISTS crm_outbound_lanes (
  instance_key text PRIMARY KEY, tenant_key text NOT NULL, owner_key text, lease_until timestamptz,
  next_allowed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_outbound_contacts (
  id text PRIMARY KEY, tenant_key text NOT NULL, phone text NOT NULL, owner_key text, lease_until timestamptz,
  attempted_at timestamptz, campaign_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_key, phone)
);
ALTER TABLE IF EXISTS contacts ALTER COLUMN consent_given SET DEFAULT FALSE;
ALTER TABLE IF EXISTS contacts ALTER COLUMN consent_date DROP DEFAULT;
COMMIT;
