import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { AsaasClient } from '@/lib/asaas-client';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

const schema = z.object({
  customerName: z.string().min(2), customerCpfCnpj: z.string().transform(value => value.replace(/\D/g, '')).refine(value => [11, 14].includes(value.length)),
  customerEmail: z.string().email().optional(), customerPhone: z.string().optional(),
  value: z.number().positive().finite(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(), billingType: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).default('PIX'),
  externalReference: z.string().min(8).max(100), tenantId: z.string().optional(),
});
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] });
  if (errorResponse) return errorResponse;
  if (!checkRateLimit(`payment:${getClientIp(req.headers)}`, 20, 60).allowed) return NextResponse.json({ error: 'Aguarde para criar outra cobrança.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Informe cliente, CPF/CNPJ, valor, vencimento e referência única da cobrança.', details: parsed.error.format() }, { status: 400 });
  if (parsed.data.tenantId && parsed.data.tenantId !== session!.tenantId && !session!.isSuperAdmin) return NextResponse.json({ error: 'Imobiliária não autorizada.' }, { status: 403 });
  try {
    const tenantId = authorizedTenant(session!, parsed.data.tenantId || req.headers.get('x-tenant-id'));
    let key = '';
    if (process.env.DATABASE_URL) {
      const [tenant] = await db.select({ apiKey: tenants.asaasApiKey }).from(tenants).where(eq(tenants.slug, tenantId.replace(/^tenant-/, ''))).limit(1);
      key = tenant?.apiKey || '';
    } else if (process.env.ASAAS_TENANT_ID === tenantId) key = process.env.ASAAS_API_KEY || '';
    if (!key) return NextResponse.json({ success: false, error: 'Asaas não configurado para esta imobiliária.' }, { status: 503 });
    const create = () => new AsaasClient(key).createPayment({ ...parsed.data, externalReference: `${tenantId}:${parsed.data.externalReference}` });
    const payment = process.env.DATABASE_URL ? await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId + ':asaas:' + parsed.data.externalReference}))`);
      return create();
    }) : await create();
    return NextResponse.json({ success: true, environment: process.env.ASAAS_ENVIRONMENT || 'sandbox', payment });
  } catch { return NextResponse.json({ success: false, error: 'Operação Asaas não confirmada. Consulte a referência antes de repetir a cobrança.' }, { status: 502 }); }
}
