import { Contact, Deal, Conversation, Message, AIInsight } from '@/types/crm';

export interface ServerCRMState {
  contacts: Contact[];
  deals: Deal[];
  conversations: Conversation[];
  messages: Message[];
  aiInsights: Record<string, AIInsight>;
}

// Base de dados limpa para produção e operação real
const INITIAL_CONTACTS: Contact[] = [];
const INITIAL_DEALS: Deal[] = [];
const INITIAL_MESSAGES: Message[] = [];
const INITIAL_INSIGHTS: Record<string, AIInsight> = {};

declare global {
  var __SERVER_CRM_STATE__: ServerCRMState | undefined;
}

if (!global.__SERVER_CRM_STATE__) {
  global.__SERVER_CRM_STATE__ = {
    contacts: INITIAL_CONTACTS,
    deals: INITIAL_DEALS,
    conversations: [],
    messages: INITIAL_MESSAGES,
    aiInsights: INITIAL_INSIGHTS,
  };
}

export const serverCRMStore = {
  getState(): ServerCRMState {
    if (!global.__SERVER_CRM_STATE__) {
      global.__SERVER_CRM_STATE__ = {
        contacts: INITIAL_CONTACTS,
        deals: INITIAL_DEALS,
        conversations: [],
        messages: INITIAL_MESSAGES,
        aiInsights: INITIAL_INSIGHTS,
      };
    }
    return global.__SERVER_CRM_STATE__;
  },

  resetState(): ServerCRMState {
    const fresh: ServerCRMState = {
      contacts: [],
      deals: [],
      conversations: [],
      messages: [],
      aiInsights: {},
    };
    global.__SERVER_CRM_STATE__ = fresh;
    return fresh;
  },

  updateState(partial: Partial<ServerCRMState>): ServerCRMState {
    const current = this.getState();
    const next: ServerCRMState = {
      contacts: partial.contacts ? this.mergeContacts(current.contacts, partial.contacts) : current.contacts,
      deals: partial.deals || current.deals,
      conversations: partial.conversations || current.conversations,
      messages: partial.messages ? this.mergeMessages(current.messages, partial.messages) : current.messages,
      aiInsights: partial.aiInsights ? { ...current.aiInsights, ...partial.aiInsights } : current.aiInsights,
    };
    global.__SERVER_CRM_STATE__ = next;
    return next;
  },

  mergeContacts(oldList: Contact[], newList: Contact[]): Contact[] {
    const normalizeKey = (phone?: string) => {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length >= 12) return digits.slice(2);
      return digits;
    };

    const phoneMap = new Map<string, Contact>();
    const idMap = new Map<string, Contact>();
    const result: Contact[] = [];

    const all = [...oldList, ...newList];
    all.forEach(c => {
      if (!c) return;
      const pKey = normalizeKey(c.phone);
      const existing = (pKey ? phoneMap.get(pKey) : null) || idMap.get(c.id);

      if (existing) {
        const merged: Contact = {
          ...existing,
          ...c,
          id: existing.id,
          name: (existing.name && !existing.name.startsWith('+') && !existing.name.startsWith('WhatsApp') && existing.name !== 'Lead WhatsApp' && existing.name !== 'Cliente')
            ? existing.name
            : (c.name || existing.name),
          monthlyIncome: c.monthlyIncome || existing.monthlyIncome,
          downPaymentAvailable: c.downPaymentAvailable || existing.downPaymentAvailable,
          maxPropertyValue: c.maxPropertyValue || existing.maxPropertyValue,
          preferredPropertyType: c.preferredPropertyType || existing.preferredPropertyType,
          email: c.email || existing.email,
          tags: Array.from(new Set([...(existing.tags || []), ...(c.tags || [])])),
          whatsappLabels: Array.from(new Set([...(existing.whatsappLabels || []), ...(c.whatsappLabels || [])])),
          firstSyncedAt: existing.firstSyncedAt || c.firstSyncedAt || new Date().toISOString(),
          lastSyncedAt: c.lastSyncedAt || new Date().toISOString(),
          targetRegions: Array.from(new Set([...(existing.targetRegions || []), ...(c.targetRegions || [])])),
          presentedProperties: c.presentedProperties || existing.presentedProperties,
          assignedUserId: c.assignedUserId || existing.assignedUserId,
          updatedAt: new Date().toISOString(),
        };

        if (pKey) phoneMap.set(pKey, merged);
        idMap.set(merged.id, merged);

        const idx = result.findIndex(x => x.id === existing.id);
        if (idx >= 0) result[idx] = merged;
      } else {
        const withTimestamps: Contact = {
          ...c,
          firstSyncedAt: c.firstSyncedAt || new Date().toISOString(),
          lastSyncedAt: c.lastSyncedAt || new Date().toISOString(),
        };
        if (pKey) phoneMap.set(pKey, withTimestamps);
        idMap.set(c.id, withTimestamps);
        result.push(withTimestamps);
      }
    });

    return result;
  },

  mergeMessages(oldMsgs: Message[], newMsgs: Message[]): Message[] {
    const map = new Map<string, Message>();
    const all = [...oldMsgs, ...newMsgs];
    all.forEach(m => {
      const content = (m.content || '').trim();
      const timeKey = m.timestamp ? m.timestamp.slice(0, 16) : '';
      const key = `${m.conversationId}-${content}-${timeKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, m);
      } else {
        // Promove de CONTACT para USER caso venha nova versão com identificação correta
        if (existing.senderType === 'CONTACT' && m.senderType === 'USER') {
          map.set(key, m);
        }
      }
    });
    return Array.from(map.values());
  }
};
