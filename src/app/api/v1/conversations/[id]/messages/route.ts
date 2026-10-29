import crypto from 'crypto';
import { readCRMState, writeCRMState } from '@/lib/crm-repository';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ZApiClient } from '@/lib/zapi-client';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

import { serverCRMStore } from '@/lib/server-crm-store';
import { isLidIdentifier, cleanLid, arePhonesEquivalent } from '@/lib/whatsapp-filter';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';

export const dynamic = 'force-dynamic';

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
  tenantId: z.string().optional(),
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
    requiredRoles: ['SUPERADMIN', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'BROKER'],
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

    if (validated.data.tenantId && validated.data.tenantId !== session!.tenantId && !session!.isSuperAdmin) return NextResponse.json({ error: 'Imobiliária não autorizada.' }, { status: 403 });
    const effectiveTenantId = authorizedTenant(session!, validated.data.tenantId || request.headers.get('x-tenant-id'));
    const scopedState = await readCRMState(effectiveTenantId);
    const ownedConversation = scopedState.conversations.find(c => c.id === conversationId);
    if (!ownedConversation) return NextResponse.json({ error: 'Conversa não encontrada nesta imobiliária.' }, { status: 404 });
    if (isInternalNote) {
      const note = { id: `note-${crypto.randomUUID()}`, tenantId: effectiveTenantId, conversationId,
        senderType: 'USER' as const, senderName: session!.userName, messageType: 'TEXT' as const,
        isInternalNote: true, content, status: 'SENT' as const, timestamp: new Date().toISOString() };
      await writeCRMState(effectiveTenantId, { messages: [note] });
      return NextResponse.json(note);
    }

    let targetPhone = validated.data.phone || validated.data.contactPhone;
    if (!targetPhone) {
      const extracted = conversationId.replace(/\D/g, '');
      if (extracted.length >= 8) targetPhone = extracted;
    }

    if (!targetPhone) {
      const serverState = scopedState;
      const conv = serverState.conversations.find(c => c.id === conversationId);
      const contact = serverState.contacts.find(c => c.id === conv?.contactId);
      if (contact?.phone) {
        targetPhone = contact.phone.replace(/\D/g, '');
      } else if (contact?.lid) {
        targetPhone = cleanLid(contact.lid);
      }
    }

    if (!isInternalNote && !targetPhone) {
      return NextResponse.json({
        error: 'Número de telefone de destino não encontrado para esta conversa. Verifique se o contato possui telefone cadastrado.',
      }, { status: 400 });
    }

    const creds = await ZapiCredentialsService.resolveCredentials({
      instanceId: validated.data.instanceId,
      tenantId: session!.isSuperAdmin ? (request.headers.get('x-tenant-id') || session!.tenantId) : session!.tenantId,
      token: validated.data.instanceToken,
      clientToken: validated.data.clientToken,
    });
    const instanceId = creds.instanceId;
    const instanceToken = creds.instanceToken;
    const securityToken = creds.securityToken;

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

      // Adiciona imediatamente ao webhookStore para reflexo instantâneo no polling do CRM
      webhookStore.addMessage({
        id: externalMessageId,
        tenantId: effectiveTenantId,
        instanceId,
        phone: cleanPhone,
        senderName: session?.userName || 'Corretor',
        content,
        mediaType: (messageType === 'AUDIO' ? 'audio' : messageType === 'IMAGE' ? 'image' : messageType === 'DOCUMENT' ? 'document' : 'text') as any,
        mediaUrl: mediaUrl || '',
        fromMe: true,
        timestamp: new Date().toISOString(),
      });

      // Registra mensagem enviada também no store para manter o histórico alinhado
      const serverState = scopedState;
      const existingConv = serverState.conversations.find(c => 
        c.id === conversationId || 
        c.id === `conv-zapi-${cleanPhone}` ||
        (cleanPhone && arePhonesEquivalent((c.id + (c.contactId || '')).replace(/\D/g, ''), cleanPhone))
      );
      const existingContact = serverState.contacts.find(c => 
        (existingConv && c.id === existingConv.contactId) ||
        (cleanPhone && arePhonesEquivalent(c.phone, cleanPhone))
      );

      const targetConvId = existingConv ? existingConv.id : (conversationId || `conv-zapi-${cleanPhone}`);
      const targetContactId = existingContact ? existingContact.id : (existingConv?.contactId || `contact-zapi-${cleanPhone}`);

      await writeCRMState(effectiveTenantId, {
        conversations: [{
          id: targetConvId,
          tenantId: effectiveTenantId,
          instanceId,
          contactId: targetContactId,
          status: 'PENDING_CLIENT',
          unreadCount: 0,
          lastMessagePreview: content.substring(0, 100),
          lastMessageAt: new Date().toISOString(),
          slaBreached: false,
          isPersonal: false,
        }],
        messages: [{
          id: externalMessageId,
          tenantId: effectiveTenantId,
          conversationId: targetConvId,
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
