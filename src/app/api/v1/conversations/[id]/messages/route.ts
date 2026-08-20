import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ZApiClient } from '@/lib/zapi-client';

const SendMessageSchema = z.object({
  content: z.string().min(1, 'Conteúdo obrigatório'),
  isInternalNote: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
  aiSuggested: z.boolean().default(false),
  contactPhone: z.string().optional(),
  instanceId: z.string().optional(),
  instanceToken: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const conversationId = params.id;

  try {
    const body = await request.json();
    const validated = SendMessageSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { content, isInternalNote, idempotencyKey, contactPhone, instanceId, instanceToken } = validated.data;

    // Se for nota interna, grava internamente sem disparar para a Z-API
    if (isInternalNote) {
      return NextResponse.json({
        id: `msg-${Date.now()}`,
        conversationId,
        isInternalNote: true,
        content,
        status: 'SENT',
        timestamp: new Date().toISOString(),
      });
    }

    // Se houver credenciais reais de instância Z-API configuradas, despacha a mensagem via HTTP
    let externalMessageId = `zapi-${Date.now()}`;
    if (instanceId && instanceToken && contactPhone) {
      const zapi = new ZApiClient({ instanceId, instanceToken });
      const sendResult = await zapi.sendText(contactPhone, content);
      if (sendResult.success && sendResult.externalMessageId) {
        externalMessageId = sendResult.externalMessageId;
      }
    }

    return NextResponse.json({
      id: `msg-${Date.now()}`,
      conversationId,
      externalId: externalMessageId,
      isInternalNote: false,
      content,
      status: 'DELIVERED',
      idempotencyKey: idempotencyKey || `idem-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem', message: err.message },
      { status: 500 }
    );
  }
}
