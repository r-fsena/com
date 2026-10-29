import crypto from 'crypto';
export function webhookToken(instanceId: string) {
  const secret = process.env.ZAPI_WEBHOOK_SECRET;
  if (!secret) throw new Error('Configure ZAPI_WEBHOOK_SECRET antes de ativar webhooks.');
  return crypto.createHmac('sha256', secret).update(instanceId).digest('hex');
}
export function buildZapiWebhookUrl(instanceId: string, tenantId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.faithhubs.com';
  const url = new URL(`/api/v1/webhooks/zapi/${encodeURIComponent(tenantId)}/${encodeURIComponent(instanceId)}`, base);
  if (url.protocol !== 'https:') throw new Error('Webhooks exigem endereço HTTPS.');
  url.searchParams.set('token', webhookToken(instanceId));
  return url.toString();
}
