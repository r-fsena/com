import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { readCRMState, writeCRMState, mutateCRMState } from '@/lib/crm-repository';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;
  try {
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenantId'));
    return NextResponse.json({ success: true, tenantId, ...await readCRMState(tenantId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ success: false, error: 'Não foi possível ler o CRM. Verifique o banco e as migrações.' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'] });
  if (errorResponse) return errorResponse;
  try {
    const body = await req.json();
    const tenantId = authorizedTenant(session!, body.tenantId || req.headers.get('x-tenant-id'));
    const allowed = ['contacts', 'conversations', 'messages', 'deals', 'quickReplies', 'aiInsights'];
    if (Object.keys(body).some(key => !allowed.includes(key) && key !== 'tenantId')) return NextResponse.json({ success: false, error: 'Use as APIs administrativas para alterar usuários ou configurações.' }, { status: 400 });
    const patch = Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    for (const key of allowed.filter(key => key !== 'aiInsights')) {
      if (patch[key] !== undefined && (!Array.isArray(patch[key]) || patch[key].some((item: any) => item.tenantId !== tenantId))) return NextResponse.json({ success: false, error: 'Registro de outra imobiliária ou inválido.' }, { status: 403 });
    }
    const state = await writeCRMState(tenantId, patch);
    return NextResponse.json({ success: true, tenantId, ...state });
  } catch { return NextResponse.json({ success: false, error: 'Alteração não confirmada. Verifique a imobiliária, o banco e as migrações.' }, { status: 503 }); }
}

export async function DELETE(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'] });
  if (errorResponse) return errorResponse;
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id') || body.tenantId);
    const conversationId = body.conversationId || req.nextUrl.searchParams.get('conversationId');
    const phone = String(body.phone || req.nextUrl.searchParams.get('phone') || '').replace(/\D/g, '');
    const next = await mutateCRMState(tenantId, state => {
    const contact = state.contacts.find(c => phone && c.phone.replace(/\D/g, '') === phone);
    const conversation = state.conversations.find(c => c.id === conversationId || (contact && c.contactId === contact.id));
    if (!conversation) throw new Error('Conversa não encontrada.');
    const removedContactId = conversation.contactId;
    return { ...state, contacts: state.contacts.filter(c => c.id !== removedContactId),
      conversations: state.conversations.filter(c => c.id !== conversation.id), messages: state.messages.filter(m => m.conversationId !== conversation.id),
      deals: state.deals.filter(d => d.contactId !== removedContactId),
      deletedKeys: [...(state.deletedKeys || []), conversation.id, removedContactId, ...(phone ? [phone] : [])] };
    });
    return NextResponse.json({ success: true, tenantId, ...next });
  } catch { return NextResponse.json({ error: 'Exclusão não confirmada.' }, { status: 503 }); }
}
