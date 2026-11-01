import { z } from 'zod';
import type { Pipeline, LossReason, LeadSource, LeadSourceGroup, Tenant } from '@/types/crm';
const id = z.string().min(1).max(200);
const name = z.string().trim().min(1, 'Informe um nome.').max(200);
export const stageSchema = z.object({ id, pipelineId: z.string().max(200), name, order: z.number().int().min(1),
  slaHours: z.number().min(0).max(8760), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isWon: z.boolean().optional(), isLost: z.boolean().optional(), whatsappLabelMapping: z.array(z.string().max(100)).max(50).optional() })
  .refine(stage => !(stage.isWon && stage.isLost), 'Uma etapa não pode ser ganha e perdida ao mesmo tempo.');
export const commercialSchemas = {
  pipelines: z.object({ id, tenantId: id, name, isDefault: z.boolean(), stages: z.array(stageSchema).min(1).max(100) }),
  lossReasons: z.object({ id, tenantId: id, name, description: z.string().max(1000).optional(), isActive: z.boolean(),
    pipelineIds: z.array(id).max(100).optional(), createdAt: z.string(), updatedAt: z.string().optional() }),
  leadSourceGroups: z.object({ id, tenantId: id, name, description: z.string().max(1000).optional(), isActive: z.boolean(),
    order: z.number().optional(), createdAt: z.string(), updatedAt: z.string().optional() }),
  leadSources: z.object({ id, tenantId: id, name, description: z.string().max(1000).optional(), groupId: z.string().optional(),
    isActive: z.boolean(), order: z.number().optional(), createdAt: z.string(), updatedAt: z.string().optional() }),
};
export const serviceSchema = z.object({ timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('pt-BR', { timeZone: value }); return true; } catch { return false; } }),
  businessHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }).refine(value => value.start < value.end, 'O fim do atendimento deve ser depois do início.'),
  settings: z.object({ slaFirstResponseMinutes: z.number().min(1).max(10080), slaInactivityHours: z.number().min(1).max(8760),
    autoAssignRule: z.enum(['ROUND_ROBIN', 'UNASSIGNED_QUEUE', 'BY_REGION']), aiCopilotEnabled: z.boolean(), requireHumanApprovalForAI: z.boolean() }) });
export interface CommercialConfig {
  revision: number; pipelines: Pipeline[]; lossReasons: LossReason[]; leadSources: LeadSource[]; leadSourceGroups: LeadSourceGroup[];
  service?: Pick<Tenant, 'timezone' | 'businessHours' | 'settings'>;
}
export const emptyCommercial = (): CommercialConfig => ({ revision: 0, pipelines: [], lossReasons: [], leadSources: [], leadSourceGroups: [] });
