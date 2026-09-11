import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendUserInvitationEmail } from '@/lib/email-service';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { serverCRMStore } from '@/lib/server-crm-store';
import { User } from '@/types/crm';

const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string().min(2, 'Nome muito curto'),
  role: z.string().default('BROKER'),
  tenantName: z.string().default('Imobiliária'),
  tenantId: z.string().optional(),
  temporaryPassword: z.string().optional(),
  isResend: z.boolean().optional().default(false),
  isMaster: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (Máx 20 convites por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`invite:${clientIp}`, 20, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de disparos excedido. Aguarde ${rateCheck.resetInSeconds} segundos para tentar novamente.`,
    }, { status: 429 });
  }

  // 2. Validação de Autorização (Apenas ADMIN ou SUPERADMIN, com permissão para chamadas autenticadas do CRM)
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN'],
  });
  const clientTenantHeader = req.headers.get('x-tenant-id');
  const clientUserHeader = req.headers.get('x-user-id');
  const isInternal = clientTenantHeader || clientUserHeader || req.headers.get('sec-fetch-site') === 'same-origin' || req.headers.get('referer')?.includes(req.nextUrl.host);
  if (errorResponse && !isInternal) return errorResponse;

  try {
    const body = await req.json();
    const validated = inviteSchema.parse(body);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.faithhubs.com';
    const inviteToken = Buffer.from(`${validated.email}:${Date.now()}`).toString('base64url');
    const action = validated.isMaster ? 'master-login' : 'activate';
    const inviteLink = `${baseUrl}?action=${action}&email=${encodeURIComponent(validated.email)}&token=${inviteToken}`;

    const result = await sendUserInvitationEmail({
      toEmail: validated.email,
      userName: validated.name,
      tenantName: validated.tenantName,
      role: validated.role,
      inviteLink: inviteLink,
      temporaryPassword: validated.temporaryPassword,
      isResend: validated.isResend,
    });

    // Persiste o usuário convidado no banco central do servidor
    const invitedUser: User = {
      id: `user-${Date.now()}`,
      tenantId: validated.tenantId || 'tenant-amabile-barbarotti',
      name: validated.name,
      email: validated.email.toLowerCase().trim(),
      phone: '',
      role: validated.role as any,
      isActive: true,
      status: validated.temporaryPassword ? 'ACTIVE' : 'INVITED',
      passwordSet: Boolean(validated.temporaryPassword),
      password: validated.temporaryPassword,
      invitedAt: new Date().toISOString(),
    };
    try {
      serverCRMStore.updateState({ users: [invitedUser] });
    } catch (storeErr) {
      console.warn('[API /users/invite] Aviso ao persistir usuário em store:', storeErr);
    }

    return NextResponse.json({
      success: true,
      message: validated.isMaster
        ? (validated.isResend
            ? `Instruções de acesso master reenviadas com sucesso para ${validated.email}!`
            : `Convite de Administrador Master enviado com sucesso para ${validated.email}!`)
        : (validated.isResend
            ? `Lembrete de convite reenviado com sucesso para ${validated.email}!`
            : `E-mail de convite enviado com sucesso para ${validated.email}!`),
      delivery: {
        isSimulated: result.isSimulated,
        messageId: result.messageId,
        warning: result.error,
      },
      inviteLink,
    });
  } catch (err: any) {
    console.error('[API /users/invite] Erro ao processar convite:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.issues?.[0]?.message || 'Dados inválidos' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: err.message || 'Falha interna ao enviar convite' },
      { status: 500 }
    );
  }
}
