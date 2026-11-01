import { z } from 'zod';
import type { Contact, Deal, Task } from '@/types/crm';

const text = (max = 200) => z.string().trim().min(1, 'Preencha este campo.').max(max);
export const triggerLabels = {
  LEAD_CREATED: 'Um novo contato for cadastrado', STAGE_CHANGED: 'Uma oportunidade mudar de etapa',
  MESSAGE_RECEIVED: 'Uma mensagem do cliente chegar', LEAD_INACTIVE: 'Um contato ficar sem atendimento',
} as const;
export const fieldLabels = { source: 'Origem', temperature: 'Interesse', stageId: 'Etapa do funil', tags: 'Etiqueta', assignedUserId: 'Responsável' } as const;
export const valueLabels: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WHATSAPP: 'WhatsApp', MANUAL: 'Cadastro manual',
  INSTAGRAM_ADS: 'Instagram', FACEBOOK_ADS: 'Facebook', GOOGLE: 'Google', PORTAL_ZAP: 'Portal Zap',
  PORTAL_VIVAREAL: 'Viva Real', INDICATION: 'Indicação', WEBSITE: 'Site',
};
const message = text(4000).refine(value => {
  const variables = Array.from(value.matchAll(/\{\{(.*?)\}\}/g)).map(match => match[1].trim());
  return variables.every(variable => ['nome', 'primeiro_nome', 'empresa'].includes(variable)) &&
    !value.replace(/\{\{\s*(nome|primeiro_nome|empresa)\s*\}\}/g, '').match(/\{\{|\}\}/);
}, 'Use os campos Nome do cliente, Primeiro nome ou Nome da empresa.');
const assignee = text().default('OWNER');
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CREATE_TASK'), title: text(), dueHours: z.number().min(0).max(8760), assignee }),
  z.object({ type: z.literal('PREPARE_MESSAGE'), message, assignee }),
  z.object({ type: z.literal('SEND_WHATSAPP_MESSAGE'), message }),
  z.object({ type: z.literal('ADD_TAG'), tag: text(80) }),
  z.object({ type: z.literal('ASSIGN_BROKER'), userIds: z.array(text()).min(1).max(100) }),
]);
export const ruleConfigSchema = z.object({
  name: text(120), description: z.string().trim().max(500).default(''),
  trigger: z.enum(['LEAD_CREATED', 'STAGE_CHANGED', 'MESSAGE_RECEIVED', 'LEAD_INACTIVE']),
  inactivityHours: z.number().min(1).max(8760).default(24),
  match: z.enum(['ALL', 'ANY']).default('ALL'),
  conditions: z.array(z.object({ field: z.enum(['source', 'temperature', 'stageId', 'tags', 'assignedUserId']),
    operator: z.enum(['EQUALS', 'NOT_EQUALS', 'IS_EMPTY']), value: z.string().trim().max(200) })).max(8)
    .refine(conditions => conditions.every(condition => condition.operator === 'IS_EMPTY' || condition.value.length > 0), 'Escolha um valor para cada condição.')
    .refine(conditions => conditions.every(condition => condition.operator === 'IS_EMPTY' ||
      (condition.field === 'temperature' ? ['HOT', 'WARM', 'COLD'].includes(condition.value) : condition.field === 'source' ? Object.keys(valueLabels).filter(value => !['HOT', 'WARM', 'COLD'].includes(value)).includes(condition.value) : true)), 'Escolha uma origem ou classificação válida.'),
  actions: z.array(actionSchema).min(1, 'Escolha pelo menos uma ação.').max(8),
  schedule: z.object({ onlyBusinessHours: z.boolean(), timezone: text(80).refine(value => {
    try { new Intl.DateTimeFormat('pt-BR', { timeZone: value }).format(); return true; } catch { return false; }
  }, 'Fuso horário inválido.'), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7) })
    .refine(value => value.start < value.end, 'O fim do atendimento deve ser depois do início.'),
}).strict();
export type RuleConfig = z.infer<typeof ruleConfigSchema>;
export type RuleAction = z.infer<typeof actionSchema>;
export interface StoredRule {
  id: string; tenantId: string; revision: number; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  draft: RuleConfig; published?: RuleConfig; publishedRevision?: number; publishedAt?: string; testedRevision?: number;
  createdAt: string; updatedAt: string; updatedBy: string;
}
export interface AutomationEvent {
  id: string; trigger: RuleConfig['trigger']; contactId: string; dealId?: string;
  occurredAt: string; origin: 'CRM' | 'WEBHOOK' | 'HISTORY' | 'SCHEDULER';
}
export interface AutomationJob {
  id: string; ruleId: string; revision: number; event: AutomationEvent; action: RuleAction;
  status: 'QUEUED' | 'WAITING_CHANNEL' | 'DISPATCHING' | 'ACCEPTED' | 'DONE' | 'SKIPPED' | 'UNKNOWN';
  reason: string; createdAt: string; updatedAt: string; externalId?: string; conversationId?: string;
  dispatchedAt?: string;
}
export interface AutomationAudit { id: string; ruleId: string; action: string; userId: string; at: string; revision: number; config?: RuleConfig; }
export interface AutomationState {
  rules: StoredRule[]; jobs: AutomationJob[]; audit: AutomationAudit[];
  enrolled: Record<string, string>; lastWorkerAt?: string;
}
export const emptyAutomations = (): AutomationState => ({ rules: [], jobs: [], audit: [], enrolled: {} });
export interface AutomationCRM {
  contacts: Contact[]; deals: Deal[]; conversations: any[]; messages: any[]; tasks?: Task[];
  automation?: AutomationState;
}
export function renderAutomationMessage(template: string, name: string, company: string) {
  const values: Record<string, string> = { nome: name, primeiro_nome: name.trim().split(/\s+/)[0], empresa: company };
  return template.replace(/\{\{\s*(nome|primeiro_nome|empresa)\s*\}\}/g, (_, variable) => values[variable]);
}
export function matchesRule(config: RuleConfig, contact: Contact, deal?: Deal): { matches: boolean; reason: string } {
  if (contact.isPersonal) return { matches: false, reason: 'Contato pessoal: nenhuma ação comercial.' };
  if (contact.hasOptedOut) return { matches: false, reason: 'O contato pediu para não receber comunicações.' };
  const checks = config.conditions.map(condition => {
    const value = condition.field === 'stageId' ? deal?.stageId : contact[condition.field];
    const empty = value === undefined || value === '' || (Array.isArray(value) && !value.length);
    if (condition.operator === 'IS_EMPTY') return empty;
    const equal = Array.isArray(value) ? value.includes(condition.value) : value === condition.value;
    return condition.operator === 'EQUALS' ? equal : !equal;
  });
  const matches = checks.length === 0 || (config.match === 'ALL' ? checks.every(Boolean) : checks.some(Boolean));
  return { matches, reason: matches ? 'O contato atende aos critérios.' : 'O contato não atende aos critérios escolhidos.' };
}
export function isBusinessTime(config: RuleConfig, now: Date): boolean {
  if (!config.schedule.onlyBusinessHours) return true;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: config.schedule.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const time = `${get('hour')}:${get('minute')}`;
  return config.schedule.workDays.includes(day) && time >= config.schedule.start && time < config.schedule.end;
}
// Only explicit live events enter here. Import/reconciliation never enrolls contacts.
export function enqueueAutomationEvent<T extends AutomationCRM>(state: T, event: AutomationEvent, now = new Date()): T {
  if (event.origin === 'HISTORY' || !Number.isFinite(Date.parse(event.occurredAt)) || Math.abs(now.getTime() - Date.parse(event.occurredAt)) > 5 * 60_000) return state;
  const contact = state.contacts.find(item => item.id === event.contactId);
  if (!contact || contact.isPersonal || contact.hasOptedOut) return state;
  const automation = state.automation ||= emptyAutomations();
  if (event.origin !== 'SCHEDULER') automation.enrolled[contact.id] = event.occurredAt;
  for (const rule of automation.rules.filter(rule => rule.status === 'ACTIVE' && rule.published?.trigger === event.trigger)) {
    const config = rule.published!;
    const decision = matchesRule(config, contact, state.deals.find(deal => deal.id === event.dealId));
    config.actions.forEach((action, index) => {
      const id = JSON.stringify([rule.id, rule.publishedRevision, event.id, index]);
      if (automation.jobs.some(job => job.id === id)) return;
      automation.jobs.push({ id, ruleId: rule.id, revision: rule.publishedRevision!, event, action,
        status: decision.matches ? 'QUEUED' : 'SKIPPED', reason: decision.matches ? 'Aguardando processamento da ação.' : decision.reason, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    });
  }
  return state;
}
export function captureCRMTransition<T extends AutomationCRM>(previous: T, next: T, intent: { trigger: 'LEAD_CREATED' | 'STAGE_CHANGED'; entityId: string }, now = new Date()): T {
  let event: AutomationEvent | undefined;
  if (intent.trigger === 'LEAD_CREATED') {
    const contact = next.contacts.find(contact => contact.id === intent.entityId);
    if (contact && !previous.contacts.some(item => item.id === contact.id) && Math.abs(now.getTime() - Date.parse(contact.createdAt)) < 5 * 60_000) {
      event = { id: `created:${contact.id}`, trigger: 'LEAD_CREATED', contactId: contact.id, occurredAt: now.toISOString(), origin: 'CRM' };
    }
  } else {
    const old = previous.deals.find(deal => deal.id === intent.entityId);
    const deal = next.deals.find(deal => deal.id === intent.entityId);
    if (old && deal && old.stageId !== deal.stageId && old.contactId === deal.contactId) {
      event = { id: `stage:${deal.id}:${old.stageId}:${deal.stageId}:${now.toISOString()}`, trigger: 'STAGE_CHANGED', contactId: deal.contactId, dealId: deal.id, occurredAt: now.toISOString(), origin: 'CRM' };
    }
  }
  return event ? enqueueAutomationEvent(next, event, now) : next;
}
export function queueInactivity<T extends AutomationCRM>(state: T, now: Date): T {
  const automation = state.automation;
  if (!automation) return state;
  for (const rule of automation.rules.filter(rule => rule.status === 'ACTIVE' && rule.published?.trigger === 'LEAD_INACTIVE')) {
    for (const contact of state.contacts) {
      const enrolledAt = automation.enrolled[contact.id];
      if (!enrolledAt || Date.parse(enrolledAt) < Date.parse(rule.publishedAt || rule.updatedAt)) continue;
      const since = Math.max(Date.parse(enrolledAt), Date.parse(contact.lastTeamInteractionAt || '') || 0, Date.parse(contact.lastClientInteractionAt || '') || 0);
      if (now.getTime() - since < rule.published!.inactivityHours * 3600_000) continue;
      // Rule ID prevents a shorter inactivity rule from starting a longer one early.
      const event = { id: `inactive:${rule.id}:${contact.id}:${since}`, contactId: contact.id,
        trigger: 'LEAD_INACTIVE' as const, occurredAt: now.toISOString(), origin: 'SCHEDULER' as const };
      const other = automation.rules;
      automation.rules = other.filter(item => item.id === rule.id);
      enqueueAutomationEvent(state, event, now);
      automation.rules = other;
    }
  }
  return state;
}
export function jobGuard(state: AutomationCRM, job: AutomationJob, now: Date): string | null {
  const rule = state.automation?.rules.find(item => item.id === job.ruleId);
  const contact = state.contacts.find(item => item.id === job.event.contactId);
  if (!rule || rule.status !== 'ACTIVE') return 'A regra foi pausada ou arquivada.';
  if (rule.publishedRevision !== job.revision) return 'Uma nova versão substituiu esta execução.';
  if (!contact) return 'Contato removido.';
  if (now.getTime() - Date.parse(job.createdAt) > 24 * 3600_000) return 'Execução expirada após 24 horas.';
  const result = matchesRule(rule.published!, contact, state.deals.find(deal => deal.id === job.event.dealId));
  if (!result.matches) return result.reason;
  if (['PREPARE_MESSAGE', 'SEND_WHATSAPP_MESSAGE'].includes(job.action.type)) {
    if (contact.consentGiven !== true) return 'O contato não possui autorização de comunicação registrada.';
    if (Date.parse(contact.lastClientInteractionAt || '') > Date.parse(job.event.occurredAt) + 1000) return 'O cliente respondeu depois do início da automação.';
    if (Date.parse(contact.lastTeamInteractionAt || '') > Date.parse(job.event.occurredAt) + 1000) return 'A equipe já atendeu este contato.';
  }
  return null;
}
export function runInternalJobs<T extends AutomationCRM>(state: T, company: string, memberIds: string[], now = new Date()): T {
  // Evaluate this batch against its starting contact data; an earlier action that
  // adds a tag or changes the owner must not invalidate the rest of the batch.
  const guardState = { ...state, contacts: state.contacts.map(contact => ({ ...contact, tags: [...(contact.tags || [])] })) };
  for (const job of state.automation?.jobs || []) {
    if (!['QUEUED', 'WAITING_CHANNEL'].includes(job.status)) continue;
    const reason = jobGuard(guardState, job, now);
    const rule = state.automation!.rules.find(item => item.id === job.ruleId);
    if (reason) { job.status = 'SKIPPED'; job.reason = reason; job.updatedAt = now.toISOString(); continue; }
    if (!isBusinessTime(rule!.published!, now)) { job.reason = 'Aguardando o próximo horário de atendimento.'; continue; }
    if (job.action.type === 'SEND_WHATSAPP_MESSAGE') continue;
    const contact = state.contacts.find(item => item.id === job.event.contactId)!;
    const action = job.action;
    if (action.type === 'ASSIGN_BROKER') {
      const available = action.userIds.filter(id => memberIds.includes(id));
      if (!available.length) { job.status = 'SKIPPED'; job.reason = 'Nenhum responsável selecionado está ativo nesta imobiliária.'; continue; }
      const completed = state.automation!.jobs.filter(other => other.ruleId === job.ruleId && other.action.type === 'ASSIGN_BROKER' && other.status === 'DONE').length;
      contact.assignedUserId = available[completed % available.length];
      state.conversations.filter(conversation => conversation.contactId === contact.id).forEach(conversation => { conversation.assignedUserId = contact.assignedUserId; });
    } else if (action.type === 'ADD_TAG') {
      contact.tags = Array.from(new Set([...(contact.tags || []), action.tag]));
    } else {
      const assignedUserId = action.assignee === 'OWNER' ? contact.assignedUserId : action.assignee;
      if (!assignedUserId || !memberIds.includes(assignedUserId)) { job.status = 'SKIPPED'; job.reason = 'Defina um responsável ativo para criar esta tarefa.'; continue; }
      state.tasks ||= [];
      const taskId = `automation:${job.id}`;
      if (!state.tasks.some(task => task.id === taskId)) state.tasks.push({ id: taskId, tenantId: contact.tenantId, contactId: contact.id,
        assignedUserId, title: action.type === 'CREATE_TASK' ? action.title : 'Revisar e enviar mensagem de WhatsApp',
        description: action.type === 'PREPARE_MESSAGE' ? renderAutomationMessage(action.message, contact.name, company) : `Criada pela automação ${rule!.published!.name}.`,
        dueDate: new Date(now.getTime() + (action.type === 'CREATE_TASK' ? action.dueHours : 0) * 3600_000).toISOString(),
        taskType: action.type === 'PREPARE_MESSAGE' ? 'WHATSAPP' : 'FOLLOW_UP', priority: 'MEDIUM', isCompleted: false });
    }
    contact.updatedAt = now.toISOString();
    job.status = 'DONE'; job.reason = action.type === 'PREPARE_MESSAGE' ? 'Mensagem preparada na agenda para revisão; nenhum envio realizado.' : 'Ação concluída no CRM.'; job.updatedAt = now.toISOString();
  }
  return state;
}
