const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('./harness.cjs');
const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const config = (overrides = {}) => ({ name: 'Receber interessados', description: '', trigger: 'LEAD_CREATED', inactivityHours: 24, match: 'ALL', conditions: [],
  actions: [{ type: 'CREATE_TASK', title: 'Atender cliente', dueHours: 2, assignee: USER }, { type: 'ADD_TAG', tag: 'Atendimento iniciado' }],
  schedule: { onlyBusinessHours: false, timezone: 'America/Sao_Paulo', start: '08:00', end: '18:00', workDays: [1, 2, 3, 4, 5] }, ...overrides });
const contact = (id, overrides = {}) => ({ id, tenantId: 'tenant-a', name: 'Cliente fictício', phone: '+5511998765432', source: 'WHATSAPP', temperature: 'HOT', tags: [], assignedUserId: USER,
  consentGiven: true, hasOptedOut: false, targetRegions: [], notesCount: 0, aiPriorityScore: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides });
async function fixture() {
  const client = new PGlite();
  await client.exec(fs.readFileSync('database/03_durable_crm_state.sql', 'utf8'));
  await client.exec(`CREATE TABLE tenants (id uuid PRIMARY KEY, name text, slug text, status text);
    CREATE TABLE users (id uuid PRIMARY KEY, full_name text, is_active boolean);
    CREATE TABLE memberships (tenant_id uuid, user_id uuid, role text, is_active boolean);
    INSERT INTO tenants VALUES ('10000000-0000-4000-8000-000000000001','Empresa A','a','ACTIVE'), ('10000000-0000-4000-8000-000000000002','Empresa B','b','ACTIVE');
    INSERT INTO users VALUES ('${USER}','Gestor A',true), ('${OTHER}','Gestor B',true);
    INSERT INTO memberships VALUES ('10000000-0000-4000-8000-000000000001','${USER}','MANAGER',true), ('10000000-0000-4000-8000-000000000002','${OTHER}','MANAGER',true);`);
  const sends = []; let sendMode = 'ok'; let connected = true;
  const mocks = { '@/lib/zapi-client': { ZApiClient: class {
    async getStatus() { return { success: true, data: { connected } }; }
    async sendText(phone, text) { sends.push({ phone, text }); if (sendMode === 'timeout') throw new Error('timeout after dispatch'); return { success: true, externalMessageId: `external-${sends.length}` }; }
  } }, '@/lib/db/zapi-credentials-service': { ZapiCredentialsService: { resolveWebhookTenant: async () => 'tenant-a', resolveCredentials: async () => ({ instanceId: 'instance-a', instanceToken: 'test-only', securityToken: 'test-only' }) } } };
  const h = harness(mocks, { DATABASE_URL: 'test-only', AUTOMATIONS_CRON_SECRET: 'test-only-cron-secret-with-more-than-32-characters', AUTOMATIONS_OUTBOUND_ENABLED: 'true' });
  h.mocks['@/db'].db = drizzle(client, { schema: h.load('src/db/schema.ts') });
  const service = h.load('src/lib/automation-service.ts');
  const repo = h.load('src/lib/crm-repository.ts');
  const route = h.load('src/app/api/v1/automations/route.ts');
  const headers = (role = 'MANAGER', tenantId = 'tenant-a', extra = {}) => ({ authorization: `Bearer ${h.load('src/lib/api-auth.ts').signSessionPayload({ userId: USER, userEmail: 'test@example.invalid', userName: 'Teste', role, tenantId, ...extra })}` });
  const post = async (body, customHeaders = headers()) => route.POST(h.request('/api/v1/automations', body, customHeaders));
  const create = async (cfg = config()) => (await (await post({ operation: 'save', config: cfg })).json()).rule;
  const publish = async rule => { assert.equal((await post({ operation: 'simulate', id: rule.id, revision: rule.revision })).status, 200); assert.equal((await post({ operation: 'publish', id: rule.id, revision: rule.revision })).status, 200); };
  return { h, client, repo, service, route, post, create, publish, headers, sends, mode: value => { sendMode = value; }, connected: value => { connected = value; } };
}

test('critérios, variáveis e horários têm validação e linguagem consistente', () => {
  const engine = harness().load('src/lib/automations.ts');
  assert.equal(engine.ruleConfigSchema.safeParse(config()).success, true);
  assert.equal(engine.ruleConfigSchema.safeParse(config({ actions: [{ type: 'PREPARE_MESSAGE', assignee: USER, message: 'Olá {{senha}}' }] })).success, false);
  assert.equal(engine.ruleConfigSchema.safeParse(config({ actions: [{ type: 'CREATE_TASK', title: '', dueHours: -1, assignee: USER }] })).success, false);
  assert.equal(engine.ruleConfigSchema.safeParse(config({ schedule: { ...config().schedule, start: '25:00' } })).success, false);
  const conditions = [{ field: 'source', operator: 'EQUALS', value: 'MANUAL' }, { field: 'temperature', operator: 'EQUALS', value: 'HOT' }];
  assert.equal(engine.matchesRule(config({ conditions }), contact('c')).matches, false);
  assert.equal(engine.matchesRule(config({ conditions, match: 'ANY' }), contact('c')).matches, true);
  assert.equal(engine.matchesRule(config(), contact('c', { isPersonal: true })).matches, false);
  assert.equal(engine.matchesRule(config(), contact('c', { hasOptedOut: true })).matches, false);
  assert.equal(engine.renderAutomationMessage('Olá {{primeiro_nome}}, {{empresa}}', 'Marina Exemplo', 'Empresa A'), 'Olá Marina, Empresa A');
  const scheduled = config({ schedule: { ...config().schedule, onlyBusinessHours: true } });
  assert.equal(engine.isBusinessTime(scheduled, new Date('2026-10-30T12:00:00Z')), true);
  assert.equal(engine.isBusinessTime(scheduled, new Date('2026-10-31T12:00:00Z')), false);
});

test('regras: autorização, rascunho durável, teste sem efeitos, ativação e conflito de edição', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post({ operation: 'save', config: config() }, {})).status, 401);
    assert.equal((await f.post({ operation: 'save', config: config() }, f.headers('BROKER'))).status, 403);
    assert.equal((await f.post({ operation: 'save', config: config() }, f.headers('SUPERADMIN', 'tenant-a', { source: 'CHROME_EXTENSION' }))).status, 403);
    assert.equal((await f.post({ operation: 'save', config: config() }, { ...f.headers(), 'x-tenant-id': 'tenant-b' })).status, 403);
    const rule = await f.create(); assert.ok(rule); assert.equal(rule.status, 'DRAFT');
    assert.equal((await f.post({ operation: 'publish', id: rule.id, revision: rule.revision })).status, 409);
    await f.publish(rule);
    let state = await f.repo.readCRMState('tenant-a');
    assert.equal(state.tasks?.length || 0, 0); assert.equal(state.messages.length, 0); assert.equal(state.automation.jobs.length, 0);
    const restarted = harness({}, { DATABASE_URL: 'test-only' }); restarted.mocks['@/db'].db = f.h.mocks['@/db'].db;
    assert.equal((await restarted.load('src/lib/crm-repository.ts').readCRMState('tenant-a')).automation.rules[0].status, 'ACTIVE');
    const results = await Promise.all(['Primeira edição', 'Outra edição'].map(name => f.post({ operation: 'save', id: rule.id, revision: 1, config: config({ name }) })));
    assert.equal(results.filter(response => response.status === 200).length, 1);
    assert.equal(results.filter(response => response.status === 409).length, 1);
    state = await f.repo.readCRMState('tenant-a'); assert.equal(state.automation.rules[0].published.name, config().name);
    assert.equal((await f.repo.readCRMState('tenant-b')).automation, undefined);
    assert.equal((await f.post({ operation: 'save', config: config({ actions: [{ type: 'CREATE_TASK', title: 'Inválido', dueHours: 1, assignee: OTHER }] }) })).status, 400);
  } finally { await f.client.close(); }
});

test('eventos reais executam uma vez; conciliação, histórico, pessoais e opt-out não disparam', async () => {
  const f = await fixture();
  try {
    const rule = await f.create(); await f.publish(rule);
    const c = contact('live');
    await Promise.all(Array.from({ length: 4 }, () => f.service.writeInteractiveCRMState('tenant-a', { contacts: [c] }, { trigger: 'LEAD_CREATED', entityId: c.id })));
    let state = await f.repo.readCRMState('tenant-a');
    assert.equal(state.tasks.length, 1); assert.equal(state.automation.jobs.length, 2);
    assert.ok(state.contacts[0].tags.includes('Atendimento iniciado'));
    assert.ok(Date.parse(state.tasks[0].dueDate) > Date.now() + 3600_000);
    await f.repo.writeCRMState('tenant-a', { contacts: [contact('imported')] });
    for (const c of [contact('personal', { isPersonal: true }), contact('optout', { hasOptedOut: true }), contact('old', { createdAt: '2020-01-01T00:00:00Z' })]) {
      await f.service.writeInteractiveCRMState('tenant-a', { contacts: [c] }, { trigger: 'LEAD_CREATED', entityId: c.id });
    }
    state = await f.repo.readCRMState('tenant-a'); assert.equal(state.tasks.length, 1); assert.equal(f.sends.length, 0);
    // Bulk state writes cannot replace the administrative automation document.
    const crm = f.h.load('src/app/api/v1/crm/state/route.ts');
    assert.equal((await crm.POST(f.h.request('/api/v1/crm/state', { automation: { rules: [] } }, f.headers()))).status, 400);
    assert.equal((await f.post({ operation: 'pause', id: rule.id, revision: rule.revision })).status, 200);
    await f.service.writeInteractiveCRMState('tenant-a', { contacts: [contact('after-pause')] }, { trigger: 'LEAD_CREATED', entityId: 'after-pause' });
    assert.equal((await f.repo.readCRMState('tenant-a')).tasks.length, 1);
  } finally { await f.client.close(); }
});

test('webhook aciona regras sem navegador, reentrega não duplica e mensagens antigas/enviadas não acionam', async () => {
  const f = await fixture();
  try {
    const rule = await f.create(config({ trigger: 'MESSAGE_RECEIVED', actions: [{ type: 'ADD_TAG', tag: 'Mensagem nova' }] })); await f.publish(rule);
    const handler = f.h.load('src/lib/zapi-webhook-handler.ts').processZapiWebhookRequest;
    const token = f.h.load('src/lib/zapi-webhook-auth.ts').webhookToken('instance-a');
    const post = (id, time, fromMe = false) => handler(f.h.request(`/webhook?token=${token}`, { instanceId: 'instance-a', messageId: id, phone: '5511998765432', text: { message: `Teste ${id}` }, momment: time, fromMe }));
    assert.equal((await post('old', Date.parse('2020-01-01T00:00:00Z'))).status, 200);
    assert.equal((await f.repo.readCRMState('tenant-a')).automation.jobs.length, 0);
    assert.equal((await post('out', Date.now(), true)).status, 200);
    assert.equal((await f.repo.readCRMState('tenant-a')).automation.jobs.length, 0);
    assert.equal((await post('incoming', Date.now())).status, 200);
    assert.equal((await post('incoming', Date.now())).status, 200);
    const state = await f.repo.readCRMState('tenant-a');
    assert.equal(state.automation.jobs.length, 1); assert.equal(state.automation.jobs[0].status, 'DONE');
    assert.ok(state.contacts[0].tags.includes('Mensagem nova'));
  } finally { await f.client.close(); }
});

test('fila: conexão indisponível aguarda, envio aceito não vira entregue e timeout nunca é repetido', async () => {
  const f = await fixture();
  try {
    await f.service.runAutomationWorker('tenant-a');
    const rule = await f.create(config({ actions: [{ type: 'SEND_WHATSAPP_MESSAGE', message: 'Olá {{nome}} da {{empresa}}' }] })); await f.publish(rule);
    const add = async id => { await f.repo.writeCRMState('tenant-a', { conversations: [{ id: `conv-${id}`, tenantId: 'tenant-a', contactId: id, instanceId: 'instance-a' }] }); await f.service.writeInteractiveCRMState('tenant-a', { contacts: [contact(id)] }, { trigger: 'LEAD_CREATED', entityId: id }); };
    await add('one'); f.connected(false); await f.service.runAutomationWorker('tenant-a');
    assert.equal((await f.repo.readCRMState('tenant-a')).automation.jobs[0].status, 'WAITING_CHANNEL'); assert.equal(f.sends.length, 0);
    f.connected(true); await f.repo.mutateCRMState('tenant-a', state => { state.automation.jobs[0].updatedAt = '2020-01-01T00:00:00Z'; return state; });
    await Promise.all([f.service.runAutomationWorker('tenant-a'), f.service.runAutomationWorker('tenant-a')]);
    let state = await f.repo.readCRMState('tenant-a'); assert.equal(f.sends.length, 1); assert.equal(state.messages[0].status, 'SENT'); assert.equal(state.automation.jobs[0].status, 'ACCEPTED');
    await add('uncertain'); f.mode('timeout'); await f.service.runAutomationWorker('tenant-a'); await f.service.runAutomationWorker('tenant-a');
    state = await f.repo.readCRMState('tenant-a'); assert.equal(state.automation.jobs[1].status, 'UNKNOWN'); assert.equal(f.sends.length, 2);
    await add('replied'); await f.repo.writeCRMState('tenant-a', { contacts: [contact('replied', { lastClientInteractionAt: new Date(Date.now() + 5000).toISOString() })] });
    await f.service.runAutomationWorker('tenant-a'); assert.equal(f.sends.length, 2); assert.equal((await f.repo.readCRMState('tenant-a')).automation.jobs[2].status, 'SKIPPED');
  } finally { await f.client.close(); }
});

test('inatividade: somente contatos acompanhados após ativação; pausa cancela pendências', async () => {
  const engine = harness().load('src/lib/automations.ts');
  const now = new Date('2026-10-31T12:00:00Z'); const since = '2026-10-30T10:00:00Z';
  const cfg = config({ trigger: 'LEAD_INACTIVE', inactivityHours: 2 });
  const state = { contacts: [contact('tracked'), contact('imported'), contact('before-activation')], deals: [], conversations: [], messages: [], automation: {
    rules: [{ id: 'r', status: 'ACTIVE', revision: 1, publishedRevision: 1, publishedAt: '2026-10-29T10:00:00Z', draft: cfg, published: cfg }], jobs: [], audit: [], enrolled: { tracked: since, 'before-activation': '2026-10-28T10:00:00Z' } } };
  engine.queueInactivity(state, now); engine.queueInactivity(state, now);
  assert.equal(state.automation.jobs.length, 2); assert.ok(state.automation.jobs.every(job => job.event.contactId === 'tracked'));
  engine.runInternalJobs(state, 'Empresa A', [USER], now); assert.equal(state.tasks.length, 1);
  const f = await fixture();
  try {
    await f.service.runAutomationWorker('tenant-a');
    const rule = await f.create(config({ actions: [{ type: 'SEND_WHATSAPP_MESSAGE', message: 'Olá' }] })); await f.publish(rule);
    await f.service.writeInteractiveCRMState('tenant-a', { contacts: [contact('queued')] }, { trigger: 'LEAD_CREATED', entityId: 'queued' });
    await f.post({ operation: 'pause', id: rule.id, revision: rule.revision });
    assert.equal((await f.repo.readCRMState('tenant-a')).automation.jobs[0].status, 'SKIPPED');
    await f.service.runAutomationWorker('tenant-a'); assert.equal(f.sends.length, 0);
  } finally { await f.client.close(); }
});

test('agendador exige segredo próprio e recusa sessão comum', async () => {
  const h = harness({ '@/lib/automation-service': { automationTenantIds: async () => [], runAutomationWorker: async () => {} } }, { AUTOMATIONS_CRON_SECRET: 'test-cron-with-at-least-thirty-two-characters' });
  const route = h.load('src/app/api/internal/automations/run/route.ts');
  assert.equal((await route.POST(h.request('/api/internal/automations/run', {}))).status, 401);
  assert.equal((await route.POST(h.request('/api/internal/automations/run', {}, { authorization: 'Bearer test-cron-with-at-least-thirty-two-characters' }))).status, 200);
});

module.exports = { fixture, config, contact, USER, OTHER };

test('configuração comercial: persistência, referências em uso, concorrência e isolamento', async () => {
  const f = await fixture();
  try {
    const route = f.h.load('src/app/api/v1/commercial/route.ts');
    const send = (body, headers = f.headers()) => route.POST(f.h.request('/api/v1/commercial', body, headers));
    const stage = { id: 'stage-one', pipelineId: 'pipeline-one', name: 'Novo interessado', order: 1, slaHours: 2, colorHex: '#6366f1' };
    const seed = { pipelines: [{ id: 'pipeline-one', tenantId: 'tenant-a', name: 'Vendas', isDefault: true, stages: [stage] }], lossReasons: [], leadSources: [], leadSourceGroups: [] };
    assert.equal((await send({ collection: 'leadSourceGroups', operation: 'save', revision: 0, seed, data: { name: 'Digital', isActive: true } }, f.headers('BROKER'))).status, 403);
    let response = await send({ collection: 'leadSourceGroups', operation: 'save', revision: 0, seed, data: { name: 'Digital', isActive: true } });
    assert.equal(response.status, 200); let cfg = (await response.json()).commercial; assert.equal(cfg.revision, 1);
    const group = cfg.leadSourceGroups[0];
    response = await send({ collection: 'leadSources', operation: 'save', revision: 1, data: { name: 'Campanha de exemplo', isActive: true, groupId: group.id } });
    assert.equal(response.status, 200); cfg = (await response.json()).commercial;
    assert.equal((await send({ collection: 'leadSourceGroups', operation: 'delete', revision: 2, id: group.id })).status, 400);
    assert.equal((await send({ collection: 'leadSources', operation: 'save', revision: 1, id: cfg.leadSources[0].id, data: { name: 'Edição antiga' } })).status, 409);
    await f.repo.writeCRMState('tenant-a', { contacts: [contact('deal-contact')], deals: [{ id: 'deal', tenantId: 'tenant-a', contactId: 'deal-contact', pipelineId: 'pipeline-one', stageId: 'stage-one', status: 'OPEN' }] });
    assert.equal((await send({ collection: 'pipelines', operation: 'save', revision: 2, id: 'pipeline-one', data: { stages: [{ ...stage, id: 'replacement' }] } })).status, 400);
    assert.equal((await f.repo.readCRMState('tenant-a')).commercial.pipelines[0].stages[0].id, 'stage-one');
    const rule = await f.create(config({ conditions: [{ field: 'stageId', operator: 'EQUALS', value: 'stage-one' }] }));
    await f.repo.mutateCRMState('tenant-a', state => ({ ...state, deals: [] }));
    assert.equal((await send({ collection: 'pipelines', operation: 'save', revision: 2, id: 'pipeline-one', data: { stages: [{ ...stage, id: 'replacement' }] } })).status, 400);
    assert.equal((await f.repo.readCRMState('tenant-b')).commercial, undefined);
    assert.equal((await send({ collection: 'leadSourceGroups', operation: 'save', revision: 0, seed, data: { name: 'Foreign', isActive: true } }, { ...f.headers('SUPERADMIN'), 'x-tenant-id': 'tenant-b' })).status, 403);
  } finally { await f.client.close(); }
});

test('modelos e tarefas confirmam banco, preservam revisões e recusam responsável de outro ambiente', async () => {
  const f = await fixture();
  try {
    const templates = f.h.load('src/app/api/v1/message-templates/route.ts');
    const send = body => templates.POST(f.h.request('/api/v1/message-templates', body, f.headers()));
    const data = { title: 'Boas-vindas', shortcut: '/ola', category: 'GREETING', content: 'Olá {{nome}}!', isActive: true };
    let response = await send({ operation: 'save', data }); assert.equal(response.status, 200);
    let saved = (await response.json()).quickReplies[0];
    response = await send({ operation: 'save', id: saved.id, updatedAt: saved.updatedAt, data: { content: 'Mensagem editada' } }); assert.equal(response.status, 200);
    assert.equal((await send({ operation: 'save', id: saved.id, updatedAt: 'old-version', data: { content: 'Outra edição' } })).status, 409);
    saved = (await response.json()).quickReplies[0];
    assert.equal((await send({ operation: 'delete', id: saved.id, updatedAt: saved.updatedAt })).status, 200);
    assert.equal((await f.repo.readCRMState('tenant-a')).quickReplies.length, 0);
    await f.repo.writeCRMState('tenant-a', { contacts: [contact('task-contact')] });
    const tasks = f.h.load('src/app/api/v1/tasks/route.ts');
    const taskSend = body => tasks.POST(f.h.request('/api/v1/tasks', body, f.headers()));
    const taskData = { contactId: 'task-contact', assignedUserId: USER, title: 'Conferir mensagem', description: 'Texto preparado', taskType: 'WHATSAPP', dueDate: new Date().toISOString(), priority: 'MEDIUM' };
    assert.equal((await taskSend({ operation: 'create', data: { ...taskData, assignedUserId: OTHER } })).status, 400);
    response = await taskSend({ operation: 'create', data: taskData }); assert.equal(response.status, 200);
    const task = (await response.json()).tasks[0];
    assert.equal((await taskSend({ operation: 'update', id: task.id, data: { isCompleted: true } })).status, 200);
    assert.equal((await f.repo.readCRMState('tenant-a')).tasks[0].isCompleted, true);
    assert.equal((await taskSend({ operation: 'delete', id: task.id })).status, 200);
    assert.equal((await f.repo.readCRMState('tenant-a')).tasks.length, 0);
    assert.equal((await f.repo.readCRMState('tenant-b')).tasks, undefined);
  } finally { await f.client.close(); }
});

test('mudança de etapa aciona uma vez e gravação obsoleta não desfaz etiqueta da automação', async () => {
  const f = await fixture();
  try {
    const rule = await f.create(config({ trigger: 'STAGE_CHANGED', conditions: [{ field: 'stageId', operator: 'EQUALS', value: 'qualified' }] })); await f.publish(rule);
    const c = contact('stage-contact');
    const deal = { id: 'transition-deal', tenantId: 'tenant-a', contactId: c.id, pipelineId: 'sales', stageId: 'new', status: 'OPEN', updatedAt: c.updatedAt };
    await f.repo.writeCRMState('tenant-a', { contacts: [c], deals: [deal] });
    const patch = { deals: [{ ...deal, stageId: 'qualified' }] };
    await Promise.all([1, 2, 3].map(() => f.service.writeInteractiveCRMState('tenant-a', patch, { trigger: 'STAGE_CHANGED', entityId: deal.id })));
    let state = await f.repo.readCRMState('tenant-a'); assert.equal(state.tasks.length, 1); assert.equal(state.automation.jobs.length, 2);
    await f.repo.writeCRMState('tenant-a', { contacts: [{ ...c, updatedAt: '2020-01-01T00:00:00Z' }] });
    state = await f.repo.readCRMState('tenant-a'); assert.ok(state.contacts[0].tags.includes('Atendimento iniciado'));
    assert.equal((await f.post({ operation: 'publish', id: rule.id, revision: rule.revision })).status, 409);
  } finally { await f.client.close(); }
});

test('falha do executor não interrompe recebimento; ações aguardam sem confirmação falsa', async () => {
  const f = await fixture();
  try {
    const rule = await f.create(config({ trigger: 'MESSAGE_RECEIVED', actions: [{ type: 'ADD_TAG', tag: 'Atender' }] })); await f.publish(rule);
    await f.client.exec('DROP TABLE memberships');
    const handler = f.h.load('src/lib/zapi-webhook-handler.ts').processZapiWebhookRequest;
    const token = f.h.load('src/lib/zapi-webhook-auth.ts').webhookToken('instance-a');
    const response = await handler(f.h.request(`/webhook?token=${token}`, { instanceId: 'instance-a', messageId: 'preserved', phone: '5511998765432', text: { message: 'Mensagem preservada' }, momment: Date.now(), fromMe: false }));
    assert.equal(response.status, 200);
    const state = await f.repo.readCRMState('tenant-a'); assert.equal(state.messages.length, 1); assert.equal(state.automation.jobs[0].status, 'QUEUED'); assert.equal(state.contacts[0].tags.includes('Atender'), false);
  } finally { await f.client.close(); }
});
