const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('1. Criando tabela platform_settings...');
  await sql`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
      asaas_master_api_key VARCHAR(255),
      asaas_master_wallet_id VARCHAR(100),
      asaas_webhook_url TEXT,
      open_ai_api_key VARCHAR(255),
      google_gemini_api_key VARCHAR(255),
      aws_bedrock_model VARCHAR(100) DEFAULT 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      aws_bedrock_region VARCHAR(50) DEFAULT 'us-east-1',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  console.log('2. Inserindo registro padrão em platform_settings...');
  await sql`
    INSERT INTO platform_settings (id, aws_bedrock_model, aws_bedrock_region)
    VALUES ('default', 'anthropic.claude-3-5-sonnet-20241022-v2:0', 'us-east-1')
    ON CONFLICT (id) DO NOTHING;
  `;

  console.log('3. Adicionando colunas de Asaas e AI em tenants...');
  await sql`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS asaas_api_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS asaas_wallet_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ai_config JSONB;
  `;

  console.log('4. Adicionando colunas de autenticação em users...');
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS salt VARCHAR(64),
    ADD COLUMN IF NOT EXISTS temp_password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
  `;

  console.log('5. Gravando hashes de senha seguros para os usuários existentes...');
  const crypto = require('crypto');
  function hashPassword(pass) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
    return { salt, hash };
  }

  // Senha Rafael Sena: '30ago2015R@!'
  const rafaelHash = hashPassword('30ago2015R@!');
  await sql`
    UPDATE users
    SET password_hash = ${rafaelHash.hash}, salt = ${rafaelHash.salt}
    WHERE email = 'rafael@faithhubs.com';
  `;

  // Senha Amábile Barbarotti: '30ago2015R@!' (ou temporária)
  const amabileHash = hashPassword('30ago2015R@!');
  await sql`
    UPDATE users
    SET password_hash = ${amabileHash.hash}, salt = ${amabileHash.salt}
    WHERE email = 'amabile.barbarotti@gmail.com';
  `;

  console.log('Sucesso total! Verificando users...');
  const u = await sql`SELECT id, email, full_name, cognito_sub, LEFT(password_hash, 16) as hash_preview FROM users`;
  console.log(u);

  await sql.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
