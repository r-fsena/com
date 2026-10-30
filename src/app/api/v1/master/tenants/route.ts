import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { validateApiSession } from '@/lib/api-auth';
import type { TenantCatalogEntry } from '@/lib/tenant-catalog';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requireSuperAdmin: true });
  if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ success: false, error: 'Entre no Portal Master para consultar os ambientes.' }, { status: 403 });
  try {
    // Projeção explícita: credenciais das imobiliárias nunca integram o catálogo.
    const rows = await db.select({
      name: tenants.name, slug: tenants.slug, documentCnpj: tenants.documentCnpj,
      logoUrl: tenants.logoUrl, primaryColor: tenants.primaryColor, timezone: tenants.timezone,
      status: tenants.status, businessHours: tenants.businessHours,
    }).from(tenants).orderBy(asc(tenants.name));
    const catalog: TenantCatalogEntry[] = rows.map(row => ({
      id: `tenant-${row.slug}`, name: row.name, slug: row.slug, documentCnpj: row.documentCnpj,
      logoUrl: row.logoUrl || undefined, primaryColor: row.primaryColor || '#3742AC', timezone: row.timezone || 'America/Sao_Paulo',
      status: ['ACTIVE', 'TRIAL', 'SUSPENDED', 'INACTIVE'].includes(row.status || '') ? row.status as TenantCatalogEntry['status'] : 'INACTIVE',
      businessHours: row.businessHours as TenantCatalogEntry['businessHours'] || { start: '08:30', end: '19:00', workDays: [1, 2, 3, 4, 5, 6] },
    }));
    return NextResponse.json({ success: true, tenants: catalog }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível consultar os ambientes no banco.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
