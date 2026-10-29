const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeMigrationState } = require('../../scripts/crm-state-migration.cjs');
test('migração unifica telefone sem duplicar contatos e remapeia conversas e mensagens somente no mesmo tenant', () => {
  const database = { contacts: [{id:'db-c',tenantId:'tenant-a',phone:'+5511999999999',name:'Latest',updatedAt:'2026-10-01'}],
    conversations:[{id:'db-v',tenantId:'tenant-a',contactId:'db-c',instanceId:'instance-a',lastMessageAt:'2026-10-01'}],messages:[],deals:[],quickReplies:[],aiInsights:{} };
  const legacy = { contacts:[{id:'old-c',tenantId:'tenant-a',phone:'5511999999999',name:'Old',updatedAt:'2026-09-01'}, {id:'foreign',tenantId:'tenant-b',phone:'+5511999999999'}],
    conversations:[{id:'old-v',tenantId:'tenant-a',contactId:'old-c',instanceId:'instance-a',lastMessageAt:'2026-09-01'}],
    messages:[{id:'m',tenantId:'tenant-a',conversationId:'old-v',content:'synthetic'},{id:'private',tenantId:'tenant-b',conversationId:'foreign'}],
    deals:[{id:'d',tenantId:'tenant-a',contactId:'old-c'}] };
  const result = mergeMigrationState(database, legacy, 'tenant-a');
  assert.equal(result.contacts.length,1);assert.equal(result.contacts[0].name,'Latest');assert.equal(result.conversations.length,1);
  assert.equal(result.messages.length,1);assert.equal(result.messages[0].conversationId,'db-v');assert.equal(result.deals[0].contactId,'db-c');
  assert.equal(database.messages.length,0);
});
