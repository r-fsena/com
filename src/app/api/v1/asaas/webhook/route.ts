import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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
