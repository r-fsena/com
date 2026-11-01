import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizedTenant, validateApiSession } from '@/lib/api-auth';
import { mutateCRMState } from '@/lib/crm-repository';
import { automationEnvironment, AutomationError } from '@/lib/automation-service';

export const dynamic = 'force-dynamic';
const fields = z.object({ contactId: z.string().min(1), assignedUserId: z.string().min(1), title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(), dueDate: z.string().datetime(),
  taskType: z.enum(['CALL', 'WHATSAPP', 'VISIT', 'PROPOSAL', 'FINANCING_SIMULATION', 'FOLLOW_UP']),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']), isCompleted: z.boolean().default(false),
  durationMinutes: z.number().min(0).max(1440).optional(), location: z.string().max(500).optional(),
  inviteSentViaWhatsApp: z.boolean().optional(), inviteSentViaWhatsAppAt: z.string().datetime().optional(),
  inviteSentViaEmail: z.boolean().optional(), inviteSentViaEmailAt: z.string().datetime().optional() });
const schema = z.object({ operation: z.enum(['create', 'update', 'delete']), id: z.string().max(600).optional(),
  data: fields.partial().optional() }).strict();
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'] });
  if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Use o CRM para alterar tarefas.' }, { status: 403 });
  try {
    const input = schema.parse(await req.json());
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const environment = await automationEnvironment(tenantId);
    const state = await mutateCRMState(tenantId, state => {
      state.tasks ||= [];
      const old = state.tasks.find(task => task.id === input.id);
      if (input.operation !== 'create' && !old) throw new AutomationError('Tarefa não encontrada.', 404);
      if (old && session!.role === 'BROKER' && old.assignedUserId !== session!.userId) throw new AutomationError('Você só pode alterar suas próprias tarefas.', 403);
      if (input.operation === 'delete') { state.tasks = state.tasks.filter(task => task.id !== input.id); return state; }
      const data = fields.parse({ ...old, ...input.data });
      if (!state.contacts.some(contact => contact.id === data.contactId) || !environment.members.some(member => member.id === data.assignedUserId)) throw new AutomationError('Escolha contato e responsável desta imobiliária.');
      if (session!.role === 'BROKER' && data.assignedUserId !== session!.userId) throw new AutomationError('Você só pode criar ou alterar tarefas sob sua responsabilidade.', 403);
      const task = { ...old, ...data, id: old?.id || crypto.randomUUID(), tenantId,
        completedAt: data.isCompleted ? old?.completedAt || new Date().toISOString() : undefined };
      state.tasks = [...state.tasks.filter(item => item.id !== task.id), task];
      return state;
    });
    return NextResponse.json({ success: true, tenantId, tasks: state.tasks });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof AutomationError ? error.message : error instanceof z.ZodError ? 'Confira título, contato, responsável e prazo da tarefa.' : 'A tarefa não foi salva. Tente novamente.' }, { status: error instanceof AutomationError ? error.status : error instanceof z.ZodError ? 400 : 503 });
  }
}
