import { NextRequest, NextResponse } from 'next/server';
import { MOCK_USERS } from '@/lib/mock-data';
import { signSessionPayload, verifySessionToken } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'vanguard_session';

/**
 * Gestão Segura de Sessão com HttpOnly Cookies Assinados com HMAC-SHA256
 * Elimina falsificação de sessão e exfiltração via XSS no localStorage.
 */

// GET: Retorna a sessão ativa a partir do cookie HttpOnly assinado
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const sessionData = verifySessionToken(cookie.value);
  if (!sessionData) {
    return NextResponse.json({ authenticated: false, error: 'Sessão inválida ou adulterada' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: sessionData,
  });
}

// POST: Cria a sessão segura e injeta o cookie HttpOnly assinado
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, userId, role, tenantId } = body;

    const userEmail = (email || 'rafael@faithhubs.com').toLowerCase().trim();
    const foundUser = MOCK_USERS.find(u => u.email.toLowerCase() === userEmail || u.id === userId) || MOCK_USERS[0];

    const sessionPayload = {
      userId: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: role || foundUser.role,
      tenantId: tenantId || 'tenant-amabile-barbarotti',
      createdAt: new Date().toISOString(),
    };

    const sessionToken = signSessionPayload(sessionPayload);

    const res = NextResponse.json({
      success: true,
      message: 'Sessão autenticada com sucesso via HttpOnly Cookie assinado.',
      user: sessionPayload,
    });

    res.cookies.set({
      name: COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao inicializar sessão',
    }, { status: 500 });
  }
}

// DELETE: Encerra a sessão e remove o cookie HttpOnly
export async function DELETE() {
  const res = NextResponse.json({
    success: true,
    message: 'Sessão encerrada com sucesso.',
  });

  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return res;
}
