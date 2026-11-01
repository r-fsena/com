import { z } from 'zod';
import type { Contact, Deal } from '@/types/crm';
import { isBusinessTime, ruleConfigSchema } from '@/lib/automations';

const ids = z.array(z.string().min(1).max(200)).max(5000).default([]);
export const campaignAttachmentSchema = z.object({ key: z.string().min(1).max(500), fileName: z.string().min(1).max(150),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']), size: z.number().int().positive().max(10 * 1024 * 1024), etag: z.string().max(200).optional() }).strict();
export type CampaignAttachment = z.infer<typeof campaignAttachmentSchema>;
export const campaignConfigSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome à campanha.').max(120),
  objective: z.enum(['PROPERTY', 'VISIT', 'FOLLOW_UP', 'CUSTOM']), instanceId: z.string().max(200).default(''),
  audience: z.object({ mode: z.enum(['FILTERED', 'SELECTED']), selectedIds: ids, excludedIds: ids,
    temperatures: z.array(z.enum(['HOT', 'WARM', 'COLD'])).max(3).default([]), sources: ids, stageIds: ids, tags: ids, regions: ids, assignedUserIds: ids,
    minValue: z.number().min(0).optional(), maxValue: z.number().min(0).optional() })
    .refine(value => value.minValue === undefined || value.maxValue === undefined || value.minValue <= value.maxValue, 'O valor máximo deve ser maior que o mínimo.'),
  message: z.string().trim().min(1, 'Escreva a mensagem.').max(4096).refine(value => {
    return !value.replace(/\{\{\s*(nome|primeiro_nome|empresa|corretor_nome)\s*\}\}/g, '').match(/\{\{|\}\}/);
  }, 'Use os botões Nome do cliente, Primeiro nome, Empresa e Corretor responsável.'),
  attachment: campaignAttachmentSchema.optional(),
  schedule: z.object({ startsAt: z.string().datetime().optional(), hours: ruleConfigSchema.shape.schedule, expiresAfterHours: z.number().int().min(24).max(168).default(48) }),
}).strict().refine(value => !value.attachment || value.message.length <= 1024, 'Com imagem ou PDF, use uma legenda de até 1.024 caracteres.');
export type CampaignConfig = z.infer<typeof campaignConfigSchema>;
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type RecipientStatus = 'PENDING' | 'PROCESSING' | 'WAITING_CHANNEL' | 'DISPATCHING' | 'ACCEPTED' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED' | 'CANCELLED' | 'UNKNOWN';
export const recipientLabels: Record<RecipientStatus, string> = { PENDING: 'Aguardando', PROCESSING: 'Verificando', WAITING_CHANNEL: 'Aguardando conexão', DISPATCHING: 'Enviando',
  ACCEPTED: 'Aceito pelo provedor', DELIVERED: 'Entregue', READ: 'Lido', FAILED: 'Falha confirmada', SKIPPED: 'Não enviado', CANCELLED: 'Cancelado', UNKNOWN: 'Precisa de conferência' };
export interface MarketingPermission { status: 'GRANTED' | 'REVOKED'; source: string; notes: string; obtainedAt?: string; recordedAt: string; recordedBy: string; contactId: string; }
export interface CampaignPayload {
  config: CampaignConfig; revision: number; testedRevision?: number; testedHash?: string; testedAt?: string;
  startedAt?: string; expiresAt?: string; lastWorkerAt?: string; reason?: string;
  createdBy: string; updatedBy: string; audit: { operation: string; userId: string; at: string; revision: number }[];
  selectionSummary?: { found: number; selected: number; excluded: { id: string; name: string; reason: string }[] };
}
export interface RecipientPayload { name: string; message: string; permissionAt?: string; instanceId: string; attachment?: CampaignAttachment; company: string;
  isTest: boolean; userId?: string; sourceRevision?: number; attemptedAt?: string; acceptedAt?: string; trackingUntil?: string; }
export interface CampaignAudienceState { contacts: Contact[]; deals: Deal[]; marketingPermissions?: Record<string, MarketingPermission>; conversations?: { contactId: string; isPersonal?: boolean }[];
  marketingPermissionAudit?: (MarketingPermission & { phone: string })[];
  automation?: { jobs: { action: { type: string }; event: { contactId: string }; status: string }[] }; }
// No country guessing, suffix matching, group IDs or LIDs in a marketing recipient list.
export function campaignPhone(phone: string): string | null {
  if (!/^[+\d\s().-]+$/.test(phone || '')) return null;
  const clean = phone.replace(/\D/g, '');
  return /^[1-9]\d{9,14}$/.test(clean) ? clean : null;
}
export function renderCampaignMessage(template: string, name: string, company: string, broker = '') {
  const values: Record<string, string> = { nome: name, primeiro_nome: name.trim().split(/\s+/)[0], empresa: company, corretor_nome: broker };
  return template.replace(/\{\{\s*(nome|primeiro_nome|empresa|corretor_nome)\s*\}\}/g, (_, variable) => values[variable]);
}
export function campaignFilterMatches(config: CampaignConfig, contact: Contact, deals: Deal[]) {
  const a = config.audience;
  const norm = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
  return (!a.temperatures.length || a.temperatures.includes(contact.temperature)) && (!a.sources.length || a.sources.includes(contact.source)) &&
    (!a.stageIds.length || deals.some(deal => deal.contactId === contact.id && a.stageIds.includes(deal.stageId))) &&
    (!a.tags.length || (contact.tags || []).some(tag => a.tags.includes(tag))) &&
    (!a.regions.length || (contact.targetRegions || []).some(region => a.regions.some(target => norm(target) === norm(region)))) &&
    (!a.assignedUserIds.length || a.assignedUserIds.includes(contact.assignedUserId || '')) &&
    (a.minValue === undefined || (contact.maxPropertyValue ?? -1) >= a.minValue) &&
    (a.maxValue === undefined || (contact.maxPropertyValue !== undefined && contact.maxPropertyValue <= a.maxValue));
}
export function campaignExclusion(state: CampaignAudienceState, contact: Contact, config: CampaignConfig, memberNames: Record<string, string> = {}): string | null {
  const phone = campaignPhone(contact.phone);
  if (contact.isPersonal || state.conversations?.some(conversation => conversation.contactId === contact.id && conversation.isPersonal)) return 'Contato pessoal';
  if (!phone) return 'Telefone internacional inválido ou não identificado';
  const related = state.contacts.filter(item => campaignPhone(item.phone) === phone);
  if (related.some(item => item.isPersonal || item.hasOptedOut || state.conversations?.some(conversation => conversation.contactId === item.id && conversation.isPersonal))) return 'Contato pessoal ou pedido de interrupção';
  const permission = state.marketingPermissions?.[phone];
  if (contact.hasOptedOut || permission?.status === 'REVOKED') return 'Pediu para não receber mensagens';
  if (permission?.status !== 'GRANTED') return 'Autorização para campanhas não registrada';
  if (/\{\{\s*corretor_nome\s*\}\}/.test(config.message) && !memberNames[contact.assignedUserId || '']) return 'Corretor responsável não identificado';
  if (state.automation?.jobs.some(job => job.event.contactId === contact.id && job.action.type === 'SEND_WHATSAPP_MESSAGE' && ['QUEUED', 'WAITING_CHANNEL', 'DISPATCHING', 'UNKNOWN'].includes(job.status))) return 'Há uma abordagem automática pendente para este contato';
  return null;
}
export function buildCampaignAudience(state: CampaignAudienceState, config: CampaignConfig, memberNames: Record<string, string> = {}, recentPhones: string[] = []) {
  const selected = new Set(config.audience.selectedIds), excluded = new Set(config.audience.excludedIds), phones = new Set<string>();
  const rows = state.contacts.filter(contact => config.audience.mode === 'SELECTED' ? selected.has(contact.id) : campaignFilterMatches(config, contact, state.deals)).map(contact => {
    const phone = campaignPhone(contact.phone);
    let reason = excluded.has(contact.id) ? 'Retirado manualmente desta campanha' : campaignExclusion(state, contact, config, memberNames);
    if (!reason && phone && recentPhones.includes(phone)) reason = 'Recebeu uma campanha nas últimas 24 horas';
    if (!reason && phone && phones.has(phone)) reason = 'Número repetido nesta seleção';
    if (!reason && phone) phones.add(phone);
    return { id: contact.id, name: contact.name, phone, eligible: !reason, reason: reason || '', permissionAt: phone ? state.marketingPermissions?.[phone]?.recordedAt : undefined };
  });
  return { rows, total: rows.length, eligible: rows.filter(row => row.eligible).length, excluded: rows.filter(row => !row.eligible).length };
}
export function campaignBusinessTime(config: CampaignConfig, now = new Date()) { return isBusinessTime({ schedule: config.schedule.hours } as any, now); }
export function isCampaignStop(content: string) {
  const text = content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[.!?]+$/g, '').trim();
  return ['sair', 'parar', 'pare', 'stop', 'cancelar', 'nao quero receber mensagens', 'nao quero mais receber mensagens', 'remova meu numero', 'remover meu numero'].includes(text);
}
export function recordCampaignStop<T extends CampaignAudienceState>(state: T, phone: string, content: string, fromMe: boolean, occurredAt: string, now = new Date()): T {
  const normalized = campaignPhone(phone);
  if (fromMe || !normalized || !isCampaignStop(content) || !Number.isFinite(Date.parse(occurredAt)) || Date.parse(occurredAt) > now.getTime() + 60000) return state;
  const previous = state.marketingPermissions?.[normalized];
  // A delayed stop is still binding, unless a newer explicit preference supersedes it.
  if (previous && Date.parse(previous.obtainedAt || previous.recordedAt) > Date.parse(occurredAt)) return state;
  state.marketingPermissions ||= {};
  state.marketingPermissions[normalized] = { status: 'REVOKED', source: 'WHATSAPP', notes: 'Pedido explícito de interrupção recebido no WhatsApp.', obtainedAt: occurredAt, recordedAt: now.toISOString(), recordedBy: 'WHATSAPP', contactId: state.contacts.find(contact => campaignPhone(contact.phone) === normalized)?.id || '' };
  state.marketingPermissionAudit ||= []; state.marketingPermissionAudit.push({ ...state.marketingPermissions[normalized], phone: normalized });
  state.contacts = state.contacts.map(contact => campaignPhone(contact.phone) === normalized ? { ...contact, hasOptedOut: true, consentGiven: false, updatedAt: now.toISOString() } : contact);
  return state;
}
