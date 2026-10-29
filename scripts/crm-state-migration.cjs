// Reconcilia IDs legados somente dentro do tenant declarado; nunca une pessoas pelo nome.
function mergeMigrationState(databaseState, legacyState, tenantId) {
  const state = structuredClone(databaseState);
  const contactAliases = new Map();
  const contacts = new Map(state.contacts.map(item => [item.id, item]));
  const phones = new Map(state.contacts.filter(item => item.phone).map(item => [item.phone.replace(/\D/g, ''), item.id]));
  for (const item of legacyState?.contacts || []) {
    if (item.tenantId !== tenantId) continue;
    const phone = String(item.phone || '').replace(/\D/g, '');
    const id = phones.get(phone) || item.id;
    contactAliases.set(item.id, id);
    const existing = contacts.get(id);
    const legacyNewer = !existing || Date.parse(item.updatedAt || '') > Date.parse(existing.updatedAt || '');
    contacts.set(id, { ...(legacyNewer ? existing : item), ...(legacyNewer ? item : existing), id, tenantId });
    if (phone) phones.set(phone, id);
  }
  state.contacts = [...contacts.values()];
  const conversations = new Map(state.conversations.map(item => [item.id, item]));
  const conversationKeys = new Map(state.conversations.map(item => [`${item.instanceId || ''}::${item.contactId}`, item.id]));
  const conversationAliases = new Map();
  for (const item of legacyState?.conversations || []) {
    if (item.tenantId !== tenantId) continue;
    const contactId = contactAliases.get(item.contactId) || item.contactId;
    const key = `${item.instanceId || ''}::${contactId}`;
    const id = conversationKeys.get(key) || item.id;
    conversationAliases.set(item.id, id);
    const existing = conversations.get(id);
    const legacyNewer = !existing || Date.parse(item.lastMessageAt || '') > Date.parse(existing.lastMessageAt || '');
    conversations.set(id, { ...(legacyNewer ? existing : item), ...(legacyNewer ? item : existing), id, contactId, tenantId });
    conversationKeys.set(key, id);
  }
  state.conversations = [...conversations.values()];
  const messages = new Map(state.messages.map(item => [item.externalId || item.id, item]));
  for (const item of legacyState?.messages || []) if (item.tenantId === tenantId) {
    const key = item.externalId || item.id;
    messages.set(key, { ...messages.get(key), ...item, conversationId: conversationAliases.get(item.conversationId) || item.conversationId });
  }
  state.messages = [...messages.values()];
  for (const key of ['deals', 'quickReplies']) {
    const records = new Map((state[key] || []).map(item => [item.id, item]));
    for (const item of legacyState?.[key] || []) if (item.tenantId === tenantId) records.set(item.id, { ...records.get(item.id), ...item,
      ...(item.contactId ? { contactId: contactAliases.get(item.contactId) || item.contactId } : {}) });
    state[key] = [...records.values()];
  }
  const owned = new Set([...state.contacts, ...state.conversations].map(item => item.id));
  state.aiInsights = { ...state.aiInsights };
  for (const [id, value] of Object.entries(legacyState?.aiInsights || {})) {
    const mapped = contactAliases.get(id) || conversationAliases.get(id) || id;
    if (owned.has(mapped)) state.aiInsights[mapped] = value;
  }
  return state;
}
module.exports = { mergeMigrationState };
