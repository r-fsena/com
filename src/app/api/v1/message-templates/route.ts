import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { mutateCRMState } from '@/lib/crm-repository';

export const dynamic = 'force-dynamic';
const template = z.object({ title: z.string().trim().min(1).max(200), shortcut: z.string().regex(/^\/\S{1,80}$/),
  content: z.string().trim().min(1).max(10000), category: z.enum(['GREETING', 'QUALIFICATION', 'PROPERTIES', 'VISIT', 'CLOSING', 'FOLLOW_UP', 'DOCS']),
  imageUrl: z.string().max(7_000_000).optional().refine(value => !value || /^https:\/\//.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,/.test(value), 'Use uma imagem válida.'),
  isActive: z.boolean().default(true), mediaType: z.enum(['image', 'document']).optional() });
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] });
  if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Use o CRM para editar modelos.' }, { status: 403 });
  try {
    const input = z.object({ operation: z.enum(['save', 'delete']), id: z.string().max(200).optional(), updatedAt: z.string().optional(), data: template.partial().optional() }).strict().parse(await req.json());
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    let error = ''; let status = 400;
    const state = await mutateCRMState(tenantId, state => {
      state.quickReplies ||= [];
      const old = state.quickReplies.find(item => item.id === input.id && item.tenantId === tenantId);
      if (input.id && !old) { error = 'Modelo não encontrado. Atualize a lista.'; status = 404; return state; }
      if (old && old.updatedAt !== input.updatedAt) { error = 'O modelo foi alterado em outra janela. Atualize antes de editar.'; status = 409; return state; }
      if (input.operation === 'delete') { state.quickReplies = state.quickReplies.filter(item => item.id !== input.id); return state; }
      const data = template.parse({ ...old, ...input.data });
      if (state.quickReplies.some(item => item.id !== old?.id && item.shortcut === data.shortcut)) { error = 'Este atalho já está em uso. Escolha outro.'; return state; }
      const now = new Date().toISOString();
      const saved = { ...data, id: old?.id || crypto.randomUUID(), tenantId, createdAt: old?.createdAt || now, updatedAt: now };
      state.quickReplies = [...state.quickReplies.filter(item => item.id !== saved.id), saved]; return state;
    });
    if (error) return NextResponse.json({ error }, { status });
    return NextResponse.json({ success: true, tenantId, quickReplies: state.quickReplies });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? 'Confira título, atalho, categoria e conteúdo do modelo.' : 'O modelo não foi salvo. Tente novamente.' }, { status: error instanceof z.ZodError ? 400 : 503 }); }
}
