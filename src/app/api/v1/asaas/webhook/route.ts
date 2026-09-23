import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // Validação Estrita de Segurança do Webhook Asaas (asaas-access-token)
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const asaasToken = req.headers.get('asaas-access-token');

  if (expectedToken) {
    const isTokenValid = asaasToken && asaasToken.length === expectedToken.length &&
      crypto.timingSafeEqual(Buffer.from(asaasToken), Buffer.from(expectedToken));
    if (!isTokenValid) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado: Token de webhook Asaas ausente ou inválido' },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Segurança de webhook: ASAAS_WEBHOOK_TOKEN não configurado no servidor' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { event, payment } = body;

    console.log(`[ASAAS WEBHOOK] Recebido evento: ${event} para pagamento: ${payment?.id}`, payment);

    // Eventos tratados:
    // PAYMENT_RECEIVED: Pagamento recebido em dinheiro ou PIX
    // PAYMENT_CONFIRMED: Pagamento confirmado
    // PAYMENT_OVERDUE: Pagamento vencido
    // PAYMENT_DELETED: Cobrança removida

    return NextResponse.json({
      received: true,
      event,
      paymentId: payment?.id,
      status: payment?.status,
      value: payment?.value,
      processedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao processar webhook Asaas' }, { status: 400 });
  }
}
