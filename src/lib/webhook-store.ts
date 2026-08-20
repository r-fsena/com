export interface LiveWebhookMessage {
  id: string;
  tenantId: string;
  instanceId: string;
  phone: string;
  senderName: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'audio' | 'document';
  fromMe: boolean;
  timestamp: string;
  receivedAt: number;
}

// Global buffer para reter mensagens recentes entre chamadas serverless / frontend polling
declare global {
  var __GLOBAL_ZAPI_MESSAGES__: LiveWebhookMessage[] | undefined;
}

if (!global.__GLOBAL_ZAPI_MESSAGES__) {
  global.__GLOBAL_ZAPI_MESSAGES__ = [];
}

export const webhookStore = {
  addMessage(msg: Omit<LiveWebhookMessage, 'receivedAt'>) {
    const fullMsg: LiveWebhookMessage = {
      ...msg,
      receivedAt: Date.now(),
    };
    
    if (!global.__GLOBAL_ZAPI_MESSAGES__) {
      global.__GLOBAL_ZAPI_MESSAGES__ = [];
    }

    // Evita duplicatas pelo ID da mensagem
    if (!global.__GLOBAL_ZAPI_MESSAGES__.some(m => m.id === fullMsg.id)) {
      global.__GLOBAL_ZAPI_MESSAGES__.unshift(fullMsg);
      // Mantém no máximo 100 mensagens no buffer
      if (global.__GLOBAL_ZAPI_MESSAGES__.length > 100) {
        global.__GLOBAL_ZAPI_MESSAGES__.pop();
      }
    }
    return fullMsg;
  },

  getMessagesSince(sinceTimestamp: number) {
    const list = global.__GLOBAL_ZAPI_MESSAGES__ || [];
    return list.filter(m => m.receivedAt > sinceTimestamp);
  },

  getAllMessages() {
    return global.__GLOBAL_ZAPI_MESSAGES__ || [];
  }
};
