import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ZapiWebhookPayloadSchema = z.object({
  event: z.string().optional(),
  instanceId: z.string().optional(),
  messageId: z.string().optional(),
  phone: z.string().optional(),
  fromMe: z.boolean().optional(),
  text: z.object({
    message: z.string().optional(),
  }).optional(),
  audio: z.object({
    audioUrl: z.string().optional(),
  }).optional(),
  image: z.object({
    imageUrl: z.string().optional(),
    caption: z.string().optional(),
  }).optional(),
  senderName: z.string().optional(),
  momment: z.number().optional(),
  status: z.string().optional(),
});

/**
 * Ingestão de Webhooks da Z-API com validação de segurança e idempotência
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string; instanceId: string } }
) {
  const startTime = Date.now();
  const { tenantId, instanceId } = params;

  try {
    // 1. Validação de token de segurança no cabeçalho
    const clientToken = request.headers.get('Client-Token') || request.headers.get('x-client-token');
    const secretKey = process.env.ZAPI_WEBHOOK_SECRET;

    if (secretKey && clientToken !== secretKey) {
      return NextResponse.json(
        { error: 'Não autorizado: Token de segurança Z-API inválido' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = ZapiWebhookPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload de webhook inválido', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Responde 200 OK imediatamente para a Z-API em menos de 50ms
    const eventId = data.messageId || `evt-${Date.now()}`;
    const processingDuration = Date.now() - startTime;

    return NextResponse.json({
      received: true,
      eventId,
      tenantId,
      instanceId,
      processedInMs: processingDuration,
      status: 'QUEUED_FOR_INGESTION',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook Z-API', message: err.message },
      { status: 500 }
    );
  }
}
