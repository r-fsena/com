import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { campaignMediaUrl } from '@/lib/campaign-media';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req); if (errorResponse) return errorResponse;
  try {
    const tenantId = authorizedTenant(session!, req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id'));
    const url = await campaignMediaUrl(tenantId, req.nextUrl.searchParams.get('key') || '');
    const response = NextResponse.redirect(url); response.headers.set('Cache-Control', 'private, no-store'); return response;
  } catch { return NextResponse.json({ error: 'Arquivo indisponível ou de outro ambiente.' }, { status: 404 }); }
}
