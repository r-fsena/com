/** Aplica a migração e copia dados normalizados/JSON para snapshots, sem substituir snapshots existentes. */
const fs = require('node:fs');
const path = require('node:path');
const postgres = require('postgres');
const { mergeMigrationState } = require('./crm-state-migration.cjs');
require('dotenv').config({ path: '.env.local', quiet: true });
const camel = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), value instanceof Date ? value.toISOString() : value]));
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await sql.unsafe(fs.readFileSync(path.join(__dirname, '../database/03_durable_crm_state.sql'), 'utf8'));
    const jsonPath = process.argv[2];
    let legacy = null;
    if (jsonPath) { const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); legacy = parsed.state || parsed; }
    const tenants = await sql`SELECT id, slug FROM tenants`;
    for (const tenant of tenants) {
      const tenantId = `tenant-${tenant.slug}`;
      await sql.begin(async tx => {
        const contacts = (await tx`SELECT * FROM contacts WHERE tenant_id = ${tenant.id}`).map(row => ({ ...camel(row), tenantId, phone: `+${row.phone_normalized}`, lid: row.whatsapp_lid || undefined, notesCount: 0 }));
        const instances = await tx`SELECT id, zapi_instance_id FROM whatsapp_instances WHERE tenant_id = ${tenant.id}`;
        const instanceIds = new Map(instances.map(row => [row.id, row.zapi_instance_id]));
        const conversations = (await tx`SELECT * FROM conversations WHERE tenant_id = ${tenant.id}`).map(row => ({ ...camel(row), tenantId, instanceId: instanceIds.get(row.instance_id) || row.instance_id }));
        const messages = (await tx`SELECT * FROM messages WHERE tenant_id = ${tenant.id}`).map(row => ({ ...camel(row), tenantId }));
        const deals = (await tx`SELECT * FROM deals WHERE tenant_id = ${tenant.id}`).map(row => ({ ...camel(row), tenantId, expectedValue: Number(row.expected_value) }));
        const state = { contacts, conversations, messages, deals, aiInsights: {}, quickReplies: [], deletedKeys: [] };
        const merged = mergeMigrationState(state, legacy, tenantId);
        await tx`INSERT INTO crm_tenant_state (tenant_key, state) VALUES (${tenantId}, ${tx.json(merged)}) ON CONFLICT (tenant_key) DO NOTHING`;
      });
    }
    console.log(`Migração concluída para ${tenants.length} imobiliárias. Snapshots existentes preservados.`);
  } finally { await sql.end(); }
}
main().catch(() => { console.error('Migração não concluída. Verifique conexão, schema anterior e arquivo de origem.'); process.exitCode = 1; });
