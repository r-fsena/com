export interface SyncJob {
  id: string;
  tenantId: string;
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
}

declare global {
  var __SYNC_JOBS__: Map<string, SyncJob> | undefined;
}

if (!global.__SYNC_JOBS__) {
  global.__SYNC_JOBS__ = new Map<string, SyncJob>();
}

export const syncJobStore = {
  createJob(tenantId: string, options: { historyDays?: number; importMode?: 'CHATS' | 'PHONEBOOK' | 'ALL' } = {}): SyncJob {
    const id = `job-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job: SyncJob = {
      id,
      tenantId,
      status: 'PENDING',
      progress: 0,
      pagesScanned: 0,
      totalChatsFound: 0,
      contactsImported: 0,
      currentStepText: 'Iniciando conexão segura com a Z-API...',
      historyDays: options.historyDays ?? 0,
      importMode: options.importMode ?? 'CHATS',
      startedAt: new Date().toISOString(),
    };
    global.__SYNC_JOBS__!.set(id, job);
    return job;
  },

  getJob(id: string): SyncJob | null {
    return global.__SYNC_JOBS__!.get(id) || null;
  },

  getActiveJobForTenant(tenantId: string): SyncJob | null {
    for (const job of Array.from(global.__SYNC_JOBS__!.values())) {
      if (job.tenantId === tenantId && (job.status === 'RUNNING' || job.status === 'PENDING')) {
        return job;
      }
    }
    return null;
  },

  updateJob(id: string, partial: Partial<SyncJob>): SyncJob | null {
    const existing = global.__SYNC_JOBS__!.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...partial };
    global.__SYNC_JOBS__!.set(id, updated);
    return updated;
  },
};
