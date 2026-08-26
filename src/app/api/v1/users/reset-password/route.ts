import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendPasswordResetNotificationEmail } from '@/lib/email-service';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

const resetSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string().min(2, 'Nome muito curto'),
  newPassword: z.string().min(3, 'Senha muito curta').optional(),
  tenantName: z.string().default('Imobiliária'),
  notifyEmail: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (Máx 10 redefinições por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`reset:${clientIp}`, 10, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de requisições excedido. Aguarde ${rateCheck.resetInSeconds} segundos para tentar novamente.`,
    }, { status: 429 });
  }

  // 2. Validação de Autorização (Apenas ADMIN ou SUPERADMIN)
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN'],
  });
  if (errorResponse) return errorResponse;
  try {
    const body = await req.json();
    const validated = resetSchema.parse(body);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.faithhubs.com';
    const loginLink = `${baseUrl}?email=${encodeURIComponent(validated.email)}`;

    let deliveryResult = null;
    if (validated.notifyEmail) {
      deliveryResult = await sendPasswordResetNotificationEmail({
        toEmail: validated.email,
        userName: validated.name,
        tenantName: validated.tenantName,
        newPassword: validated.newPassword,
        loginLink,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Senha de ${validated.name} (${validated.email}) redefinida com sucesso!`,
      delivery: deliveryResult ? {
        isSimulated: deliveryResult.isSimulated,
        messageId: deliveryResult.messageId,
      } : null,
    });
  } catch (err: any) {
    console.error('[API /users/reset-password] Erro:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.issues?.[0]?.message || 'Dados inválidos' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao redefinir senha' },
      { status: 500 }
    );
  }
}
