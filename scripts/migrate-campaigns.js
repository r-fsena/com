const fs = require('node:fs');
const path = require('node:path');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local', quiet: true });
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await sql.unsafe(fs.readFileSync(path.join(__dirname, '../database/04_campaigns.sql'), 'utf8'));
    await sql.unsafe(fs.readFileSync(path.join(__dirname, '../database/05_campaign_sequences.sql'), 'utf8'));
    console.log('Estrutura de campanhas criada. Registros existentes preservados. Nenhum envio iniciado.');
  } finally { await sql.end(); }
}
main().catch(() => { console.error('Migração de campanhas não concluída. Verifique o banco e as permissões.'); process.exitCode = 1; });
