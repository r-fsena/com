BEGIN;
ALTER TABLE crm_outbound_contacts ADD COLUMN IF NOT EXISTS sequence_key text;
CREATE INDEX IF NOT EXISTS crm_campaign_recipients_sequence_idx ON crm_campaign_recipients(tenant_key, campaign_id, ((payload->>'sequenceId')), ((payload->>'partIndex')::integer));
COMMIT;
