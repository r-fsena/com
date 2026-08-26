import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';
import { serverCRMStore } from '@/lib/server-crm-store';
import { recordLgpdAuditLog, maskPii } from '@/lib/lgpd-audit';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * LGPD: Exportação de Dados do Titular (Portabilidade e Acesso - Art. 18, II e V da LGPD)
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`lgpd_export:${clientIp}`, 10, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: `Limite de exportações excedido. Aguarde ${rateCheck.resetInSeconds}s.`,
    }, { status: 429 });
  }

  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { contactId, phone } = body;

    if (!contactId && !phone) {
      return NextResponse.json({
        success: false,
        error: 'Identificador do contato ou telefone é obrigatório',
      }, { status: 400 });
    }

    const state = serverCRMStore.getState();
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    
    const contact = state.contacts.find(c => 
      (contactId && c.id === contactId) || 
      (cleanPhone && c.phone.replace(/\D/g, '').includes(cleanPhone))
    );

    if (!contact) {
      return NextResponse.json({
        success: false,
        error: 'Contato não localizado para exportação LGPD',
      }, { status: 404 });
    }

    // Busca conversas e mensagens vinculadas ao contato
    const conversations = state.conversations.filter(c => c.contactId === contact.id);
    const messages = state.messages.filter(m => 
      conversations.some(c => c.id === m.conversationId)
    );

    // Registra log formal de auditoria LGPD
    recordLgpdAuditLog({
      tenantId: session?.tenantId || contact.tenantId,
      userId: session?.userId || 'admin',
      action: 'DATA_EXPORT',
      contactId: contact.id,
      contactNameMasked: maskPii(contact.name, 'NAME'),
      details: {
        exportedItems: {
          profile: true,
          conversationsCount: conversations.length,
          messagesCount: messages.length,
        },
      },
      ipAddress: clientIp,
    });

    const exportBundle = {
      lgpdReport: {
        legalBasis: 'Lei 13.709/2018 (LGPD) - Art. 18 (Direito de Acesso e Portabilidade)',
        generatedAt: new Date().toISOString(),
        tenantId: contact.tenantId,
        subjectId: contact.id,
      },
      personalData: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        createdAt: contact.createdAt,
        consentGiven: contact.consentGiven,
        consentDate: contact.consentDate,
        hasOptedOut: contact.hasOptedOut,
      },
      commercialPreferences: {
        preferredPropertyType: contact.preferredPropertyType,
        targetRegions: contact.targetRegions,
        tags: contact.tags,
        whatsappLabels: contact.whatsappLabels,
      },
      communicationHistory: {
        conversationsCount: conversations.length,
        messagesCount: messages.length,
        messages: messages.map(m => ({
          timestamp: m.timestamp || (m as any).createdAt,
          sender: m.senderType || (m as any).sender,
          senderName: m.senderName,
          content: m.content,
          type: m.messageType,
        })),
      },
    };

    return NextResponse.json({
      success: true,
      data: exportBundle,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao gerar relatório LGPD',
    }, { status: 500 });
  }
}
