import { NextRequest, NextResponse } from 'next/server';
import { ZApiClient } from '@/lib/zapi-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phone } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Telefone obrigatório' }, { status: 400 });
    }

    const instanceId = process.env.ZAPI_INSTANCE_ID || '3F1B67FC8139425171C79ED390C0144C';
    const instanceToken = process.env.ZAPI_INSTANCE_TOKEN || '7A18BD2BADA4840FB0374499';
    const securityToken = process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';

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
        name || 'Plantão de Vendas Vanguard',
        address || 'Av. Beira Mar Norte, 1000 - Florianópolis, SC'
      );
      return NextResponse.json(res);
    }

    if (action === 'send-contact') {
      const { contactName, contactPhone } = body;
      const res = await zapi.sendContact(
        cleanPhone,
        contactName || 'Corretor Vanguard',
        contactPhone || '+554888774408'
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
