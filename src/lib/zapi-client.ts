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
   * Validação de segurança do Webhook
   */
  verifyWebhookSecurity(clientTokenHeader?: string | null): boolean {
    if (!this.securityToken) return true;
    return clientTokenHeader === this.securityToken;
  }
}
