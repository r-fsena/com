import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession, authorizedTenant } from '@/lib/api-auth';
import { mutateCRMState } from '@/lib/crm-repository';
import { commercialSchemas, emptyCommercial, serviceSchema, type CommercialConfig } from '@/lib/commercial-config';
import { AutomationError } from '@/lib/automation-service';

export const dynamic = 'force-dynamic';
const inputSchema = z.object({ operation: z.enum(['save', 'delete']), collection: z.enum(['pipelines', 'lossReasons', 'leadSources', 'leadSourceGroups', 'service']),
  id: z.string().max(200).optional(), revision: z.number().int().min(0), data: z.unknown().optional(), seed: z.unknown().optional() }).strict();
export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] });
  if (errorResponse) return errorResponse;
  if (session!.source === 'CHROME_EXTENSION') return NextResponse.json({ error: 'Entre no CRM para configurar o atendimento.' }, { status: 403 });
  try {
    const input = inputSchema.parse(await req.json());
    const tenantId = authorizedTenant(session!, req.headers.get('x-tenant-id'));
    const state = await mutateCRMState(tenantId, state => {
      const commercial = structuredClone(state.commercial || emptyCommercial());
      if (commercial.revision !== input.revision) throw new AutomationError('As configurações foram alteradas em outra janela. Atualize a página antes de continuar.', 409);
      // First explicit save preserves this tenant's existing local configuration; never imports another tenant.
      if (!state.commercial && input.seed) {
        const seed = z.object({ pipelines: z.array(commercialSchemas.pipelines).max(100), lossReasons: z.array(commercialSchemas.lossReasons).max(200),
          leadSources: z.array(commercialSchemas.leadSources).max(200), leadSourceGroups: z.array(commercialSchemas.leadSourceGroups).max(200) }).parse(input.seed);
        for (const items of Object.values(seed)) if (items.some(item => item.tenantId !== tenantId)) throw new AutomationError('Configuração de outra imobiliária.', 403);
        Object.assign(commercial, seed);
      }
      if (input.collection === 'service') commercial.service = serviceSchema.parse(input.data);
      else {
        const collection = input.collection;
        const old = commercial[collection].find(item => item.id === input.id);
        if (input.id && !old) throw new AutomationError('Item não encontrado. Atualize a página.', 404);
        if (input.operation === 'delete') (commercial as any)[collection] = commercial[collection].filter(item => item.id !== input.id);
        else {
          const data = input.data && typeof input.data === 'object' ? input.data : {};
          const now = new Date().toISOString();
          const saved = commercialSchemas[collection].parse({ ...old, ...data, id: old?.id || crypto.randomUUID(), tenantId,
            createdAt: old && 'createdAt' in old ? old.createdAt : now, updatedAt: now });
          if ('stages' in saved) saved.stages = saved.stages.map((stage, index) => ({ ...stage, order: index + 1, pipelineId: saved.id }));
          (commercial as any)[collection] = [...commercial[collection].filter(item => item.id !== saved.id), saved];
        }
      }
      for (const pipeline of commercial.pipelines) {
        if (pipeline.tenantId !== tenantId) throw new AutomationError('Funil de outra imobiliária.', 403);
        if (new Set(pipeline.stages.map(stage => stage.id)).size !== pipeline.stages.length) throw new AutomationError('Cada etapa deve ter uma identificação diferente.');
      }
      if (!commercial.pipelines.length) throw new AutomationError('Mantenha pelo menos um funil de atendimento.');
      const stages = new Set(commercial.pipelines.flatMap(pipeline => pipeline.stages.map(stage => stage.id)));
      // Existing opportunities must keep their pipeline and stage during edits/deletions.
      for (const deal of state.deals) if (!commercial.pipelines.some(pipeline => pipeline.id === deal.pipelineId && pipeline.stages.some(stage => stage.id === deal.stageId))) {
        if (input.collection === 'pipelines') throw new AutomationError('Há oportunidades usando este funil ou etapa. Mova-as antes de remover.');
      }
      for (const rule of state.automation?.rules || []) if (rule.status !== 'ARCHIVED') {
        const configs = [rule.draft, rule.published].filter(Boolean);
        if (configs.some(config => config!.conditions.some(condition => condition.field === 'stageId' && condition.operator !== 'IS_EMPTY' && !stages.has(condition.value)))) throw new AutomationError('Uma automação usa esta etapa. Altere a regra antes de removê-la.');
      }
      if (commercial.leadSources.some(source => source.groupId && !commercial.leadSourceGroups.some(group => group.id === source.groupId))) throw new AutomationError('Uma origem usa este grupo. Altere a origem antes de remover o grupo.');
      if (commercial.lossReasons.some(reason => reason.pipelineIds?.some(id => !commercial.pipelines.some(pipeline => pipeline.id === id)))) throw new AutomationError('Um motivo de perda usa este funil. Altere-o antes de remover.');
      if (input.collection === 'lossReasons' && input.operation === 'delete' && state.deals.some(deal => deal.lossReasonId === input.id)) throw new AutomationError('Este motivo aparece em oportunidades. Desative-o para preservar o histórico.');
      commercial.revision++; state.commercial = commercial; return state;
    });
    return NextResponse.json({ success: true, tenantId, commercial: state.commercial });
  } catch (error) { return NextResponse.json({ error: error instanceof AutomationError ? error.message : error instanceof z.ZodError ? error.issues.map(issue => issue.message).join(' ') : 'A configuração não foi salva. Tente novamente.' },
    { status: error instanceof AutomationError ? error.status : error instanceof z.ZodError ? 400 : 503 }); }
}
