const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('./harness.cjs');
const admin = { userId: 'master-a', userEmail: 'master@example.invalid', userName: 'Master', role: 'SUPERADMIN', tenantId: 'tenant-other', isSuperAdmin: true };

test('catálogo master exige sessão global e não aceita sessão limitada da extensão', async () => {
  let reads = 0;
  const h = harness({ '@/db': { db: { select() { reads++; throw new Error('Not authorized'); } } } });
  const route = h.load('src/app/api/v1/master/tenants/route.ts');
  assert.equal((await route.GET(h.request('/api/v1/master/tenants'))).status, 401);
  const auth = h.load('src/lib/api-auth.ts');
  for (const payload of [{ ...admin, role: 'BROKER', isSuperAdmin: false }, { ...admin, role: 'ADMIN', isSuperAdmin: false }, { ...admin, source: 'CHROME_EXTENSION' }]) {
    const response = await route.GET(h.request('/api/v1/master/tenants', undefined, { authorization: `Bearer ${auth.signSessionPayload(payload)}` }));
    assert.equal(response.status, 403);
  }
  assert.equal(reads, 0);
});

test('catálogo usa cadastro PostgreSQL, IDs canônicos e todos os status sem expor credenciais', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE tenants(id uuid PRIMARY KEY,name text NOT NULL,slug text NOT NULL UNIQUE,document_cnpj text,logo_url text,primary_color text,timezone text,status text,business_hours jsonb,asaas_api_key text,ai_config jsonb);
      CREATE TABLE tenant_settings(tenant_id uuid PRIMARY KEY,sla_first_response_minutes integer,sla_inactivity_hours integer,auto_assign_rule text,ai_copilot_enabled boolean,require_human_approval_for_ai boolean);
      INSERT INTO tenants VALUES
      ('00000000-0000-0000-0000-000000000001','Ambiente Teste Rafael Sena','ambiente-teste-rafael-sena','','','#000000','America/Sao_Paulo','ACTIVE',NULL,'secret-not-for-catalog','{"apiKey":"private-ai-key"}'),
      ('00000000-0000-0000-0000-000000000002','Vanguard','1790857269847','','',NULL,NULL,'ACTIVE',NULL,NULL,NULL),
      ('00000000-0000-0000-0000-000000000003','Suspended','suspended','','',NULL,NULL,'SUSPENDED',NULL,NULL,NULL);
      INSERT INTO tenant_settings VALUES ('00000000-0000-0000-0000-000000000001',5,12,'ROUND_ROBIN',true,false);`);
    const h = harness();
    h.mocks['@/db'].db = drizzle(pg, { schema: h.load('src/db/schema.ts') });
    const auth = h.load('src/lib/api-auth.ts');
    const result = await h.load('src/app/api/v1/master/tenants/route.ts').GET(h.request('/api/v1/master/tenants?tenantId=tenant-other', undefined, { cookie: `vanguard_session=${auth.signSessionPayload(admin)}` }));
    assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
    const data = await result.json();
    assert.equal(data.tenants.length, 3);
    const target = data.tenants.find(tenant => tenant.slug === 'ambiente-teste-rafael-sena');
    assert.equal(target.id, 'tenant-ambiente-teste-rafael-sena'); assert.equal(target.settings.slaFirstResponseMinutes, 5);
    assert.equal(data.tenants.find(tenant => tenant.slug === '1790857269847').id, 'tenant-1790857269847');
    assert.equal(data.tenants.find(tenant => tenant.slug === 'suspended').status, 'SUSPENDED');
    assert.equal(JSON.stringify(data).includes('secret-not-for-catalog'), false); assert.equal(JSON.stringify(data).includes('private-ai-key'), false);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM tenants')).rows[0].n, 3);
  } finally { await pg.close(); }
});

test('reconciliação inclui ambiente ausente e não mistura Teste e Vanguard por um ID legado reutilizado', () => {
  const { reconcileTenantCatalog, catalogTenantForSelection } = harness().load('src/lib/tenant-catalog.ts');
  const cached = [{ id: 'tenant-1790857269847', slug: 'ambiente-teste-rafael-sena', name: 'Old name', plan: 'ENTERPRISE', monthlyFee: 0, maxBrokers: 50, maxInstances: 10, asaasApiKey: 'not-to-copy' }];
  const catalog = [
    { id: 'tenant-ambiente-teste-rafael-sena', slug: 'ambiente-teste-rafael-sena', name: 'Ambiente Teste Rafael Sena', status: 'ACTIVE' },
    { id: 'tenant-1790857269847', slug: '1790857269847', name: 'Vanguard', status: 'ACTIVE' },
  ];
  const result = reconcileTenantCatalog(catalog, cached);
  assert.equal(result.length, 2); assert.equal(new Set(result.map(item=>item.id)).size, 2);
  assert.equal(result[0].plan, 'ENTERPRISE'); assert.equal(result[0].id, 'tenant-ambiente-teste-rafael-sena');
  assert.equal(result[1].name, 'Vanguard'); assert.equal(result[1].catalogMetadataOnly, true);
  assert.equal(result[0].asaasApiKey, undefined);
  assert.equal(catalogTenantForSelection(cached[0], result).id, 'tenant-ambiente-teste-rafael-sena');
  assert.equal(reconcileTenantCatalog(catalog, []).length, 2);
  assert.equal(catalogTenantForSelection({ id: 'tenant-1790857269847', slug: '1790857269847' }, cached), undefined);
});

test('falha do banco não retorna catálogo vazio como sucesso', async () => {
  const h = harness({ '@/db': { db: { select() { throw new Error('DB unavailable'); } } } });
  const token = h.load('src/lib/api-auth.ts').signSessionPayload(admin);
  const result = await h.load('src/app/api/v1/master/tenants/route.ts').GET(h.request('/api/v1/master/tenants', undefined, { authorization: `Bearer ${token}` }));
  assert.equal(result.status, 503); assert.equal((await result.json()).success, false);
});

test('login usa o slug da sessão sem herdar o nome, contrato ou chaves de outro ambiente', () => {
  const { tenantForAuthenticatedSession } = harness().load('src/lib/tenant-catalog.ts');
  const legacy = [{ id: 'tenant-1790857269847', slug: 'ambiente-teste-rafael-sena', name: 'Ambiente Teste Rafael Sena', plan: 'ENTERPRISE', monthlyFee: 0, asaasApiKey: 'not-the-other-tenant' }];
  const vanguard = tenantForAuthenticatedSession('tenant-1790857269847', legacy);
  assert.equal(vanguard.slug, '1790857269847'); assert.notEqual(vanguard.name, legacy[0].name);
  assert.equal(vanguard.asaasApiKey, undefined); assert.equal(vanguard.catalogMetadataOnly, true);
  const testTenant = tenantForAuthenticatedSession('tenant-ambiente-teste-rafael-sena', legacy);
  assert.equal(testTenant.id, 'tenant-ambiente-teste-rafael-sena'); assert.equal(testTenant.name, legacy[0].name);
});
