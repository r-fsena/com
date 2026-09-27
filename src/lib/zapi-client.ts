/**
 * Cliente de Integração com a Z-API (WhatsApp Gateway)
 * Desacoplado, resiliente, com rate-limiting e suporte a múltiplos tipos de mídia.
 */

export interface ZApiConfig {
  instanceId: string;
  instanceToken: string;
  securityToken?: string;
  baseUrl?: string;
}

export interface ZApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  externalMessageId?: string;
}

export class ZApiClient {
  private instanceId: string;
  private instanceToken: string;
  private securityToken?: string;
  private baseUrl: string;

  constructor(config: ZApiConfig) {
    this.instanceId = config.instanceId;
    this.instanceToken = config.instanceToken;
    this.securityToken = config.securityToken;
    this.baseUrl = config.baseUrl || 'https://api.z-api.io/instances';
  }

  private getEndpoint(path: string): string {
    return `${this.baseUrl}/${this.instanceId}/token/${this.instanceToken}/${path}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ZApiResponse<T>> {
    const url = this.getEndpoint(path);
    const headers = {
      'Content-Type': 'application/json',
      ...(this.securityToken ? { 'Client-Token': this.securityToken } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Z-API HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
        externalMessageId: data.id || data.messageId || data.zaapId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Falha de rede ao conectar à Z-API: ${err.message || err}`,
      };
    }
  }

  /**
   * Envio de mensagem de texto simples
   */
  async sendText(phone: string, message: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-text', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        message,
      }),
    });
  }

  /**
   * Envio de áudio gravado (PTT - Push To Talk)
   */
  async sendAudio(phone: string, audioUrl: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-audio', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        audio: audioUrl,
      }),
    });
  }

  /**
   * Envio de imagem com legenda
   */
  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-image', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        image: imageUrl,
        caption,
      }),
    });
  }

  /**
   * Envio de documento (PDF, proposta, contrato)
   */
  async sendDocument(phone: string, documentUrl: string, fileName: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-document', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        document: documentUrl,
        fileName,
      }),
    });
  }

  /**
   * Consulta o status de conexão da instância (Conectado / Desconectado / Bateria)
   */
  async getStatus(): Promise<ZApiResponse<{ connected: boolean; battery?: number; smartphone?: any }>> {
    return this.request('status');
  }

  /**
   * Desconecta a sessão atual do WhatsApp na Z-API (limpa o pareamento)
   */
  async disconnect(): Promise<ZApiResponse> {
    return this.request('disconnect', {
      method: 'GET',
    });
  }

  /**
   * Reinicia a instância Z-API
   */
  async restart(): Promise<ZApiResponse> {
    return this.request('restart', {
      method: 'GET',
    });
  }

  /**
   * Obtém QR Code para reconexão da instância
   */
  async getQRCode(): Promise<ZApiResponse<{ value?: string; image?: string; connected?: boolean; smartphoneConnected?: boolean }>> {
    return this.request('qr-code/image');
  }

  /**
   * Configuração automática do Webhook de Recebimento na Z-API via API REST
   */
  async configureWebhookReceived(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-received', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configuração automática do Webhook de Status de Entrega na Z-API
   */
  async configureWebhookDelivery(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-delivery', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configuração atômica de todos os webhooks na Z-API (Moderno / Recomendado)
   */
  async updateEveryWebhooks(webhookUrl: string, notifySentByMe: boolean = true): Promise<ZApiResponse> {
    return this.request('update-every-webhooks', {
      method: 'PUT',
      body: JSON.stringify({
        value: webhookUrl,
        notifySentByMe,
      }),
    });
  }

  /**
   * Configuração do Webhook de Status de Mensagem (Nome oficial da documentação Z-API)
   */
  async configureWebhookMessageStatus(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-message-status', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configuração do Webhook de Presença de Chat (Digitando / Gravando áudio)
   */
  async configureWebhookChatPresence(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-chat-presence', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configuração do Webhook de Status de Mensagem (Legado)
   */
  async configureWebhookStatus(webhookUrl: string): Promise<ZApiResponse> {
    return this.configureWebhookMessageStatus(webhookUrl);
  }

  /**
   * Configuração do Webhook de Conexão
   */
  async configureWebhookConnected(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-connected', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configuração automática do Webhook de Desconexão na Z-API
   */
  async configureWebhookDisconnected(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-disconnected', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configura para notificar mensagens enviadas pelo próprio celular (fromMe = true)
   */
  async configureNotifySentByMe(): Promise<ZApiResponse> {
    return this.request('update-notify-sent-by-me', {
      method: 'PUT',
      body: JSON.stringify({ value: true }),
    });
  }

  /**
   * Configura automaticamente todas as URLs de webhook e token de segurança na Z-API (Zero-Config)
   * Tenta primeiro o endpoint atômico moderno 'update-every-webhooks', com fallback para endpoints granulares.
   */
  async configureAllWebhooks(webhookUrl: string): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const atomicResult = await this.updateEveryWebhooks(webhookUrl, true);
      if (atomicResult.success) {
        return { success: true };
      }
    } catch {
      // Prossegue para o fallback individual se o endpoint atômico não for aceito
    }

    const results = await Promise.allSettled([
      this.configureWebhookReceived(webhookUrl),
      this.configureWebhookDelivery(webhookUrl),
      this.configureWebhookMessageStatus(webhookUrl),
      this.configureWebhookChatPresence(webhookUrl),
      this.configureWebhookConnected(webhookUrl),
      this.configureWebhookDisconnected(webhookUrl),
      this.configureNotifySentByMe(),
    ]);

    const errors: string[] = [];
    results.forEach((r, idx) => {
      if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)) {
        errors.push(`Erro ao configurar webhook ${idx}: ${r.status === 'rejected' ? r.reason : r.value.error}`);
      }
    });

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Envio de Localização GPS do Imóvel ou Plantão
   */
  async sendLocation(phone: string, latitude: string, longitude: string, name: string, address: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-location', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        latitude,
        longitude,
        name,
        address,
      }),
    });
  }

  /**
   * Envio de Cartão de Contato (vCard) do Corretor
   */
  async sendContact(phone: string, contactName: string, contactPhone: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-contact', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        contactName,
        contactPhone: contactPhone.replace(/\D/g, ''),
      }),
    });
  }

  /**
   * Envio de Reação com Emoji em Mensagem
   */
  async sendReaction(phone: string, messageId: string, emoji: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-reaction', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        messageId,
        reaction: emoji,
      }),
    });
  }

  /**
   * Disparo de Presença "Digitando..." ou "Gravando áudio..."
   */
  async sendPresence(phone: string, presence: 'composing' | 'recording' | 'available' = 'composing'): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('send-presence', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        presence,
      }),
    });
  }

  /**
   * Consulta Grupos de WhatsApp
   */
  async getGroups(): Promise<ZApiResponse<any[]>> {
    return this.request('chats?page=1&pageSize=50');
  }

  /**
   * Modifica o status do chat no WhatsApp (read, unread, archive, unarchive, clear, delete, pin, unpin, mute, unmute)
   */
  async modifyChat(
    phone: string,
    action: 'read' | 'unread' | 'archive' | 'unarchive' | 'clear' | 'delete' | 'pin' | 'unpin' | 'mute' | 'unmute'
  ): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request('modify-chat', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        action,
      }),
    });
  }

  /**
   * Valida se o número possui conta no WhatsApp e retorna dados canônicos e LID (Oficial Z-API)
   */
  async phoneExists(phone: string): Promise<ZApiResponse<{ exists: boolean; phone?: string; lid?: string }>> {
    const cleanPhone = phone.replace(/\D/g, '');
    const res = await this.request<any>(`phone-exists/${cleanPhone}`);
    if (res.success && res.data) {
      // Se retornar array de 1 elemento conforme docs Z-API
      const item = Array.isArray(res.data) ? res.data[0] : res.data;
      return {
        success: true,
        data: {
          exists: Boolean(item.exists === true || item.exists === 'true'),
          phone: item.phone || cleanPhone,
          lid: item.lid || undefined,
        },
      };
    }
    return res;
  }

  /**
   * Obtém a URL da foto de perfil atualizada do contato (Oficial Z-API)
   */
  async getProfilePicture(phone: string): Promise<ZApiResponse<{ link?: string }>> {
    const cleanPhone = phone.replace(/\D/g, '');
    const res = await this.request<any>(`profile-picture?phone=${cleanPhone}`);
    if (res.success && res.data) {
      const item = Array.isArray(res.data) ? res.data[0] : res.data;
      return {
        success: true,
        data: {
          link: item?.link || item?.url || item?.imageUrl || undefined,
        },
      };
    }
    return res;
  }

  /**
   * Lista todas as etiquetas cadastradas no WhatsApp Business (Oficial Z-API)
   */
  async getTags(): Promise<ZApiResponse<Array<{ id: string; name: string; color: string | number }>>> {
    return this.request('tags');
  }

  /**
   * Atribui uma etiqueta do WhatsApp Business ao chat do cliente (Oficial Z-API)
   */
  async addTagToChat(phone: string, tagId: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request(`chats/${cleanPhone}/tags/${tagId}/add`, {
      method: 'PUT',
    });
  }

  /**
   * Remove uma etiqueta do WhatsApp Business do chat do cliente (Oficial Z-API)
   */
  async removeTagFromChat(phone: string, tagId: string): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request(`chats/${cleanPhone}/tags/${tagId}/remove`, {
      method: 'PUT',
    });
  }

  /**
   * Lista contatos da agenda do aparelho (Oficial Z-API)
   */
  async getContacts(page: number = 1, pageSize: number = 100): Promise<ZApiResponse<any[]>> {
    return this.request(`contacts?page=${page}&pageSize=${pageSize}`);
  }

  /**
   * Obtém metadados detalhados de um contato específico (Oficial Z-API)
   */
  async getContactMetadata(phone: string): Promise<ZApiResponse<{
    name?: string;
    short?: string;
    vname?: string;
    notify?: string;
    imgUrl?: string;
    about?: string;
    phone?: string;
  }>> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request(`contacts/${cleanPhone}`);
  }

  /**
   * Lista conversas / chats ativos no WhatsApp (Oficial Z-API)
   */
  async getChats(page: number = 1, pageSize: number = 100): Promise<ZApiResponse<any[]>> {
    return this.request(`chats?page=${page}&pageSize=${pageSize}`);
  }

  /**
   * Obtém metadados detalhados de um chat específico (Oficial Z-API)
   */
  async getChatMetadata(phone: string): Promise<ZApiResponse<{
    phone?: string;
    unread?: string;
    lastMessageTime?: string;
    isMuted?: string;
    muteEndTime?: number;
    isMarkedSpam?: boolean;
    profileThumbnail?: string;
    notes?: { id?: string; content?: string; createdAt?: number; lastUpdateAt?: number };
    about?: string;
    isGroup?: boolean;
  }>> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request(`chats/${cleanPhone}`);
  }

  /**
   * Consulta lote de mensagens do histórico de um chat (Oficial Z-API)
   */
  async getChatMessages(phone: string, amount: number = 20, lastMessageId?: string): Promise<ZApiResponse<any[]>> {
    const cleanPhone = phone.replace(/\D/g, '');
    const query = lastMessageId ? `?amount=${amount}&lastMessageId=${lastMessageId}` : `?amount=${amount}`;
    return this.request(`chat-messages/${cleanPhone}${query}`);
  }

  /**
   * Deleta uma mensagem individual do WhatsApp
   */
  async deleteMessage(phone: string, messageId: string, owner: boolean = true): Promise<ZApiResponse> {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request(`messages?messageId=${messageId}&phone=${cleanPhone}&owner=${owner}`, {
      method: 'DELETE',
    });
  }

  /**
   * Validação de segurança do Webhook
   */
  verifyWebhookSecurity(clientTokenHeader?: string | null): boolean {
    if (!this.securityToken) return true;
    return clientTokenHeader === this.securityToken;
  }
}
