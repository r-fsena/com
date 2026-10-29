import { db } from '@/db';
import { whatsappInstances, tenants } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';

export interface ResolvedZapiCredentials { instanceId: string; instanceToken: string; securityToken: string; }

export class ZapiCredentialsService {
  static async resolveCredentials(params?: { instanceId?: string | null; tenantId?: string | null; token?: string | null; clientToken?: string | null }): Promise<ResolvedZapiCredentials> {
    const tenantId = params?.tenantId?.trim();
    if (!tenantId) throw new Error('Imobiliária autenticada obrigatória para acessar o WhatsApp.');
    const slug = tenantId.replace(/^tenant-/, '');
    const rawId = params?.instanceId?.trim();
    if (process.env.DATABASE_URL) {
      const conditions = [eq(tenants.slug, slug)];
      if (rawId) conditions.push(or(eq(whatsappInstances.zapiInstanceId, rawId), ...(/^[0-9a-f-]{36}$/i.test(rawId) ? [eq(whatsappInstances.id, rawId)] : []))!);
      const rows = await db.select({ instanceId: whatsappInstances.zapiInstanceId, instanceToken: whatsappInstances.zapiToken, securityToken: whatsappInstances.clientToken })
        .from(whatsappInstances).innerJoin(tenants, eq(whatsappInstances.tenantId, tenants.id)).where(and(...conditions)).limit(2);
      if (rows.length !== 1) throw new Error(rows.length ? 'Selecione a conexão WhatsApp desta imobiliária.' : 'Conexão WhatsApp não cadastrada nesta imobiliária.');
      if (!rows[0].instanceToken || !rows[0].securityToken) throw new Error('Credenciais da conexão WhatsApp incompletas no servidor.');
      return rows[0] as ResolvedZapiCredentials;
    }
    // Desenvolvimento com uma conexão explicitamente vinculada; nunca usa token recebido do browser.
    if (tenantId !== process.env.ZAPI_TENANT_ID || (rawId && rawId !== process.env.ZAPI_INSTANCE_ID) ||
        !process.env.ZAPI_INSTANCE_ID || !process.env.ZAPI_INSTANCE_TOKEN || !process.env.ZAPI_CLIENT_TOKEN) {
      throw new Error('Configure uma conexão WhatsApp vinculada à imobiliária no servidor.');
    }
    return { instanceId: process.env.ZAPI_INSTANCE_ID, instanceToken: process.env.ZAPI_INSTANCE_TOKEN, securityToken: process.env.ZAPI_CLIENT_TOKEN };
  }

  static async resolveWebhookTenant(instanceId: string): Promise<string> {
    if (!instanceId) throw new Error('Webhook sem identificador de instância.');
    if (process.env.DATABASE_URL) {
      const rows = await db.select({ slug: tenants.slug }).from(whatsappInstances)
        .innerJoin(tenants, eq(whatsappInstances.tenantId, tenants.id)).where(and(eq(whatsappInstances.zapiInstanceId, instanceId), sql`nullif(${whatsappInstances.zapiToken}, '') is not null`, sql`nullif(${whatsappInstances.clientToken}, '') is not null`)).limit(2);
      if (rows.length !== 1) throw new Error('Instância do webhook não cadastrada ou ambígua.');
      return `tenant-${rows[0].slug}`;
    }
    if (instanceId === process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TENANT_ID) return process.env.ZAPI_TENANT_ID;
    throw new Error('Instância do webhook não autorizada.');
  }
}
