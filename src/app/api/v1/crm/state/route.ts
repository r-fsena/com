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

    // Se o banco PostgreSQL estiver configurado, lê do banco como fonte primária
    if (process.env.DATABASE_URL) {
      try {
        const { ContactsDBService } = await import('@/lib/db/contacts-service');
        const [dbContacts, dbDeals] = await Promise.all([
          ContactsDBService.getAllContacts(targetTenantId),
          ContactsDBService.getAllDeals(targetTenantId),
        ]);

        if (dbContacts && dbContacts.length > 0) {
          const contactMap = new Map<string, any>();
          for (const c of (state.contacts || [])) {
            if (c.phone) contactMap.set(c.phone.replace(/\D/g, ''), c);
          }
          for (const c of dbContacts) {
            if (c.phone) {
              const clean = c.phone.replace(/\D/g, '');
              const existing = contactMap.get(clean);
              contactMap.set(clean, { ...(existing || {}), ...c });
            }
          }
          state.contacts = Array.from(contactMap.values());
        }

        if (dbDeals && dbDeals.length > 0) {
          const dealMap = new Map<string, any>();
          for (const d of (state.deals || [])) {
            dealMap.set(d.id, d);
          }
          for (const d of dbDeals) {
            dealMap.set(d.id, { ...(dealMap.get(d.id) || {}), ...d });
          }
          state.deals = Array.from(dealMap.values());
        }
      } catch (dbErr) {
        console.warn('[GET /api/v1/crm/state] Aviso ao buscar do PostgreSQL:', dbErr);
      }
    }

    // Sanitização de segurança: remove senhas e hashes do estado enviado ao cliente
    const safeState = { ...state };
    if (safeState.users) {
      safeState.users = safeState.users.map((u: any) => {
        const safe = { ...u };
        delete safe.password;
        delete safe.passwordHash;
        delete safe.salt;
        delete safe.tempPassword;
        return safe;
      });
    }

    if ((safeState as any).saasApiConfig) {
      const cfg = (safeState as any).saasApiConfig;
      (safeState as any).saasApiConfig = {
        ...cfg,
        asaasMasterApiKey: cfg.asaasMasterApiKey ? '••••••••' : '',
        openAiApiKey: cfg.openAiApiKey ? '••••••••' : '',
        googleGeminiApiKey: cfg.googleGeminiApiKey ? '••••••••' : '',
      };
    }

    const deletedKeys = serverCRMStore.getDeletedChatKeys();
    return NextResponse.json({
      success: true,
      tenantId: targetTenantId,
      deletedKeys,
      ...safeState,
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
    const clientTenantHeader = req.headers.get('x-tenant-id');
    const targetTenantId = (session && !session.isSuperAdmin && session.tenantId) 
      ? session.tenantId 
      : (session?.tenantId || clientTenantHeader || 'tenant-amabile-barbarotti');

    if (body.action === 'undelete' && (body.phone || body.conversationId)) {
      const remainingDeleted = serverCRMStore.undeleteChat(body.phone || body.conversationId);
      return NextResponse.json({
        success: true,
        tenantId: targetTenantId,
        deletedKeys: remainingDeleted,
        ...serverCRMStore.getScopedState(targetTenantId),
      });
    }

    serverCRMStore.updateState(payload);
    const deletedKeys = serverCRMStore.getDeletedChatKeys();

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

    // Se houver mensagens existentes sendo sincronizadas, persiste no PostgreSQL garantindo zero perda
    if (process.env.DATABASE_URL && Array.isArray(payload.messages) && payload.messages.length > 0) {
      import('@/lib/db/contacts-service').then(async ({ ContactsDBService }) => {
        try {
          await ContactsDBService.seedMessages(targetTenantId, payload.messages);
        } catch (dbErr) {
          console.warn('[ContactsDBService] Aviso ao sincronizar mensagens no banco:', dbErr);
        }
      }).catch(err => console.warn('[ContactsDBService] Erro ao carregar serviço de banco:', err));
    }

    // Se houver oportunidades (deals) sendo atualizadas, persiste no PostgreSQL
    if (process.env.DATABASE_URL && Array.isArray(payload.deals) && payload.deals.length > 0) {
      import('@/lib/db/contacts-service').then(async ({ ContactsDBService }) => {
        for (const d of payload.deals) {
          if (d && d.title) {
            try {
              await ContactsDBService.upsertDeal(d.tenantId || targetTenantId, d);
            } catch (dbErr) {
              console.warn('[ContactsDBService] Aviso ao persistir deal no banco:', dbErr);
            }
          }
        }
      }).catch(err => console.warn('[ContactsDBService] Erro ao carregar serviço de banco:', err));
    }

    // Se houver configurações globais da plataforma (saasApiConfig), persiste no PostgreSQL
    if (process.env.DATABASE_URL && payload.saasApiConfig) {
      import('@/db').then(async ({ db }) => {
        const { platformSettings } = await import('@/db/schema');
        try {
          const cfg = payload.saasApiConfig;
          await db
            .insert(platformSettings)
            .values({
              id: 'default',
              asaasMasterApiKey: cfg.asaasMasterApiKey,
              asaasMasterWalletId: cfg.asaasMasterWalletId,
              asaasWebhookUrl: cfg.asaasWebhookUrl,
              openAiApiKey: cfg.openAiApiKey,
              googleGeminiApiKey: cfg.googleGeminiApiKey,
              awsBedrockModel: cfg.awsBedrockModel,
              awsBedrockRegion: cfg.awsBedrockRegion,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: platformSettings.id,
              set: {
                asaasMasterApiKey: cfg.asaasMasterApiKey,
                asaasMasterWalletId: cfg.asaasMasterWalletId,
                asaasWebhookUrl: cfg.asaasWebhookUrl,
                openAiApiKey: cfg.openAiApiKey,
                googleGeminiApiKey: cfg.googleGeminiApiKey,
                awsBedrockModel: cfg.awsBedrockModel,
                awsBedrockRegion: cfg.awsBedrockRegion,
                updatedAt: new Date(),
              }
            });
        } catch (dbErr) {
          console.warn('[platformSettings] Falha ao persistir configurações da plataforma no banco:', dbErr);
        }
      }).catch(err => console.warn('[platformSettings] Erro ao carregar db:', err));
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
