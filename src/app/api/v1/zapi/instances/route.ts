import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { db } from '@/db';
import { tenants, whatsappInstances } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
function publicInstance(row: typeof whatsappInstances.$inferSelect, tenantId: string) {
  return { id: row.id, tenantId, name: row.name, phoneNumber: row.phoneNumber, zapiInstanceId: row.zapiInstanceId, status: 'DISCONNECTED', type: 'COMPANY_CENTRAL', isDefault: false };
}
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    if (!process.env.DATABASE_URL) return NextResponse.json({ success: true, instances: [] });
    const rows = await db.select({ instance: whatsappInstances }).from(whatsappInstances)
      .innerJoin(tenants, eq(whatsappInstances.tenantId, tenants.id)).where(eq(tenants.slug, tenantId.replace(/^tenant-/, '')));
    return NextResponse.json({ success: true, instances: rows.map(row => publicInstance(row.instance, tenantId)) });
  } catch { return NextResponse.json({ success: false, error: 'Conexões indisponíveis.' }, { status: 503 }); }
}
const schema = z.object({ tenantId: z.string().optional(), name: z.string().min(2).max(255).default('WhatsApp Comercial'), instanceId: z.string().min(20).max(100), token: z.string().min(16).max(128), clientToken: z.string().min(16).max(128) });
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN'] });
  if (errorResponse) return errorResponse;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Informe nome, ID, token da instância e token de segurança válidos.' }, { status: 400 });
  if (parsed.data.tenantId && parsed.data.tenantId !== session!.tenantId && !session!.isSuperAdmin) return NextResponse.json({ error: 'Imobiliária não autorizada.' }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Configure o banco para salvar conexões.' }, { status: 503 });
  try {
    const tenantId = authorizedTenant(session!, parsed.data.tenantId || req.headers.get('x-tenant-id'));
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantId.replace(/^tenant-/, ''))).limit(1);
    if (!tenant) return NextResponse.json({ error: 'Imobiliária não encontrada.' }, { status: 404 });
    const foreign = await db.select().from(whatsappInstances).where(eq(whatsappInstances.zapiInstanceId, parsed.data.instanceId));
    if (foreign.some(instance => instance.tenantId !== tenant.id)) return NextResponse.json({ error: 'Instância já vinculada a outra imobiliária.' }, { status: 409 });
    const [instance] = await db.insert(whatsappInstances).values({ tenantId: tenant.id, name: parsed.data.name,
      phoneNumber: 'Aguardando pareamento', zapiInstanceId: parsed.data.instanceId, zapiToken: parsed.data.token,
      clientToken: parsed.data.clientToken, zapiTokenSecretRef: 'database', status: 'DISCONNECTED' })
      .onConflictDoUpdate({ target: [whatsappInstances.tenantId, whatsappInstances.zapiInstanceId], set: { zapiToken: parsed.data.token, clientToken: parsed.data.clientToken, name: parsed.data.name } }).returning();
    return NextResponse.json({ success: true, instance: publicInstance(instance, tenantId) });
  } catch { return NextResponse.json({ error: 'Não foi possível salvar a conexão.' }, { status: 503 }); }
}
