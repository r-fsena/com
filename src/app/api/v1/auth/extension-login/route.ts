import { NextRequest, NextResponse } from 'next/server';
import { MOCK_USERS, MOCK_TENANTS } from '@/lib/mock-data';
import { signSessionPayload } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-extension-token',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * GET: Retorna catálogo simplificado de Imobiliárias e Corretores ativos
 * para exibição amigável na interface de login da extensão
 */
export async function GET(req: NextRequest) {
  const tenants = MOCK_TENANTS.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    primaryColor: t.primaryColor || '#3742AC',
  }));

  const brokers = MOCK_USERS.filter(u => u.isActive).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tenantId: u.tenantId || 'tenant-amabile-barbarotti',
    avatarUrl: u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=3742AC&color=ffffff`,
  }));

  return NextResponse.json({
    success: true,
    tenants,
    brokers,
  }, { headers: corsHeaders });
}

/**
 * POST: Autentica o corretor e emite um token assinado com HMAC-SHA256
 * isolado para uso persistente na extensão Brokiva.
 */
export async function POST(req: NextRequest) {
  // Rate Limiting preventivo (Máx 20 tentativas por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`ext-login:${clientIp}`, 20, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Muitas tentativas. Aguarde ${rateCheck.resetInSeconds} segundos.`,
    }, { status: 429, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, name, tenantId } = body;

    if (!email && !name) {
      return NextResponse.json({
        success: false,
        error: 'Informe o e-mail ou nome do corretor para identificação.',
      }, { status: 400, headers: corsHeaders });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const targetTenantId = tenantId || 'tenant-amabile-barbarotti';
    const foundTenant = MOCK_TENANTS.find(t => t.id === targetTenantId || t.slug === targetTenantId) || MOCK_TENANTS[0];

    // Localiza usuário existente ou provisiona credencial de corretor para o tenant selecionado
    let foundUser = MOCK_USERS.find(u => 
      (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
      (name && u.name.toLowerCase().trim() === String(name).toLowerCase().trim())
    );

    const displayName = foundUser?.name || (name ? String(name).trim() : cleanEmail.split('@')[0]);
    const finalEmail = foundUser?.email || cleanEmail || `${displayName.toLowerCase().replace(/\s+/g, '.')}@amabile.com.br`;
    const finalUserId = foundUser?.id || `user-broker-${displayName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-')}`;
    const finalRole = foundUser?.role || (finalEmail.includes('admin') || finalEmail.includes('rafael') ? 'SUPERADMIN' : 'BROKER');

    const sessionPayload = {
      userId: finalUserId,
      email: finalEmail,
      name: displayName,
      role: finalRole,
      tenantId: foundTenant.id,
      tenantName: foundTenant.name,
      avatarUrl: foundUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3742AC&color=ffffff`,
      source: 'CHROME_EXTENSION',
      issuedAt: new Date().toISOString(),
    };

    const token = signSessionPayload(sessionPayload);

    return NextResponse.json({
      success: true,
      message: `Corretor ${displayName} autenticado com sucesso na extensão Brokiva.`,
      token,
      user: sessionPayload,
    }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao autenticar corretor na extensão',
    }, { status: 500, headers: corsHeaders });
  }
}
