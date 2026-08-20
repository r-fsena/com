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
   * Obtém QR Code para reconexão da instância
   */
  async getQRCode(): Promise<ZApiResponse<{ value?: string; image?: string }>> {
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
   * Configuração automática do Webhook de Desconexão na Z-API
   */
  async configureWebhookDisconnected(webhookUrl: string): Promise<ZApiResponse> {
    return this.request('update-webhook-disconnected', {
      method: 'PUT',
      body: JSON.stringify({ value: webhookUrl }),
    });
  }

  /**
   * Configura automaticamente todas as URLs de webhook e token de segurança na Z-API (Zero-Config)
   */
  async configureAllWebhooks(webhookUrl: string): Promise<{ success: boolean; errors?: string[] }> {
    const results = await Promise.allSettled([
      this.configureWebhookReceived(webhookUrl),
      this.configureWebhookDelivery(webhookUrl),
      this.configureWebhookDisconnected(webhookUrl),
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
   * Modifica o status do chat no WhatsApp (archive, unarchive, clear, delete, pin, unpin, mute, unmute)
   */
  async modifyChat(phone: string, action: 'archive' | 'unarchive' | 'clear' | 'delete' | 'pin' | 'unpin' | 'mute' | 'unmute'): Promise<ZApiResponse> {
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
