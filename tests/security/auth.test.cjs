const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { harness } = require('./harness.cjs');
const broker = { userId: 'broker-a', userEmail: 'broker@example.invalid', userName: 'Broker', role: 'BROKER', tenantId: 'tenant-a', isSuperAdmin: false };

test('headers, origem e segredo compartilhado não autenticam', () => {
  const h = harness(); const auth = h.load('src/lib/api-auth.ts');
  for (const headers of [{ 'x-extension-token': 'brokiva-ext-sync-secret-2026' }, { 'x-user-id': 'admin', 'x-user-email': 'admin@test', 'sec-fetch-site': 'same-origin', referer: 'https://crm.test', 'x-tenant-id': 'tenant-a' }]) {
    assert.equal(auth.validateApiSession(h.request('/api/test', undefined, headers)).errorResponse.status, 401);
  }
});
test('Bearer válido preserva corretor mesmo com segredo compartilhado', () => {
  const h = harness(); const auth = h.load('src/lib/api-auth.ts'); const token = auth.signSessionPayload(broker);
  const result = auth.validateApiSession(h.request('/api/test', undefined, { authorization: `Bearer ${token}`, 'x-extension-token': 'anything' }));
  assert.equal(result.session.userId, broker.userId); assert.equal(result.session.userEmail, broker.userEmail);
  assert.equal(result.session.tenantId, 'tenant-a');
});
test('token expirado, legado, adulterado e sem segredo de produção são rejeitados', () => {
  const h = harness(); const auth = h.load('src/lib/api-auth.ts');
  assert.equal(auth.verifySessionToken(auth.signSessionPayload(broker, -10)), null);
  const legacy = Buffer.from(JSON.stringify({ ...broker, role: 'SUPERADMIN' })).toString('base64url');
  const signature = crypto.createHmac('sha256', h.env.SESSION_SECRET).update(legacy).digest('base64url');
  assert.equal(auth.verifySessionToken(`${legacy}.${signature}`), null);
  assert.equal(auth.verifySessionToken(`${legacy}.invalid`), null);
  const unconfigured = harness({}, { SESSION_SECRET: '' }).load('src/lib/api-auth.ts');
  assert.throws(() => unconfigured.signSessionPayload(broker));
});
test('token de outra imobiliária e perfis insuficientes recebem 403', () => {
  const h = harness(); const auth = h.load('src/lib/api-auth.ts'); const token = auth.signSessionPayload(broker);
  assert.equal(auth.validateApiSession(h.request('/api/test?tenantId=tenant-b', undefined, { authorization: `Bearer ${token}` })).errorResponse.status, 403);
  assert.equal(auth.validateApiSession(h.request('/api/test', undefined, { authorization: `Bearer ${token}` }), { requireSuperAdmin: true }).errorResponse.status, 403);
});
test('login não emite sessão sem senha e não aceita cognitoSub como autenticação', async () => {
  const h = harness({ '@/lib/db/auth-service': { AuthService: { authenticateUser: async () => ({ success: false }) } } });
  const sessions = h.load('src/app/api/v1/auth/session/route.ts');
  for (const body of [{ email: broker.userEmail, role: 'SUPERADMIN' }, { cognitoSub: 'arbitrary', email: broker.userEmail }]) assert.equal((await sessions.POST(h.request('/api/v1/auth/session', body))).status, 401);
  const extension = h.load('src/app/api/v1/auth/extension-login/route.ts');
  assert.equal((await extension.POST(h.request('/api/v1/auth/extension-login', { email: broker.userEmail, name: 'Admin' }))).status, 401);
  assert.equal((await extension.GET(h.request('/api/v1/auth/extension-login'))).status, 401);
});
test('pareamento usa cookie autenticado e expira em no máximo 15 minutos', async () => {
  const h = harness({ '@/lib/db/auth-service': { AuthService: {} } }); const auth = h.load('src/lib/api-auth.ts');
  const response = await h.load('src/app/api/v1/auth/extension-login/route.ts').POST(h.request('/api/v1/auth/extension-login', { email: 'other@example.invalid', role: 'SUPERADMIN' }, { cookie: `vanguard_session=${auth.signSessionPayload(broker)}` }));
  const data = await response.json(); assert.equal(response.status, 200); assert.equal(data.user.userId, broker.userId);
  assert.equal(data.user.role, 'BROKER'); assert.ok(data.expiresAt <= Date.now() / 1000 + 900);
});
test('webhook rejeita token ausente/incorreto mesmo com payload reconhecido', async () => {
  const h = harness(); const route = h.load('src/lib/zapi-webhook-handler.ts');
  for (const body of [{ type: 'MessageStatusCallback', ids: ['id'], status: 'READ' }, { phone: '5511999999999', text: { message: 'synthetic' } }]) {
    assert.equal((await route.processZapiWebhookRequest(h.request('/api/hook', body))).status, 401);
  }
});
test('eventos e APIs de conexão não aceitam query nem cabeçalhos sem sessão', async () => {
  const h = harness();
  for (const file of ['webhooks/zapi/events', 'zapi/status', 'zapi/qr-code', 'crm/state']) {
    const route = h.load(`src/app/api/v1/${file}/route.ts`);
    const response = await route.GET(h.request('/api/test?tenantId=tenant-amabile-barbarotti', undefined, { 'sec-fetch-site': 'same-origin', 'x-tenant-id': 'tenant-amabile-barbarotti' }));
    assert.equal(response.status, 401, file);
  }
});
test('ingestão rejeita tenant do corpo diferente do token antes de gravar', async () => {
  let writes = 0;
  const h = harness({ '@/lib/crm-repository': { readCRMState: async () => ({ contacts: [], conversations: [] }), writeCRMState: async () => writes++ } });
  const token = h.load('src/lib/api-auth.ts').signSessionPayload(broker);
  const response = await h.load('src/app/api/v1/sync/extension-history/route.ts').POST(h.request('/api/sync', { tenantId: 'tenant-b', chats: [] }, { authorization: `Bearer ${token}` }));
  assert.equal(response.status, 403); assert.equal(writes, 0);
});
test('falha de persistência impede ACK de sincronização', async () => {
  const h = harness({ '@/lib/crm-repository': { mutateCRMState: async () => { throw new Error('simulated database outage'); } } });
  const token = h.load('src/lib/api-auth.ts').signSessionPayload(broker);
  const response = await h.load('src/app/api/v1/sync/extension-history/route.ts').POST(h.request('/api/sync', { tenantId: 'tenant-a', chats: [{ phone: '5511998765432', messages: [{ id: 'test-msg', content: 'Synthetic', fromMe: false, timestamp: '2024-01-01T10:00:00Z' }] }] }, { authorization: `Bearer ${token}` }));
  assert.ok(response.status >= 500); assert.equal((await response.json()).success, false);
});
test('autenticação real exige hash válido e vínculo ativo, sem senha mestre ou vínculo Cognito arbitrário', async () => {
  let user; let members = [{ role: 'BROKER', tenantId: 'uuid-a', tenantSlug: 'a' }];
  const db = { select: () => {
    let joined = false;
    return { from() { return this; }, innerJoin() { joined = true; return this; },
      where() { return joined ? Promise.resolve(members) : { limit: async () => [user] }; } };
  } };
  const h = harness({ '@/db': { db } });
  const service = h.load('src/lib/db/auth-service.ts').AuthService;
  const credentials = service.hashPassword('correct-isolated-password');
  user = { id: 'db-user-a', email: 'rafael@example.invalid', fullName: 'Synthetic', isActive: true, passwordHash: credentials.hash, salt: credentials.salt, cognitoSub: 'known-sub' };
  const valid = await service.authenticateUser(user.email, 'correct-isolated-password');
  assert.equal(valid.success, true); assert.equal(valid.user.role, 'BROKER');
  assert.equal(h.load('src/lib/api-auth.ts').verifySessionToken(valid.sessionToken).email, user.email);
  assert.equal((await service.authenticateUser(user.email, 'wrong-password')).success, false);
  assert.equal((await service.authenticateUser(user.email, undefined, 'known-sub')).success, false);
  assert.equal((await service.authenticateUser(user.email, 'correct-isolated-password', undefined, 'tenant-b')).success, false);
  user.passwordHash = null;
  assert.equal((await service.authenticateUser(user.email, 'new-password')).success, false);
});
test('eventos autenticados ficam restritos ao tenant e jobs de outro tenant retornam 404', async () => {
  const h = harness({
    '@/lib/crm-repository': { readCRMState: async () => ({ contacts: [], conversations: [], messages: [{ id: 'a', tenantId: 'tenant-a', timestamp: new Date().toISOString(), messageType: 'TEXT', senderType: 'CONTACT', content: 'Synthetic A' }] }) },
    '@/lib/sync-job-store': { syncJobStore: { getJob: async () => ({ id: 'private-job', tenantId: 'tenant-b' }) } },
  });
  const authorization = `Bearer ${h.load('src/lib/api-auth.ts').signSessionPayload(broker)}`;
  const events = await h.load('src/app/api/v1/webhooks/zapi/events/route.ts').GET(h.request('/api/events?tenantId=tenant-a', undefined, { authorization }));
  const body = await events.json(); assert.equal(body.messages.length, 1); assert.equal(body.messages[0].tenantId, 'tenant-a');
  const job = await h.load('src/app/api/v1/zapi/background-sync/route.ts').GET(h.request('/api/jobs?jobId=private-job', undefined, { authorization }));
  assert.equal(job.status, 404);
});
