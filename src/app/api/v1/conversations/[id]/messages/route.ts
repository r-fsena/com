import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ZApiClient } from '@/lib/zapi-client';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const SendMessageSchema = z.object({
  content: z.string().default(''),
  messageType: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE']).default('TEXT'),
  mediaUrl: z.string().optional(),
  fileName: z.string().optional(),
  isInternalNote: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
  aiSuggested: z.boolean().default(false),
  phone: z.string().optional(),
  contactPhone: z.string().optional(),
  instanceId: z.string().optional(),
  instanceToken: z.string().optional(),
  clientToken: z.string().optional(),
  senderUserId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, errorResponse } = validateApiSession(request, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  if (errorResponse) return errorResponse;

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

    const { content, messageType, mediaUrl, fileName, isInternalNote, idempotencyKey } = validated.data;

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
      let sendResult = null;

      if (messageType === 'AUDIO' && mediaUrl) {
        sendResult = await zapi.sendAudio(cleanPhone, mediaUrl);
      } else if (messageType === 'IMAGE' && mediaUrl) {
        sendResult = await zapi.sendImage(cleanPhone, mediaUrl, content || undefined);
      } else if (messageType === 'DOCUMENT' && mediaUrl) {
        sendResult = await zapi.sendDocument(cleanPhone, mediaUrl, fileName || 'documento.pdf');
      } else {
        sendResult = await zapi.sendText(cleanPhone, content || 'Mensagem enviada');
      }

      if (sendResult && sendResult.success && sendResult.externalMessageId) {
        externalMessageId = sendResult.externalMessageId;
      } else if (sendResult && !sendResult.success) {
        console.error('Falha ao enviar mensagem Z-API:', sendResult.error);
      }
    }

    return NextResponse.json({
      id: externalMessageId,
      conversationId,
      externalId: externalMessageId,
      isInternalNote: false,
      content,
      messageType,
      mediaUrl,
      fileName,
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
