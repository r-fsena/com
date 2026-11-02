import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { readCRMState, mutateCRMState, mergeTenantState } from '@/lib/crm-repository';
import { qualificationFields } from '@/lib/lead-qualification';
import { kickQualification } from '@/lib/lead-qualification-service';
import { writeInteractiveCRMState } from '@/lib/automation-service';
import { z } from 'zod';

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
    const allowed = ['contacts', 'conversations', 'messages', 'deals', 'aiInsights'];
    if (Object.keys(body).some(key => !allowed.includes(key) && !['tenantId', 'automationEvent', 'qualificationEdits'].includes(key))) return NextResponse.json({ success: false, error: 'Use as APIs administrativas para alterar usuários ou configurações.' }, { status: 400 });
    const edits = z.object({ contactId: z.string(), values: z.object({ monthlyIncome: z.number().finite().min(0).max(1e9).nullable().optional(), downPaymentAvailable: z.number().finite().min(0).max(1e9).nullable().optional(), maxPropertyValue: z.number().finite().min(0).max(1e9).nullable().optional(), preferredPropertyType: z.enum(['APARTMENT','HOUSE','STUDIO','LAND','COMMERCIAL','PENTHOUSE']).nullable().optional(), targetRegions: z.array(z.string().max(100)).max(20).nullable().optional(), email: z.string().max(200).nullable().optional() }).strict() }).safeParse(body.qualificationEdits);
    if (body.qualificationEdits !== undefined && (!edits.success || session!.source === 'CHROME_EXTENSION')) return NextResponse.json({ error: 'Edição de qualificação inválida.' }, { status: 400 });
    const intent = body.automationEvent === undefined ? undefined : z.object({ trigger: z.enum(['LEAD_CREATED', 'STAGE_CHANGED']), entityId: z.string().min(1).max(200) }).strict().safeParse(body.automationEvent);
    if (intent && (!intent.success || session!.source === 'CHROME_EXTENSION')) return NextResponse.json({ error: 'Evento comercial inválido.' }, { status: 400 });
    const patch = Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    for (const key of allowed.filter(key => key !== 'aiInsights')) {
      if (patch[key] !== undefined && (!Array.isArray(patch[key]) || patch[key].some((item: any) => item.tenantId !== tenantId))) return NextResponse.json({ success: false, error: 'Registro de outra imobiliária ou inválido.' }, { status: 403 });
    }
    // Browser snapshots cannot forge AI provenance or overwrite server-owned analysis.
    delete patch.aiInsights;
    if (intent?.success && Array.isArray(patch.contacts)) patch.contacts = patch.contacts.map(({ qualificationFields: ignored, qualificationClassificationSource: ignoredSource, ...contact }: any) => contact);
    const state = intent?.success ? await writeInteractiveCRMState(tenantId, patch, intent.data) : await mutateCRMState(tenantId, previous => {
      if (Array.isArray(patch.contacts)) patch.contacts = patch.contacts.map((contact: any) => {
        const existing = previous.contacts.find(c => c.id === contact.id);
        const provenance = { ...existing?.qualificationFields };
        for (const field of qualificationFields) {
          // Unrelated full snapshots cannot turn an old cached AI value into a human decision.
          // Explicit field edits below are the only browser command that changes existing qualification.
          if (existing) contact[field] = existing[field];
        }
        if (existing && session!.source === 'CHROME_EXTENSION') contact.isPersonal = existing.isPersonal;
        return { ...contact, qualificationFields: provenance, qualificationClassificationSource: existing && typeof contact.isPersonal === 'boolean' && contact.isPersonal !== existing.isPersonal ? 'HUMAN' : existing?.qualificationClassificationSource };
      });
      const next = mergeTenantState(tenantId, previous, patch);
      if (edits.success) {
        const contact = next.contacts.find(c => c.id === edits.data.contactId);
        if (!contact) throw new Error('Contato não encontrado.');
        for (const [field, value] of Object.entries(edits.data.values)) {
          (contact as any)[field] = value === null ? undefined : value;
          contact.qualificationFields = { ...contact.qualificationFields, [field]: { source: 'HUMAN', value: value ?? '', messageId: '', quote: '', at: new Date().toISOString(), confidence: 1 } };
        }
        contact.updatedAt = new Date().toISOString();
      }
      return next;
    });
    if (Array.isArray(patch.messages) && patch.messages.length) await kickQualification(tenantId);
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
