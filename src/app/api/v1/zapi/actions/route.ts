import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { serverCRMStore } from '@/lib/server-crm-store';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) {
    return NextResponse.json({ success: false, error: 'Telefone obrigatório' }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const presence = serverCRMStore.getPresence(cleanPhone);
  return NextResponse.json({
    success: true,
    phone: cleanPhone,
    presence: presence || null,
  });
}

export async function POST(req: NextRequest) {
  // Rate Limiting (Máx 120 ações por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`zapi-actions:${clientIp}`, 120, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de ações excedido. Aguarde ${rateCheck.resetInSeconds}s.`,
    }, { status: 429 });
  }

  const { errorResponse } = validateApiSession(req, {
    requiredRoles: ['BROKER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
  });

  const isSameOrigin = req.headers.get('sec-fetch-site') === 'same-origin' || 
                       req.headers.get('sec-fetch-site') === 'same-site' ||
                       (!!req.nextUrl.host && !!req.headers.get('referer')?.includes(req.nextUrl.host)) ||
                       Boolean(req.headers.get('x-user-id') || req.headers.get('x-user-email'));

  if (errorResponse && !isSameOrigin) return errorResponse;

  try {
    const body = await req.json();
    const { action, phone, targetInstanceId, targetToken } = body;

    const creds = await ZapiCredentialsService.resolveCredentials({
      instanceId: targetInstanceId,
      tenantId: req.headers.get('x-tenant-id'),
      token: targetToken,
    });

    const zapi = new ZApiClient({
      instanceId: creds.instanceId,
      instanceToken: creds.instanceToken,
      securityToken: creds.securityToken,
    });

    // Ações globais que não exigem telefone
    if (action === 'get-tags' || action === 'tags') {
      const res = await zapi.getTags();
      return NextResponse.json(res);
    }

    if (action === 'update-every-webhooks') {
      const { webhookUrl, notifySentByMe } = body;
      const res = await zapi.updateEveryWebhooks(webhookUrl, notifySentByMe ?? true);
      return NextResponse.json(res);
    }

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Telefone obrigatório para esta ação' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // Consulta de Presença em memória (Item 4)
    if (action === 'get-presence') {
      const presence = serverCRMStore.getPresence(cleanPhone);
      return NextResponse.json({
        success: true,
        phone: cleanPhone,
        presence: presence || null,
      });
    }

    // Marcação de Leitura / Desleitura no WhatsApp (Item 2)
    if (action === 'read' || action === 'unread') {
      if (action === 'read') {
        serverCRMStore.markConversationRead(cleanPhone);
      }
      const res = await zapi.modifyChat(cleanPhone, action);
      return NextResponse.json(res);
    }

    // Ações de Modificação de Chat (Arquivo, Fixação, Limpeza)
    if (action === 'archive' || action === 'unarchive' || action === 'clear' || action === 'delete' || action === 'pin' || action === 'unpin' || action === 'mute' || action === 'unmute') {
      const res = await zapi.modifyChat(cleanPhone, action);
      return NextResponse.json(res);
    }

    // Envio de Presença ("Digitando...", "Gravando áudio...") (Item 4)
    if (action === 'send-presence') {
      const { presence } = body;
      const res = await zapi.sendPresence(cleanPhone, presence || 'composing');
      return NextResponse.json(res);
    }

    // Validação de Existência no WhatsApp e LID (Item 1)
    if (action === 'phone-exists') {
      const res = await zapi.phoneExists(cleanPhone);
      if (res.success && res.data?.lid) {
        serverCRMStore.registerLidPhone(res.data.lid, cleanPhone);
      }
      return NextResponse.json(res);
    }

    // Busca de Foto de Perfil (Item 6)
    if (action === 'get-profile-picture') {
      const res = await zapi.getProfilePicture(cleanPhone);
      if (res.success && res.data?.link) {
        serverCRMStore.updateContactAvatar(cleanPhone, res.data.link);
      }
      return NextResponse.json(res);
    }

    // Atribuição de Etiqueta (Tag) do WhatsApp Business (Item 5)
    if (action === 'add-tag') {
      const { tagId } = body;
      if (!tagId) return NextResponse.json({ success: false, error: 'tagId obrigatório' }, { status: 400 });
      const res = await zapi.addTagToChat(cleanPhone, String(tagId));
      return NextResponse.json(res);
    }

    // Remoção de Etiqueta (Tag) do WhatsApp Business (Item 5)
    if (action === 'remove-tag') {
      const { tagId } = body;
      if (!tagId) return NextResponse.json({ success: false, error: 'tagId obrigatório' }, { status: 400 });
      const res = await zapi.removeTagFromChat(cleanPhone, String(tagId));
      return NextResponse.json(res);
    }

    // Envio de Localização
    if (action === 'send-location') {
      const { latitude, longitude, name, address } = body;
      const res = await zapi.sendLocation(
        cleanPhone,
        latitude || '-27.5954',
        longitude || '-48.5480',
        name || 'Plantão de Atendimento • Amábile Barbarotti',
        address || 'Atendimento Personalizado'
      );
      return NextResponse.json(res);
    }

    // Envio de Contato (vCard)
    if (action === 'send-contact') {
      const { contactName, contactPhone } = body;
      const res = await zapi.sendContact(
        cleanPhone,
        contactName || 'Amábile Barbarotti Corretora',
        contactPhone || ''
      );
      return NextResponse.json(res);
    }

    // Envio de Reação
    if (action === 'send-reaction') {
      const { messageId, emoji } = body;
      const res = await zapi.sendReaction(cleanPhone, messageId, emoji || '👍');
      return NextResponse.json(res);
    }

    // Deletar mensagem individual
    if (action === 'delete-message') {
      const { messageId, owner } = body;
      const res = await zapi.deleteMessage(cleanPhone, messageId, owner ?? true);
      return NextResponse.json(res);
    }

    return NextResponse.json({ success: false, error: 'Ação não suportada' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
