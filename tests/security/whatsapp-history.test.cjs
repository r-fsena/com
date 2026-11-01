const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('./harness.cjs');

const broker = { userId: 'broker-a', userEmail: 'broker@example.invalid', userName: 'Broker', role: 'BROKER', tenantId: 'tenant-a', isSuperAdmin: false };

test('histórico sem navegador: commit, reentrega, concorrência, ordem, status e retomada por cursor', async () => {
  const client = new PGlite();
  try {
    await client.exec(fs.readFileSync('database/03_durable_crm_state.sql', 'utf8'));
    const overrides = { '@/lib/db/zapi-credentials-service': { ZapiCredentialsService: { resolveWebhookTenant: async () => 'tenant-a' } } };
    const h = harness(overrides, { DATABASE_URL: 'test-only' });
    h.mocks['@/db'].db = drizzle(client, { schema: h.load('src/db/schema.ts') });
    const repo = h.load('src/lib/crm-repository.ts');
    const handler = h.load('src/lib/zapi-webhook-handler.ts').processZapiWebhookRequest;
    const token = h.load('src/lib/zapi-webhook-auth.ts').webhookToken('instance-a');
    const post = body => handler(h.request(`/api/webhook?token=${token}`, { instanceId: 'instance-a', ...body }));
    const message = (id, minute, fromMe = false) => ({ messageId: id, phone: '5511998765432', text: { message: `Synthetic ${id}` }, momment: Date.parse(`2024-01-01T10:${minute}:00Z`), fromMe });
    assert.equal((await post(message('first', '10'))).status, 200);
    const first = await repo.readCRMState('tenant-a');
    assert.equal(first.conversations[0].unreadCount, 1);
    await post(message('first', '10'));
    const retried = await repo.readCRMState('tenant-a');
    assert.equal(retried.messages.length, 1);
    assert.equal(retried.conversations[0].unreadCount, 1);
    assert.equal(retried.eventCursor, first.eventCursor);
    await Promise.all([post(message('second', '20')), post(message('older', '05'))]);
    let state = await repo.readCRMState('tenant-a');
    assert.equal(state.messages.length, 3);
    assert.equal(state.conversations[0].unreadCount, 3);
    assert.equal(state.conversations[0].lastMessagePreview, 'Synthetic second');
    await post(message('outgoing', '30', true));
    await post({ ...message('new-incoming', '40'), data: { fromMe: 'false' } });
    await post(message('old-outgoing', '15', true));
    state = await repo.readCRMState('tenant-a');
    assert.equal(state.conversations[0].lastMessagePreview, 'Synthetic new-incoming');
    assert.equal(state.conversations[0].unreadCount, 1);
    assert.equal(state.messages.find(m => m.id === 'outgoing').senderType, 'USER');
    assert.equal(state.messages.find(m => m.id === 'new-incoming').senderType, 'CONTACT');
    await Promise.all(['READ', 'SENT'].map(status => post({ type: 'MessageStatusCallback', ids: ['outgoing'], status })));
    state = await repo.readCRMState('tenant-a');
    assert.equal(state.messages.find(m => m.id === 'outgoing').status, 'READ');
    const stableCursor = state.eventCursor;
    await repo.writeCRMState('tenant-a', { messages: state.messages.map(m => ({ ...m, receivedAt: Date.now() + 99999999 })) });
    assert.equal((await repo.readCRMState('tenant-a')).eventCursor, stableCursor);

    // Nova execução HTTP: sem cookies de navegador ou estado em memória do webhook.
    const fresh = harness({}, { DATABASE_URL: 'test-only' });
    fresh.mocks['@/db'].db = h.mocks['@/db'].db;
    const auth = `Bearer ${fresh.load('src/lib/api-auth.ts').signSessionPayload(broker)}`;
    let readState = repo.readCRMState;
    fresh.mocks['@/lib/crm-repository'] = { readCRMState: (...args) => readState(...args) };
    const events = fresh.load('src/app/api/v1/webhooks/zapi/events/route.ts');
    const get = async since => (await events.GET(fresh.request(`/api/events?tenantId=tenant-a&since=${since}`, undefined, { authorization: auth }))).json();
    const restored = await get(0);
    assert.equal(restored.messages.length, 6);
    assert.equal(restored.messages.find(m => m.id === 'first').timestamp, '2024-01-01T10:10:00.000Z');
    assert.ok(restored.messages.find(m => m.id === 'first').receivedAt > Date.parse('2024-01-01T10:10:00Z'));
    assert.equal(restored.conversations.length, 1);
    assert.equal((await get(restored.serverTime)).messages.length, 0);

    // Um commit entre a leitura do snapshot e a resposta não fica atrás do cursor.
    const snapshot = await repo.readCRMState('tenant-a');
    readState = async () => { await post(message('late-arrival', '01')); return snapshot; };
    const duringRead = await get(restored.serverTime);
    assert.equal(duringRead.serverTime, snapshot.eventCursor);
    readState = repo.readCRMState;
    const resumed = await get(duringRead.serverTime);
    assert.equal(resumed.messages.length, 1);
    assert.equal(resumed.messages[0].id, 'late-arrival');
    assert.equal((await repo.readCRMState('tenant-b')).messages.length, 0);
    repo.mutateCRMState = async () => { throw new Error('DB offline'); };
    assert.equal((await post(message('not-committed', '50'))).status, 500);
  } finally { await client.close(); }
});

test('retomada na tela preserva IDs distintos, atualiza status e isola imobiliárias', () => {
  const { mergeSyncedRecords } = harness().load('src/lib/crm-event-cursor.ts');
  const old = [{ id: 'same', tenantId: 'tenant-b', content: 'other' }, { id: 'same', tenantId: 'tenant-a', content: 'Olá', status: 'SENT', receivedAt: 10 }];
  const result = mergeSyncedRecords(old, [
    { id: 'same', tenantId: 'tenant-a', content: 'Olá', status: 'READ', receivedAt: 20 },
    { id: 'distinct', tenantId: 'tenant-a', content: 'Olá', receivedAt: 20 },
    { id: 'foreign', tenantId: 'tenant-b' },
  ], 'tenant-a');
  assert.equal(result.length, 3);
  assert.equal(result.find(m => m.tenantId === 'tenant-b').content, 'other');
  assert.equal(result.find(m => m.tenantId === 'tenant-a' && m.id === 'same').status, 'READ');
  assert.equal(mergeSyncedRecords(result, [{ ...old[1], receivedAt: 1 }], 'tenant-a'), result);
  assert.equal(mergeSyncedRecords(result, result, 'tenant-a'), result);
});

test('configuração cobre a URL prioritária de recebidas/enviadas e reporta falhas', async () => {
  const calls = [];
  let failPriority = false;
  const h = harness({ fetch: async (url, options) => {
    calls.push({ path: url.split('/').pop(), body: JSON.parse(options.body) });
    return failPriority && url.endsWith('/update-webhook-received-delivery')
      ? { ok: false, status: 400, text: async () => 'config failed' }
      : { ok: true, json: async () => ({ value: true }) };
  } });
  const client = new (h.load('src/lib/zapi-client.ts').ZApiClient)({ instanceId: 'a', instanceToken: 'test', securityToken: 'test' });
  assert.equal((await client.configureAllWebhooks('https://crm.test/hook')).success, true);
  assert.ok(calls.some(c => c.path === 'update-webhook-received-delivery' && c.body.value === 'https://crm.test/hook'));
  assert.ok(calls.some(c => c.path === 'update-notify-sent-by-me' && c.body.notifySentByMe === true));
  failPriority = true;
  assert.equal((await client.configureAllWebhooks('https://crm.test/hook')).success, false);
});

test('webhook preserva vídeo recebido e enviado como VIDEO, com legenda e arquivo, sem duplicar reentrega', async () => {
  const client=new PGlite();
  try {
    await client.exec(fs.readFileSync('database/03_durable_crm_state.sql','utf8'));
    const h=harness({'@/lib/db/zapi-credentials-service':{ZapiCredentialsService:{resolveWebhookTenant:async()=> 'tenant-a'}}},{DATABASE_URL:'test-only'});
    h.mocks['@/db'].db=drizzle(client,{schema:h.load('src/db/schema.ts')});
    const handler=h.load('src/lib/zapi-webhook-handler.ts').processZapiWebhookRequest;
    const token=h.load('src/lib/zapi-webhook-auth.ts').webhookToken('instance-a');
    const post=body=>handler(h.request(`/api/webhook?token=${token}`,{instanceId:'instance-a',phone:'5511998765432',momment:Date.parse('2024-01-01T10:10:00Z'),...body}));
    const video={videoUrl:'https://example.invalid/tour.mp4',caption:'Tour do imóvel',fileName:'tour.mp4',fileSize:1500};
    for(const fromMe of [true,false]){
      const body={messageId:`video-${fromMe}`,video,fromMe}; assert.equal((await post(body)).status,200); assert.equal((await post(body)).status,200);
    }
    const state=await h.load('src/lib/crm-repository.ts').readCRMState('tenant-a');assert.equal(state.messages.length,2);
    for(const message of state.messages){assert.equal(message.messageType,'VIDEO');assert.equal(message.content,'Tour do imóvel');assert.equal(message.attachments[0].mimeType,'video/mp4');assert.equal(message.attachments[0].fileName,'tour.mp4');assert.equal(message.attachments[0].fileSize,1500);}
    assert.equal(state.messages.find(m=>m.id==='video-true').senderType,'USER');assert.equal(state.messages.find(m=>m.id==='video-false').senderType,'CONTACT');
  }finally{await client.close();}
});
