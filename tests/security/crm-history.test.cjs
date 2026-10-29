const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('tela preserva homônimos, mensagens repetidas, números, IDs e isolamento por conversa/tenant', () => {
  const { reconcileIdentities, reconcileMessageHistory, historyForConversation, reconcileConversationHistory, tenantSnapshotRecords } = harness().load('src/lib/crm-history.ts');
  const contacts = reconcileIdentities([{ id: 'a', tenantId: 'one', name: 'Ana' }, { id: 'b', tenantId: 'one', name: 'Ana' }]);
  assert.equal(contacts.length, 2);
  const cached = [...contacts, { id: 'foreign', tenantId: 'two', name: 'Foreign' }];
  assert.equal(tenantSnapshotRecords(cached, [], 'one', true).length, 1);
  assert.equal(tenantSnapshotRecords(cached, [], 'one', false).length, 3);
  assert.equal(tenantSnapshotRecords(cached, contacts, 'one', true).length, 3);
  const base = { tenantId: 'one', conversationId: 'uuid-original', status: 'READ', timestamp: '2024-01-01T10:00:00Z', senderType: 'CONTACT', content: 'Olá', messageType: 'TEXT', isInternalNote: false };
  const records = [{ ...base, id: 'first' }, { ...base, id: 'second' }, { ...base, id: 'number', content: '123' }, { ...base, id: 'time', content: '14:32' }, { ...base, id: 'other-conv', conversationId: 'another' }, { ...base, id: 'other-tenant', tenantId: 'two' }];
  const messages = reconcileMessageHistory(records);
  assert.equal(messages.length, 6);
  assert.ok(messages.every(m => m.conversationId === records.find(r => r.id === m.id).conversationId));
  const visible = historyForConversation(messages, { id: 'uuid-original', tenantId: 'one' });
  assert.equal(visible.length, 4);
  assert.equal(historyForConversation([], { id: 'uuid-original', tenantId: 'one', lastMessagePreview: 'Must not fabricate a bubble' }).length, 0);
  const conv = { id: 'uuid-original', tenantId: 'one', contactId: 'a', instanceId: 'physical', lastMessageAt: base.timestamp, lastMessagePreview: 'Recent' };
  assert.equal(reconcileConversationHistory([conv])[0].id, 'uuid-original');
});
