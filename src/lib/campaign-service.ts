import crypto from 'crypto';
import { and, eq, inArray, asc, desc, sql, isNull, gt } from 'drizzle-orm';
import { db } from '@/db';
import { crmCampaigns, crmCampaignRecipients, crmCampaignReceipts, crmTenantState, tenants, whatsappInstances, users } from '@/db/schema';
import { readCRMState, mutateCRMState, emptyCRMState, mergeTenantState, type PersistedCRMState } from '@/lib/crm-repository';
import { automationEnvironment, AutomationError, workerIsHealthy } from '@/lib/automation-service';
import { campaignConfigSchema, buildCampaignAudience, campaignExclusion, campaignPhone, renderCampaignMessage, renderCampaignParts, campaignParts, campaignSequenceStatus, campaignBusinessTime, type CampaignConfig, type CampaignPayload, type MarketingPermission, type RecipientPayload, type RecipientStatus } from '@/lib/campaigns';
import { verifyCampaignMedia, campaignMediaUrl } from '@/lib/campaign-media';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';
import { ZApiClient } from '@/lib/zapi-client';
import { acquireOutboundLane, releaseOutboundLane, markOutboundAttempt, recentlyCampaignedPhones } from '@/lib/outbound-lane';

type CampaignRow = typeof crmCampaigns.$inferSelect;
type RecipientRow = typeof crmCampaignRecipients.$inferSelect;
const pending = ['PENDING', 'PROCESSING', 'WAITING_CHANNEL'];
const hash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function campaignCapabilities(state: PersistedCRMState) {
  return { workerReady: workerIsHealthy(state), outboundEnabled: process.env.CAMPAIGNS_ENABLED === 'true' && process.env.CAMPAIGNS_OUTBOUND_ENABLED === 'true',
    storageReady: !!process.env.AWS_S3_BUCKET_NAME, lastWorkerAt: state.automation?.lastWorkerAt || null };
}
function requireDelivery(state: PersistedCRMState) {
  const capabilities = campaignCapabilities(state);
  if (!capabilities.outboundEnabled) throw new AutomationError('O envio de campanhas não está habilitado no servidor. Rascunhos e simulações continuam disponíveis.', 409);
  if (!capabilities.workerReady) throw new AutomationError('O agendador está sem confirmação recente. Solicite a verificação antes de iniciar envios.', 409);
}
async function ownedCampaign(transaction: any, tenantId: string, id: string, revision?: number): Promise<CampaignRow> {
  const [row] = await transaction.select().from(crmCampaigns).where(and(eq(crmCampaigns.id, id), eq(crmCampaigns.tenantKey, tenantId))).for('update');
  if (!row) throw new AutomationError('Campanha não encontrada neste ambiente.', 404);
  if (revision !== undefined && row.payload.revision !== revision) throw new AutomationError('A campanha foi alterada em outra janela. Atualize a lista antes de continuar.', 409);
  return row;
}
async function lockedState(transaction: any, tenantId: string): Promise<PersistedCRMState> {
  await transaction.insert(crmTenantState).values({ tenantKey: tenantId, state: emptyCRMState() }).onConflictDoNothing();
  const [row] = await transaction.select().from(crmTenantState).where(eq(crmTenantState.tenantKey, tenantId)).for('update');
  return row.state as PersistedCRMState;
}
async function campaignContext(tenantId: string) {
  if (!process.env.DATABASE_URL) throw new AutomationError('O banco de dados precisa estar configurado para salvar campanhas.', 503);
  const environment = await automationEnvironment(tenantId);
  return { ...environment, memberNames: Object.fromEntries(environment.members.map(member => [member.id, member.name])) };
}
export async function campaignConnections(tenantId: string) {
  return db.select({ id: whatsappInstances.zapiInstanceId, name: whatsappInstances.name, phone: whatsappInstances.phoneNumber }).from(whatsappInstances)
    .innerJoin(tenants, eq(tenants.id, whatsappInstances.tenantId)).where(eq(tenants.slug, tenantId.replace(/^tenant-/, '')));
}
export async function campaignSelfPhone(userId: string) {
  const [user] = await db.select({ phone: users.phone }).from(users).where(and(eq(users.id, userId), eq(users.isActive, true))).limit(1);
  return user?.phone ? campaignPhone(user.phone) : null;
}
async function validateConnection(tenantId: string, instanceId: string, requireConnected = false) {
  if (!instanceId) throw new AutomationError('Escolha a linha de WhatsApp que enviará a campanha.');
  const credentials = await ZapiCredentialsService.resolveCredentials({ tenantId, instanceId });
  if (requireConnected) {
    const status = await new ZApiClient({ ...credentials, requestTimeoutMs: 8000 }).getStatus();
    if (!status.success || !status.data?.connected) throw new AutomationError('Esta linha não está disponível para envio. Confira a conexão e a assinatura do provedor.', 409);
  }
  return credentials;
}
async function audienceFor(tenantId: string, state: PersistedCRMState, config: CampaignConfig, memberNames: Record<string, string>, transaction: any = db, company = '') {
  const audience = buildCampaignAudience(state, config, memberNames, await recentlyCampaignedPhones(tenantId, transaction));
  if (audience.total > 5000) throw new AutomationError('Selecione até 5.000 contatos por campanha. Use os filtros para reduzir o público.');
  for (const row of audience.rows.filter(row => row.eligible)) {
    const contact = state.contacts.find(contact => contact.id === row.id)!;
    if (renderCampaignParts(config, row.name, company, memberNames[contact.assignedUserId || '']).some(part => part.message.length > (part.attachment ? 1024 : 4096))) {
      row.eligible = false; row.reason = 'A mensagem personalizada ficou longa demais. Encurte o texto.';
    }
  }
  audience.eligible = audience.rows.filter(row => row.eligible).length; audience.excluded = audience.total - audience.eligible;
  return audience;
}
function audienceHash(audience: ReturnType<typeof buildCampaignAudience>, config: CampaignConfig, state: PersistedCRMState, members: Record<string, string>, company: string) {
  return hash({ config, recipients: audience.rows.filter(row => row.eligible).map(row => {
    const contact = state.contacts.find(contact => contact.id === row.id)!;
    return [row.id, row.phone, row.permissionAt, renderCampaignParts(config, row.name, company, members[contact.assignedUserId || ''])];
  }).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) });
}
export async function previewCampaign(tenantId: string, input: unknown) {
  const config = campaignConfigSchema.parse(input);
  const [state, context] = await Promise.all([readCRMState(tenantId), campaignContext(tenantId)]);
  const audience = await audienceFor(tenantId, state, config, context.memberNames, db, context.company);
  return { audience, sample: audience.rows.filter(row => row.eligible).slice(0, 3).map(row => ({ name: row.name,
    message: renderCampaignMessage(config.message, row.name, context.company, context.memberNames[state.contacts.find(contact => contact.id === row.id)?.assignedUserId || '']),
    parts: renderCampaignParts(config, row.name, context.company, context.memberNames[state.contacts.find(contact => contact.id === row.id)?.assignedUserId || '']) })), capabilities: campaignCapabilities(state) };
}
export async function setMarketingPermission(tenantId: string, userId: string, input: { contactId: string; granted: boolean; source: string; notes: string; confirmed: true; obtainedAt?: string; expectedRecordedAt?: string }) {
  await campaignContext(tenantId);
  return mutateCRMState(tenantId, state => {
    const contact = state.contacts.find(contact => contact.id === input.contactId);
    if (!contact) throw new AutomationError('Contato não encontrado neste ambiente.', 404);
    const phone = campaignPhone(contact.phone);
    if (!phone) throw new AutomationError('Informe um telefone internacional válido no cadastro do contato.');
    if (input.granted && state.contacts.some(item => campaignPhone(item.phone) === phone && (item.isPersonal || state.conversations.some(conversation => conversation.contactId === item.id && conversation.isPersonal)))) throw new AutomationError('Contatos pessoais não podem receber campanhas. Confira o cadastro antes de registrar autorização.');
    const previous = state.marketingPermissions?.[phone];
    if (previous?.recordedAt !== input.expectedRecordedAt) throw new AutomationError('A autorização foi alterada em outra janela. Atualize antes de continuar.', 409);
    const now = new Date(Math.max(Date.now(), (Date.parse(previous?.recordedAt || '') || 0) + 1)).toISOString();
    const obtainedAt = input.obtainedAt || now;
    if (!Number.isFinite(Date.parse(obtainedAt)) || Date.parse(obtainedAt) > Date.now() + 60000) throw new AutomationError('Informe quando a preferência foi recebida, sem usar uma data futura.');
    if (previous?.status === 'REVOKED' && input.granted && Date.parse(obtainedAt) <= Date.parse(previous.obtainedAt || previous.recordedAt)) throw new AutomationError('Há um pedido de interrupção mais recente. Registre uma nova autorização informada pelo contato.');
    const permission: MarketingPermission = { status: input.granted ? 'GRANTED' : 'REVOKED', source: input.source, notes: input.notes, obtainedAt, recordedAt: now, recordedBy: userId, contactId: contact.id };
    state.marketingPermissions ||= {}; state.marketingPermissions[phone] = permission;
    state.marketingPermissionAudit ||= []; state.marketingPermissionAudit.push({ ...permission, phone });
    state.contacts = state.contacts.map(item => campaignPhone(item.phone) === phone ? { ...item, consentGiven: input.granted, consentDate: input.granted ? now : item.consentDate,
      hasOptedOut: !input.granted, updatedAt: now } : item);
    return state;
  });
}
export async function listCampaigns(tenantId: string, userId: string, offset = 0) {
  const [state, context, connections, ownPhone, campaigns] = await Promise.all([readCRMState(tenantId), campaignContext(tenantId), campaignConnections(tenantId), campaignSelfPhone(userId),
    db.select().from(crmCampaigns).where(eq(crmCampaigns.tenantKey, tenantId)).orderBy(desc(crmCampaigns.createdAt), desc(crmCampaigns.id)).limit(100).offset(offset)]);
  const ids = campaigns.map(row => row.id);
  const groups = ids.length ? await db.select({ campaignId: crmCampaignRecipients.campaignId, phone: crmCampaignRecipients.phone, status: crmCampaignRecipients.status,
    count: sql<number>`count(*)::integer`, replies: sql<number>`count(${crmCampaignRecipients.repliedAt})::integer` }).from(crmCampaignRecipients)
    .where(and(eq(crmCampaignRecipients.tenantKey, tenantId), inArray(crmCampaignRecipients.campaignId, ids), sql`(${crmCampaignRecipients.payload}->>'isTest')::boolean = false`))
    .groupBy(crmCampaignRecipients.campaignId, crmCampaignRecipients.phone, crmCampaignRecipients.status) : [];
  return { campaigns: campaigns.map(row => {
    const matching = groups.filter(group => group.campaignId === row.id), counts: Record<string, number> = {}, messageCounts: Record<string, number> = {};
    const byPhone = new Map<string, string[]>();
    for (const group of matching) byPhone.set(group.phone, [...(byPhone.get(group.phone) || []), group.status]);
    for (const statuses of Array.from(byPhone.values())) {
      const status = campaignSequenceStatus(statuses);
      counts[status] = (counts[status] || 0) + 1;
    }
    for (const group of matching) messageCounts[group.status] = (messageCounts[group.status] || 0) + group.count;
    return { ...row, counts, messageCounts, replies: new Set(matching.filter(group => group.replies > 0).map(group => group.phone)).size };
  }),
    connections, members: context.members, ownPhone, capabilities: campaignCapabilities(state),
    permissions: state.marketingPermissions || {}, contacts: state.contacts.map(({ id, name, phone, temperature, source, tags, whatsappLabels, targetRegions, maxPropertyValue, assignedUserId, isPersonal, hasOptedOut }) =>
      ({ id, name, phone, temperature, source, tags, whatsappLabels, targetRegions, maxPropertyValue, assignedUserId, isPersonal, hasOptedOut })),
    pipelines: state.commercial?.pipelines || [], offset, nextOffset: campaigns.length === 100 ? offset + 100 : null };
}
export async function campaignRecipients(tenantId: string, id: string, offset = 0, status?: string) {
  const [campaign] = await db.select().from(crmCampaigns).where(and(eq(crmCampaigns.id, id), eq(crmCampaigns.tenantKey, tenantId))).limit(1);
  if (!campaign) throw new AutomationError('Campanha não encontrada.', 404);
  const where = and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.campaignId, id), status ? eq(crmCampaignRecipients.status, status) : undefined);
  const [total] = await db.select({ count: sql<number>`count(*)::integer` }).from(crmCampaignRecipients).where(where);
  const rows = await db.select().from(crmCampaignRecipients).where(where).orderBy(asc(crmCampaignRecipients.createdAt), asc(crmCampaignRecipients.phone),
    sql`coalesce((${crmCampaignRecipients.payload}->>'partIndex')::integer, 0)`, asc(crmCampaignRecipients.id)).limit(100).offset(offset);
  const sequences = Array.from(new Set(rows.map(row => row.payload.sequenceId).filter((id): id is string => !!id)));
  const parts = sequences.length ? await db.select().from(crmCampaignRecipients).where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.campaignId, id),
    inArray(sql<string>`${crmCampaignRecipients.payload}->>'sequenceId'`, sequences))) : [];
  return { campaign, recipients: rows.map(row => {
    const previous = parts.find(part => part.payload.sequenceId === row.payload.sequenceId && part.payload.partIndex === (row.payload.partIndex || 0) - 1);
    const nextMessageAt = previous?.payload.acceptedAt && ['ACCEPTED','DELIVERED','READ'].includes(previous.status)
      ? new Date(Date.parse(previous.payload.acceptedAt) + (row.payload.intervalSeconds || 30) * 1000).toISOString() : undefined;
    return { ...row, nextMessageAt };
  }), total: total.count, offset, nextOffset: offset + rows.length < total.count ? offset + rows.length : null };
}
export async function changeCampaign(tenantId: string, userId: string, input: any) {
  const context = await campaignContext(tenantId);
  if (input.operation === 'save') {
    const config = campaignConfigSchema.parse(input.config);
    if (config.instanceId) await validateConnection(tenantId, config.instanceId);
    if (config.parts) {
      for (const part of config.parts) if (part.attachment) part.attachment = await verifyCampaignMedia(tenantId, part.attachment);
      config.message = config.parts[0].message; config.attachment = config.parts[0].attachment;
    } else if (config.attachment) config.attachment = await verifyCampaignMedia(tenantId, config.attachment);
    return db.transaction(async tx => {
      if (input.id && !Number.isInteger(input.revision)) throw new AutomationError('Informe a revisão atual do rascunho.', 409);
      const old = input.id ? await ownedCampaign(tx, tenantId, input.id, input.revision) : undefined;
      if (old && old.status !== 'DRAFT') throw new AutomationError('Esta campanha já foi iniciada. Duplique-a para preparar outra mensagem.');
      const now = new Date();
      const payload: CampaignPayload = { config, revision: (old?.payload.revision || 0) + 1, createdBy: old?.payload.createdBy || userId, updatedBy: userId,
        audit: [...(old?.payload.audit || []), { operation: 'save', userId, at: now.toISOString(), revision: (old?.payload.revision || 0) + 1 }] };
      if (old) { const [row] = await tx.update(crmCampaigns).set({ payload, updatedAt: now }).where(eq(crmCampaigns.id, old.id)).returning(); return { campaign: row }; }
      const [row] = await tx.insert(crmCampaigns).values({ id: crypto.randomUUID(), tenantKey: tenantId, payload }).returning(); return { campaign: row };
    });
  }
  if (input.operation === 'check-connection') { await validateConnection(tenantId, input.instanceId, true); return { connected: true }; }
  if (input.operation === 'simulate' || input.operation === 'start') {
    // Only connection checks and asset verification occur outside the transaction; no message sends.
    const [candidate] = await db.select().from(crmCampaigns).where(and(eq(crmCampaigns.tenantKey, tenantId), eq(crmCampaigns.id, input.id))).limit(1);
    if (!candidate) throw new AutomationError('Campanha não encontrada.', 404);
    if (input.operation === 'start') {
      requireDelivery(await readCRMState(tenantId));
      await validateConnection(tenantId, candidate.payload.config.instanceId, true);
      for (const part of campaignParts(candidate.payload.config)) if (part.attachment) await verifyCampaignMedia(tenantId, part.attachment);
    }
    return db.transaction(async tx => {
      const state = await lockedState(tx, tenantId);
      const campaign = await ownedCampaign(tx, tenantId, input.id, input.revision);
      if (campaign.status !== 'DRAFT') throw new AutomationError('Esta campanha já foi iniciada.', 409);
      const payload = structuredClone(campaign.payload), config = payload.config;
      const audience = await audienceFor(tenantId, state, config, context.memberNames, tx, context.company);
      const fingerprint = audienceHash(audience, config, state, context.memberNames, context.company);
      const now = new Date();
      if (input.operation === 'simulate') {
        payload.testedRevision = payload.revision; payload.testedHash = fingerprint; payload.testedAt = now.toISOString();
        payload.audit.push({ operation: 'simulate', userId, at: now.toISOString(), revision: payload.revision });
        const [row] = await tx.update(crmCampaigns).set({ payload, updatedAt: now }).where(eq(crmCampaigns.id, campaign.id)).returning();
        return { campaign: row, simulation: { audience, sample: audience.rows.filter(row => row.eligible).slice(0, 3).map(row => ({ name: row.name,
          message: renderCampaignMessage(config.message, row.name, context.company, context.memberNames[state.contacts.find(contact => contact.id === row.id)?.assignedUserId || '']),
    parts: renderCampaignParts(config, row.name, context.company, context.memberNames[state.contacts.find(contact => contact.id === row.id)?.assignedUserId || '']) })),
          warning: 'Nenhuma mensagem foi enviada. A simulação verifica o público e a personalização.' } };
      }
      requireDelivery(state);
      if (!audience.eligible) throw new AutomationError('Nenhum destinatário elegível. Confira os filtros e as autorizações.');
      if (payload.testedRevision !== payload.revision || payload.testedHash !== fingerprint || !payload.testedAt || now.getTime() - Date.parse(payload.testedAt) > 15 * 60_000) throw new AutomationError('O público ou a mensagem mudou, ou a revisão expirou. Teste sem enviar novamente antes de confirmar.', 409);
      if (input.confirmedCount !== audience.eligible || input.confirmed !== true) throw new AutomationError('Confira e confirme a quantidade exata de destinatários.');
      const startsAt = config.schedule.startsAt ? new Date(config.schedule.startsAt) : now;
      if (startsAt.getTime() < now.getTime() - 60_000 || startsAt.getTime() > now.getTime() + 90 * 86400_000) throw new AutomationError('Escolha um horário futuro nos próximos 90 dias ou envie agora.');
      payload.startedAt = now.toISOString(); payload.expiresAt = new Date(Math.max(now.getTime(), startsAt.getTime()) + config.schedule.expiresAfterHours * 3600_000).toISOString();
      payload.selectionSummary = { found: audience.total, selected: audience.eligible, excluded: audience.rows.filter(row => !row.eligible).map(({ id, name, reason }) => ({ id, name, reason })) };
      payload.audit.push({ operation: 'start', userId, at: now.toISOString(), revision: payload.revision });
      const frozen: typeof crmCampaignRecipients.$inferInsert[] = [];
      for (const target of audience.rows.filter(row => row.eligible)) {
        const contact = state.contacts.find(contact => contact.id === target.id)!;
        const sequenceId = crypto.randomUUID();
        const parts = renderCampaignParts(config, target.name, context.company, context.memberNames[contact.assignedUserId || '']);
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
          const part = parts[partIndex];
          frozen.push({ id: crypto.randomUUID(), tenantKey: tenantId, campaignId: campaign.id, contactId: target.id,
            phone: target.phone!, targetKey: `recipient:${target.phone}:${partIndex}`, payload: { name: target.name, ...part,
              sequenceId, partIndex, partCount: parts.length, intervalSeconds: config.intervalSeconds || 30,
              permissionAt: target.permissionAt, instanceId: config.instanceId, company: context.company, isTest: false }, reason: partIndex ? 'Aguardando a mensagem anterior e o intervalo configurado.' : 'Aguardando processamento no servidor.' });
        }
      }
      for (let offset = 0; offset < frozen.length; offset += 500) await tx.insert(crmCampaignRecipients).values(frozen.slice(offset, offset + 500));
      const [row] = await tx.update(crmCampaigns).set({ payload, status: startsAt > now ? 'SCHEDULED' : 'RUNNING', scheduledAt: startsAt, updatedAt: now }).where(eq(crmCampaigns.id, campaign.id)).returning();
      return { campaign: row };
    });
  }
  if (input.operation === 'send-test') {
    const state = await readCRMState(tenantId); requireDelivery(state);
    const phone = await campaignSelfPhone(userId);
    if (!phone || input.confirmed !== true) throw new AutomationError('Cadastre seu telefone internacional no perfil e confirme o envio de teste.');
    const [campaign] = await db.select().from(crmCampaigns).where(and(eq(crmCampaigns.id, input.id), eq(crmCampaigns.tenantKey, tenantId))).limit(1);
    if (!campaign || campaign.payload.revision !== input.revision || campaign.status !== 'DRAFT') throw new AutomationError('Atualize o rascunho antes do teste.', 409);
    await validateConnection(tenantId, campaign.payload.config.instanceId, true);
    for (const part of campaignParts(campaign.payload.config)) if (part.attachment) await verifyCampaignMedia(tenantId, part.attachment);
    const id = hash([tenantId, userId, campaign.id, input.requestId]);
    return db.transaction(async tx => {
      // Serialize requests across drafts too, so concurrent clicks cannot bypass the hourly limit.
      requireDelivery(await lockedState(tx, tenantId));
      const current = await ownedCampaign(tx, tenantId, campaign.id, input.revision);
      if (current.status !== 'DRAFT') throw new AutomationError('Atualize o rascunho antes do teste.', 409);
      const [existing] = await tx.select().from(crmCampaignRecipients).where(eq(crmCampaignRecipients.id, id)).limit(1);
      if (existing) return { test: existing };
      const recent = await tx.select({ count: sql<number>`count(*)::integer` }).from(crmCampaignRecipients).where(and(eq(crmCampaignRecipients.tenantKey, tenantId),
        sql`${crmCampaignRecipients.payload}->>'userId' = ${userId}`, sql`coalesce((${crmCampaignRecipients.payload}->>'partIndex')::integer, 0) = 0`, gt(crmCampaignRecipients.createdAt, new Date(Date.now() - 3600_000))));
      if (recent[0].count >= 10) throw new AutomationError('Limite de dez testes por hora atingido. Aguarde antes de testar novamente.', 429);
      const parts = renderCampaignParts(current.payload.config, 'Cliente de exemplo', context.company, context.memberNames[userId]);
      if (parts.some(part => part.message.length > (part.attachment ? 1024 : 4096))) throw new AutomationError('A mensagem personalizada ficou longa demais. Encurte o texto antes do teste.');
      const rows = await tx.insert(crmCampaignRecipients).values(parts.map((part, partIndex) => ({ id: partIndex ? hash([id, partIndex]) : id, tenantKey: tenantId, campaignId: current.id, phone,
        targetKey: `test:${id}:${partIndex}`, payload: { name: context.memberNames[userId] || 'Meu teste', ...part, instanceId: current.payload.config.instanceId,
          sequenceId: id, partIndex, partCount: parts.length, intervalSeconds: current.payload.config.intervalSeconds || 30,
          company: context.company, isTest: true, userId, sourceRevision: current.payload.revision },
        reason: 'Sequência de teste solicitada explicitamente. Aguardando o servidor.' }))).returning();
      const row = rows[0];
      return { test: row };
    });
  }
  const deliveryState = input.operation === 'resume' ? await readCRMState(tenantId) : undefined;
  return db.transaction(async tx => {
    const row = await ownedCampaign(tx, tenantId, input.id, input.revision);
    const now = new Date(), payload = structuredClone(row.payload);
    if (input.operation === 'pause' && ['RUNNING', 'SCHEDULED'].includes(row.status)) row.status = 'PAUSED';
    else if (input.operation === 'resume' && row.status === 'PAUSED') {
      requireDelivery(deliveryState!);
      if (payload.expiresAt && Date.parse(payload.expiresAt) <= now.getTime()) throw new AutomationError('Esta campanha expirou. Duplique-a e revise o público novamente.');
      row.status = row.scheduledAt && row.scheduledAt > now ? 'SCHEDULED' : 'RUNNING';
    } else if (input.operation === 'cancel' && !['CANCELLED', 'COMPLETED'].includes(row.status)) {
      row.status = 'CANCELLED';
      await tx.update(crmCampaignRecipients).set({ status: 'CANCELLED', leaseUntil: null, reason: 'Envio pendente cancelado pelo gestor.', updatedAt: now })
        .where(and(eq(crmCampaignRecipients.campaignId, row.id), eq(crmCampaignRecipients.tenantKey, tenantId), inArray(crmCampaignRecipients.status, pending)));
    } else throw new AutomationError('Esta operação não está disponível no estado atual da campanha.', 409);
    payload.revision++; payload.updatedBy = userId; payload.audit.push({ operation: input.operation, userId, at: now.toISOString(), revision: payload.revision });
    const [updated] = await tx.update(crmCampaigns).set({ status: row.status, payload, updatedAt: now }).where(eq(crmCampaigns.id, row.id)).returning(); return { campaign: updated };
  });
}

const receiptRank: Record<string, number> = { ACCEPTED: 1, FAILED: 2, DELIVERED: 3, READ: 4 };
export async function recordCampaignReceipt(tenantId: string, instanceId: string, ids: string[], status: string, occurredAt = new Date()) {
  if (process.env.CAMPAIGNS_ENABLED !== 'true' || !receiptRank[status]) return;
  await db.transaction(async tx => {
    for (const externalId of ids.slice(0, 500)) {
      const id = hash([tenantId, instanceId, externalId]);
      await tx.insert(crmCampaignReceipts).values({ id, tenantKey: tenantId, instanceKey: instanceId, externalId, status, occurredAt }).onConflictDoNothing();
      const [old] = await tx.select().from(crmCampaignReceipts).where(eq(crmCampaignReceipts.id, id)).for('update');
      const next = receiptRank[status] > receiptRank[old.status] ? status : old.status;
      await tx.update(crmCampaignReceipts).set({ status: next, updatedAt: new Date() }).where(eq(crmCampaignReceipts.id, id));
      const recipients = await tx.select().from(crmCampaignRecipients).where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.externalId, externalId), sql`${crmCampaignRecipients.payload}->>'instanceId' = ${instanceId}`)).for('update');
      for (const recipient of recipients) if (receiptRank[next] > (receiptRank[recipient.status] || 0)) await tx.update(crmCampaignRecipients).set({ status: next, reason: next === 'FAILED' ? 'Falha de envio informada pelo provedor.' : 'Confirmação recebida do provedor.', updatedAt: new Date() }).where(eq(crmCampaignRecipients.id, recipient.id));
    }
  });
}
export async function recordCampaignReply(tenantId: string, instanceId: string, phone: string, occurredAt: string) {
  if (process.env.CAMPAIGNS_ENABLED !== 'true') return;
  const normalized = campaignPhone(phone), at = new Date(occurredAt);
  if (!normalized || !Number.isFinite(at.getTime())) return;
  const [target] = await db.select().from(crmCampaignRecipients).where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.phone, normalized),
    sql`${crmCampaignRecipients.payload}->>'instanceId' = ${instanceId}`, sql`(${crmCampaignRecipients.payload}->>'isTest')::boolean = false`,
    sql`(${crmCampaignRecipients.payload}->>'acceptedAt')::timestamptz <= ${at.toISOString()}::timestamptz`,
    sql`(${crmCampaignRecipients.payload}->>'trackingUntil')::timestamptz >= ${at.toISOString()}::timestamptz`)).orderBy(desc(crmCampaignRecipients.createdAt)).limit(1);
  if (target) await db.update(crmCampaignRecipients).set({ repliedAt: at }).where(and(eq(crmCampaignRecipients.id, target.id), isNull(crmCampaignRecipients.repliedAt)));
}
