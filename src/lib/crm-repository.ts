import { db } from '@/db';
import { crmTenantState } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { serverCRMStore, ServerCRMState } from '@/lib/server-crm-store';
import { crmEventCursor } from '@/lib/crm-event-cursor';
import { campaignPhone } from '@/lib/campaigns';

export type PersistedCRMState = ServerCRMState & { deletedKeys?: string[]; eventCursor?: number };
const collections = ['contacts', 'conversations', 'messages', 'deals', 'quickReplies'] as const;
export function emptyCRMState(): PersistedCRMState {
  return { contacts: [], conversations: [], messages: [], deals: [], quickReplies: [], aiInsights: {}, deletedKeys: [] };
}
export function mergeTenantState(tenantId: string, previous: PersistedCRMState, patch: Partial<PersistedCRMState>): PersistedCRMState {
  if (!tenantId || tenantId === 'all') throw new Error('Imobiliária obrigatória.');
  const next = { ...previous };
  const revision = Math.max(Date.now(), crmEventCursor(previous) + 1);
  for (const key of collections) {
    const incoming = patch[key];
    if (incoming !== undefined && !Array.isArray(incoming)) throw new Error(`Coleção inválida: ${key}.`);
    const map = new Map<string, any>();
    for (const item of previous[key] || []) if (item.tenantId === tenantId) map.set(item.id, item);
    for (const item of incoming || []) {
      if (!item || typeof item.id !== 'string' || !item.id || item.tenantId !== tenantId) throw new Error('Registro de outra imobiliária ou sem identificação.');
      const existing = map.get(item.id);
      // Full browser snapshots can be older than a server-side commercial action.
      // An unchanged stale contact must not undo that action during reconciliation.
      if (key === 'contacts' && existing?.updatedAt && 'updatedAt' in item && item.updatedAt && Date.parse(existing.updatedAt) > Date.parse(item.updatedAt)) continue;
      if (key === 'messages') {
        // O navegador não define o cursor e reenviar o mesmo histórico não cria eventos novos.
        const { receivedAt: ignored, ...incomingMessage } = item as any;
        const { receivedAt: previousReceipt, ...previousMessage } = existing || {};
        const merged = { ...previousMessage, ...incomingMessage };
        const changed = !existing || JSON.stringify(previousMessage) !== JSON.stringify(merged);
        map.set(item.id, { ...merged, receivedAt: changed ? revision : previousReceipt });
        if (changed) next.eventCursor = revision;
      } else {
        const merged = { ...existing, ...item };
        if (key === 'contacts') {
          const phone = campaignPhone(merged.phone || '');
          if (phone && previous.marketingPermissions?.[phone]?.status === 'REVOKED') { merged.hasOptedOut = true; merged.consentGiven = false; }
          if (existing?.phone && campaignPhone(existing.phone) !== phone) { merged.consentGiven = false; merged.consentDate = undefined; }
        }
        map.set(item.id, merged);
      }
    }
    (next as any)[key] = Array.from(map.values());
  }
  // Insights só podem referenciar contatos/conversas desta imobiliária.
  const ownedIds = new Set([...next.contacts, ...next.conversations].map(item => item.id));
  next.aiInsights = Object.fromEntries(Object.entries({ ...previous.aiInsights, ...patch.aiInsights }).filter(([id]) => ownedIds.has(id)));
  next.deletedKeys = patch.deletedKeys || previous.deletedKeys || [];
  return next;
}
function requireStorage() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória em produção.');
}
export async function readCRMState(tenantId: string): Promise<PersistedCRMState> {
  requireStorage();
  if (!tenantId || tenantId === 'all') throw new Error('Imobiliária obrigatória.');
  if (!process.env.DATABASE_URL) return serverCRMStore.getScopedState(tenantId);
  const rows = await db.select().from(crmTenantState).where(eq(crmTenantState.tenantKey, tenantId)).limit(1);
  const state = rows[0] ? rows[0].state as PersistedCRMState : emptyCRMState();
  return { ...state, contacts: state.contacts.filter(c => c.tenantId === tenantId), conversations: state.conversations.filter(c => c.tenantId === tenantId), messages: state.messages.filter(m => m.tenantId === tenantId), deals: state.deals.filter(d => d.tenantId === tenantId) };
}
export async function mutateCRMState(tenantId: string, transform: (previous: PersistedCRMState) => PersistedCRMState): Promise<PersistedCRMState> {
  requireStorage();
  if (!tenantId || tenantId === 'all') throw new Error('Imobiliária obrigatória.');
  if (!process.env.DATABASE_URL) {
    const next = transform(serverCRMStore.getScopedState(tenantId));
    serverCRMStore.resetTenantState(tenantId);
    serverCRMStore.updateState(next);
    return next;
  }
  return db.transaction(async tx => {
    await tx.insert(crmTenantState).values({ tenantKey: tenantId, state: emptyCRMState() }).onConflictDoNothing();
    const [row] = await tx.select().from(crmTenantState).where(eq(crmTenantState.tenantKey, tenantId)).for('update');
    const next = transform(row.state as PersistedCRMState);
    await tx.update(crmTenantState).set({ state: next, updatedAt: new Date() }).where(eq(crmTenantState.tenantKey, tenantId));
    return next;
  });
}
export async function writeCRMState(tenantId: string, patch: Partial<PersistedCRMState>): Promise<PersistedCRMState> {
  return mutateCRMState(tenantId, previous => mergeTenantState(tenantId, previous, patch));
}
export async function resetCRMState(tenantId: string) {
  await mutateCRMState(tenantId, () => emptyCRMState());
}
