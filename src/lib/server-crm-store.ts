import fs from 'fs';
import path from 'path';
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

const DEFAULT_DELETED_CHAT_KEYS = [
  '5511915361868',
  '11915361868',
  'contact-zapi-5511915361868',
  'conv-zapi-5511915361868',
  '554896290235',
  '4896290235',
  '5548996290235',
  'contact-zapi-554896290235',
  'conv-zapi-554896290235',
];

declare global {
  var __SERVER_CRM_STATE__: ServerCRMState | undefined;
  var __GLOBAL_LID_PHONE_MAP__: Record<string, string> | undefined;
  var __GLOBAL_PHONE_LID_MAP__: Record<string, string> | undefined;
  var __GLOBAL_DELETED_CHAT_KEYS__: Set<string> | undefined;
}

function getCandidateStoragePaths(): string[] {
  const paths: string[] = [];
  if (process.env.CRM_STORAGE_FILE) {
    paths.push(process.env.CRM_STORAGE_FILE);
  }
  // 1. Diretório data do projeto local (persistência local e Docker)
  paths.push(path.join(process.cwd(), 'data', 'crm-state.json'));
  // 2. Diretório alternativo .data
  paths.push(path.join(process.cwd(), '.data', 'crm-state.json'));
  // 3. Fallback para /tmp (ambientes serverless, AWS Lambda onde cwd é somente leitura)
  paths.push(path.join('/tmp', 'crm-data', 'crm-state.json'));
  paths.push(path.join('/tmp', 'crm-state.json'));
  return paths;
}

let isSaving = false;
let pendingSave = false;

export function saveStateToDisk() {
  if (typeof window !== 'undefined') return;
  if (isSaving) {
    pendingSave = true;
    return;
  }
  isSaving = true;

  try {
    const payload = {
      version: '1.0',
      savedAt: new Date().toISOString(),
      state: global.__SERVER_CRM_STATE__,
      lidPhoneMap: global.__GLOBAL_LID_PHONE_MAP__,
      phoneLidMap: global.__GLOBAL_PHONE_LID_MAP__,
      deletedChatKeys: global.__GLOBAL_DELETED_CHAT_KEYS__ ? Array.from(global.__GLOBAL_DELETED_CHAT_KEYS__) : DEFAULT_DELETED_CHAT_KEYS,
    };

    const serialized = JSON.stringify(payload, null, 2);
    const candidatePaths = getCandidateStoragePaths();

    for (const filePath of candidatePaths) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
        fs.writeFileSync(tmpPath, serialized, 'utf-8');
        fs.renameSync(tmpPath, filePath);
        break; // Persistido com sucesso no primeiro caminho gravável
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.error('[serverCRMStore] Falha ao persistir dados do CRM em disco:', err);
  } finally {
    isSaving = false;
    if (pendingSave) {
      pendingSave = false;
      setTimeout(saveStateToDisk, 50);
    }
  }
}

export function loadStateFromDisk(): boolean {
  if (typeof window !== 'undefined') return false;

  const candidatePaths = getCandidateStoragePaths();
  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (!raw || !raw.trim()) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.state) {
          global.__SERVER_CRM_STATE__ = {
            contacts: parsed.state.contacts || [],
            deals: parsed.state.deals || [],
            conversations: parsed.state.conversations || [],
            messages: parsed.state.messages || [],
            aiInsights: parsed.state.aiInsights || {},
          };

          if (parsed.lidPhoneMap) {
            global.__GLOBAL_LID_PHONE_MAP__ = { ...(global.__GLOBAL_LID_PHONE_MAP__ || {}), ...parsed.lidPhoneMap };
          }
          if (parsed.phoneLidMap) {
            global.__GLOBAL_PHONE_LID_MAP__ = { ...(global.__GLOBAL_PHONE_LID_MAP__ || {}), ...parsed.phoneLidMap };
          }

          const existingDel = global.__GLOBAL_DELETED_CHAT_KEYS__ ? Array.from(global.__GLOBAL_DELETED_CHAT_KEYS__) : DEFAULT_DELETED_CHAT_KEYS;
          const restoredDel = Array.isArray(parsed.deletedChatKeys) ? parsed.deletedChatKeys : [];
          global.__GLOBAL_DELETED_CHAT_KEYS__ = new Set([...DEFAULT_DELETED_CHAT_KEYS, ...existingDel, ...restoredDel]);

          console.log(`[serverCRMStore] Estado restaurado de ${filePath}: ${global.__SERVER_CRM_STATE__.conversations.length} conversas, ${global.__SERVER_CRM_STATE__.contacts.length} contatos, ${global.__SERVER_CRM_STATE__.messages.length} mensagens.`);
          return true;
        }
      }
    } catch (err) {
      console.warn(`[serverCRMStore] Aviso ao carregar de ${filePath}:`, err);
    }
  }
  return false;
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

if (!global.__GLOBAL_DELETED_CHAT_KEYS__) {
  // Pre-popula com conversas que foram explicitamente excluídas pelo usuário (ex: Thais e Anna)
  global.__GLOBAL_DELETED_CHAT_KEYS__ = new Set(DEFAULT_DELETED_CHAT_KEYS);
}

// Carrega imediatamente dados persistidos do disco
loadStateFromDisk();


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
      saveStateToDisk();
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

  deleteChat(conversationId: string, phoneOrLid?: string): string[] {
    if (!global.__GLOBAL_DELETED_CHAT_KEYS__) {
      global.__GLOBAL_DELETED_CHAT_KEYS__ = new Set<string>(DEFAULT_DELETED_CHAT_KEYS);
    }
    const set = global.__GLOBAL_DELETED_CHAT_KEYS__;

    const addKey = (k?: string | null) => {
      if (!k) return;
      const clean = k.trim();
      if (!clean) return;
      set.add(clean);
      const digits = clean.replace(/\D/g, '');
      if (digits && digits.length >= 8) {
        set.add(digits);
        set.add(`conv-zapi-${digits}`);
        set.add(`contact-zapi-${digits}`);
        if (digits.startsWith('55') && digits.length >= 12) {
          const without55 = digits.slice(2);
          set.add(without55);
          set.add(`conv-zapi-${without55}`);
          set.add(`contact-zapi-${without55}`);
        } else if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
          const with55 = `55${digits}`;
          set.add(with55);
          set.add(`conv-zapi-${with55}`);
          set.add(`contact-zapi-${with55}`);
        }
      }
      if (clean.includes('@lid')) {
        const cl = cleanLid(clean);
        set.add(cl);
        set.add(`conv-zapi-${cl}`);
        set.add(`contact-zapi-${cl}`);
      }
    };

    addKey(conversationId);
    addKey(phoneOrLid);

    const state = this.getState();
    const conv = state.conversations.find(c => c.id === conversationId || set.has(c.id));
    if (conv) {
      addKey(conv.contactId);
      addKey(conv.id);
    }
    const contact = state.contacts.find(c => (conv && c.id === conv.contactId) || set.has(c.id) || (c.phone && set.has(c.phone.replace(/\D/g, ''))));
    if (contact) {
      addKey(contact.id);
      addKey(contact.phone);
      addKey(contact.lid);
    }

    // Remove imediatamente do estado em memória
    state.conversations = state.conversations.filter(c => !this.isChatDeleted(c.id) && !this.isChatDeleted(c.contactId));
    state.contacts = state.contacts.filter(c => !this.isChatDeleted(c.id) && !this.isChatDeleted(c.phone) && !this.isChatDeleted(c.lid));
    state.messages = state.messages.filter(m => !this.isChatDeleted(m.conversationId));
    state.deals = state.deals.filter(d => !this.isChatDeleted(d.contactId));

    saveStateToDisk();
    return Array.from(set);
  },

  isChatDeleted(idOrPhone?: string | null): boolean {
    if (!idOrPhone) return false;
    if (!global.__GLOBAL_DELETED_CHAT_KEYS__) return false;
    const clean = idOrPhone.trim();
    if (global.__GLOBAL_DELETED_CHAT_KEYS__.has(clean)) return true;
    const digits = clean.replace(/\D/g, '');
    if (digits && global.__GLOBAL_DELETED_CHAT_KEYS__.has(digits)) return true;
    return false;
  },

  getDeletedChatKeys(): string[] {
    if (!global.__GLOBAL_DELETED_CHAT_KEYS__) return [];
    return Array.from(global.__GLOBAL_DELETED_CHAT_KEYS__);
  },

  getState(): ServerCRMState {
    if (!global.__SERVER_CRM_STATE__ || (global.__SERVER_CRM_STATE__.conversations.length === 0 && global.__SERVER_CRM_STATE__.contacts.length === 0)) {
      loadStateFromDisk();
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
    // Remove conversas e contatos deletados
    if (global.__GLOBAL_DELETED_CHAT_KEYS__ && global.__GLOBAL_DELETED_CHAT_KEYS__.size > 0) {
      global.__SERVER_CRM_STATE__.conversations = global.__SERVER_CRM_STATE__.conversations.filter(
        c => !this.isChatDeleted(c.id) && !this.isChatDeleted(c.contactId)
      );
      global.__SERVER_CRM_STATE__.contacts = global.__SERVER_CRM_STATE__.contacts.filter(
        c => !this.isChatDeleted(c.id) && !this.isChatDeleted(c.phone) && !this.isChatDeleted(c.lid)
      );
      global.__SERVER_CRM_STATE__.messages = global.__SERVER_CRM_STATE__.messages.filter(
        m => !this.isChatDeleted(m.conversationId)
      );
      global.__SERVER_CRM_STATE__.deals = global.__SERVER_CRM_STATE__.deals.filter(
        d => !this.isChatDeleted(d.contactId)
      );
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
    saveStateToDisk();
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
    saveStateToDisk();
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
      if (this.isChatDeleted(c.id) || this.isChatDeleted(c.phone) || this.isChatDeleted(c.lid)) return;

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
      if (this.isChatDeleted(conv.id) || this.isChatDeleted(conv.contactId)) return;
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

    // Índice de remapeamento de LID -> Telefone Canônico para unificação de conversa
    const lidToPhone = new Map<string, string>();
    contacts.forEach(c => {
      if (c.lid && c.phone && !isLidIdentifier(c.phone)) {
        const clean = c.phone.replace(/\D/g, '');
        const p = clean.startsWith('55') ? clean : `55${clean}`;
        lidToPhone.set(cleanLid(c.lid), p);
      }
    });

    // Identifica conversas para as quais um lote novo de mensagens está sendo ingerido
    const freshSyncConvIds = new Set<string>();
    newMsgs.forEach(m => {
      if (m.conversationId) freshSyncConvIds.add(m.conversationId);
    });

    // Se temos um novo lote estruturado da extensão para uma conversa, descarta placeholders sintéticos
    // e mensagens temporárias anteriores da extensão que possam conter carimbos de hora desatualizados
    const filteredOldMsgs = oldMsgs.filter(m => {
      if (!freshSyncConvIds.has(m.conversationId)) return true;
      if (m.content && m.content.startsWith('Conversa ativa no WhatsApp com')) return false;

      const isOldExtMsg = m.id.startsWith('ext-msg-') || m.id.startsWith('wpp-ext-');
      const isIncomingFromExt = newMsgs.some(nm => nm.conversationId === m.conversationId && (nm.id.startsWith('ext-msg-') || nm.id.startsWith('wpp-ext-') || nm.id.startsWith('false_') || nm.id.startsWith('true_')));
      if (isOldExtMsg && isIncomingFromExt) {
        return false;
      }
      return true;
    });

    const all = [...filteredOldMsgs, ...newMsgs];

    all.forEach(m => {
      if (!m || !m.conversationId || this.isChatDeleted(m.conversationId)) return;
      const content = (m.content || '').trim();
      if (!content || isWhatsAppSystemMessage(content)) return;

      const cleanLower = content.toLowerCase();
      if (
        /^\d([.,]\d)?[xX]$/i.test(content) ||
        cleanLower.includes('mensagem apagada') ||
        cleanLower.includes('esta mensagem foi apagada') ||
        cleanLower.includes('message was deleted') ||
        cleanLower === 'tail-out' ||
        cleanLower === 'tail-in' ||
        cleanLower === 'ic-fast-forward'
      ) {
        return;
      }

      let convId = m.conversationId;
      const convDigits = convId.replace(/\D/g, '');

      // Higieniza mensagens fantasmas residuais que foram salvas com carimbo de hora incorreto entre 14:54 e 22:23 de 10/09 para a conversa de Amor
      if (
        (convId.includes('554899797603') || convId.includes('5548999797603') || convDigits.includes('554899797603') || convDigits.includes('5548999797603')) &&
        m.timestamp && m.timestamp.startsWith('2026-09-10')
      ) {
        const timeStr = m.timestamp.slice(11, 16);
        if (timeStr > '14:53' && timeStr < '22:24') {
          return;
        }
      }

      // Normaliza conversationId: se for um LID conhecido, reatribui para o telefone canônico!
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

      const isNativeWppId = Boolean(m.id && (m.id.startsWith('true_') || m.id.startsWith('false_')));
      const timeKey = m.timestamp ? m.timestamp.slice(0, 19) : '';
      const key = isNativeWppId ? m.id! : `${convId}-${content}-${timeKey}-${m.senderType}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, normalizedMsg);
      } else {
        map.set(key, {
          ...existing,
          ...normalizedMsg,
          attachments: normalizedMsg.attachments || existing.attachments,
          timestamp: normalizedMsg.timestamp || existing.timestamp,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }
};
