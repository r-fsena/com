import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ZApiClient } from '@/lib/zapi-client';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

import { serverCRMStore } from '@/lib/server-crm-store';
import { isLidIdentifier, cleanLid } from '@/lib/whatsapp-filter';

export const dynamic = 'force-dynamic';

const DEFAULT_ZAPI_INSTANCE_ID = '3F8144490C66805B4E3FD64A35E2F2DC';
const DEFAULT_ZAPI_INSTANCE_TOKEN = '550DBC07B2F984AB74E4BCE5';
const DEFAULT_ZAPI_CLIENT_TOKEN = 'Fc78d61c833db4b50864816b70766aee8S';

const SendMessageSchema = z.object({
  content: z.string().default(''),
  messageType: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'VIDEO', 'STICKER']).default('TEXT'),
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
  // Rate Limiting (Máx 60 disparos por minuto por IP)
  const clientIp = getClientIp(request.headers);
  const rateCheck = checkRateLimit(`send-msg:${clientIp}`, 60, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      error: `Limite de envio de mensagens atingido. Aguarde ${rateCheck.resetInSeconds} segundos.`,
    }, { status: 429 });
  }

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

    const { content, messageType, mediaUrl, fileName, isInternalNote, idempotencyKey, senderUserId } = validated.data;

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

    let targetPhone = validated.data.phone || validated.data.contactPhone;
    if (!targetPhone) {
      const extracted = conversationId.replace(/\D/g, '');
      if (extracted.length >= 8) targetPhone = extracted;
    }

    let instanceId = validated.data.instanceId;
    if (!instanceId || instanceId.startsWith('inst-') || instanceId.startsWith('INST-') || instanceId.length < 20) {
      instanceId = process.env.ZAPI_INSTANCE_ID || DEFAULT_ZAPI_INSTANCE_ID;
    }
    let instanceToken = validated.data.instanceToken;
    if (!instanceToken || instanceToken.length < 15) {
      instanceToken = process.env.ZAPI_INSTANCE_TOKEN || DEFAULT_ZAPI_INSTANCE_TOKEN;
    }
    let securityToken = validated.data.clientToken || process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || DEFAULT_ZAPI_CLIENT_TOKEN;

    let externalMessageId = `zapi-${Date.now()}`;

    // Dispara para a Z-API se tiver telefone
    if (targetPhone) {
      let cleanPhone = targetPhone.replace(/\D/g, '');

      // Resolução de LID para o telefone canônico caso o alvo seja um LID
      if (isLidIdentifier(cleanPhone) || isLidIdentifier(targetPhone)) {
        const lidCandidate = cleanLid(isLidIdentifier(cleanPhone) ? cleanPhone : targetPhone);
        const resolved = await serverCRMStore.resolvePhoneFromLidAsync(lidCandidate, instanceId, instanceToken, securityToken);
        if (resolved) {
          cleanPhone = resolved;
        }
      }

      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }

      const zapi = new ZApiClient({
        instanceId,
        instanceToken,
        securityToken,
      });

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
        return NextResponse.json({
          error: 'Falha ao despachar mensagem no WhatsApp via Z-API',
          details: sendResult.error,
        }, { status: 400 });
      }

      // Registra mensagem enviada também no store para manter o histórico alinhado
      const canonicalConvId = `conv-zapi-${cleanPhone}`;
      serverCRMStore.updateState({
        conversations: [{
          id: canonicalConvId,
          tenantId: session?.tenantId || 'tenant-amabile-barbarotti',
          instanceId,
          contactId: `contact-zapi-${cleanPhone}`,
          status: 'PENDING_CLIENT',
          unreadCount: 0,
          lastMessagePreview: content.substring(0, 100),
          lastMessageAt: new Date().toISOString(),
          slaBreached: false,
          isPersonal: false,
        }],
        messages: [{
          id: externalMessageId,
          tenantId: session?.tenantId || 'tenant-amabile-barbarotti',
          conversationId: canonicalConvId,
          senderType: 'USER',
          senderName: session?.userName || 'Corretor',
          messageType: messageType as any,
          content,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: new Date().toISOString(),
        }],
      });
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
