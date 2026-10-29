BEGIN;
CREATE TABLE IF NOT EXISTS crm_tenant_state (
  tenant_key text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_sync_jobs (
  id text PRIMARY KEY,
  tenant_key text NOT NULL,
  payload jsonb NOT NULL,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_sync_jobs_tenant_idx ON crm_sync_jobs(tenant_key);
COMMIT;
