import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ZApiClient } from '@/lib/zapi-client';

export const dynamic = 'force-dynamic';

const SendMessageSchema = z.object({
  content: z.string().min(1, 'Conteúdo obrigatório'),
  isInternalNote: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
  aiSuggested: z.boolean().default(false),
  phone: z.string().optional(),
  contactPhone: z.string().optional(),
  instanceId: z.string().optional(),
  instanceToken: z.string().optional(),
  clientToken: z.string().optional(),
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

    const { content, isInternalNote, idempotencyKey } = validated.data;

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

    const targetPhone = validated.data.phone || validated.data.contactPhone;
    const instanceId = validated.data.instanceId || process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
    const instanceToken = validated.data.instanceToken || process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
    const securityToken = validated.data.clientToken || process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || 'Fc78d61c833db4b50864816b70766aee8S';

    let externalMessageId = `zapi-${Date.now()}`;

    // Dispara para a Z-API se tiver telefone
    if (targetPhone) {
      const zapi = new ZApiClient({
        instanceId,
        instanceToken,
        securityToken,
      });

      const cleanPhone = targetPhone.replace(/\D/g, '');
      const sendResult = await zapi.sendText(cleanPhone, content);

      if (sendResult.success && sendResult.externalMessageId) {
        externalMessageId = sendResult.externalMessageId;
      } else if (!sendResult.success) {
        console.error('Falha ao enviar mensagem Z-API:', sendResult.error);
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
