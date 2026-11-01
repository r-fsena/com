const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { eq } = require('drizzle-orm');
const { harness } = require('./harness.cjs');
const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const contact = (id, overrides = {}) => ({ id, tenantId: 'tenant-a', name: `Cliente ${id}`, phone: '+5511998765432', source: 'WHATSAPP', temperature: 'HOT', tags: ['Interesse'],
  targetRegions: ['Centro'], assignedUserId: USER, consentGiven: true, hasOptedOut: false, notesCount: 0, aiPriorityScore: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides });
const config = (overrides = {}) => ({ name: 'Campanha fictícia', objective: 'PROPERTY', instanceId: 'instance-a', audience: { mode: 'FILTERED', selectedIds: [], excludedIds: [], temperatures: [], sources: [], stageIds: [], tags: [], regions: [], assignedUserIds: [] },
  message: 'Olá {{primeiro_nome}} da {{empresa}}! Responda SAIR se não desejar novidades.', schedule: { hours: { onlyBusinessHours: false, timezone: 'America/Sao_Paulo', start: '08:00', end: '18:00', workDays: [1, 2, 3, 4, 5] }, expiresAfterHours: 48 }, ...overrides });
async function fixture() {
  const client = new PGlite();
  await client.exec(fs.readFileSync('database/03_durable_crm_state.sql', 'utf8'));
  await client.exec(fs.readFileSync('database/04_campaigns.sql', 'utf8'));
  await client.exec(`CREATE TABLE tenants (id uuid PRIMARY KEY, name text, slug text, status text);
    CREATE TABLE users (id uuid PRIMARY KEY, full_name text, is_active boolean, phone text);
    CREATE TABLE memberships (tenant_id uuid, user_id uuid, role text, is_active boolean);
    CREATE TABLE whatsapp_instances (id uuid, tenant_id uuid, zapi_instance_id text, name text, phone_number text);
    INSERT INTO tenants VALUES ('10000000-0000-4000-8000-000000000001','Empresa A','a','ACTIVE'), ('10000000-0000-4000-8000-000000000002','Empresa B','b','ACTIVE');
    INSERT INTO users VALUES ('${USER}','Gestor A',true,'+5511987654321'), ('${OTHER}','Gestor B',true,'+5511976543210');
    INSERT INTO memberships VALUES ('10000000-0000-4000-8000-000000000001','${USER}','MANAGER',true), ('10000000-0000-4000-8000-000000000002','${OTHER}','MANAGER',true);
    INSERT INTO whatsapp_instances VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','instance-a','Comercial A','+5511912345678');`);
  const sends = []; let mode = 'ok', connected = true; let duringSend;
  const h = harness({
    '@/lib/zapi-client': { ZApiClient: class {
      async getStatus() { return { success: true, data: { connected } }; }
      async sendText(phone, text) { return send('TEXT', phone, text); }
      async sendImage(phone, url, text) { return send('IMAGE', phone, text, url); }
      async sendVideo(phone, url, text) { return send('VIDEO', phone, text, url); }
      async sendDocument(phone, url, fileName, text) { return send('DOCUMENT', phone, text, url, fileName); }
    } },
    '@/lib/db/zapi-credentials-service': { ZapiCredentialsService: {
      resolveCredentials: async ({ tenantId, instanceId }) => { if (tenantId !== 'tenant-a' || instanceId !== 'instance-a') throw new Error('Foreign instance'); return { instanceId, instanceToken: 'test-only', securityToken: 'test-only' }; },
      resolveWebhookTenant: async () => 'tenant-a',
    } },
    '@/lib/campaign-media': { verifyCampaignMedia: async (tenantId, attachment) => { if (!attachment.key.startsWith(`tenants/${tenantId}/`) || attachment.etag === 'changed') throw new Error('Invalid asset'); return { ...attachment, etag: 'verified-etag' }; }, campaignMediaUrl: async () => 'https://test-bucket.invalid/temporary-signed-asset' },
  }, { DATABASE_URL: 'test-only', AUTOMATIONS_CRON_SECRET: 'test-only-scheduler-secret-with-at-least-thirty-two-characters', AUTOMATIONS_OUTBOUND_ENABLED: 'false', CAMPAIGNS_ENABLED: 'true', CAMPAIGNS_OUTBOUND_ENABLED: 'true' });
  async function send(kind, phone, text, url, fileName) {
    const id = `external-${sends.length + 1}`; sends.push({ kind, phone, text, url, fileName, id });
    if (duringSend) await duringSend(id);
    if (mode === 'timeout') throw new Error('Timeout after dispatch');
    return { success: true, externalMessageId: id };
  }
  const schema = h.load('src/db/schema.ts'); h.mocks['@/db'].db = drizzle(client, { schema });
  const service = h.load('src/lib/campaign-service.ts'), repo = h.load('src/lib/crm-repository.ts'), worker = h.load('src/lib/campaign-worker.ts');
  await h.load('src/lib/automation-service.ts').runAutomationWorker('tenant-a');
  const route = h.load('src/app/api/v1/campaigns/route.ts');
  const headers = (role = 'MANAGER', tenantId = 'tenant-a', extra = {}) => ({ authorization: `Bearer ${h.load('src/lib/api-auth.ts').signSessionPayload({ userId: USER, userEmail: 'test@example.invalid', userName: 'Teste', role, tenantId, ...extra })}` });
  const post = body => route.POST(h.request('/api/v1/campaigns', body, headers()));
  const create = async (cfg = config()) => { const response = await post({ operation: 'save', config: cfg }); const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data.campaign; };
  const consent = async c => { await repo.writeCRMState('tenant-a', { contacts: [c] }); return service.setMarketingPermission('tenant-a', USER, { contactId: c.id, granted: true, source: 'Formulário de teste', notes: 'Autorização fictícia coletada no formulário de teste.', confirmed: true }); };
  const start = async campaign => { let response = await post({ operation: 'simulate', id: campaign.id, revision: campaign.payload.revision }); const simulation = await response.json(); assert.equal(response.status, 200, JSON.stringify(simulation)); response = await post({ operation: 'start', id: campaign.id, revision: campaign.payload.revision, confirmed: true, confirmedCount: simulation.simulation.audience.eligible }); const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data.campaign; };
  const recipients = async id => (await service.campaignRecipients('tenant-a', id)).recipients;
  const ready = async () => {
    await h.mocks['@/db'].db.update(schema.crmOutboundLanes).set({ leaseUntil: null, nextAllowedAt: new Date(0) });
    await h.mocks['@/db'].db.update(schema.crmCampaignRecipients).set({ updatedAt: new Date(0) }).where(eq(schema.crmCampaignRecipients.status, 'WAITING_CHANNEL'));
  };
  return { client, h, schema, service, repo, worker, route, headers, post, create, consent, start, recipients, ready, sends, mode: value => { mode = value; }, connected: value => { connected = value; }, duringSend: callback => { duringSend = callback; } };
}

test('público: seleção, filtros, autorização explícita, pessoais, duplicados e números não identificados', () => {
  const engine = harness().load('src/lib/campaigns.ts');
  const contacts = [contact('one'), contact('duplicate'), contact('personal', { phone: '+5511998765000', isPersonal: true }), contact('no-proof', { phone: '+5511998765001' }), contact('invalid', { phone: '123@lid' })];
  const state = { contacts, deals: [], marketingPermissions: { '5511998765432': { status: 'GRANTED', recordedAt: '2026-10-01' }, '5511998765000': { status: 'GRANTED', recordedAt: '2026-10-01' } } };
  const result = engine.buildCampaignAudience(state, config());
  assert.equal(result.total, 5); assert.equal(result.eligible, 1); assert.equal(result.excluded, 4);
  assert.match(result.rows.find(row => row.id === 'duplicate').reason, /repetido/);
  assert.match(result.rows.find(row => row.id === 'no-proof').reason, /Autorização/);
  assert.equal(engine.campaignConfigSchema.safeParse(config({ message: 'Olá {{senha}}' })).success, false);
  assert.equal(engine.campaignPhone('5511999999999@g.us'), null);
  assert.equal(engine.buildCampaignAudience(state, config({ audience: { ...config().audience, mode: 'SELECTED', selectedIds: [] } })).eligible, 0);
  assert.equal(engine.buildCampaignAudience(state, config({ audience: { ...config().audience, temperatures: ['COLD'] } })).eligible, 0);
});

test('campanhas: autenticação, rascunho persistente e edição concorrente', async () => {
  const f = await fixture();
  try {
    const body = { operation: 'save', config: config() };
    assert.equal((await f.route.POST(f.h.request('/api/v1/campaigns', body))).status, 401);
    assert.equal((await f.route.POST(f.h.request('/api/v1/campaigns', body, f.headers('BROKER')))).status, 403);
    assert.equal((await f.route.POST(f.h.request('/api/v1/campaigns', body, f.headers('SUPERADMIN','tenant-a',{source:'CHROME_EXTENSION'})))).status, 403);
    assert.equal((await f.route.POST(f.h.request('/api/v1/campaigns', body, { ...f.headers(), 'x-tenant-id': 'tenant-b' }))).status, 403);
    const c = await f.create(); assert.equal(c.status, 'DRAFT'); assert.equal(f.sends.length, 0);
    const results = await Promise.all(['A', 'B'].map(name => f.post({ operation: 'save', id: c.id, revision: 1, config: config({ name }) })));
    assert.equal(results.filter(response => response.status === 200).length, 1); assert.equal(results.filter(response => response.status === 409).length, 1);
    assert.equal((await f.post({ operation: 'save', id: c.id, config: config() })).status, 409);
    const restarted = harness({}, { DATABASE_URL: 'test-only' }); restarted.mocks['@/db'].db = f.h.mocks['@/db'].db;
    const rows = await f.service.listCampaigns('tenant-a', USER); assert.equal(rows.campaigns.length, 1); assert.equal(rows.campaigns[0].counts.PENDING, undefined);
    assert.equal((await f.service.listCampaigns('tenant-b', OTHER)).campaigns.length, 0);
  } finally { await f.client.close(); }
});

test('simulação não envia; público vazio e mudança de público exigem nova revisão', async () => {
  const f = await fixture();
  try {
    const c = await f.create();
    let response = await f.post({ operation: 'simulate', id: c.id, revision: 1 });
    assert.equal((await response.json()).simulation.audience.eligible, 0); assert.equal(f.sends.length, 0);
    assert.equal((await f.post({ operation: 'start', id: c.id, revision: 1, confirmed: true, confirmedCount: 1 })).status, 400);
    await f.consent(contact('one'));
    assert.equal((await f.post({ operation: 'start', id: c.id, revision: 1, confirmed: true, confirmedCount: 1 })).status, 409);
    await f.start(c); assert.equal((await f.recipients(c.id)).length, 1); assert.equal(f.sends.length, 0);
    await f.consent(contact('later', { phone: '+5511998765002' }));
    assert.equal((await f.recipients(c.id)).length, 1);
    assert.equal((await f.post({ operation: 'save', id: c.id, revision: 1, config: config({ message: 'Outra mensagem' }) })).status, 400);
    await assert.rejects(f.service.campaignRecipients('tenant-b', c.id));
  } finally { await f.client.close(); }
});

test('envio: concorrência, confirmação real, callbacks fora de ordem e retomada sem duplicar', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.create(); await f.start(c);
    await Promise.all([f.worker.runCampaignWorker('tenant-a'), f.worker.runCampaignWorker('tenant-a')]);
    let rows = await f.recipients(c.id); assert.equal(f.sends.length, 1); assert.equal(rows[0].status, 'ACCEPTED');
    assert.equal((await f.repo.readCRMState('tenant-a')).messages[0].status, 'SENT');
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 1);
    await f.service.recordCampaignReceipt('tenant-a','instance-a',[rows[0].externalId],'READ');
    await f.service.recordCampaignReceipt('tenant-a','instance-a',[rows[0].externalId],'ACCEPTED');
    assert.equal((await f.recipients(c.id))[0].status, 'READ');
    await f.service.recordCampaignReceipt('tenant-b','instance-a',[rows[0].externalId],'FAILED');
    assert.equal((await f.recipients(c.id))[0].status, 'READ');
    const listing = await f.service.listCampaigns('tenant-a', USER); assert.equal(listing.campaigns[0].counts.READ, 1); assert.equal(listing.campaigns[0].status, 'COMPLETED');
  } finally { await f.client.close(); }
});

test('pausa, retomada, cancelamento e autorização revogada antes do envio', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); let c = await f.create(); c = await f.start(c);
    let response = await f.post({ operation: 'pause', id: c.id, revision: 1 }); c = (await response.json()).campaign;
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 0);
    response = await f.post({ operation: 'resume', id: c.id, revision: c.payload.revision }); c = (await response.json()).campaign;
    const state = await f.repo.readCRMState('tenant-a');
    await f.service.setMarketingPermission('tenant-a', USER, { contactId: 'one', granted: false, source: 'Pedido de teste', notes: 'Cliente fictício pediu interrupção antes do envio.', confirmed: true, expectedRecordedAt: state.marketingPermissions['5511998765432'].recordedAt });
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 0); assert.equal((await f.recipients(c.id))[0].status, 'SKIPPED');
    const next = await f.create(config({ name: 'Cancelar rascunho' }));
    assert.equal((await f.post({ operation: 'cancel', id: next.id, revision: 1 })).status, 200);
    assert.equal((await f.post({ operation: 'start', id: next.id, revision: 2, confirmed: true, confirmedCount: 1 })).status, 409);
  } finally { await f.client.close(); }
});

test('falha de conexão aguarda; timeout depois de iniciar nunca é reenviado', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.create(); await f.start(c);
    f.connected(false); await f.worker.runCampaignWorker('tenant-a'); assert.equal((await f.recipients(c.id))[0].status, 'WAITING_CHANNEL'); assert.equal(f.sends.length, 0);
    f.connected(true); f.mode('timeout'); await f.ready(); await f.worker.runCampaignWorker('tenant-a');
    assert.equal((await f.recipients(c.id))[0].status, 'UNKNOWN'); assert.equal(f.sends.length, 1);
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 1);
  } finally { await f.client.close(); }
});

test('teste real é restrito ao telefone do perfil e idempotente; simulação não cria testes', async () => {
  const f = await fixture();
  try {
    const c = await f.create(); await f.post({ operation: 'simulate', id: c.id, revision: 1 }); assert.equal((await f.recipients(c.id)).length, 0);
    const command = { operation: 'send-test', id: c.id, revision: 1, confirmed: true, requestId: '30000000-0000-4000-8000-000000000001' };
    assert.equal((await f.post({ ...command, phone: '+5511111111111' })).status, 400);
    await Promise.all([f.post(command), f.post(command)]); assert.equal((await f.recipients(c.id)).length, 1);
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends[0].phone, '5511987654321');
    assert.equal((await f.service.listCampaigns('tenant-a', USER)).campaigns[0].counts.ACCEPTED, undefined);
  } finally { await f.client.close(); }
});

test('pedidos de interrupção são explícitos, persistidos e não podem ser desfeitos por snapshot antigo', async () => {
  const f = await fixture();
  try {
    const engine = f.h.load('src/lib/campaigns.ts'); await f.consent(contact('one'));
    assert.equal(engine.isCampaignStop('não precisa parar'), false); assert.equal(engine.isCampaignStop('SAIR!'), true);
    await f.repo.mutateCRMState('tenant-a', state => engine.recordCampaignStop(state, '5511998765432', 'SAIR', false, new Date().toISOString()));
    await f.repo.writeCRMState('tenant-a', { contacts: [contact('one', { updatedAt: new Date(Date.now() + 1000).toISOString(), hasOptedOut: false })] });
    const state = await f.repo.readCRMState('tenant-a'); assert.equal(state.contacts[0].hasOptedOut, true); assert.equal(state.marketingPermissions['5511998765432'].status, 'REVOKED');
  } finally { await f.client.close(); }
});

test('agendamento aguarda a data; expiração é tratada mesmo fora do horário comercial', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one'));
    let c = await f.create(config({ schedule: { ...config().schedule, startsAt: new Date(Date.now() + 3600000).toISOString() } })); c = await f.start(c);
    assert.equal(c.status, 'SCHEDULED'); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 0);
    await f.h.mocks['@/db'].db.update(f.schema.crmCampaigns).set({ scheduledAt: new Date(0), payload: { ...c.payload, expiresAt: new Date(Date.now() - 60000).toISOString(), config: { ...c.payload.config, schedule: { ...c.payload.config.schedule, hours: { ...config().schedule.hours, onlyBusinessHours: true, timezone: 'UTC', workDays: [(new Date().getUTCDay() + 1) % 7] } } } } }).where(eq(f.schema.crmCampaigns.id, c.id));
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 0); assert.equal((await f.recipients(c.id))[0].status, 'SKIPPED');
  } finally { await f.client.close(); }
});

test('callbacks anteriores ao retorno do envio são conciliados e respostas têm janela definida', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.create(); await f.start(c);
    f.duringSend(async id => {
      await f.service.recordCampaignReceipt('tenant-a','instance-a',[id],'READ');
      await f.repo.writeCRMState('tenant-a', { conversations: [{ id: 'existing-conversation', tenantId: 'tenant-a', contactId: 'one', instanceId: 'instance-a',
        status: 'PENDING_TEAM', unreadCount: 1, lastMessagePreview: 'Resposta mais recente', lastMessageAt: new Date(Date.now() + 1000).toISOString(), slaBreached: false }] });
    });
    await f.worker.runCampaignWorker('tenant-a'); let rows = await f.recipients(c.id);
    assert.equal(rows[0].status, 'READ'); assert.equal(f.sends.length, 1);
    const snapshot = await f.repo.readCRMState('tenant-a');
    assert.equal(snapshot.messages.find(message => message.campaignId === c.id).status, 'READ');
    assert.equal(snapshot.conversations[0].lastMessagePreview, 'Resposta mais recente');
    assert.equal(snapshot.conversations[0].status, 'PENDING_TEAM'); assert.equal(snapshot.conversations[0].unreadCount, 1);
    await f.service.recordCampaignReply('tenant-a','instance-a',rows[0].phone,new Date(Date.now() - 3600000).toISOString()); assert.equal((await f.recipients(c.id))[0].repliedAt, null);
    await f.service.recordCampaignReply('tenant-a','instance-a',rows[0].phone,new Date(Date.now() + 1000).toISOString());
    await f.service.recordCampaignReply('tenant-a','instance-a',rows[0].phone,new Date(Date.now() + 2000).toISOString());
    assert.equal((await f.service.listCampaigns('tenant-a',USER)).campaigns[0].replies, 1);
  } finally { await f.client.close(); }
});

test('preferência posterior prevalece sobre evento atrasado; limite de testes resiste a chamadas concorrentes', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one'));
    const engine = f.h.load('src/lib/campaigns.ts');
    await f.repo.mutateCRMState('tenant-a', state => engine.recordCampaignStop(state, '5511998765432', 'SAIR', false, new Date(Date.now() - 60000).toISOString()));
    assert.equal((await f.repo.readCRMState('tenant-a')).marketingPermissions['5511998765432'].status, 'GRANTED');
    await f.repo.mutateCRMState('tenant-a', state => engine.recordCampaignStop(state, '5511998765432', 'SAIR', false, new Date().toISOString()));
    const revoked = (await f.repo.readCRMState('tenant-a')).marketingPermissions['5511998765432'];
    await assert.rejects(() => f.service.setMarketingPermission('tenant-a', USER, { contactId: 'one', granted: true, source: 'Formulário', notes: 'Preferência antiga de teste.', confirmed: true,
      expectedRecordedAt: revoked.recordedAt, obtainedAt: new Date(Date.now() - 120000).toISOString() }), /interrupção/);
    const c = await f.create();
    const commands = Array.from({ length: 12 }, (_, i) => ({ operation: 'send-test', id: c.id, revision: 1, confirmed: true, requestId: `30000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
    const responses = await Promise.all(commands.map(command => f.post(command)));
    assert.equal(responses.filter(response => response.status === 200).length, 10);
    assert.equal(responses.filter(response => response.status === 429).length, 2);
    assert.equal((await f.recipients(c.id)).length, 10); assert.equal(f.sends.length, 0);
  } finally { await f.client.close(); }
});

test('anexos são congelados e verificados; arquivos alterados não são enviados', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one'));
    const attachment = { key: 'tenants/tenant-a/attachments/test-image.jpg', fileName: 'imovel.jpg', mimeType: 'image/jpeg', size: 100 };
    let c = await f.create(config({ attachment })); c = await f.start(c);
    assert.equal(c.payload.config.attachment.etag, 'verified-etag');
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends[0].kind, 'IMAGE'); assert.ok(f.sends[0].text.includes('Empresa A'));
    await f.consent(contact('other', { phone: '+5511998765004' }));
    const next = await f.create(config({ audience: { ...config().audience, mode: 'SELECTED', selectedIds: ['other'] }, attachment })); await f.start(next); await f.ready();
    const [row] = await f.recipients(next.id);
    await f.h.mocks['@/db'].db.update(f.schema.crmCampaignRecipients).set({ payload: { ...row.payload, attachment: { ...row.payload.attachment, etag: 'changed' } } }).where(eq(f.schema.crmCampaignRecipients.id, row.id));
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 1); assert.equal((await f.recipients(next.id))[0].status, 'SKIPPED');
    assert.equal((await f.post({ operation: 'save', config: config({ attachment: { ...attachment, key: 'tenants/tenant-b/attachments/foreign.jpg' } }) })).status, 503);
    assert.equal((await f.post({ operation: 'save', config: config({ attachment, message: 'A'.repeat(1025) }) })).status, 400);
  } finally { await f.client.close(); }
});

test('migração é repetível; verificação interrompida retoma e envio interrompido exige conferência', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.create(); await f.start(c);
    await f.client.exec(fs.readFileSync('database/04_campaigns.sql','utf8')); assert.equal((await f.recipients(c.id)).length, 1);
    const [row] = await f.recipients(c.id);
    await f.h.mocks['@/db'].db.update(f.schema.crmCampaignRecipients).set({ status: 'DISPATCHING', leaseUntil: new Date(0) }).where(eq(f.schema.crmCampaignRecipients.id,row.id));
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 0); assert.equal((await f.recipients(c.id))[0].status, 'UNKNOWN');
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 0);
  } finally { await f.client.close(); }
});

test('campanhas e automações compartilham reserva por linha e intervalos por contato', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.create(); await f.start(c);
    const auto = f.h.load('src/lib/automation-service.ts'); f.h.env.AUTOMATIONS_OUTBOUND_ENABLED = 'true';
    const rule = (await auto.changeAutomation('tenant-a', USER, { operation:'save', config: { name:'Automação fictícia', description:'', trigger:'LEAD_CREATED', inactivityHours:24, match:'ALL', conditions:[], actions:[{type:'SEND_WHATSAPP_MESSAGE',message:'Olá do teste de automação'}], schedule:config().schedule.hours } })).rule;
    await auto.changeAutomation('tenant-a',USER,{operation:'simulate',id:rule.id,revision:1}); await auto.changeAutomation('tenant-a',USER,{operation:'publish',id:rule.id,revision:1});
    await auto.writeInteractiveCRMState('tenant-a', { contacts:[contact('auto-contact',{phone:'+5511998765005'})], conversations:[{ id:'auto-conv', tenantId:'tenant-a', contactId:'auto-contact', instanceId:'instance-a' }] }, { trigger:'LEAD_CREATED', entityId:'auto-contact' });
    await f.repo.writeCRMState('tenant-a',{conversations:[{id:'auto-conv',tenantId:'tenant-a',contactId:'auto-contact',instanceId:'instance-a'}]});
    await Promise.all([auto.runAutomationWorker('tenant-a'),f.worker.runCampaignWorker('tenant-a')]);
    assert.equal(f.sends.length,1);
    await f.ready(); await Promise.all([auto.runAutomationWorker('tenant-a'),f.worker.runCampaignWorker('tenant-a')]);
    assert.equal(f.sends.length,2);
  } finally { await f.client.close(); }
});

test('cliente do provedor envia documento na rota oficial com extensão e legenda', async () => {
  let captured;
  const h = harness({ fetch: async (url, options) => { captured = { url, body: JSON.parse(options.body) }; return { ok:true, json:async()=>({messageId:'document-test'}) }; } });
  const client = new (h.load('src/lib/zapi-client.ts').ZApiClient)({instanceId:'test',instanceToken:'test',securityToken:'test'});
  const result = await client.sendDocument('5511998765432','https://example.invalid/document.pdf','imovel.pdf','Descrição do imóvel');
  assert.equal(result.success,true); assert.ok(captured.url.endsWith('/send-document/pdf')); assert.equal(captured.body.caption,'Descrição do imóvel');
});

test('anexos reais usam apenas o bucket e prefixo da imobiliária, com tamanho e versão verificados', async () => {
  const sdk = require('@aws-sdk/client-s3'); let reads = 0;
  class S3Client extends sdk.S3Client {
    constructor(options) { super({ ...options, credentials: { accessKeyId:'isolated-test-key', secretAccessKey:'isolated-test-secret' } }); }
    async send() { reads++; return { ETag:'real-version', ContentLength:100, ContentType:'application/pdf' }; }
  }
  const h = harness({ '@aws-sdk/client-s3': { ...sdk, S3Client } }, { AWS_S3_BUCKET_NAME:'isolated-test-bucket', AWS_S3_REGION:'sa-east-1' });
  const media = h.load('src/lib/campaign-media.ts');
  const attachment = { key:'tenants/tenant-a/attachments/file.pdf', fileName:'file.pdf', mimeType:'application/pdf', size:100 };
  assert.equal((await media.verifyCampaignMedia('tenant-a',attachment)).etag,'real-version');
  await assert.rejects(media.verifyCampaignMedia('tenant-b',attachment)); assert.equal(reads,1);
  await assert.rejects(media.verifyCampaignMedia('tenant-a',{...attachment,etag:'old-version'}));
  await assert.rejects(media.verifyCampaignMedia('tenant-a',{...attachment,size:200}));
  const url = new URL(await media.campaignMediaUrl('tenant-a',attachment.key));
  assert.ok(url.hostname.startsWith('isolated-test-bucket')); assert.ok(url.searchParams.get('X-Amz-Signature'));
});

const sequenceConfig = (count = 3, overrides = {}) => {
  const parts = Array.from({ length: count }, (_, index) => ({ message: `Parte ${index + 1} para {{primeiro_nome}}. Responda SAIR para interromper.` }));
  return config({ message: parts[0].message, parts, intervalSeconds: 30, ...overrides });
};
async function releaseSequenceTimer(f, row) {
  await f.h.mocks['@/db'].db.update(f.schema.crmCampaignRecipients).set({ payload: { ...row.payload, acceptedAt: new Date(Date.now() - (row.payload.intervalSeconds || 30) * 1000 - 1000).toISOString() } }).where(eq(f.schema.crmCampaignRecipients.id, row.id));
  await f.ready();
}

test('sequências aceitam de uma a cinco partes, validam todos os textos e limitam o timer', async () => {
  const engine = harness().load('src/lib/campaigns.ts');
  assert.equal(engine.campaignConfigSchema.safeParse(sequenceConfig(5)).success, true);
  assert.equal(engine.campaignConfigSchema.safeParse(sequenceConfig(6)).success, false);
  for (const intervalSeconds of [0, 14, 3601, 15.5]) assert.equal(engine.campaignConfigSchema.safeParse(sequenceConfig(2, { intervalSeconds })).success, false);
  for (const intervalSeconds of [15, 30, 3600]) assert.equal(engine.campaignConfigSchema.safeParse(sequenceConfig(2, { intervalSeconds })).success, true);
  assert.equal(engine.campaignConfigSchema.parse(config()).intervalSeconds, 30);
  const cfg = sequenceConfig(); cfg.parts[2].message = '{{senha}}'; assert.equal(engine.campaignConfigSchema.safeParse(cfg).success, false);
  cfg.parts[2].message = ''; assert.equal(engine.campaignConfigSchema.safeParse(cfg).success, false);
  assert.equal(engine.campaignConfigSchema.safeParse(sequenceConfig(2, { message: 'Cabeçalho divergente' })).success, false);
});

test('timer persistido mantém a ordem; retomadas e concorrência não repetem partes nem contam contatos em dobro', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.start(await f.create(sequenceConfig()));
    let rows = (await f.recipients(c.id)).sort((a,b) => a.payload.partIndex - b.payload.partIndex);
    assert.equal(rows.length, 3); assert.equal(rows[0].payload.sequenceId, rows[2].payload.sequenceId);
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 1); assert.match(f.sends[0].text, /^Parte 1/);
    rows = (await f.recipients(c.id)).sort((a,b) => a.payload.partIndex - b.payload.partIndex);
    assert.ok(rows[1].nextMessageAt); assert.ok(Date.parse(rows[1].nextMessageAt) > Date.now());
    const restarted = harness({ ...f.h.mocks }, f.h.env).load('src/lib/campaign-worker.ts');
    await f.ready(); await restarted.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 1, 'Um processador reiniciado e a linha livre não ignoram o timer persistido');
    let summary = (await f.service.listCampaigns('tenant-a', USER)).campaigns[0]; assert.equal(summary.counts.PENDING, 1); assert.equal(summary.messageCounts.ACCEPTED, 1);
    await f.service.recordCampaignReceipt('tenant-a','instance-a',[rows[0].externalId],'READ');
    await releaseSequenceTimer(f, (await f.recipients(c.id)).find(row => row.payload.partIndex === 0));
    await Promise.all([f.worker.runCampaignWorker('tenant-a'),f.worker.runCampaignWorker('tenant-a')]); assert.equal(f.sends.length, 2); assert.match(f.sends[1].text, /^Parte 2/);
    rows = (await f.recipients(c.id)).sort((a,b) => a.payload.partIndex - b.payload.partIndex);
    await releaseSequenceTimer(f, rows[1]); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 3); assert.match(f.sends[2].text, /^Parte 3/);
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length, 3);
    summary = (await f.service.listCampaigns('tenant-a', USER)).campaigns[0]; assert.equal(summary.counts.ACCEPTED, 1); assert.equal(summary.status, 'COMPLETED');
    const snapshot = await f.repo.readCRMState('tenant-a'); assert.equal(snapshot.messages.filter(message => message.campaignId === c.id).length, 3);
    rows = await f.recipients(c.id);
    for (const row of rows) await f.service.recordCampaignReceipt('tenant-a','instance-a',[row.externalId],'READ');
    summary = (await f.service.listCampaigns('tenant-a', USER)).campaigns[0]; assert.equal(summary.counts.READ, 1); assert.equal(summary.messageCounts.READ, 3);
    await f.service.recordCampaignReply('tenant-a','instance-a',rows[0].phone,new Date().toISOString());
    await f.service.recordCampaignReply('tenant-a','instance-a',rows[0].phone,new Date(Date.now()+1000).toISOString());
    assert.equal((await f.service.listCampaigns('tenant-a',USER)).campaigns[0].replies,1);
  } finally { await f.client.close(); }
});

test('falha ou resultado incerto em uma parte impede as próximas; não há repetição automática', async () => {
  for (const mode of ['timeout','failed']) {
    const f = await fixture();
    try {
      await f.consent(contact('one')); const c = await f.start(await f.create(sequenceConfig()));
      if (mode === 'timeout') f.mode('timeout');
      else f.duringSend(id => f.service.recordCampaignReceipt('tenant-a','instance-a',[id],'FAILED'));
      await f.worker.runCampaignWorker('tenant-a'); await f.ready(); await f.worker.runCampaignWorker('tenant-a');
      const rows = await f.recipients(c.id); assert.equal(f.sends.length, 1); assert.equal(rows.filter(row => row.status === 'SKIPPED').length, 2);
      assert.equal(rows.find(row => row.payload.partIndex === 0).status, mode === 'timeout' ? 'UNKNOWN' : 'FAILED');
    } finally { await f.client.close(); }
  }
});

test('resposta entre as partes interrompe a sequência sem desfazer a primeira mensagem', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); const c = await f.start(await f.create(sequenceConfig()));
    await f.worker.runCampaignWorker('tenant-a');
    await f.repo.mutateCRMState('tenant-a', state => ({ ...state, contacts: state.contacts.map(item => ({ ...item, lastClientInteractionAt: new Date(Date.now()+1000).toISOString() })) }));
    await releaseSequenceTimer(f, (await f.recipients(c.id)).find(row => row.payload.partIndex === 0));
    await f.worker.runCampaignWorker('tenant-a'); await f.worker.runCampaignWorker('tenant-a');
    const rows = await f.recipients(c.id); assert.equal(f.sends.length, 1); assert.equal(rows.filter(row => row.status === 'ACCEPTED').length, 1); assert.equal(rows.filter(row => row.status === 'SKIPPED').length, 2);
  } finally { await f.client.close(); }
});

test('pausa preserva o timer, cancelamento afeta apenas partes pendentes e testes respeitam o mesmo intervalo', async () => {
  const f = await fixture();
  try {
    await f.consent(contact('one')); let c = await f.start(await f.create(sequenceConfig(2)));
    await f.worker.runCampaignWorker('tenant-a');
    let response = await f.post({ operation:'pause',id:c.id,revision:c.payload.revision }); c = (await response.json()).campaign;
    await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length,1);
    response = await f.post({ operation:'resume',id:c.id,revision:c.payload.revision }); c = (await response.json()).campaign;
    await f.ready(); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length,1);
    await f.post({ operation:'cancel',id:c.id,revision:c.payload.revision });
    const rows=await f.recipients(c.id); assert.equal(rows.filter(row=>row.status==='ACCEPTED').length,1); assert.equal(rows.filter(row=>row.status==='CANCELLED').length,1);
    c=await f.create(sequenceConfig(2)); const command={operation:'send-test',id:c.id,revision:1,confirmed:true,requestId:'40000000-0000-4000-8000-000000000001'};
    await Promise.all([f.post(command),f.post(command)]); assert.equal((await f.recipients(c.id)).length,2);
    await f.ready(); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length,2);
    await f.ready(); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length,2);
    await releaseSequenceTimer(f,(await f.recipients(c.id)).find(row=>row.payload.partIndex===0)); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length,3);
    assert.equal(f.sends[1].phone, '5511987654321'); assert.equal(f.sends[2].phone, '5511987654321');
  } finally { await f.client.close(); }
});

test('cada parte congela seu anexo; personalização e autorização são revistas para a sequência inteira', async () => {
  const f=await fixture();
  try {
    await f.consent(contact('one'));
    const attachment={key:'tenants/tenant-a/attachments/sequence.jpg',fileName:'imovel.jpg',mimeType:'image/jpeg',size:100};
    let cfg=sequenceConfig(2); cfg.parts[1].attachment=attachment;
    let c=await f.create(cfg); c=await f.start(c);
    await f.worker.runCampaignWorker('tenant-a'); await releaseSequenceTimer(f,(await f.recipients(c.id)).find(row=>row.payload.partIndex===0)); await f.worker.runCampaignWorker('tenant-a');
    assert.deepEqual(f.sends.map(send=>send.kind),['TEXT','IMAGE']); assert.match(f.sends[1].text,/Parte 2/);
    cfg=sequenceConfig(2); cfg.parts[1].message='A'.repeat(1025); cfg.parts[1].attachment=attachment;
    assert.equal((await f.post({operation:'save',config:cfg})).status,400);
    await f.client.exec(fs.readFileSync('database/05_campaign_sequences.sql','utf8')); await f.client.exec(fs.readFileSync('database/05_campaign_sequences.sql','utf8'));
    assert.equal((await f.recipients(c.id)).length,2);
  }finally{await f.client.close();}
});

test('alterar uma parte ou o timer exige nova simulação; revogação entre partes interrompe sem liberar outra campanha', async () => {
  const f=await fixture();
  try {
    await f.consent(contact('one')); let cfg=sequenceConfig(2); let c=await f.create(cfg);
    await f.post({operation:'simulate',id:c.id,revision:1});
    cfg={...cfg,intervalSeconds:60,parts:[cfg.parts[0],{message:'Nova segunda mensagem'}]};
    let response=await f.post({operation:'save',id:c.id,revision:1,config:cfg}); c=(await response.json()).campaign;
    assert.equal((await f.post({operation:'start',id:c.id,revision:c.payload.revision,confirmed:true,confirmedCount:1})).status,409);
    c=await f.start(c); await f.worker.runCampaignWorker('tenant-a'); assert.equal(f.sends.length,1);
    const other=await f.create(sequenceConfig(2)); const preview=await f.service.previewCampaign('tenant-a',other.payload.config); assert.equal(preview.audience.eligible,0);
    const engine=f.h.load('src/lib/campaigns.ts'); await f.repo.mutateCRMState('tenant-a',state=>engine.recordCampaignStop(state,'5511998765432','SAIR',false,new Date().toISOString()));
    await releaseSequenceTimer(f,(await f.recipients(c.id)).find(row=>row.payload.partIndex===0)); await f.worker.runCampaignWorker('tenant-a');
    assert.equal(f.sends.length,1); assert.equal((await f.recipients(c.id)).find(row=>row.payload.partIndex===1).status,'SKIPPED');
  }finally{await f.client.close();}
});

test('vídeos MP4 têm limite próprio, nome coerente e legenda validada', () => {
  const engine=harness().load('src/lib/campaigns.ts');
  assert.equal(engine.campaignConfigSchema.safeParse(sequenceConfig(2,{parts:[]})).success,false);
  const video={key:'tenants/tenant-a/attachments/tour.mp4',fileName:'tour.mp4',mimeType:'video/mp4',size:25*1024*1024};
  assert.equal(engine.campaignAttachmentSchema.safeParse(video).success,true);
  assert.equal(engine.campaignAttachmentSchema.safeParse({...video,size:video.size+1}).success,false);
  assert.equal(engine.campaignAttachmentSchema.safeParse({...video,mimeType:'image/jpeg',fileName:'image.jpg'}).success,false);
  assert.equal(engine.campaignAttachmentSchema.safeParse({...video,mimeType:'application/pdf',fileName:'file.pdf'}).success,false);
  assert.equal(engine.campaignAttachmentSchema.safeParse({...video,fileName:'tour.mov'}).success,false);
  assert.equal(engine.campaignAttachmentSchema.safeParse({...video,mimeType:'video/webm',fileName:'tour.webm'}).success,false);
  const cfg=sequenceConfig(2);cfg.parts[1]={message:'Legenda',attachment:video};
  assert.equal(engine.campaignConfigSchema.safeParse(cfg).success,true);
  cfg.parts[1].message='';assert.equal(engine.campaignConfigSchema.safeParse(cfg).success,true);
  assert.equal(engine.campaignConfigSchema.safeParse(config({message:'',attachment:video})).success,true);
  cfg.parts[1].message='A'.repeat(1025);assert.equal(engine.campaignConfigSchema.safeParse(cfg).success,false);
});

test('cliente envia vídeo na rota oficial com legenda e aceite assíncrono, sem confundir aceite e entrega', async () => {
  let captured;const h=harness({fetch:async(url,options)=>{captured={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({messageId:'video-test'})};}});
  const client=new(h.load('src/lib/zapi-client.ts').ZApiClient)({instanceId:'test',instanceToken:'test',securityToken:'test'});
  const result=await client.sendVideo('+55 (11) 99876-5432','https://example.invalid/tour.mp4','Conheça o imóvel');
  assert.equal(result.externalMessageId,'video-test');assert.ok(captured.url.endsWith('/send-video'));
  assert.deepEqual(captured.body,{phone:'5511998765432',video:'https://example.invalid/tour.mp4',caption:'Conheça o imóvel',viewOnce:false,async:true});
});

test('vídeo integra a sequência, respeita o timer e é salvo como VIDEO no histórico', async () => {
  const f=await fixture();
  try {
    await f.consent(contact('one'));const cfg=sequenceConfig(2);
    cfg.parts[1].attachment={key:'tenants/tenant-a/attachments/tour.mp4',fileName:'tour.mp4',mimeType:'video/mp4',size:20*1024*1024};
    cfg.parts[1].message='';
    const c=await f.start(await f.create(cfg));await f.worker.runCampaignWorker('tenant-a');assert.equal(f.sends.length,1);
    await f.ready();await f.worker.runCampaignWorker('tenant-a');assert.equal(f.sends.length,1);
    await releaseSequenceTimer(f,(await f.recipients(c.id))[0]);await f.worker.runCampaignWorker('tenant-a');
    assert.deepEqual(f.sends.map(send=>send.kind),['TEXT','VIDEO']);assert.equal(f.sends[1].text,'');
    const message=(await f.repo.readCRMState('tenant-a')).messages.find(message=>message.messageType==='VIDEO');
    assert.equal(message.campaignId,c.id);assert.equal(message.status,'SENT');assert.equal(message.attachments[0].mimeType,'video/mp4');
    const row=(await f.recipients(c.id)).find(row=>row.payload.partIndex===1);assert.equal(row.status,'ACCEPTED');
    await f.service.recordCampaignReceipt('tenant-a','instance-a',[row.externalId],'DELIVERED');assert.equal((await f.recipients(c.id)).find(row=>row.payload.partIndex===1).status,'DELIVERED');
  }finally{await f.client.close();}
});

test('validação de armazenamento confere tamanho, MIME e versão de vídeos antes de gerar o envio', async () => {
  const sdk=require('@aws-sdk/client-s3');let metadata={ETag:'video-version',ContentLength:20*1024*1024,ContentType:'video/mp4'};
  class S3Client extends sdk.S3Client {constructor(options){super({...options,credentials:{accessKeyId:'test',secretAccessKey:'test'}});}async send(){return metadata;}}
  const media=harness({'@aws-sdk/client-s3':{...sdk,S3Client}},{AWS_S3_BUCKET_NAME:'isolated-test-bucket'}).load('src/lib/campaign-media.ts');
  const attachment={key:'tenants/tenant-a/attachments/tour.mp4',fileName:'tour.mp4',mimeType:'video/mp4',size:20*1024*1024};
  assert.equal((await media.verifyCampaignMedia('tenant-a',attachment)).etag,'video-version');
  metadata={...metadata,ContentType:'application/pdf'};await assert.rejects(media.verifyCampaignMedia('tenant-a',attachment));
  metadata={...metadata,ContentType:'video/mp4',ContentLength:100};await assert.rejects(media.verifyCampaignMedia('tenant-a',attachment));
  metadata={...metadata,ContentLength:attachment.size,ETag:'changed'};await assert.rejects(media.verifyCampaignMedia('tenant-a',{...attachment,etag:'video-version'}));
  await assert.rejects(media.verifyCampaignMedia('tenant-b',attachment));
});
