import type { Message, Conversation } from '@/types/crm';

/** Identificadores persistidos são a autoridade; nomes, avatares e texto não provam identidade. */
export function reconcileIdentities<T extends { id: string; tenantId: string }>(records: T[]): T[] {
  const map = new Map<string, T>();
  for (const record of records) {
    if (!record?.id || !record.tenantId) continue;
    const key = `${record.tenantId}:${record.id}`;
    map.set(key, { ...map.get(key), ...record });
  }
  return Array.from(map.values());
}
export function reconcileMessageHistory(records: Message[]): Message[] {
  const map = new Map<string, Message>();
  const rank = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: -1 };
  for (const record of records) {
    if (!record?.id || !record.tenantId || !record.conversationId) continue;
    const external = record.externalId || record.id;
    const native = external.match(/^(?:true|false)_[^_]+_(.+)$/)?.[1] || external;
    const key = `${record.tenantId}:${record.conversationId}:${native}`;
    const old = map.get(key);
    if (old && (old.receivedAt || 0) > (record.receivedAt || 0)) continue;
    map.set(key, { ...old, ...record, attachments: record.attachments || old?.attachments,
      status: old && rank[old.status] > rank[record.status] ? old.status : record.status });
  }
  return Array.from(map.values()).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
export function reconcileConversationHistory(records: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const record of records) {
    if (!record?.id || !record.tenantId) continue;
    const key = `${record.tenantId}:${record.id}`;
    const old = map.get(key);
    const older = old && Date.parse(old.lastMessageAt) > Date.parse(record.lastMessageAt);
    map.set(key, { ...old, ...record, ...(older ? { lastMessageAt: old.lastMessageAt, lastMessagePreview: old.lastMessagePreview } : {}) });
  }
  return Array.from(map.values()).sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}
export function historyForConversation(records: Message[], conversation: Pick<Conversation, 'id' | 'tenantId'>): Message[] {
  return reconcileMessageHistory(records.filter(message => message.tenantId === conversation.tenantId && message.conversationId === conversation.id));
}
