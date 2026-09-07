import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Rate Limiting (Máx 60 ações por minuto por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`zapi-actions:${clientIp}`, 60, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de ações excedido. Aguarde ${rateCheck.resetInSeconds}s.`,
    }, { status: 429 });
  }

  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['BROKER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { action, phone, targetInstanceId, targetToken } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Telefone obrigatório' }, { status: 400 });
    }

    const instanceId = targetInstanceId || process.env.ZAPI_INSTANCE_ID || '';
    const instanceToken = targetToken || process.env.ZAPI_INSTANCE_TOKEN || '';
    const securityToken = process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || '';

    if (!instanceId || !instanceToken) {
      return NextResponse.json({
        success: false,
        error: 'Instância Z-API não configurada no servidor',
      }, { status: 500 });
    }

    const zapi = new ZApiClient({
      instanceId,
      instanceToken,
      securityToken,
    });

    const cleanPhone = phone.replace(/\D/g, '');

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

    if (action === 'send-contact') {
      const { contactName, contactPhone } = body;
      const res = await zapi.sendContact(
        cleanPhone,
        contactName || 'Amábile Barbarotti Corretora',
        contactPhone || ''
      );
      return NextResponse.json(res);
    }

    if (action === 'send-reaction') {
      const { messageId, emoji } = body;
      const res = await zapi.sendReaction(cleanPhone, messageId, emoji || '👍');
      return NextResponse.json(res);
    }

    if (action === 'send-presence') {
      const { presence } = body;
      const res = await zapi.sendPresence(cleanPhone, presence || 'composing');
      return NextResponse.json(res);
    }

    if (action === 'archive' || action === 'unarchive' || action === 'clear' || action === 'delete' || action === 'pin' || action === 'unpin') {
      const res = await zapi.modifyChat(cleanPhone, action);
      return NextResponse.json(res);
    }

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
