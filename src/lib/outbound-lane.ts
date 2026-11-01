import crypto from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { crmOutboundLanes, crmOutboundContacts } from '@/db/schema';
import { mutateCRMState } from '@/lib/crm-repository';

export async function nextOutboundTurn(tenantId: string) {
  let turn: 'CAMPAIGN' | 'AUTOMATION' = 'CAMPAIGN';
  await mutateCRMState(tenantId, state => {
    turn = state.outboundNext || 'CAMPAIGN';
    return { ...state, outboundNext: turn === 'CAMPAIGN' ? 'AUTOMATION' : 'CAMPAIGN' };
  });
  return turn;
}

export async function acquireOutboundLane(tenantId: string, instanceId: string, phone: string, owner: string, kind: 'CAMPAIGN' | 'AUTOMATION' | 'TEST', now = new Date()) {
  return db.transaction(async tx => {
    await tx.insert(crmOutboundLanes).values({ instanceKey: instanceId, tenantKey: tenantId, nextAllowedAt: now }).onConflictDoNothing();
    const [lane] = await tx.select().from(crmOutboundLanes).where(eq(crmOutboundLanes.instanceKey, instanceId)).for('update');
    if (lane.tenantKey !== tenantId) return { acquired: false, reason: 'Conexão vinculada a outro ambiente.' };
    if ((lane.leaseUntil && lane.leaseUntil > now) || lane.nextAllowedAt > now) return { acquired: false, reason: 'Aguardando a vez desta linha.' };
    const id = crypto.createHash('sha256').update(JSON.stringify([tenantId, phone])).digest('hex');
    await tx.insert(crmOutboundContacts).values({ id, tenantKey: tenantId, phone }).onConflictDoNothing();
    const [contact] = await tx.select().from(crmOutboundContacts).where(eq(crmOutboundContacts.id, id)).for('update');
    if (contact.leaseUntil && contact.leaseUntil > now) return { acquired: false, reason: 'Outro envio está verificando este contato.' };
    if (kind === 'CAMPAIGN' && contact.campaignAt && now.getTime() - contact.campaignAt.getTime() < 24 * 3600_000) return { acquired: false, reason: 'Recebeu uma campanha nas últimas 24 horas.' };
    if (contact.attemptedAt && now.getTime() - contact.attemptedAt.getTime() < (kind === 'TEST' ? 60_000 : 10 * 60_000)) return { acquired: false, reason: 'Há um envio recente para este contato. Aguardando intervalo.' };
    const leaseUntil = new Date(now.getTime() + 120_000);
    await tx.update(crmOutboundLanes).set({ ownerKey: owner, leaseUntil, updatedAt: now }).where(eq(crmOutboundLanes.instanceKey, instanceId));
    await tx.update(crmOutboundContacts).set({ ownerKey: owner, leaseUntil, updatedAt: now }).where(eq(crmOutboundContacts.id, id));
    return { acquired: true, reason: '' };
  });
}
export async function markOutboundAttempt(tenantId: string, instanceId: string, phone: string, owner: string, campaign: boolean) {
  await db.transaction(async tx => {
    const now = new Date();
    const [lane] = await tx.select().from(crmOutboundLanes).where(and(eq(crmOutboundLanes.instanceKey, instanceId), eq(crmOutboundLanes.tenantKey, tenantId))).for('update');
    if (!lane || lane.ownerKey !== owner || !lane.leaseUntil || lane.leaseUntil <= now) throw new Error('A reserva de envio expirou.');
    await tx.update(crmOutboundContacts).set({ attemptedAt: now, ...(campaign ? { campaignAt: now } : {}), updatedAt: now })
      .where(and(eq(crmOutboundContacts.tenantKey, tenantId), eq(crmOutboundContacts.phone, phone), eq(crmOutboundContacts.ownerKey, owner)));
  });
}
export async function releaseOutboundLane(tenantId: string, instanceId: string, phone: string, owner: string, attempted: boolean) {
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(crmOutboundLanes).set({ leaseUntil: null, ownerKey: null, nextAllowedAt: new Date(now.getTime() + (attempted ? 15000 : 1000)), updatedAt: now })
      .where(and(eq(crmOutboundLanes.instanceKey, instanceId), eq(crmOutboundLanes.tenantKey, tenantId), eq(crmOutboundLanes.ownerKey, owner)));
    await tx.update(crmOutboundContacts).set({ ownerKey: null, leaseUntil: null, updatedAt: now })
      .where(and(eq(crmOutboundContacts.tenantKey, tenantId), eq(crmOutboundContacts.phone, phone), eq(crmOutboundContacts.ownerKey, owner)));
  });
}
export async function recentlyCampaignedPhones(tenantId: string, client: any = db) {
  return (await client.select({ phone: crmOutboundContacts.phone }).from(crmOutboundContacts)
    .where(and(eq(crmOutboundContacts.tenantKey, tenantId), gt(crmOutboundContacts.campaignAt, new Date(Date.now() - 24 * 3600_000))))).map((row: { phone: string }) => row.phone);
}
