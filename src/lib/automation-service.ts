import crypto from 'crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { tenants, users, memberships, crmTenantState } from '@/db/schema';
import { mutateCRMState, readCRMState, mergeTenantState, type PersistedCRMState } from '@/lib/crm-repository';
import { emptyAutomations, ruleConfigSchema, matchesRule, renderAutomationMessage, enqueueAutomationEvent, captureCRMTransition, runInternalJobs, queueInactivity, jobGuard, isBusinessTime, type AutomationEvent, type StoredRule, type RuleConfig } from '@/lib/automations';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';
import { ZApiClient } from '@/lib/zapi-client';
import { acquireOutboundLane, markOutboundAttempt, releaseOutboundLane } from '@/lib/outbound-lane';

export class AutomationError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function automationEnvironment(tenantId: string) {
  if (!process.env.DATABASE_URL) throw new AutomationError('Configure o banco de dados para salvar e executar automações.', 503);
  const [tenant] = await db.select({ name: tenants.name, status: tenants.status }).from(tenants).where(eq(tenants.slug, tenantId.replace(/^tenant-/, ''))).limit(1);
  if (!tenant || !['ACTIVE', 'TRIAL'].includes(tenant.status || '')) throw new AutomationError('Esta imobiliária não está ativa.', 403);
  const members = await db.select({ id: users.id, name: users.fullName }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId)).innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(and(eq(tenants.slug, tenantId.replace(/^tenant-/, '')), eq(users.isActive, true), eq(memberships.isActive, true), sql`${memberships.role} <> 'VIEWER'`));
  return { company: tenant.name, members };
}
function validateReferences(config: RuleConfig, memberIds: string[]) {
  for (const action of config.actions) {
    const ids = action.type === 'ASSIGN_BROKER' ? action.userIds : 'assignee' in action && action.assignee !== 'OWNER' ? [action.assignee] : [];
    if (ids.some(id => !memberIds.includes(id))) throw new AutomationError('Escolha responsáveis ativos desta imobiliária.');
  }
  if (config.conditions.some(condition => condition.field === 'assignedUserId' && condition.operator !== 'IS_EMPTY' && !memberIds.includes(condition.value))) throw new AutomationError('O responsável do filtro não está ativo nesta imobiliária.');
}
export function workerIsHealthy(state: PersistedCRMState, now = Date.now()) {
  return !!process.env.AUTOMATIONS_CRON_SECRET && !!state.automation?.lastWorkerAt && now - Date.parse(state.automation.lastWorkerAt) < 10 * 60_000;
}
export function automationCapabilities(state: PersistedCRMState) {
  const workerReady = workerIsHealthy(state);
  return { workerReady, outboundEnabled: workerReady && process.env.AUTOMATIONS_OUTBOUND_ENABLED === 'true',
    lastWorkerAt: state.automation?.lastWorkerAt || null };
}
function requireWorker(config: RuleConfig, state: PersistedCRMState) {
  if ((config.trigger === 'LEAD_INACTIVE' || config.schedule.onlyBusinessHours) && !workerIsHealthy(state)) throw new AutomationError('O agendamento do servidor ainda não está operacional. Use uma regra imediata ou solicite a configuração ao administrador.', 409);
  if (config.actions.some(action => action.type === 'SEND_WHATSAPP_MESSAGE') && !automationCapabilities(state).outboundEnabled) throw new AutomationError('O envio automático ainda não está habilitado no servidor. Use “Preparar mensagem para revisão”.', 409);
}
function ruleById(state: PersistedCRMState, id: string, revision: number) {
  const rule = state.automation?.rules.find(item => item.id === id);
  if (!rule) throw new AutomationError('Regra não encontrada.', 404);
  if (rule.revision !== revision) throw new AutomationError('Esta regra foi alterada em outra janela. Atualize a lista antes de continuar.', 409);
  return rule;
}
export async function changeAutomation(tenantId: string, userId: string, input: any) {
  const environment = await automationEnvironment(tenantId);
  const memberIds = environment.members.map(member => member.id);
  let result: any;
  await mutateCRMState(tenantId, state => {
    const automation = state.automation ||= emptyAutomations();
    const now = new Date().toISOString();
    if (input.operation === 'save') {
      const parsed = ruleConfigSchema.safeParse(input.config);
      if (!parsed.success) throw new AutomationError(parsed.error.issues.map(issue => issue.message).join(' '));
      validateReferences(parsed.data, memberIds);
      if (state.commercial && parsed.data.conditions.some(condition => condition.field === 'stageId' && condition.operator !== 'IS_EMPTY' && !state.commercial!.pipelines.some(pipeline => pipeline.stages.some(stage => stage.id === condition.value)))) throw new AutomationError('Escolha uma etapa de um funil desta imobiliária.');
      let rule: StoredRule;
      if (input.id) {
        rule = ruleById(state, input.id, input.revision);
        if (rule.status === 'ARCHIVED') throw new AutomationError('Duplique a regra arquivada para voltar a utilizá-la.');
        rule.draft = parsed.data; rule.revision++; rule.testedRevision = undefined;
      } else {
        if (automation.rules.length >= 200) throw new AutomationError('Limite de 200 regras atingido.');
        rule = { id: crypto.randomUUID(), tenantId, revision: 1, status: 'DRAFT', draft: parsed.data, createdAt: now, updatedAt: now, updatedBy: userId };
        automation.rules.unshift(rule);
      }
      rule.updatedAt = now; rule.updatedBy = userId; result = { rule };
    } else {
      const rule = ruleById(state, input.id, input.revision);
      if (input.operation === 'simulate') {
        const contact = input.contactId ? state.contacts.find(contact => contact.id === input.contactId) : {
          id: 'example', tenantId, name: 'Cliente de exemplo', source: 'WHATSAPP', temperature: 'HOT', tags: [],
          assignedUserId: memberIds[0], consentGiven: true, hasOptedOut: false, isPersonal: false,
        } as any;
        if (!contact) throw new AutomationError('Contato não encontrado nesta imobiliária.', 404);
        const deal = state.deals.find(deal => deal.contactId === contact.id && deal.status === 'OPEN');
        const decision = matchesRule(rule.draft, contact, deal);
        const simulatedRule = { ...rule, status: 'ACTIVE' as const, published: rule.draft, publishedRevision: rule.revision };
        const sandbox = { contacts: [structuredClone(contact)], deals: deal ? [structuredClone(deal)] : [], conversations: [], messages: [], tasks: [],
          automation: { ...emptyAutomations(), rules: [simulatedRule] } };
        const simulated = runInternalJobs(enqueueAutomationEvent(sandbox, { id: `simulation:${rule.id}`, trigger: rule.draft.trigger,
          contactId: contact.id, dealId: deal?.id, occurredAt: now, origin: 'CRM' }), environment.company, memberIds);
        rule.testedRevision = rule.revision;
        result = { simulation: { ...decision, contactName: contact.name,
          warning: 'Simulação: nenhum envio ou alteração de contato foi realizado.',
          actions: rule.draft.actions.map((action, index) => ({ type: action.type,
            text: 'message' in action ? renderAutomationMessage(action.message, contact.name, environment.company) : action.type === 'CREATE_TASK' ? `${action.title} — prazo: ${action.dueHours} hora(s)` : action.type === 'ADD_TAG' ? `Adicionar etiqueta: ${action.tag}` : 'Distribuir entre os responsáveis selecionados.',
            warning: simulated.automation.jobs[index]?.status === 'SKIPPED' ? simulated.automation.jobs[index].reason : undefined })),
          outsideBusinessHours: !isBusinessTime(rule.draft, new Date()), capabilities: automationCapabilities(state) } };
      } else if (input.operation === 'publish') {
        if (rule.status === 'ARCHIVED') throw new AutomationError('Uma regra arquivada não pode ser ativada.');
        if (rule.status === 'ACTIVE' && rule.publishedRevision === rule.revision) throw new AutomationError('Esta versão já está ativa. Altere e teste o rascunho antes de publicar uma nova versão.', 409);
        if (rule.testedRevision !== rule.revision) throw new AutomationError('Teste este rascunho sem enviar antes de ativar.', 409);
        validateReferences(rule.draft, memberIds); requireWorker(rule.draft, state);
        rule.published = structuredClone(rule.draft); rule.publishedRevision = rule.revision; rule.publishedAt = now; rule.status = 'ACTIVE';
        rule.updatedAt = now; rule.updatedBy = userId;
        // Edits supersede pending jobs. Never replay the contact catalog on activation.
        for (const job of automation.jobs) if (job.ruleId === rule.id && ['QUEUED', 'WAITING_CHANNEL'].includes(job.status)) {
          job.status = 'SKIPPED'; job.reason = 'Substituída pela publicação de uma nova versão.'; job.updatedAt = now;
        }
      } else if (input.operation === 'pause' || input.operation === 'archive') {
        rule.status = input.operation === 'pause' ? 'PAUSED' : 'ARCHIVED'; rule.revision++;
        rule.testedRevision = undefined; rule.updatedAt = now; rule.updatedBy = userId;
        for (const job of automation.jobs) if (job.ruleId === rule.id && ['QUEUED', 'WAITING_CHANNEL'].includes(job.status)) {
          job.status = 'SKIPPED'; job.reason = 'A regra foi pausada ou arquivada.'; job.updatedAt = now;
        }
      } else throw new AutomationError('Operação inválida.');
      result = { ...result, rule };
    }
    automation.audit.push({ id: crypto.randomUUID(), ruleId: result.rule.id, action: input.operation, userId, at: now, revision: result.rule.revision,
      ...(['save', 'publish'].includes(input.operation) ? { config: structuredClone(result.rule.draft) } : {}) });
    return state;
  });
  return result;
}

export async function applyLiveAutomationEvent(tenantId: string, event: AutomationEvent) {
  const environment = await automationEnvironment(tenantId);
  return mutateCRMState(tenantId, state => runInternalJobs(enqueueAutomationEvent(state, event), environment.company, environment.members.map(member => member.id)));
}
export async function writeInteractiveCRMState(tenantId: string, patch: Partial<PersistedCRMState>, intent: { trigger: 'LEAD_CREATED' | 'STAGE_CHANGED'; entityId: string }) {
  const existing = await readCRMState(tenantId);
  const environment = existing.automation?.rules.some(rule => rule.status === 'ACTIVE') ? await automationEnvironment(tenantId).catch(() => null) : null;
  return mutateCRMState(tenantId, previous => {
    // The UI may resend its full collection. A transition only writes its target,
    // so retries cannot undo tags or assignments produced by the first execution.
    if (intent.trigger === 'LEAD_CREATED' && previous.contacts.some(contact => contact.id === intent.entityId)) return previous;
    const scopedPatch = intent.trigger === 'LEAD_CREATED'
      ? { contacts: patch.contacts?.filter(contact => contact.id === intent.entityId) }
      : { deals: patch.deals?.filter(deal => deal.id === intent.entityId) };
    const next = captureCRMTransition(previous, mergeTenantState(tenantId, previous, scopedPatch), intent);
    return environment ? runInternalJobs(next, environment.company, environment.members.map(member => member.id)) : next;
  });
}

// The worker is awaited by a scheduled HTTP invocation. No detached serverless timers.
export async function runAutomationWorker(tenantId: string, deadline = Date.now() + 45000) {
  const environment = await automationEnvironment(tenantId);
  await mutateCRMState(tenantId, state => {
    const now = new Date(); const automation = state.automation ||= emptyAutomations();
    automation.lastWorkerAt = now.toISOString();
    for (const job of automation.jobs) if (job.status === 'DISPATCHING' && now.getTime() - Date.parse(job.dispatchedAt || job.updatedAt) > 120_000) {
      job.status = 'UNKNOWN'; job.reason = 'O envio foi iniciado, mas a confirmação não chegou. Confira no WhatsApp antes de reenviar.'; job.updatedAt = now.toISOString();
    }
    return runInternalJobs(queueInactivity(state, now), environment.company, environment.members.map(member => member.id), now);
  });
  if (process.env.AUTOMATIONS_OUTBOUND_ENABLED !== 'true') return;
  // At most 5 external requests per tenant/invocation; claim each job under the tenant row lock.
  for (let index = 0; index < 5 && Date.now() < deadline - 17000; index++) {
    let claimed: any;
    await mutateCRMState(tenantId, state => {
      const now = new Date();
      const candidate = state.automation?.jobs.find(job => job.action.type === 'SEND_WHATSAPP_MESSAGE' &&
        ['QUEUED', 'WAITING_CHANNEL'].includes(job.status) && now.getTime() - Date.parse(job.updatedAt) >= (job.status === 'WAITING_CHANNEL' ? 60_000 : 0) &&
        isBusinessTime(state.automation!.rules.find(rule => rule.id === job.ruleId)?.published || state.automation!.rules[0].draft, now));
      if (!candidate) return state;
      const reason = jobGuard(state, candidate, now);
      if (reason) { candidate.status = 'SKIPPED'; candidate.reason = reason; candidate.updatedAt = now.toISOString(); return state; }
      const rule = state.automation!.rules.find(rule => rule.id === candidate.ruleId)!;
      if (!isBusinessTime(rule.published!, now)) return state;
      const contact = state.contacts.find(contact => contact.id === candidate.event.contactId)!;
      const conversation = state.conversations.find(conversation => conversation.contactId === contact.id && !conversation.isPersonal);
      if (!conversation || !/^\+?\d{10,15}$/.test(contact.phone)) { candidate.status = 'SKIPPED'; candidate.reason = 'Contato sem conversa ou telefone válido.'; return state; }
      candidate.status = 'DISPATCHING'; candidate.dispatchedAt = now.toISOString(); candidate.updatedAt = now.toISOString();
      candidate.conversationId = conversation.id; candidate.reason = 'Verificando conexão antes de enviar.';
      claimed = { job: structuredClone(candidate), phone: contact.phone.replace(/\D/g, ''), conversation,
        content: renderAutomationMessage((candidate.action as any).message, contact.name, environment.company) };
      return state;
    });
    if (!claimed) break;
    let attempted = false;
    let laneAcquired = false;
    let laneInstanceId = claimed.conversation.instanceId;
    const laneOwner = `automation:${claimed.job.id}`;
    let externalId: string | undefined;
    let failure = '';
    try {
      const credentials = await ZapiCredentialsService.resolveCredentials({ tenantId, instanceId: claimed.conversation.instanceId });
      const client = new ZApiClient({ ...credentials, requestTimeoutMs: 8000 });
      const status = await client.getStatus();
      if (!status.success || !status.data?.connected) throw new Error('Conexão indisponível.');
      // Recheck pause, new reply and criteria immediately before the external side effect.
      const current = await readCRMState(tenantId);
      const reason = jobGuard(current, claimed.job, new Date());
      if (reason) throw new AutomationError(reason);
      if (process.env.CAMPAIGNS_ENABLED === 'true') {
        const lane = await acquireOutboundLane(tenantId, credentials.instanceId, claimed.phone, laneOwner, 'AUTOMATION');
        if (!lane.acquired) throw new AutomationError(`Conexão aguardando intervalo: ${lane.reason}`);
        laneAcquired = true;
        laneInstanceId = credentials.instanceId;
        await markOutboundAttempt(tenantId, credentials.instanceId, claimed.phone, laneOwner, false);
      }
      attempted = true;
      const sent = await client.sendText(claimed.phone, claimed.content);
      if (!sent.success || !sent.externalMessageId) throw new Error('Confirmação de envio ausente.');
      externalId = sent.externalMessageId;
    } catch (error) {
      failure = error instanceof AutomationError ? error.message : attempted ? 'Envio sem confirmação. Confira no WhatsApp antes de reenviar.' : 'Conexão indisponível. Aguardando uma nova verificação.';
    }
    await mutateCRMState(tenantId, state => {
      const job = state.automation!.jobs.find(job => job.id === claimed.job.id)!;
      const now = new Date().toISOString();
      job.status = externalId ? 'ACCEPTED' : attempted ? 'UNKNOWN' : failure.startsWith('Conexão') ? 'WAITING_CHANNEL' : 'SKIPPED';
      job.reason = externalId ? 'Envio aceito pelo provedor. A entrega é acompanhada no histórico da conversa.' : failure;
      job.externalId = externalId; job.updatedAt = now;
      if (!externalId) return state;
      const alreadyReceived = state.messages.find(message => (message.externalId || message.id) === externalId);
      const status = alreadyReceived && ['DELIVERED', 'READ'].includes(alreadyReceived.status) ? alreadyReceived.status : 'SENT' as const;
      return mergeTenantState(tenantId, state, { messages: [{ id: externalId, externalId, tenantId, conversationId: claimed.conversation.id,
        senderType: 'SYSTEM', senderName: 'Automação', messageType: 'TEXT', content: claimed.content, status, isInternalNote: false, timestamp: now }],
        contacts: state.contacts.filter(contact => contact.id === job.event.contactId).map(contact => ({ ...contact, lastTeamInteractionAt: now })) });
    });
    if (laneAcquired) await releaseOutboundLane(tenantId, laneInstanceId, claimed.phone, laneOwner, attempted);
  }
}
export async function automationTenantIds() {
  const rows = await db.select({ id: crmTenantState.tenantKey }).from(crmTenantState).where(sql`${crmTenantState.state}->'automation' IS NOT NULL`)
    .orderBy(sql`${crmTenantState.state}->'automation'->>'lastWorkerAt' ASC NULLS FIRST`, asc(crmTenantState.tenantKey)).limit(20);
  return rows.map(row => row.id);
}
