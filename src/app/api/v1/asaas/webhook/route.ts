import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Validação de Segurança do Webhook Asaas (asaas-access-token)
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const asaasToken = req.headers.get('asaas-access-token');

  if (expectedToken && asaasToken && asaasToken !== expectedToken) {
    return NextResponse.json(
      { success: false, error: 'Acesso negado: Token de webhook Asaas inválido' },
      { status: 401 }
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
