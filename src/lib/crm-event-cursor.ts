/** Cursor do estado persistido, independente da data original da mensagem no WhatsApp. */
export function messageEventTime(message: { receivedAt?: number; timestamp: string }): number {
  return Number.isFinite(message.receivedAt) && message.receivedAt! > 0
    ? message.receivedAt! : (Date.parse(message.timestamp) || 0);
}

export function crmEventCursor(state: { eventCursor?: number; messages: { receivedAt?: number; timestamp: string }[] }): number {
  return state.messages.reduce((cursor, message) => Math.max(cursor, messageEventTime(message)), state.eventCursor || 0);
}

/** Identidade do servidor: mensagens distintas com o mesmo texto continuam distintas. */
export function mergeSyncedRecords<T extends { id: string; tenantId: string; receivedAt?: number }>(previous: T[], incoming: T[], tenantId: string): T[] {
  const records = new Map(previous.map(record => [`${record.tenantId}:${record.id}`, record]));
  let changed = false;
  for (const record of incoming) {
    if (!record?.id || record.tenantId !== tenantId) continue;
    const key = `${tenantId}:${record.id}`;
    const old = records.get(key);
    if (old && (old.tenantId !== tenantId || (old.receivedAt || 0) > (record.receivedAt || 0))) continue;
    const merged = { ...old, ...record };
    if (JSON.stringify(old) === JSON.stringify(merged)) continue;
    records.set(key, merged);
    changed = true;
  }
  return changed ? Array.from(records.values()) : previous;
}
