import { Contact, Deal, Conversation, Message, AIInsight } from '@/types/crm';
import { isWhatsAppSystemMessage, isLidIdentifier, cleanLid, canonicalPhoneKey, arePhonesEquivalent } from '@/lib/whatsapp-filter';

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
  var __GLOBAL_LID_PHONE_MAP__: Record<string, string> | undefined;
  var __GLOBAL_PHONE_LID_MAP__: Record<string, string> | undefined;
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

if (!global.__GLOBAL_LID_PHONE_MAP__) {
  global.__GLOBAL_LID_PHONE_MAP__ = {};
}

if (!global.__GLOBAL_PHONE_LID_MAP__) {
  global.__GLOBAL_PHONE_LID_MAP__ = {};
}

export const serverCRMStore = {
  // Mapeamento Bidirecional Global de WhatsApp LID <-> Telefone Canônico
  registerLidPhone(lidRaw?: string | null, phoneRaw?: string | null) {
    if (!lidRaw || !phoneRaw) return;
    const l = cleanLid(lidRaw);
    const pKey = canonicalPhoneKey(phoneRaw);
    const pDigits = phoneRaw.replace(/\D/g, '');

    // Apenas registra se o 'phone' for um telefone real e não outro LID
    if (l && l.length >= 8 && pKey && !isLidIdentifier(phoneRaw)) {
      if (!global.__GLOBAL_LID_PHONE_MAP__) global.__GLOBAL_LID_PHONE_MAP__ = {};
      if (!global.__GLOBAL_PHONE_LID_MAP__) global.__GLOBAL_PHONE_LID_MAP__ = {};

      const cleanPhone = pDigits.startsWith('55') ? pDigits : `55${pDigits}`;
      global.__GLOBAL_LID_PHONE_MAP__[l] = cleanPhone;
      global.__GLOBAL_PHONE_LID_MAP__[pKey] = l;
      global.__GLOBAL_PHONE_LID_MAP__[cleanPhone] = l;
    }
  },

  async fetchAndCacheZapiLidMap(
    instanceId?: string,
    instanceToken?: string,
    clientToken?: string
  ): Promise<Record<string, string>> {
    const instId = instanceId || process.env.ZAPI_INSTANCE_ID || '3F8144490C66805B4E3FD64A35E2F2DC';
    const instTok = instanceToken || process.env.ZAPI_INSTANCE_TOKEN || '550DBC07B2F984AB74E4BCE5';
    const secTok = clientToken || process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || 'Fc78d61c833db4b50864816b70766aee8S';

    if (!instId || !instTok) return global.__GLOBAL_LID_PHONE_MAP__ || {};

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secTok) headers['Client-Token'] = secTok;

      const res = await fetch(`https://api.z-api.io/instances/${instId}/token/${instTok}/chats?page=1&pageSize=100`, {
        headers,
        cache: 'no-store',
      });

      if (res.ok) {
        const chats = await res.json();
        if (Array.isArray(chats)) {
          chats.forEach((c: any) => {
            if (c.lid && c.phone && !isLidIdentifier(c.phone)) {
              this.registerLidPhone(c.lid, c.phone);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[serverCRMStore] Falha ao sincronizar mapa LID-telefone da Z-API:', err);
    }

    return global.__GLOBAL_LID_PHONE_MAP__ || {};
  },

  async resolvePhoneFromLidAsync(
    lidRaw?: string | null,
    instanceId?: string,
    instanceToken?: string,
    clientToken?: string
  ): Promise<string | null> {
    if (!lidRaw) return null;
    const syncResult = this.resolvePhoneFromLid(lidRaw);
    if (syncResult) return syncResult;

    // Se ainda não resolveu, carrega o catálogo de chats da Z-API em tempo real
    await this.fetchAndCacheZapiLidMap(instanceId, instanceToken, clientToken);
    return this.resolvePhoneFromLid(lidRaw);
  },

  resolvePhoneFromLid(lidRaw?: string | null): string | null {
    if (!lidRaw) return null;
    const l = cleanLid(lidRaw);
    if (!l) return null;

    // 1. Consulta mapa em memória
    if (global.__GLOBAL_LID_PHONE_MAP__ && global.__GLOBAL_LID_PHONE_MAP__[l]) {
      return global.__GLOBAL_LID_PHONE_MAP__[l];
    }

    // 2. Consulta contatos existentes no estado
    const state = this.getState();
    const contact = state.contacts.find(c => {
      if (c.lid && cleanLid(c.lid) === l) return true;
      if (c.phone && isLidIdentifier(c.phone) && cleanLid(c.phone) === l) return true;
      return false;
    });

    if (contact && contact.phone && !isLidIdentifier(contact.phone)) {
      const clean = contact.phone.replace(/\D/g, '');
      const full = clean.startsWith('55') ? clean : `55${clean}`;
      this.registerLidPhone(l, full);
      return full;
    }

    return null;
  },

  resolveLidFromPhone(phoneRaw?: string | null): string | null {
    if (!phoneRaw) return null;
    const pKey = canonicalPhoneKey(phoneRaw);
    if (global.__GLOBAL_PHONE_LID_MAP__ && global.__GLOBAL_PHONE_LID_MAP__[pKey]) {
      return global.__GLOBAL_PHONE_LID_MAP__[pKey];
    }
    const clean = phoneRaw.replace(/\D/g, '');
    if (global.__GLOBAL_PHONE_LID_MAP__ && global.__GLOBAL_PHONE_LID_MAP__[clean]) {
      return global.__GLOBAL_PHONE_LID_MAP__[clean];
    }
    return null;
  },

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
    // Higieniza mensagens caso existam avisos de sistema prévios
    if (global.__SERVER_CRM_STATE__.messages?.some(m => isWhatsAppSystemMessage(m.content))) {
      global.__SERVER_CRM_STATE__.messages = global.__SERVER_CRM_STATE__.messages.filter(m => !isWhatsAppSystemMessage(m.content));
    }
    // Garante que todo contato seja tratado como lead comercial (isPersonal: false) por padrão
    if (global.__SERVER_CRM_STATE__.contacts) {
      global.__SERVER_CRM_STATE__.contacts = global.__SERVER_CRM_STATE__.contacts.map(c => ({
        ...c,
        isPersonal: c.isPersonal === true ? true : false,
      }));
    }
    if (global.__SERVER_CRM_STATE__.conversations) {
      global.__SERVER_CRM_STATE__.conversations = global.__SERVER_CRM_STATE__.conversations.map(c => ({
        ...c,
        isPersonal: c.isPersonal === true ? true : false,
      }));
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
    global.__GLOBAL_LID_PHONE_MAP__ = {};
    global.__GLOBAL_PHONE_LID_MAP__ = {};
    return fresh;
  },

  updateState(partial: Partial<ServerCRMState>): ServerCRMState {
    const current = this.getState();

    // Se novos contatos forem fornecidos, processa e registra pares LID <-> Telefone
    const mergedContacts = partial.contacts ? this.mergeContacts(current.contacts, partial.contacts) : current.contacts;

    // Normaliza conversas garantindo unicidade por contato canônico
    const rawConvs = partial.conversations || current.conversations;
    const cleanConvs = this.mergeConversations(current.conversations, rawConvs, mergedContacts);

    // Normaliza mensagens garantindo que enviadas e recebidas compartilhem a mesma conversa canônica
    const mergedMessages = partial.messages ? this.mergeMessages(current.messages, partial.messages, mergedContacts) : current.messages;

    const next: ServerCRMState = {
      contacts: mergedContacts,
      deals: partial.deals || current.deals,
      conversations: cleanConvs,
      messages: mergedMessages,
      aiInsights: partial.aiInsights ? { ...current.aiInsights, ...partial.aiInsights } : current.aiInsights,
    };
    global.__SERVER_CRM_STATE__ = next;
    return next;
  },

  mergeContacts(oldList: Contact[], newList: Contact[]): Contact[] {
    const phoneMap = new Map<string, Contact>();
    const lidMap = new Map<string, Contact>();
    const idMap = new Map<string, Contact>();
    const nameMap = new Map<string, Contact>();
    const result: Contact[] = [];

    const all = [...oldList, ...newList];
    all.forEach(c => {
      if (!c) return;

      const isPhoneLid = isLidIdentifier(c.phone);
      const pureLid = cleanLid(c.lid || (isPhoneLid ? c.phone : ''));
      
      let realPhone = !isPhoneLid ? c.phone : '';
      if (!realPhone && pureLid) {
        const resolved = this.resolvePhoneFromLid(pureLid);
        if (resolved) realPhone = resolved;
      }

      const pKey = realPhone ? canonicalPhoneKey(realPhone) : '';
      const normName = c.name && !c.name.startsWith('+') && !c.name.startsWith('WhatsApp') && c.name !== 'Lead WhatsApp' && c.name !== 'Cliente'
        ? c.name.toLowerCase().trim()
        : '';

      const existing = (pKey ? phoneMap.get(pKey) : null) ||
                       (pureLid ? lidMap.get(pureLid) : null) ||
                       idMap.get(c.id) ||
                       (normName ? nameMap.get(normName) : null);

      if (existing) {
        const existingIsLid = isLidIdentifier(existing.phone);
        const finalPhone = (!existingIsLid && existing.phone) 
          ? existing.phone 
          : (realPhone || existing.phone);

        const finalLid = existing.lid || pureLid || (existingIsLid ? cleanLid(existing.phone) : undefined);
        const finalId = finalPhone && !isLidIdentifier(finalPhone)
          ? `contact-zapi-${finalPhone.replace(/\D/g, '')}`
          : existing.id;

        if (finalLid && finalPhone && !isLidIdentifier(finalPhone)) {
          this.registerLidPhone(finalLid, finalPhone);
        }

        const merged: Contact = {
          ...existing,
          ...c,
          id: finalId,
          phone: finalPhone,
          lid: finalLid,
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
          isPersonal: c.isPersonal !== undefined ? c.isPersonal : (existing.isPersonal ?? false),
          updatedAt: new Date().toISOString(),
        };

        const finalKey = canonicalPhoneKey(finalPhone);
        if (finalKey) phoneMap.set(finalKey, merged);
        if (finalLid) lidMap.set(cleanLid(finalLid), merged);
        if (normName) nameMap.set(normName, merged);
        idMap.set(merged.id, merged);

        const idx = result.findIndex(x => x.id === existing.id || x.id === merged.id);
        if (idx >= 0) result[idx] = merged;
      } else {
        const finalLid = pureLid || (isPhoneLid ? cleanLid(c.phone) : undefined);
        const finalPhone = realPhone || c.phone;

        if (finalLid && finalPhone && !isLidIdentifier(finalPhone)) {
          this.registerLidPhone(finalLid, finalPhone);
        }

        const withTimestamps: Contact = {
          ...c,
          phone: finalPhone,
          lid: finalLid,
          isPersonal: c.isPersonal ?? false,
          firstSyncedAt: c.firstSyncedAt || new Date().toISOString(),
          lastSyncedAt: c.lastSyncedAt || new Date().toISOString(),
        };
        if (pKey) phoneMap.set(pKey, withTimestamps);
        if (finalLid) lidMap.set(cleanLid(finalLid), withTimestamps);
        if (normName) nameMap.set(normName, withTimestamps);
        idMap.set(c.id, withTimestamps);
        result.push(withTimestamps);
      }
    });

    return result;
  },

  mergeConversations(oldConvs: Conversation[], newConvs: Conversation[], contacts: Contact[]): Conversation[] {
    const map = new Map<string, Conversation>();
    const all = [...oldConvs, ...newConvs];

    // Cria índice de contatos para resolução de IDs canônicos
    const contactByPhone = new Map<string, Contact>();
    const contactByLid = new Map<string, Contact>();
    const contactById = new Map<string, Contact>();

    contacts.forEach(c => {
      contactById.set(c.id, c);
      if (c.phone && !isLidIdentifier(c.phone)) {
        contactByPhone.set(canonicalPhoneKey(c.phone), c);
      }
      if (c.lid) {
        contactByLid.set(cleanLid(c.lid), c);
      }
    });

    all.forEach(conv => {
      if (!conv) return;
      const rawDigits = conv.id.replace(/\D/g, '');
      const isLid = isLidIdentifier(rawDigits);

      // Determina o contato canônico dono desta conversa
      let contact = contactById.get(conv.contactId);
      if (!contact && isLid) {
        contact = contactByLid.get(cleanLid(rawDigits));
      }
      if (!contact && rawDigits) {
        contact = contactByPhone.get(canonicalPhoneKey(rawDigits));
      }

      const canonicalPhone = contact?.phone && !isLidIdentifier(contact.phone)
        ? contact.phone.replace(/\D/g, '')
        : (isLid ? (this.resolvePhoneFromLid(rawDigits) || rawDigits) : rawDigits);

      const canonicalConvId = canonicalPhone 
        ? `conv-zapi-${canonicalPhone}`
        : conv.id;

      const preview = (conv.lastMessagePreview && isWhatsAppSystemMessage(conv.lastMessagePreview))
        ? 'Conversa sincronizada via WhatsApp'
        : conv.lastMessagePreview;

      const existing = map.get(canonicalConvId);
      if (existing) {
        // Preserva a mensagem mais recente entre as duas
        const timeA = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
        const timeB = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
        const useNewer = timeB > timeA;

        map.set(canonicalConvId, {
          ...existing,
          ...conv,
          id: canonicalConvId,
          contactId: contact?.id || existing.contactId || conv.contactId,
          lastMessagePreview: useNewer ? (preview || existing.lastMessagePreview) : existing.lastMessagePreview,
          lastMessageAt: useNewer ? conv.lastMessageAt : existing.lastMessageAt,
          unreadCount: Math.max(existing.unreadCount || 0, conv.unreadCount || 0),
        });
      } else {
        map.set(canonicalConvId, {
          ...conv,
          id: canonicalConvId,
          contactId: contact?.id || conv.contactId,
          lastMessagePreview: preview,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });
  },

  mergeMessages(oldMsgs: Message[], newMsgs: Message[], contacts: Contact[]): Message[] {
    const map = new Map<string, Message>();
    const all = [...oldMsgs, ...newMsgs];

    // Índice de remapeamento de LID -> Telefone Canônico para unificação de conversa
    const lidToPhone = new Map<string, string>();
    contacts.forEach(c => {
      if (c.lid && c.phone && !isLidIdentifier(c.phone)) {
        const clean = c.phone.replace(/\D/g, '');
        const p = clean.startsWith('55') ? clean : `55${clean}`;
        lidToPhone.set(cleanLid(c.lid), p);
      }
    });

    all.forEach(m => {
      const content = (m.content || '').trim();
      if (!content || isWhatsAppSystemMessage(content)) return;

      // Normaliza conversationId: se for um LID conhecido, reatribui para o telefone canônico!
      let convId = m.conversationId;
      const convDigits = convId.replace(/\D/g, '');
      if (isLidIdentifier(convDigits)) {
        const mappedPhone = lidToPhone.get(cleanLid(convDigits)) || this.resolvePhoneFromLid(convDigits);
        if (mappedPhone) {
          convId = `conv-zapi-${mappedPhone}`;
        }
      }

      const normalizedMsg: Message = {
        ...m,
        conversationId: convId,
      };

      const timeKey = m.timestamp ? m.timestamp.slice(0, 16) : '';
      const key = `${convId}-${content}-${timeKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, normalizedMsg);
      } else {
        // Promove de CONTACT para USER caso venha nova versão com identificação correta
        if (existing.senderType === 'CONTACT' && normalizedMsg.senderType === 'USER') {
          map.set(key, normalizedMsg);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }
};
