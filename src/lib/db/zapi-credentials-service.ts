import { db } from '@/db';
import { whatsappInstances, tenants } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

export interface ResolvedZapiCredentials {
  instanceId: string;
  instanceToken: string;
  securityToken: string;
}

/**
 * Serviço exclusivo de Backend para resolução segura de credenciais Z-API
 * Fonte Primária: Banco de Dados PostgreSQL (AWS RDS)
 * Fallback: Variáveis de Ambiente da AWS
 * NENHUM DADO SENSÍVEL É EXPOSTO AO NAVEGADOR
 */
export class ZapiCredentialsService {
  static async resolveCredentials(params?: {
    instanceId?: string | null;
    tenantId?: string | null;
    token?: string | null;
    clientToken?: string | null;
  }): Promise<ResolvedZapiCredentials> {
    const rawInstanceId = (params?.instanceId || '').trim();
    const rawTenantId = (params?.tenantId || '').trim();

    // 1. Tenta buscar no PostgreSQL se DATABASE_URL estiver configurado
    if (process.env.DATABASE_URL) {
      try {
        // Se instanceId for fornecido e válido
        if (rawInstanceId && !rawInstanceId.startsWith('inst-') && rawInstanceId.length >= 20) {
          const rows = await db
            .select({
              zapiInstanceId: whatsappInstances.zapiInstanceId,
              zapiToken: whatsappInstances.zapiToken,
              clientToken: whatsappInstances.clientToken,
            })
            .from(whatsappInstances)
            .where(eq(whatsappInstances.zapiInstanceId, rawInstanceId))
            .limit(1);

          if (rows[0] && rows[0].zapiToken) {
            return {
              instanceId: rows[0].zapiInstanceId,
              instanceToken: rows[0].zapiToken,
              securityToken: rows[0].clientToken || process.env.ZAPI_CLIENT_TOKEN || '',
            };
          }
        }

        // Se tenantId for fornecido
        if (rawTenantId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTenantId);
          const cleanSlug = rawTenantId.replace(/^tenant-/, '');
          const condition = isUuid 
            ? or(eq(tenants.slug, cleanSlug), eq(tenants.id, rawTenantId))
            : eq(tenants.slug, cleanSlug);

          const rows = await db
            .select({
              zapiInstanceId: whatsappInstances.zapiInstanceId,
              zapiToken: whatsappInstances.zapiToken,
              clientToken: whatsappInstances.clientToken,
            })
            .from(whatsappInstances)
            .leftJoin(tenants, eq(whatsappInstances.tenantId, tenants.id))
            .where(condition)
            .limit(1);

          if (rows[0] && rows[0].zapiToken) {
            return {
              instanceId: rows[0].zapiInstanceId,
              instanceToken: rows[0].zapiToken,
              securityToken: rows[0].clientToken || process.env.ZAPI_CLIENT_TOKEN || '',
            };
          }
        }
      } catch (dbErr) {
        console.warn('[ZapiCredentialsService] Aviso ao consultar credenciais no banco:', dbErr);
      }
    }

    // 2. Fallback seguro via variáveis de ambiente do servidor
    const fallbackInstanceId = rawInstanceId || process.env.ZAPI_INSTANCE_ID || '';
    const fallbackToken = params?.token || process.env.ZAPI_INSTANCE_TOKEN || '';
    const fallbackClientToken = params?.clientToken || 
                               process.env.ZAPI_CLIENT_TOKEN || 
                               process.env.ZAPI_WEBHOOK_SECRET || 
                               '';

    return {
      instanceId: fallbackInstanceId,
      instanceToken: fallbackToken,
      securityToken: fallbackClientToken,
    };
  }
}
