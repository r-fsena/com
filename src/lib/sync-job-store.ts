export interface SyncJob {
  id: string;
  tenantId: string;
  instanceId?: string;
  assignedUserId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number; // 0 - 100
  pagesScanned: number;
  totalChatsFound: number;
  contactsImported: number;
  currentStepText: string;
  historyDays: number;
  importMode: 'CHATS' | 'PHONEBOOK' | 'ALL';
  startedAt: string;
  completedAt?: string;
  error?: string;
  resultSummary?: {
    totalContacts: number;
    totalConversations: number;
  };
  resultContacts?: any[];
  resultConversations?: any[];
  resultMessages?: any[];
}

// PostgreSQL é obrigatório em produção. O Map atende apenas desenvolvimento local.
const localLeases = new Set<string>();
const localJobs = new Map<string, SyncJob>();
import { db } from '@/db';
import { crmSyncJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
function useDatabase() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL obrigatória para sincronização.');
  return Boolean(process.env.DATABASE_URL);
}
export const syncJobStore = {
  async createJob(tenantId: string, options: { historyDays?: number; importMode?: 'CHATS' | 'PHONEBOOK' | 'ALL'; instanceId?: string; assignedUserId?: string } = {}): Promise<SyncJob> {
    const job: SyncJob = {
      id: `job-sync-${crypto.randomUUID()}`, tenantId, status: 'PENDING', progress: 0, pagesScanned: 0,
      totalChatsFound: 0, contactsImported: 0, currentStepText: 'Aguardando sincronização...',
      historyDays: options.historyDays ?? 0, importMode: options.importMode ?? 'CHATS', startedAt: new Date().toISOString(),
      instanceId: options.instanceId, assignedUserId: options.assignedUserId,
    };
    if (useDatabase()) await db.insert(crmSyncJobs).values({ id: job.id, tenantKey: tenantId, payload: job });
    else localJobs.set(job.id, job);
    return job;
  },
  async getJob(id: string): Promise<SyncJob | null> {
    if (!useDatabase()) return localJobs.get(id) || null;
    const rows = await db.select().from(crmSyncJobs).where(eq(crmSyncJobs.id, id)).limit(1);
    return rows[0] ? rows[0].payload as SyncJob : null;
  },
  async getActiveJobForTenant(tenantId: string): Promise<SyncJob | null> {
    const jobs = useDatabase() ? (await db.select().from(crmSyncJobs).where(eq(crmSyncJobs.tenantKey, tenantId))).map(r => r.payload as SyncJob) : Array.from(localJobs.values());
    return jobs.find(job => job.tenantId === tenantId && ['PENDING', 'RUNNING'].includes(job.status)) || null;
  },
  async updateJob(id: string, partial: Partial<SyncJob>): Promise<SyncJob | null> {
    if (!useDatabase()) {
      const job = localJobs.get(id); if (!job) return null;
      const next = { ...job, ...partial }; localJobs.set(id, next); return next;
    }
    return db.transaction(async tx => {
      const [row] = await tx.select().from(crmSyncJobs).where(eq(crmSyncJobs.id, id)).for('update');
      if (!row) return null;
      const next = { ...(row.payload as SyncJob), ...partial };
      await tx.update(crmSyncJobs).set({ payload: next, updatedAt: new Date(), ...(['COMPLETED', 'FAILED'].includes(next.status) ? { leaseUntil: null } : {}) }).where(eq(crmSyncJobs.id, id));
      return next;
    });
  },
  async releaseJob(id: string) {
    if (!useDatabase()) { localLeases.delete(id); return; }
    await db.update(crmSyncJobs).set({ leaseUntil: null }).where(eq(crmSyncJobs.id, id));
  },
  async claimJob(id: string): Promise<boolean> {
    if (!useDatabase()) { const job = localJobs.get(id); if (!job || localLeases.has(id) || ['COMPLETED', 'FAILED'].includes(job.status)) return false; localLeases.add(id); return true; }
    return db.transaction(async tx => {
      const [row] = await tx.select().from(crmSyncJobs).where(eq(crmSyncJobs.id, id)).for('update');
      if (!row || ['COMPLETED', 'FAILED'].includes((row.payload as SyncJob).status) || (row.leaseUntil && row.leaseUntil.getTime() > Date.now())) return false;
      await tx.update(crmSyncJobs).set({ leaseUntil: new Date(Date.now() + 120000) }).where(eq(crmSyncJobs.id, id));
      return true;
    });
  },
};
