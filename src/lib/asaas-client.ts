export class AsaasClient {
  private baseUrl: string;
  constructor(private apiKey: string, environment = process.env.ASAAS_ENVIRONMENT || 'sandbox') {
    if (!apiKey) throw new Error('Asaas não configurado para esta imobiliária.');
    if (!['sandbox', 'production'].includes(environment)) throw new Error('Ambiente Asaas inválido.');
    this.baseUrl = environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  }
  private async request(path: string, body?: unknown) {
    const response = await fetch(`${this.baseUrl}${path}`, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', access_token: this.apiKey, 'User-Agent': 'Brokiva CRM' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.errors?.[0]?.description || 'Falha na API Asaas.');
    return data;
  }
  async createPayment(input: { customerName: string; customerCpfCnpj: string; customerEmail?: string; customerPhone?: string; value: number; dueDate: string; description?: string; billingType: string; externalReference: string }) {
    const cpfCnpj = input.customerCpfCnpj.replace(/\D/g, '');
    const existing = await this.request(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`);
    const customer = existing.data?.[0] || await this.request('/customers', { name: input.customerName, cpfCnpj,
      email: input.customerEmail, mobilePhone: input.customerPhone, notificationDisabled: true });
    // Reutiliza a referência fornecida pelo CRM após respostas inconclusivas; não gera um ID fictício.
    const previous = await this.request(`/payments?externalReference=${encodeURIComponent(input.externalReference)}`);
    let payment = previous.data?.[0];
    if (payment && (payment.customer !== customer.id || Number(payment.value) !== input.value || payment.billingType !== input.billingType || payment.dueDate !== input.dueDate)) throw new Error('Referência de cobrança já utilizada com outros dados.');
    if (!payment) payment = await this.request('/payments', { customer: customer.id, billingType: input.billingType,
      value: input.value, dueDate: input.dueDate, description: input.description, externalReference: input.externalReference });
    let pix;
    if (input.billingType === 'PIX') {
      try { pix = await this.request(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`); }
      catch { return { ...payment, customerName: input.customerName, pixAvailable: false, warning: 'Cobrança criada. QR Code temporariamente indisponível; consulte a cobrança existente antes de tentar novamente.' }; }
    }
    return { ...payment, customerName: input.customerName, pixQrCode: pix?.encodedImage, pixPayload: pix?.payload, pixAvailable: Boolean(pix) };
  }
}
