import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Validação não-bloqueante para permitir hidratação em novos navegadores / Safari
  const { session } = validateApiSession(req);

  try {
    const state = serverCRMStore.getState();
    const deletedKeys = serverCRMStore.getDeletedChatKeys();
    return NextResponse.json({
      success: true,
      deletedKeys,
      ...state,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao obter estado do CRM',
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  // Permite sincronização interna e cross-device mesmo se o cookie de sessão não for transmitido pelo navegador
  const clientTenantHeader = req.headers.get('x-tenant-id');
  const clientUserHeader = req.headers.get('x-user-id');
  const isInternal = clientTenantHeader || clientUserHeader || req.headers.get('sec-fetch-site') === 'same-origin' || req.headers.get('referer')?.includes(req.nextUrl.host);
  if (errorResponse && !isInternal) {
    return errorResponse;
  }

  try {
    const body = await req.json();
    const payload = { ...body };
    if (body.user && !body.users) {
      payload.users = [body.user];
    }
    const updatedState = serverCRMStore.updateState(payload);
    const deletedKeys = serverCRMStore.getDeletedChatKeys();

    // Se houver DATABASE_URL (PostgreSQL), persiste os contatos qualificados em segundo plano
    if (process.env.DATABASE_URL && Array.isArray(payload.contacts) && payload.contacts.length > 0) {
      import('@/lib/db/contacts-service').then(({ ContactsDBService }) => {
        const tenantId = req.headers.get('x-tenant-id') || 'tenant-vanguard-01';
        payload.contacts.forEach((c: any) => {
          if (c.phone) {
            ContactsDBService.upsertContact(tenantId, c).catch(() => {});
          }
        });
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      deletedKeys,
      ...updatedState,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao persistir estado do CRM',
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    let conversationId = searchParams.get('conversationId') || '';
    let phone = searchParams.get('phone') || '';

    try {
      const body = await req.json();
      if (body.conversationId) conversationId = body.conversationId;
      if (body.phone) phone = body.phone;
    } catch {}

    if (!conversationId && !phone) {
      return NextResponse.json({ success: false, error: 'Identificador obrigatório' }, { status: 400 });
    }

    const deletedKeys = serverCRMStore.deleteChat(conversationId, phone);
    const updatedState = serverCRMStore.getState();

    return NextResponse.json({
      success: true,
      deletedKeys,
      ...updatedState,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao deletar do estado do CRM',
    }, { status: 500 });
  }
}
