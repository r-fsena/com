const fs = require('fs');
const postgres = require('postgres');

async function migrate() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://faith_admin:30ago2015Ra!@crm-faith-hub-db.c5ga8cy0w39h.us-east-2.rds.amazonaws.com:5432/crm-faith-hub-db?sslmode=require';
  const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });

  console.log(' Conectado ao crm-faith-hub-db!');

  // 1. Mapeamento de Tenants
  console.log('\n1. Verificando Tenants...');
  const tenantRows = [
    {
      name: 'Ambiente Teste Rafael Sena',
      slug: 'ambiente-teste-rafael-sena',
      document_cnpj: '21585562000114',
      primary_color: '#000000'
    },
    {
      name: 'Amábile Barbarotti Imóveis',
      slug: 'amabile-barbarotti',
      document_cnpj: '52.189.432/0001-90',
      primary_color: '#059669'
    }
  ];

  const tenantMap = new Map();
  for (const t of tenantRows) {
    const existing = await sql`SELECT id, slug FROM tenants WHERE slug = ${t.slug}`;
    if (existing.length > 0) {
      tenantMap.set(t.slug, existing[0].id);
      tenantMap.set('tenant-' + t.slug, existing[0].id);
      console.log(`  Tenant "${t.name}" OK (ID: ${existing[0].id})`);
    } else {
      const ins = await sql`
        INSERT INTO tenants (name, slug, document_cnpj, primary_color)
        VALUES (${t.name}, ${t.slug}, ${t.document_cnpj}, ${t.primary_color})
        RETURNING id, slug
      `;
      tenantMap.set(t.slug, ins[0].id);
      tenantMap.set('tenant-' + t.slug, ins[0].id);
      console.log(`  Tenant "${t.name}" criado (ID: ${ins[0].id})`);
    }
  }
  tenantMap.set('tenant-1790857269847', tenantMap.get('ambiente-teste-rafael-sena'));

  // 2. Usuários e Memberships
  console.log('\n2. Verificando Usuários...');
  const userRows = [
    {
      email: 'rafael@faithhubs.com',
      full_name: 'Rafael Sena',
      phone: '+55 11 98877-6655',
      role: 'SUPERADMIN',
      tenantSlug: 'ambiente-teste-rafael-sena'
    },
    {
      email: 'amabile.barbarotti@gmail.com',
      full_name: 'Amábile Barbarotti',
      phone: '+55 11 99999-8877',
      role: 'ADMIN',
      tenantSlug: 'amabile-barbarotti'
    }
  ];

  const userMap = new Map();
  for (const u of userRows) {
    const existing = await sql`SELECT id, email FROM users WHERE email = ${u.email}`;
    let userId;
    if (existing.length > 0) {
      userId = existing[0].id;
      userMap.set(u.email, userId);
      console.log(`  Usuário "${u.full_name}" OK (ID: ${userId})`);
    } else {
      const ins = await sql`
        INSERT INTO users (email, full_name, phone, is_active)
        VALUES (${u.email}, ${u.full_name}, ${u.phone}, true)
        RETURNING id
      `;
      userId = ins[0].id;
      userMap.set(u.email, userId);
      console.log(`  Usuário "${u.full_name}" criado (ID: ${userId})`);
    }

    const tId = tenantMap.get(u.tenantSlug);
    if (tId) {
      const memExisting = await sql`SELECT id FROM memberships WHERE tenant_id = ${tId} AND user_id = ${userId}`;
      if (memExisting.length === 0) {
        await sql`INSERT INTO memberships (tenant_id, user_id, role) VALUES (${tId}, ${userId}, ${u.role})`;
        console.log(`  Membership associada para "${u.full_name}".`);
      }
    }
  }

  // 3. Instâncias WhatsApp Z-API
  console.log('\n3. Verificando Instâncias WhatsApp...');
  const instRows = [
    {
      tenantSlug: 'ambiente-teste-rafael-sena',
      name: 'Instância Pessoal • Rafael Sena',
      phoneNumber: '+554888774408',
      zapiInstanceId: '3F1B67FC8139425171C79ED390C0144C'
    },
    {
      tenantSlug: 'amabile-barbarotti',
      name: 'Central WhatsApp • Amábile Barbarotti',
      phoneNumber: '+554899797603',
      zapiInstanceId: '3F8144490C66805B4E3FD64A35E2F2DC'
    }
  ];

  for (const inst of instRows) {
    const tId = tenantMap.get(inst.tenantSlug);
    if (!tId) continue;
    const existing = await sql`
      SELECT id FROM whatsapp_instances 
      WHERE tenant_id = ${tId} AND zapi_instance_id = ${inst.zapiInstanceId}
    `;
    if (existing.length === 0) {
      await sql`
        INSERT INTO whatsapp_instances (tenant_id, name, phone_number, zapi_instance_id, zapi_token_secret_ref, status)
        VALUES (${tId}, ${inst.name}, ${inst.phoneNumber}, ${inst.zapiInstanceId}, 'zapi-secret', 'CONNECTED')
      `;
      console.log(`  Instância "${inst.name}" cadastrada.`);
    } else {
      console.log(`  Instância "${inst.name}" já cadastrada.`);
    }
  }

  // 4. Migração de Contatos do crm-state.json
  console.log('\n4. Migrando Contatos de data/crm-state.json...');
  const statePath = '/Users/rafaelsena/Desktop/Projetos-apps/CRM /data/crm-state.json';
  const stateData = JSON.parse(fs.readFileSync(statePath, 'utf-8')).state || {};
  const contactsList = stateData.contacts || [];

  let contactsCreated = 0;
  let contactsExisted = 0;
  for (const c of contactsList) {
    if (!c.phone) continue;
    const cleanPhone = c.phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) continue;

    const tId = tenantMap.get(c.tenantId) || tenantMap.get('ambiente-teste-rafael-sena');
    if (!tId) continue;

    const existing = await sql`SELECT id FROM contacts WHERE tenant_id = ${tId} AND phone_normalized = ${cleanPhone}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO contacts (
          tenant_id, name, phone_normalized, phone_display, whatsapp_lid,
          email, monthly_income, down_payment_available, max_property_value,
          preferred_property_type, purchase_purpose, target_regions, target_bedrooms,
          source, temperature, ai_priority_score, tags, consent_given
        )
        VALUES (
          ${tId},
          ${c.name || 'Contato WhatsApp'},
          ${cleanPhone},
          ${c.phone},
          ${c.lid || null},
          ${c.email || null},
          ${c.monthlyIncome ? String(c.monthlyIncome) : null},
          ${c.downPayment ? String(c.downPayment) : null},
          ${c.maxBudget ? String(c.maxBudget) : null},
          ${(c.preferredPropertyType || 'APARTMENT').toUpperCase()},
          ${(c.purchasePurpose || 'LIVING').toUpperCase()},
          ${JSON.stringify(c.targetRegions || [])},
          ${c.targetBedrooms || 2},
          ${c.source || 'WHATSAPP'},
          ${(c.temperature || 'WARM').toUpperCase()},
          ${c.aiPriorityScore || 70},
          ${JSON.stringify(c.tags || [])},
          true
        )
      `;
      contactsCreated++;
    } else {
      contactsExisted++;
    }
  }
  console.log(`  Contatos inseridos: ${contactsCreated} | Já existentes: ${contactsExisted} (Total: ${contactsList.length})`);

  // 5. Migração de Conversas e Mensagens
  console.log('\n5. Migrando Conversas e Mensagens...');
  const messagesList = stateData.messages || [];
  let msgsCreated = 0;
  for (const m of messagesList) {
    if (!m.content) continue;
    const phone = (m.conversationId || '').replace(/\D/g, '');
    if (!phone) continue;

    const tId = tenantMap.get(m.tenantId) || tenantMap.get('ambiente-teste-rafael-sena');
    if (!tId) continue;

    const contactRow = await sql`SELECT id FROM contacts WHERE tenant_id = ${tId} AND phone_normalized = ${phone} LIMIT 1`;
    if (contactRow.length === 0) continue;

    let convId;
    const convRow = await sql`SELECT id FROM conversations WHERE tenant_id = ${tId} AND contact_id = ${contactRow[0].id} LIMIT 1`;
    if (convRow.length === 0) {
      const newConv = await sql`
        INSERT INTO conversations (tenant_id, contact_id, phone_normalized, last_message_preview)
        VALUES (${tId}, ${contactRow[0].id}, ${phone}, ${m.content.slice(0, 100)})
        RETURNING id
      `;
      convId = newConv[0].id;
    } else {
      convId = convRow[0].id;
    }

    const existingMsg = await sql`SELECT id FROM messages WHERE tenant_id = ${tId} AND (external_zapi_id = ${m.id} OR id::text = ${m.id})`;
    if (existingMsg.length === 0) {
      await sql`
        INSERT INTO messages (
          tenant_id, conversation_id, phone_normalized, external_zapi_id,
          sender_type, sender_name, message_type, content, status, timestamp
        )
        VALUES (
          ${tId},
          ${convId},
          ${phone},
          ${m.id || null},
          ${m.senderType === 'USER' ? 'USER' : 'CONTACT'},
          ${m.senderName || 'Contato'},
          'TEXT',
          ${m.content},
          'DELIVERED',
          ${m.timestamp ? new Date(m.timestamp) : new Date()}
        )
      `;
      msgsCreated++;
    }
  }
  console.log(`  Mensagens migradas: ${msgsCreated}`);

  // 6. Resumo Final
  console.log('\n=============================================');
  console.log(' RESUMO OFICIAL DOS DADOS NO POSTGRESQL');
  console.log('=============================================');
  const [tCount] = await sql`SELECT count(*) FROM tenants`;
  const [uCount] = await sql`SELECT count(*) FROM users`;
  const [cCount] = await sql`SELECT count(*) FROM contacts`;
  const [cvCount] = await sql`SELECT count(*) FROM conversations`;
  const [mCount] = await sql`SELECT count(*) FROM messages`;
  const [instCount] = await sql`SELECT count(*) FROM whatsapp_instances`;
  console.log(`  Tenants (Ambientes):    ${tCount.count}`);
  console.log(`  Usuários:               ${uCount.count}`);
  console.log(`  Instâncias Z-API:       ${instCount.count}`);
  console.log(`  Contatos / Leads:       ${cCount.count}`);
  console.log(`  Conversas Ativas:       ${cvCount.count}`);
  console.log(`  Mensagens no Histórico: ${mCount.count}`);
  console.log('=============================================\n');

  await sql.end();
}

migrate().catch(console.error);
