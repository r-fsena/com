import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';
import { AuthService } from '@/lib/db/auth-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
const COOKIE_NAME = 'vanguard_session';

export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;
  return NextResponse.json({ authenticated: true, user: session }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`login:${getClientIp(req.headers)}`, 10, 60);
  if (!limit.allowed) return NextResponse.json({ success: false, error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
  try {
    const { email, password, tenantId } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ success: false, error: 'Informe e-mail e senha.' }, { status: 401 });
    }
    const result = await AuthService.authenticateUser(email, password, undefined, tenantId);
    if (!result.success || !result.user || !result.sessionToken) return NextResponse.json({ success: false, error: result.error || 'Credenciais inválidas.' }, { status: 401 });
    const res = NextResponse.json({ success: true, user: result.user });
    res.cookies.set({ name: COOKIE_NAME, value: result.sessionToken, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 86400 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch { return NextResponse.json({ success: false, error: 'Não foi possível autenticar. Verifique a configuração do servidor.' }, { status: 503 }); }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({ name: COOKIE_NAME, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
