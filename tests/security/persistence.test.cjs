const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('./harness.cjs');

test('PostgreSQL: commit, isolamento, concorrência, rollback e job durável', async () => {
  const client = new PGlite();
  try {
    await client.exec(fs.readFileSync('database/03_durable_crm_state.sql', 'utf8'));
    const h = harness({}, { DATABASE_URL: 'test-only' });
    const schema = h.load('src/db/schema.ts'); h.mocks['@/db'].db = drizzle(client, { schema });
    const repo = h.load('src/lib/crm-repository.ts');
    const contact = (id, tenantId) => ({ id, tenantId, name: id, phone: '+5511999999999', tags: [] });
    await repo.writeCRMState('tenant-a', { contacts: [contact('same-id', 'tenant-a')], conversations: [{ id: 'conversation', tenantId: 'tenant-a', contactId: 'same-id' }], messages: [{ id: 'msg', tenantId: 'tenant-a', conversationId: 'conversation', content: 'A', timestamp: new Date().toISOString() }] });
    await repo.writeCRMState('tenant-b', { contacts: [contact('same-id', 'tenant-b')] });
    assert.equal((await repo.readCRMState('tenant-b')).messages.length, 0);
    await assert.rejects(repo.writeCRMState('tenant-a', { contacts: [contact('foreign', 'tenant-b')] }));
    await Promise.all(Array.from({ length: 8 }, (_, index) => repo.writeCRMState('tenant-a', { contacts: [contact(`concurrent-${index}`, 'tenant-a')] })));
    assert.equal((await repo.readCRMState('tenant-a')).contacts.length, 9);
    const fresh = harness({}, { DATABASE_URL: 'test-only' }); fresh.mocks['@/db'].db = h.mocks['@/db'].db;
    assert.equal((await fresh.load('src/lib/crm-repository.ts').readCRMState('tenant-a')).messages[0].content, 'A');
    const jobs = h.load('src/lib/sync-job-store.ts').syncJobStore; const job = await jobs.createJob('tenant-a', { instanceId: 'instance-a' });
    const claims = await Promise.all([jobs.claimJob(job.id), jobs.claimJob(job.id)]);
    assert.equal(claims.filter(Boolean).length, 1);
    await jobs.updateJob(job.id, { pagesScanned: 3, status: 'RUNNING' }); await jobs.releaseJob(job.id);
    const restored = fresh.load('src/lib/sync-job-store.ts').syncJobStore; assert.equal((await restored.getJob(job.id)).pagesScanned, 3);
    assert.equal(await restored.claimJob(job.id), true); await restored.releaseJob(job.id);
    await repo.resetCRMState('tenant-a'); assert.equal((await repo.readCRMState('tenant-a')).contacts.length, 0);
    assert.equal((await repo.readCRMState('tenant-b')).contacts.length, 1);
  } finally { await client.close(); }
});
