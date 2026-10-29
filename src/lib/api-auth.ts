import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { UserRole } from '@/types/crm';

export interface AuthenticatedSession {
  userId: string;
  userEmail: string;
  userName: string;
  role: UserRole;
  tenantId: string;
  isSuperAdmin: boolean;
  expiresAt?: number;
  source?: string;
}

const developmentSecret = crypto.randomBytes(32).toString('hex');
function sessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('Configure SESSION_SECRET com pelo menos 32 caracteres.');
  return developmentSecret;
}

// Tokens anteriores à versão 2 são invalidados, inclusive os emitidos pelos fluxos inseguros.
export function signSessionPayload(payload: any, lifetimeSeconds = 60 * 60 * 24): string {
  const now = Math.floor(Date.now() / 1000);
  const normalized = {
    ...payload,
    email: payload.userEmail || payload.email,
    name: payload.userName || payload.name,
    userEmail: payload.userEmail || payload.email,
    userName: payload.userName || payload.name,
    version: 2,
    iat: now,
    exp: now + Math.min(lifetimeSeconds, 60 * 60 * 24),
    aud: 'brokiva-crm',
  };
  const encoded = Buffer.from(JSON.stringify(normalized), 'utf8').toString('base64url');
  return `${encoded}.${crypto.createHmac('sha256', sessionSecret()).update(encoded).digest('base64url')}`;
}

export function verifySessionToken(token: string): any | null {
  try {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra) return null;
    const expected = crypto.createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    const roles: UserRole[] = ['SUPERADMIN', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'BROKER', 'VIEWER'];
    if (payload.version !== 2 || payload.aud !== 'brokiva-crm' || !Number.isFinite(payload.exp) || payload.exp <= now ||
        !Number.isFinite(payload.iat) || payload.iat > now + 30 || payload.exp - payload.iat > 86400 ||
        !payload.userId || !payload.email || !payload.tenantId || !roles.includes(payload.role)) return null;
    return payload;
  } catch { return null; }
}

export function validateApiSession(req: NextRequest, options?: {
  requiredRoles?: UserRole[];
  requireSuperAdmin?: boolean;
}): { session: AuthenticatedSession | null; errorResponse: NextResponse | null } {
  const fail = (status: number, error: string) => ({ session: null, errorResponse: NextResponse.json({ success: false, error }, { status }) });
  const auth = req.headers.get('authorization');
  const token = auth ? (auth.startsWith('Bearer ') ? auth.slice(7).trim() : '') : req.cookies.get('vanguard_session')?.value;
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) return fail(401, 'Autenticação necessária. Entre novamente com e-mail e senha.');
  const isSuperAdmin = payload.role === 'SUPERADMIN';
  const session: AuthenticatedSession = {
    userId: payload.userId, userEmail: payload.email, userName: payload.name || payload.email,
    role: payload.role, tenantId: payload.tenantId, isSuperAdmin, expiresAt: payload.exp, source: payload.source,
  };
  // Cabeçalhos são contexto, nunca credenciais. Somente o administrador global pode trocar de tenant.
  for (const requested of [req.headers.get('x-tenant-id'), req.nextUrl.searchParams.get('tenantId')]) {
    if (requested && requested !== session.tenantId && !isSuperAdmin) return fail(403, 'Imobiliária não autorizada para esta sessão.');
  }
  if (options?.requireSuperAdmin && !isSuperAdmin) return fail(403, 'Acesso restrito ao administrador global.');
  if (options?.requiredRoles?.length && !isSuperAdmin && !options.requiredRoles.includes(session.role)) return fail(403, 'Seu perfil não tem permissão para esta operação.');
  return { session, errorResponse: null };
}

export function authorizedTenant(session: AuthenticatedSession, requested?: string | null): string {
  if (requested && requested !== session.tenantId && !session.isSuperAdmin) throw new Error('Imobiliária não autorizada para esta sessão.');
  return session.isSuperAdmin && requested ? requested : session.tenantId;
}
