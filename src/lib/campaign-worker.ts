import crypto from 'crypto';
import { and, eq, inArray, asc, sql, or, isNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { crmCampaigns, crmCampaignRecipients, crmCampaignReceipts, crmTenantState } from '@/db/schema';
import { readCRMState, emptyCRMState, mergeTenantState, type PersistedCRMState } from '@/lib/crm-repository';
import { automationEnvironment } from '@/lib/automation-service';
import { campaignSelfPhone } from '@/lib/campaign-service';
import { campaignExclusion, campaignPhone, campaignBusinessTime, type RecipientStatus } from '@/lib/campaigns';
import { verifyCampaignMedia, campaignMediaUrl } from '@/lib/campaign-media';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';
import { ZApiClient } from '@/lib/zapi-client';
import { acquireOutboundLane, releaseOutboundLane, markOutboundAttempt } from '@/lib/outbound-lane';

const pending = ['PENDING', 'PROCESSING', 'WAITING_CHANNEL'];
async function recipientGuard(tenantId: string, recipient: typeof crmCampaignRecipients.$inferSelect) {
  const [campaign] = await db.select().from(crmCampaigns).where(and(eq(crmCampaigns.id, recipient.campaignId), eq(crmCampaigns.tenantKey, tenantId))).limit(1);
  if (!campaign || ['CANCELLED', 'COMPLETED'].includes(campaign.status)) return 'A campanha foi encerrada.';
  if (recipient.payload.sequenceId && (recipient.payload.partIndex || 0) > 0) {
    const previous = await db.select().from(crmCampaignRecipients).where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.campaignId, recipient.campaignId),
      sql`${crmCampaignRecipients.payload}->>'sequenceId' = ${recipient.payload.sequenceId}`, sql`(${crmCampaignRecipients.payload}->>'partIndex')::integer < ${recipient.payload.partIndex}`));
    if (previous.length !== recipient.payload.partIndex || previous.some(row => !['ACCEPTED','DELIVERED','READ'].includes(row.status))) return 'Uma parte anterior não foi confirmada. A sequência foi interrompida.';
  }
  if (recipient.payload.isTest) {
    if (campaign.status !== 'DRAFT' || campaign.payload.revision !== recipient.payload.sourceRevision) return 'O rascunho foi alterado ou iniciado depois do pedido de teste.';
    if (await campaignSelfPhone(recipient.payload.userId!) !== recipient.phone) return 'O telefone do perfil mudou depois do pedido de teste.';
    if (Date.now() - recipient.createdAt.getTime() > 3600_000) return 'O envio de teste expirou.';
    return null;
  }
  if (campaign.payload.expiresAt && Date.parse(campaign.payload.expiresAt) <= Date.now()) return 'A campanha expirou antes deste envio.';
  const [state, environment] = await Promise.all([readCRMState(tenantId), automationEnvironment(tenantId)]);
  const contact = state.contacts.find(contact => contact.id === recipient.contactId);
  if (!contact || campaignPhone(contact.phone) !== recipient.phone) return 'Contato removido ou telefone alterado após a revisão.';
  const reason = campaignExclusion(state, contact, campaign.payload.config, Object.fromEntries(environment.members.map(member => [member.id, member.name])));
  if (reason) return reason;
  if (state.marketingPermissions?.[recipient.phone]?.recordedAt !== recipient.payload.permissionAt) return 'A autorização mudou depois da revisão desta campanha.';
  const started = Date.parse(campaign.payload.startedAt || '');
  if (Date.parse(contact.lastClientInteractionAt || '') > started) return 'O cliente iniciou um atendimento após a confirmação da campanha.';
  if (Date.parse(contact.lastTeamInteractionAt || '') > started && !state.messages.some(message => message.campaignId === recipient.campaignId
    && Date.parse(message.timestamp) === Date.parse(contact.lastTeamInteractionAt || '')
    && state.conversations.some(conversation => conversation.id === message.conversationId && conversation.contactId === contact.id))) return 'A equipe já atendeu este contato após a confirmação da campanha.';
  return null;
}
export async function runCampaignWorker(tenantId: string, deadline = Date.now() + 45000) {
  if (process.env.CAMPAIGNS_ENABLED !== 'true') return;
  const now = new Date();
  // Recover safe preflight leases, but never retry an external request whose outcome is unknown.
  await db.update(crmCampaignRecipients).set({ status: 'PENDING', leaseUntil: null, reason: 'Verificação interrompida; aguardando retomada.', updatedAt: now })
    .where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.status, 'PROCESSING'), lte(crmCampaignRecipients.leaseUntil, now)));
  await db.update(crmCampaignRecipients).set({ status: 'UNKNOWN', leaseUntil: null, reason: 'O envio foi iniciado, mas a confirmação não chegou. Confira no WhatsApp antes de reenviar.', updatedAt: now })
    .where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.status, 'DISPATCHING'), lte(crmCampaignRecipients.leaseUntil, now)));
  await db.update(crmCampaignRecipients).set({ status: 'SKIPPED', leaseUntil: null, reason: 'Uma mensagem anterior não foi confirmada ou a sequência foi interrompida. As próximas partes não serão enviadas.', updatedAt: now })
    .where(and(eq(crmCampaignRecipients.tenantKey, tenantId), inArray(crmCampaignRecipients.status, pending), sql`EXISTS (
      SELECT 1 FROM crm_campaign_recipients previous WHERE previous.tenant_key = ${tenantId}
      AND previous.campaign_id = ${crmCampaignRecipients.campaignId} AND previous.payload->>'sequenceId' = ${crmCampaignRecipients.payload}->>'sequenceId'
      AND (previous.payload->>'partIndex')::integer < (${crmCampaignRecipients.payload}->>'partIndex')::integer
      AND previous.status IN ('UNKNOWN','FAILED','SKIPPED','CANCELLED'))`));
  await db.update(crmCampaignRecipients).set({ status: 'SKIPPED', leaseUntil: null, reason: 'A campanha expirou antes deste envio.', updatedAt: now })
    .where(and(eq(crmCampaignRecipients.tenantKey, tenantId), inArray(crmCampaignRecipients.status, pending), sql`${crmCampaignRecipients.campaignId} IN
      (SELECT c.id FROM crm_campaigns c WHERE c.tenant_key = ${tenantId} AND c.status IN ('RUNNING','SCHEDULED') AND (c.payload->>'expiresAt')::timestamptz <= ${now.toISOString()}::timestamptz)`));
  if (process.env.CAMPAIGNS_OUTBOUND_ENABLED !== 'true') return;
  for (let index = 0; index < 8 && Date.now() < deadline - 18000; index++) {
    const claimed = await db.transaction(async tx => {
      // Lock campaign before recipient, the same order used by pause/cancel/start.
      const campaigns = await tx.select().from(crmCampaigns).where(and(eq(crmCampaigns.tenantKey, tenantId), inArray(crmCampaigns.status, ['DRAFT', 'RUNNING', 'SCHEDULED'])))
        .orderBy(asc(crmCampaigns.updatedAt)).for('update');
      for (const campaign of campaigns) {
        const at = new Date();
        const testOnly = campaign.status === 'DRAFT';
        if (!testOnly && campaign.scheduledAt && campaign.scheduledAt > at) continue;
        if (!testOnly && !campaignBusinessTime(campaign.payload.config, at)) continue;
        const [recipient] = await tx.select().from(crmCampaignRecipients).where(and(eq(crmCampaignRecipients.tenantKey, tenantId), eq(crmCampaignRecipients.campaignId, campaign.id),
          inArray(crmCampaignRecipients.status, ['PENDING', 'WAITING_CHANNEL']),
          testOnly ? sql`(${crmCampaignRecipients.payload}->>'isTest')::boolean = true` : sql`(${crmCampaignRecipients.payload}->>'isTest')::boolean = false`,
          sql`(coalesce((${crmCampaignRecipients.payload}->>'partIndex')::integer, 0) = 0 OR EXISTS (
            SELECT 1 FROM crm_campaign_recipients previous WHERE previous.tenant_key = ${tenantId} AND previous.campaign_id = ${crmCampaignRecipients.campaignId}
            AND previous.payload->>'sequenceId' = ${crmCampaignRecipients.payload}->>'sequenceId'
            AND (previous.payload->>'partIndex')::integer = (${crmCampaignRecipients.payload}->>'partIndex')::integer - 1
            AND previous.status IN ('ACCEPTED','DELIVERED','READ')
            AND (previous.payload->>'acceptedAt')::timestamptz + make_interval(secs => coalesce((${crmCampaignRecipients.payload}->>'intervalSeconds')::integer, 30)) <= ${at.toISOString()}::timestamptz))`,
          or(eq(crmCampaignRecipients.status, 'PENDING'), lte(crmCampaignRecipients.updatedAt, new Date(at.getTime() - 60000)))))
          .orderBy(asc(crmCampaignRecipients.updatedAt), asc(crmCampaignRecipients.id)).limit(1).for('update');
        if (!recipient) continue;
        const [row] = await tx.update(crmCampaignRecipients).set({ status: 'PROCESSING', leaseUntil: new Date(at.getTime() + 120000), reason: 'Verificando autorização, conexão e arquivo.', updatedAt: at })
          .where(eq(crmCampaignRecipients.id, recipient.id)).returning();
        if (!testOnly) await tx.update(crmCampaigns).set({ status: 'RUNNING', updatedAt: at }).where(eq(crmCampaigns.id, campaign.id));
        return row;
      }
      return null;
    });
    if (!claimed) break;
    let acquired = false, attempted = false, checkingMedia = false, laneInstanceId = claimed.payload.instanceId;
    let externalId: string | undefined;
    let result: RecipientStatus = 'SKIPPED', reason = '';
    const owner = `campaign:${claimed.id}`;
    try {
      const exclusion = await recipientGuard(tenantId, claimed);
      if (exclusion) { reason = exclusion; }
      else {
        const credentials = await ZapiCredentialsService.resolveCredentials({ tenantId, instanceId: claimed.payload.instanceId });
        laneInstanceId = credentials.instanceId;
        const client = new ZApiClient({ ...credentials, requestTimeoutMs: 8000 });
        const status = await client.getStatus();
        if (!status.success || !status.data?.connected) { result = 'WAITING_CHANNEL'; reason = 'A linha está indisponível. O servidor verificará novamente, sem repetir envios confirmados.'; }
        else {
          let mediaUrl: string | undefined;
          if (claimed.payload.attachment) {
            checkingMedia = true;
            await verifyCampaignMedia(tenantId, claimed.payload.attachment);
            mediaUrl = await campaignMediaUrl(tenantId, claimed.payload.attachment.key);
            checkingMedia = false;
          }
          const lane = await acquireOutboundLane(tenantId, credentials.instanceId, claimed.phone, owner, claimed.payload.isTest ? 'TEST' : 'CAMPAIGN', new Date(), claimed.payload.sequenceId);
          acquired = lane.acquired;
          if (!acquired) { result = lane.reason.includes('24 horas') || lane.reason.includes('outro ambiente') ? 'SKIPPED' : 'WAITING_CHANNEL'; reason = lane.reason; }
          else {
            const secondCheck = await recipientGuard(tenantId, claimed);
            if (secondCheck) reason = secondCheck;
            else {
              const dispatching = await db.transaction(async tx => {
                // A reply/revocation committed before dispatch must win over this part.
                const [snapshot] = await tx.select().from(crmTenantState).where(eq(crmTenantState.tenantKey, tenantId)).for('update');
                const [campaign] = await tx.select().from(crmCampaigns).where(eq(crmCampaigns.id, claimed.campaignId)).for('update');
                const permitted = claimed.payload.isTest ? campaign.status === 'DRAFT' && campaign.payload.revision === claimed.payload.sourceRevision : campaign.status === 'RUNNING' && campaignBusinessTime(campaign.payload.config);
                if (!permitted) return false;
                if (!claimed.payload.isTest) {
                  const latest = snapshot?.state as PersistedCRMState | undefined;
                  const contact = latest?.contacts.find(contact => contact.id === claimed.contactId);
                  if (!contact || campaignPhone(contact.phone) !== claimed.phone || contact.isPersonal || contact.hasOptedOut
                    || latest?.marketingPermissions?.[claimed.phone]?.recordedAt !== claimed.payload.permissionAt
                    || latest?.marketingPermissions?.[claimed.phone]?.status !== 'GRANTED'
                    || Date.parse(contact.lastClientInteractionAt || '') > Date.parse(campaign.payload.startedAt || '')) return false;
                }
                const [row] = await tx.update(crmCampaignRecipients).set({ status: 'DISPATCHING', payload: { ...claimed.payload, attemptedAt: new Date().toISOString() }, reason: 'Envio iniciado. Aguardando confirmação do provedor.', updatedAt: new Date() })
                  .where(and(eq(crmCampaignRecipients.id, claimed.id), eq(crmCampaignRecipients.status, 'PROCESSING'))).returning();
                return !!row;
              });
              if (!dispatching) { result = 'PENDING'; reason = 'A campanha foi pausada ou alterada antes do envio.'; }
              else {
                await markOutboundAttempt(tenantId, credentials.instanceId, claimed.phone, owner, !claimed.payload.isTest, claimed.payload.sequenceId);
                attempted = true;
                const sent = claimed.payload.attachment ? claimed.payload.attachment.mimeType === 'application/pdf'
                  ? await client.sendDocument(claimed.phone, mediaUrl!, claimed.payload.attachment.fileName, claimed.payload.message)
                  : claimed.payload.attachment.mimeType === 'video/mp4' ? await client.sendVideo(claimed.phone, mediaUrl!, claimed.payload.message)
                  : await client.sendImage(claimed.phone, mediaUrl!, claimed.payload.message)
                  : await client.sendText(claimed.phone, claimed.payload.message);
                if (sent.success && sent.externalMessageId) { externalId = sent.externalMessageId; result = 'ACCEPTED'; reason = 'Aceito pelo provedor. Aguardando confirmação de entrega.'; }
                else { result = 'UNKNOWN'; reason = 'O provedor não confirmou o envio. Confira no WhatsApp antes de reenviar.'; }
              }
            }
          }
        }
      }
    } catch (error) {
      result = attempted ? 'UNKNOWN' : checkingMedia ? 'SKIPPED' : 'WAITING_CHANNEL';
      reason = attempted ? 'Envio sem confirmação. Confira no WhatsApp antes de reenviar.' : checkingMedia ? 'O arquivo não foi confirmado ou mudou depois da revisão. Prepare uma nova campanha com o anexo correto.' : 'Verificação de envio indisponível. Aguardando nova tentativa antes de iniciar o envio.';
    }
    // Commit the provider acknowledgement and CRM history together. If this fails,
    // the persisted DISPATCHING lease becomes UNKNOWN; never send it a second time.
    await db.transaction(async tx => {
      // Same state-before-recipient order as campaign confirmation.
      let state: PersistedCRMState | undefined;
      if (externalId && !claimed.payload.isTest) {
        await tx.insert(crmTenantState).values({ tenantKey: tenantId, state: emptyCRMState() }).onConflictDoNothing();
        const [snapshot] = await tx.select().from(crmTenantState).where(eq(crmTenantState.tenantKey, tenantId)).for('update');
        state = snapshot.state as PersistedCRMState;
      }
      const [current] = await tx.select().from(crmCampaignRecipients).where(eq(crmCampaignRecipients.id, claimed.id)).for('update');
      if (!['PROCESSING', 'DISPATCHING'].includes(current.status)) return current;
      const at = new Date(); let status: string = result;
      if (externalId) {
        const [receipt] = await tx.select().from(crmCampaignReceipts).where(and(eq(crmCampaignReceipts.tenantKey, tenantId), eq(crmCampaignReceipts.instanceKey, claimed.payload.instanceId), eq(crmCampaignReceipts.externalId, externalId))).limit(1);
        if (receipt) status = receipt.status;
      }
      const [updated] = await tx.update(crmCampaignRecipients).set({ status, reason, externalId: externalId || null, leaseUntil: null, updatedAt: at,
        payload: { ...current.payload, ...(externalId ? { acceptedAt: at.toISOString(), trackingUntil: new Date(at.getTime() + 7 * 86400000).toISOString() } : {}) } })
        .where(eq(crmCampaignRecipients.id, current.id)).returning();
      if (state && externalId) {
        const contact = state.contacts.find(contact => contact.id === claimed.contactId);
        if (!contact) return;
        const existingMessage = state.messages.find(message => (message.externalId || message.id) === externalId);
        const at = existingMessage?.timestamp || current.payload.attemptedAt || updated.updatedAt.toISOString();
        const existing = state.conversations.find(conversation => conversation.id === existingMessage?.conversationId)
          || state.conversations.find(conversation => conversation.contactId === contact.id && conversation.instanceId === claimed.payload.instanceId);
        const conversationId = existing?.id || `conv-campaign-${crypto.randomUUID()}`;
        const newerSummary = existing && Date.parse(existing.lastMessageAt || '') > Date.parse(at);
        const next = mergeTenantState(tenantId, state, { contacts: [{ ...contact,
          lastTeamInteractionAt: Date.parse(contact.lastTeamInteractionAt || '') > Date.parse(at) ? contact.lastTeamInteractionAt : at, updatedAt: updated.updatedAt.toISOString() }],
          conversations: [{ ...existing, id: conversationId, tenantId, instanceId: claimed.payload.instanceId, contactId: contact.id, assignedUserId: contact.assignedUserId,
            status: newerSummary ? existing.status : 'PENDING_CLIENT', unreadCount: existing?.unreadCount || 0,
            lastMessagePreview: newerSummary ? existing.lastMessagePreview : (claimed.payload.message || (claimed.payload.attachment?.mimeType === 'video/mp4' ? '🎥 Vídeo' : claimed.payload.attachment?.mimeType === 'application/pdf' ? `📄 ${claimed.payload.attachment.fileName}` : '📷 Imagem')).slice(0, 100), lastMessageAt: newerSummary ? existing.lastMessageAt : at, slaBreached: newerSummary ? existing.slaBreached : false }],
          messages: [{ id: existingMessage?.id || externalId!, externalId, tenantId, conversationId: existingMessage?.conversationId || conversationId,
            campaignId: claimed.campaignId, senderType: 'SYSTEM', senderName: 'Campanha', messageType: claimed.payload.attachment ? claimed.payload.attachment.mimeType === 'application/pdf' ? 'DOCUMENT' : claimed.payload.attachment.mimeType === 'video/mp4' ? 'VIDEO' : 'IMAGE' : 'TEXT',
            content: claimed.payload.message, status: existingMessage?.status === 'READ' || updated.status === 'READ' ? 'READ' : existingMessage?.status === 'DELIVERED' || updated.status === 'DELIVERED' ? 'DELIVERED' : updated.status === 'FAILED' ? 'FAILED' : 'SENT',
            isInternalNote: false, timestamp: existingMessage?.timestamp || at, attachments: claimed.payload.attachment ? [{ id: `campaign-${claimed.id}`, url: `/api/v1/campaigns/media?tenantId=${encodeURIComponent(tenantId)}&key=${encodeURIComponent(claimed.payload.attachment.key)}`,
              fileName: claimed.payload.attachment.fileName, fileSize: claimed.payload.attachment.size, mimeType: claimed.payload.attachment.mimeType }] : undefined }] });
        await tx.update(crmTenantState).set({ state: next, updatedAt: updated.updatedAt }).where(eq(crmTenantState.tenantKey, tenantId));
      }
    });
    if (acquired) await releaseOutboundLane(tenantId, laneInstanceId, claimed.phone, owner, attempted);
  }
  // "Completed" means every attempt has a recorded outcome, not that every message was delivered.
  await db.update(crmCampaigns).set({ status: 'COMPLETED', updatedAt: new Date() }).where(and(eq(crmCampaigns.tenantKey, tenantId), inArray(crmCampaigns.status, ['RUNNING', 'SCHEDULED']),
    sql`EXISTS (SELECT 1 FROM crm_campaign_recipients r WHERE r.campaign_id = ${crmCampaigns.id} AND (r.payload->>'isTest')::boolean = false)`,
    sql`NOT EXISTS (SELECT 1 FROM crm_campaign_recipients r WHERE r.campaign_id = ${crmCampaigns.id} AND r.status IN ('PENDING','PROCESSING','WAITING_CHANNEL','DISPATCHING') AND (r.payload->>'isTest')::boolean = false)`));
}
export async function campaignWorkerTenants() {
  if (process.env.CAMPAIGNS_ENABLED !== 'true') return [] as string[];
  return (await db.selectDistinct({ id: crmCampaigns.tenantKey }).from(crmCampaigns).where(inArray(crmCampaigns.status, ['DRAFT', 'RUNNING', 'SCHEDULED']))).map(row => row.id);
}
