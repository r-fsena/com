import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendUserInvitationEmail } from '@/lib/email-service';

const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string().min(2, 'Nome muito curto'),
  role: z.string().default('BROKER'),
  tenantName: z.string().default('Imobiliária'),
  tenantId: z.string().optional(),
  isResend: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = inviteSchema.parse(body);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.faithhubs.com';
    const inviteToken = Buffer.from(`${validated.email}:${Date.now()}`).toString('base64url');
    const inviteLink = `${baseUrl}?action=activate&email=${encodeURIComponent(validated.email)}&token=${inviteToken}`;

    const result = await sendUserInvitationEmail({
      toEmail: validated.email,
      userName: validated.name,
      tenantName: validated.tenantName,
      role: validated.role,
      inviteLink: inviteLink,
      isResend: validated.isResend,
    });

    return NextResponse.json({
      success: true,
      message: validated.isResend
        ? `Lembrete de convite reenviado com sucesso para ${validated.email}!`
        : `E-mail de convite enviado com sucesso para ${validated.email}!`,
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
