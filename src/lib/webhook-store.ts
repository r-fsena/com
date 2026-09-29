import fs from 'fs';
import path from 'path';

export interface LiveWebhookMessage {
  id: string;
  tenantId: string;
  instanceId: string;
  phone: string;
  lid?: string;
  senderName: string;
  chatName?: string;
  senderPhoto?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'audio' | 'document';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fromMe: boolean;
  timestamp: string;
  receivedAt: number;
}

// Global buffer para reter mensagens recentes entre chamadas serverless / frontend polling
declare global {
  var __GLOBAL_ZAPI_MESSAGES__: LiveWebhookMessage[] | undefined;
}

function getWebhookCachePath(): string {
  return path.join('/tmp', 'webhook-events.json');
}

function loadFromDisk(): LiveWebhookMessage[] {
  try {
    const p = getWebhookCachePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}
  return [];
}

function saveToDisk(msgs: LiveWebhookMessage[]) {
  try {
    const p = getWebhookCachePath();
    fs.writeFileSync(p, JSON.stringify(msgs.slice(0, 100)), 'utf-8');
  } catch {}
}

if (!global.__GLOBAL_ZAPI_MESSAGES__) {
  global.__GLOBAL_ZAPI_MESSAGES__ = loadFromDisk();
}

export const webhookStore = {
  addMessage(msg: Omit<LiveWebhookMessage, 'receivedAt'>) {
    const fullMsg: LiveWebhookMessage = {
      ...msg,
      receivedAt: Date.now(),
    };
    
    if (!global.__GLOBAL_ZAPI_MESSAGES__ || global.__GLOBAL_ZAPI_MESSAGES__.length === 0) {
      global.__GLOBAL_ZAPI_MESSAGES__ = loadFromDisk();
    }

    const existingIdx = global.__GLOBAL_ZAPI_MESSAGES__.findIndex(m => m.id === fullMsg.id);
    if (existingIdx >= 0) {
      // Atualiza a mensagem existente (ex: se mudou fromMe)
      global.__GLOBAL_ZAPI_MESSAGES__[existingIdx] = fullMsg;
    } else {
      global.__GLOBAL_ZAPI_MESSAGES__.unshift(fullMsg);
      // Mantém no máximo 100 mensagens no buffer
      if (global.__GLOBAL_ZAPI_MESSAGES__.length > 100) {
        global.__GLOBAL_ZAPI_MESSAGES__.pop();
      }
    }

    saveToDisk(global.__GLOBAL_ZAPI_MESSAGES__);
    return fullMsg;
  },

  getMessagesSince(sinceTimestamp: number) {
    let list = global.__GLOBAL_ZAPI_MESSAGES__ || [];
    if (list.length === 0) {
      list = loadFromDisk();
      global.__GLOBAL_ZAPI_MESSAGES__ = list;
    }
    return list.filter(m => m.receivedAt > sinceTimestamp);
  },

  getAllMessages() {
    let list = global.__GLOBAL_ZAPI_MESSAGES__ || [];
    if (list.length === 0) {
      list = loadFromDisk();
      global.__GLOBAL_ZAPI_MESSAGES__ = list;
    }
    return list;
  },

  clearAll() {
    global.__GLOBAL_ZAPI_MESSAGES__ = [];
    saveToDisk([]);
  }
};
