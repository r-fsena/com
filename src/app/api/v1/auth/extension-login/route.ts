import { NextRequest, NextResponse } from 'next/server';
import { signSessionPayload, validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { AuthService } from '@/lib/db/auth-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors }); }
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;
  // O catálogo público de corretores e perfis foi removido.
  return NextResponse.json({ success: true, user: session, tenants: [{ id: session!.tenantId, name: session!.tenantId.replace(/^tenant-/, '') }] }, { headers: cors });
}
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`ext-login:${getClientIp(req.headers)}`, 10, 60);
  if (!limit.allowed) return NextResponse.json({ success: false, error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429, headers: cors });
  try {
    const body = await req.json();
    // Pareamento por cookie já autenticado, ou login real com senha.
    let { session } = validateApiSession(req);
    if (typeof body.password === 'string' && typeof body.email === 'string') {
      const result = await AuthService.authenticateUser(body.email, body.password, undefined, body.tenantId || undefined);
      session = result.success && result.user ? result.user : null;
    }
    if (!session) return NextResponse.json({ success: false, error: 'Entre no CRM ou informe e-mail e senha para conectar a extensão.' }, { status: 401, headers: cors });
    // O cookie define o contexto do pareamento; dados do localStorage não escolhem identidade ou tenant.
    session = { ...session, tenantId: authorizedTenant(session, body.tenantId) };
    const expiresAt = Math.min(session.expiresAt || Infinity, Math.floor(Date.now() / 1000) + 900);
    const token = signSessionPayload({ ...session, source: 'CHROME_EXTENSION' }, expiresAt - Math.floor(Date.now() / 1000));
    return NextResponse.json({ success: true, token, expiresAt, user: { ...session, email: session.userEmail, name: session.userName, tenantName: session.tenantId.replace(/^tenant-/, '') } }, { headers: cors });
  } catch { return NextResponse.json({ success: false, error: 'Não foi possível conectar a extensão.' }, { status: 503, headers: cors }); }
}
