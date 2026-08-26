import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';
import { serverCRMStore } from '@/lib/server-crm-store';
import { recordLgpdAuditLog, anonymizeContact, maskPii } from '@/lib/lgpd-audit';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * LGPD: Anonimização ou Exclusão Definitiva de Dados (Direito ao Esquecimento - Art. 18, VI da LGPD)
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`lgpd_anon:${clientIp}`, 10, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de requisições excedido. Aguarde ${rateCheck.resetInSeconds}s.`,
    }, { status: 429 });
  }

  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { contactId, reason = 'Solicitação formal do titular (LGPD Art. 18)' } = body;

    if (!contactId) {
      return NextResponse.json({
        success: false,
        error: 'Identificador do contato é obrigatório',
      }, { status: 400 });
    }

    const state = serverCRMStore.getState();
    const contact = state.contacts.find(c => c.id === contactId);

    if (!contact) {
      return NextResponse.json({
        success: false,
        error: 'Contato não encontrado',
      }, { status: 404 });
    }

    const originalNameMasked = maskPii(contact.name, 'NAME');
    const anonymized = anonymizeContact(contact);

    // Atualiza o estado do servidor com o contato anonimizado
    const updatedContacts = state.contacts.map(c => c.id === contactId ? anonymized : c);
    serverCRMStore.updateState({ contacts: updatedContacts });

    // Registra log formal de auditoria LGPD
    recordLgpdAuditLog({
      tenantId: session?.tenantId || contact.tenantId,
      userId: session?.userId || 'admin',
      action: 'DATA_ANONYMIZED',
      contactId: contact.id,
      contactNameMasked: originalNameMasked,
      details: {
        reason,
        anonymizedFields: ['name', 'phone', 'email', 'avatarUrl', 'financialData'],
      },
      ipAddress: clientIp,
    });

    return NextResponse.json({
      success: true,
      message: `Dados do titular anonimizados e histórico desvinculado com sucesso sob a LGPD.`,
      anonymizedId: anonymized.id,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao processar anonimização LGPD',
    }, { status: 500 });
  }
}
