import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  const isSameOrigin = req.headers.get('sec-fetch-site') === 'same-origin' || (!!req.nextUrl.host && !!req.headers.get('referer')?.includes(req.nextUrl.host));

  // Em produção, se não for same-origin da UI e não tiver sessão autenticada, bloqueia acesso
  if (process.env.NODE_ENV === 'production' && !session && !isSameOrigin) {
    return errorResponse || NextResponse.json({ success: false, error: 'Acesso não autorizado.' }, { status: 401 });
  }

  try {
    const clientTenantHeader = req.headers.get('x-tenant-id');
    const queryTenant = req.nextUrl.searchParams.get('tenantId');
    
    // Regra de segurança: se autenticado e não for SuperAdmin, força estritamente o tenantId da sessão do usuário
    let targetTenantId = session?.tenantId || clientTenantHeader || queryTenant || 'tenant-amabile-barbarotti';
    if (session && !session.isSuperAdmin && session.tenantId) {
      targetTenantId = session.tenantId;
    }

    const state = serverCRMStore.getScopedState(targetTenantId);
    const deletedKeys = serverCRMStore.getDeletedChatKeys();
    return NextResponse.json({
      success: true,
      tenantId: targetTenantId,
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
  const isSameOrigin = req.headers.get('sec-fetch-site') === 'same-origin' || (!!req.nextUrl.host && !!req.headers.get('referer')?.includes(req.nextUrl.host));

  // Bloqueio rigoroso: apenas sessões assinadas ou requisições same-origin verificadas
  if (errorResponse && !isSameOrigin) {
    return errorResponse;
  }

  try {
    const body = await req.json();
    const payload = { ...body };
    if (body.user && !body.users) {
      payload.users = [body.user];
    }
    serverCRMStore.updateState(payload);
    const deletedKeys = serverCRMStore.getDeletedChatKeys();

    const clientTenantHeader = req.headers.get('x-tenant-id');
    const targetTenantId = (session && !session.isSuperAdmin && session.tenantId) 
      ? session.tenantId 
      : (session?.tenantId || clientTenantHeader || 'tenant-amabile-barbarotti');

    // Se houver DATABASE_URL (PostgreSQL), persiste os contatos qualificados em segundo plano
    if (process.env.DATABASE_URL && Array.isArray(payload.contacts) && payload.contacts.length > 0) {
      import('@/lib/db/contacts-service').then(async ({ ContactsDBService }) => {
        for (const c of payload.contacts) {
          if (c && (c.phone || c.id)) {
            try {
              await ContactsDBService.upsertContact(c.tenantId || targetTenantId, c);
            } catch (dbErr) {
              console.warn('[ContactsDBService] Aviso ao persistir contato no banco:', dbErr);
            }
          }
        }
      }).catch(err => console.warn('[ContactsDBService] Erro ao carregar serviço de banco:', err));
    }

    const scopedState = serverCRMStore.getScopedState(targetTenantId);

    return NextResponse.json({
      success: true,
      tenantId: targetTenantId,
      deletedKeys,
      ...scopedState,
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
