import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vanguard_crm';

// Connection pool com limites para AWS Lambda / RDS Proxy
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

/**
 * Helper de segurança para garantir isolamento multi-tenant forçado
 */
export function withTenant<T extends { tenantId: any }>(table: T, tenantId: string) {
  return eq(table.tenantId, tenantId);
}
