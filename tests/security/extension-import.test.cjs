const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('./harness.cjs');
const broker = { userId: 'broker-a', userEmail: 'broker@example.invalid', userName: 'Broker', role: 'BROKER', tenantId: 'tenant-a', isSuperAdmin: false };

test('importação: recibo após commit, reentrega, texto intacto, concorrência e rollback integral', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(fs.readFileSync('database/03_durable_crm_state.sql', 'utf8'));
    const h = harness({}, { DATABASE_URL: 'test' });
    h.mocks['@/db'].db = drizzle(pg, { schema: h.load('src/db/schema.ts') });
    const repo = h.load('src/lib/crm-repository.ts');
    const route = h.load('src/app/api/v1/sync/extension-history/route.ts');
    const token = h.load('src/lib/api-auth.ts').signSessionPayload(broker);
    const send = async body => {
      const response = await route.POST(h.request('/api/sync', { protocol: 2, batchId: crypto.randomUUID(), tenantId: 'tenant-a', ...body }, { authorization: `Bearer ${token}` }));
      return { status: response.status, body: await response.json() };
    };
    const phone = '5511998765432';
    const message = (id, content, fromMe = false) => ({ id: `${fromMe}_${phone}@c.us_${id}`, content, fromMe, timestamp: '2024-01-01T10:00:00.000Z', messageType: 'TEXT' });
    await repo.writeCRMState('tenant-a', {
      contacts: [{ id: 'contact', tenantId: 'tenant-a', name: 'Synthetic', phone: `+${phone}`, tags: [] }],
      conversations: [{ id: 'conversation', tenantId: 'tenant-a', contactId: 'contact', instanceId: 'physical-zapi', lastMessageAt: '2026-01-01T10:00:00Z', lastMessagePreview: 'Newest', unreadCount: 5, status: 'PENDING_TEAM' }],
      messages: [{ id: 'webhook-message', externalId: 'RAW1', tenantId: 'tenant-a', conversationId: 'conversation', content: 'Text from webhook', timestamp: '2024-01-01T10:00:00.000Z', senderType: 'CONTACT', messageType: 'TEXT', status: 'READ' }],
    });
    const messages = [message('RAW1', '123'), message('REPEAT1', 'Olá'), message('REPEAT2', 'Olá'), message('TIME', '14:32'), message('FILE', '40 KB\nLinha 2', true)];
    const first = await send({ chats: [{ phone, name: 'Synthetic', avatarUrl: null, messages }] });
    assert.equal(first.status, 200); assert.equal(first.body.receipt.messageIds.length, 5);
    assert.equal(first.body.receipt.protocol, 2);
    assert.deepEqual(first.body.receipt.messageIds, messages.map(m => m.id));
    let state = await repo.readCRMState('tenant-a');
    assert.equal(state.messages.length, 5);
    assert.equal(state.messages.find(m => m.id === 'webhook-message').content, '123');
    assert.equal(state.messages.find(m => m.id === 'webhook-message').status, 'READ');
    assert.equal(state.messages.find(m => m.externalId === 'FILE').content, '40 KB\nLinha 2');
    assert.equal(state.messages.find(m => m.externalId === 'FILE').senderType, 'USER');
    assert.equal(state.conversations[0].lastMessagePreview, 'Newest');
    assert.equal(state.conversations[0].unreadCount, 5);
    assert.equal(state.conversations[0].instanceId, 'physical-zapi');
    await send({ chats: [{ phone, messages }] });
    assert.equal((await repo.readCRMState('tenant-a')).messages.length, 5);
    await Promise.all(['A', 'B', 'C'].map(id => send({ chats: [{ phone, messages: [message(id, `Concurrent ${id}`)] }] })));
    assert.equal((await repo.readCRMState('tenant-a')).messages.length, 8);
    const before = await repo.readCRMState('tenant-a');
    const invalid = await send({ chats: [{ phone, messages: [message('ROLLBACK', 'Must not persist')] }, { phone: '550012345678', name: 'Synthetic', messages: [message('WRONG', 'Must not persist')] }] });
    assert.equal(invalid.status, 400);
    assert.equal((await repo.readCRMState('tenant-a')).messages.length, before.messages.length);
    const missingDate = await send({ chats: [{ phone, messages: [{ id: 'bad-date', fromMe: false, content: 'Unknown date' }] }] });
    assert.equal(missingDate.status, 400);
    const wrongChat = await send({ chats: [{ phone: '5511987654321', messages }] });
    assert.equal(wrongChat.status, 400);
    const other = await send({ tenantId: 'tenant-b', chats: [{ phone, messages }] });
    assert.equal(other.status, 403); assert.equal((await repo.readCRMState('tenant-b')).messages.length, 0);
    await send({ chats: [{ phone: '5511987654321', name: 'Synthetic', messages: [{ ...message('OTHER', 'Same name, different person'), id: 'false_5511987654321@c.us_OTHER' }] }] });
    state = await repo.readCRMState('tenant-a');
    assert.equal(state.contacts.length, 2); assert.equal(state.conversations.length, 2);
  } finally { await pg.close(); }
});
