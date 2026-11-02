import crypto from 'crypto';
import { z } from 'zod';
import type { Contact, Message } from '@/types/crm';
import type { PersistedCRMState } from '@/lib/crm-repository';

export const qualificationFields = ['monthlyIncome', 'downPaymentAvailable', 'maxPropertyValue', 'preferredPropertyType', 'targetRegions', 'email'] as const;
export type QualificationField = typeof qualificationFields[number];
export type QualificationFact = { value: number | string | string[]; messageId: string; quote: string; at: string; source: 'AI' | 'HUMAN'; confidence: number };
export type QualificationFacts = Partial<Record<QualificationField, QualificationFact>>;
export type QualificationType = 'REAL_ESTATE_LEAD' | 'PERSONAL_OR_OTHER' | 'OPERATIONAL_OR_VENDOR' | 'INSUFFICIENT_DATA';
export type QualificationJob = {
  fingerprint: string; status: 'QUEUED' | 'PROCESSING' | 'UPDATED' | 'REVIEW' | 'ERROR' | 'DISABLED';
  processedFingerprint?: string;
  cursor: number; total: number; facts: QualificationFacts; classification: QualificationType; summary: string;
  attempts: number; updatedAt: string; lease?: string; leaseUntil?: number; retryAt?: number; error?: string;
  contextAttempts?: number;
  humanClassificationPreserved?: boolean;
  conflicts?: QualificationField[]; source?: string; degraded?: boolean;
};
export type QualificationState = { jobs: Record<string, QualificationJob>; lastWorkerAt?: string; lastScheduledAt?: string };

export function qualificationMessages(state: Pick<PersistedCRMState, 'messages'>, conversationId: string) {
  return state.messages.filter(m => m.conversationId === conversationId && !m.isInternalNote &&
    !['CONTACT_CARD', 'CALL', 'LOCATION', 'STICKER'].includes(m.messageType) &&
    ['CONTACT', 'USER'].includes(m.senderType) && !!m.content?.trim() &&
    Number.isFinite(Date.parse(m.timestamp)) && !/^\s*(?:\[[^\]]+\]|📷\s*(?:foto|imagem)|🎵\s*áudio)\s*$/i.test(m.content))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
}
export function qualificationFingerprint(messages: Message[]) {
  return crypto.createHash('sha256').update(JSON.stringify(messages.map(m => [m.id, m.senderType, m.content, m.timestamp]))).digest('hex');
}
export function enqueueQualifications(state: PersistedCRMState): PersistedCRMState {
  const jobs = state.qualification?.jobs || {};
  for (const conversation of state.conversations) {
    if (!state.contacts.some(c => c.id === conversation.contactId && c.tenantId === conversation.tenantId)) continue;
    const messages = qualificationMessages(state, conversation.id);
    if (!messages.some(m => m.senderType === 'CONTACT')) continue;
    const fingerprint = qualificationFingerprint(messages);
    if (jobs[conversation.id]?.fingerprint === fingerprint) continue;
    const previous = jobs[conversation.id];
    if (previous?.cursor && previous.processedFingerprint === qualificationFingerprint(messages.slice(0, previous.cursor))) {
      // New messages append to the validated memory. Older imports or edits invalidate this prefix.
      jobs[conversation.id] = { ...previous, fingerprint, status: 'QUEUED', total: messages.length, attempts: 0,
        contextAttempts: 0, lease: undefined, leaseUntil: undefined, retryAt: undefined, error: undefined, updatedAt: new Date().toISOString() };
      continue;
    }
    jobs[conversation.id] = { fingerprint, status: 'QUEUED', cursor: 0, total: messages.length, facts: {},
      classification: 'INSUFFICIENT_DATA', summary: '', attempts: 0, updatedAt: new Date().toISOString() };
  }
  const ids = new Set(state.conversations.map(c => c.id));
  state.qualification = { ...state.qualification, jobs: Object.fromEntries(Object.entries(jobs).filter(([id]) => ids.has(id))) };
  return state;
}
export function propertyType(value: string): Contact['preferredPropertyType'] | undefined {
  if (/cobertura|penthouse/i.test(value)) return 'PENTHOUSE';
  if (/casa|sobrado/i.test(value)) return 'HOUSE';
  if (/studio|loft|kitnet/i.test(value)) return 'STUDIO';
  if (/terreno|lote/i.test(value)) return 'LAND';
  if (/comercial|galpão|consultório/i.test(value)) return 'COMMERCIAL';
  if (/apartamento|apto/i.test(value)) return 'APARTMENT';
}
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function money(raw: string, unit?: string) {
  let value = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw);
  if (/milhao|milhoes|milhão|milhões|^m$/i.test(unit || '')) value *= 1_000_000;
  else if (/mil|k/i.test(unit || '')) value *= 1000;
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000 ? value : undefined;
}
export function explicitQualification(messages: Array<Pick<Message, 'id' | 'senderType' | 'content' | 'timestamp'>>) {
  const facts: QualificationFacts = {};
  let classification: QualificationType = 'INSUFFICIENT_DATA';
  const client = messages.filter(m => m.senderType === 'CONTACT');
  for (const m of client) {
    const text = normalize(m.content);
    const vendor = /(?:sou|somos|trabalho como|presto servico|servicos de).{0,45}(?:fotograf|cartorio|corretor|corretora|prestador|fornecedor)|(?:ensaio|servico).{0,30}(?:apartamento|imovel)/.test(text);
    const lead = /(?:quero|queremos|procuro|procuramos|busco|buscamos|pretendo|preciso|interesse|buscando|procurando).{0,65}(?:apartamento|apto|casa|terreno|imovel|cobertura|studio|alugar|comprar)|(?:comprar|alugar|vender|financiar).{0,35}(?:apartamento|apto|casa|terreno|imovel)/.test(text);
    if (lead && (!vendor || /\b(comprar|alugar|financiar|morar|moradia)\b/.test(text))) classification = 'REAL_ESTATE_LEAD';
    else if (vendor && classification !== 'REAL_ESTATE_LEAD') classification = 'OPERATIONAL_OR_VENDOR';
    else if (classification === 'INSUFFICIENT_DATA' && /\b(amor|esposa|marido|almoco|jantar|pao|dormir)\b/.test(text)) classification = 'PERSONAL_OR_OTHER';
    for (const sentence of m.content.split(/[\n;!?]+|\.(?:\s|$)|,\s*(?=(?:procuro|busco|quero|minha|meu|entrada|orçamento)\b)/i).map(s => s.trim()).filter(Boolean)) {
      const normalized = normalize(sentence);
      const noEntry = /^(?:agora |atualmente )?(?:nao tenho|nao possuo|estou sem|sem) (?:mais )?(?:dinheiro (?:para |de )?)?entrada[.,\s]*$/.test(normalized);
      if (noEntry) { facts.downPaymentAvailable = { value: 0, messageId: m.id, quote: sentence, at: m.timestamp, source: 'AI', confidence: 0.95 }; continue; }
      // Examples, reported speech and negations require contextual review; never become automatic facts.
      if (/\b(?:exemplo|suponha|hipotetic|simulacao|corretor disse|ele disse|ela disse|nao|nem|talvez|se eu|caso eu|meu cliente|minha cliente|meu amigo|minha amiga)\b/.test(normalized)) continue;
      if (/encaminhad|oportunidade|oferta|vende-se|a partir de|somente hoje|condicoes especiais/.test(text)) continue;
      const put = (field: QualificationField, value: QualificationFact['value']) => { facts[field] = { value, messageId: m.id, quote: sentence, at: m.timestamp, source: 'AI', confidence: 0.9 }; };
      const patterns: Array<[QualificationField, RegExp]> = [
        ['monthlyIncome', /(?:minha\s+|nossa\s+)?renda(?:\s+(?:mensal|familiar|bruta|liquida))?\s*(?:(?:e|de|fica|atual)\s*)?(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|k|m)?/],
        ['downPaymentAvailable', /(?:minha\s+)?entrada\s*(?:(?:e|de|disponivel)\s*)?(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|k|m)?/],
        ['maxPropertyValue', /(?:meu\s+)?(?:orcamento|teto|maximo|limite)\s*(?:(?:e|de|ate)\s*)?(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|k|m)?/],
        ['monthlyIncome', /(?:ganho|recebo|meu salario e)\s*(?:por mes|mensalmente|ao mes)?\s*(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|k|m)?/],
        ['downPaymentAvailable', /(?:tenho|possuo|posso dar|consigo dar|disponho de)\s*(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|k|m)?\s*(?:reais\s*)?(?:de |para |pra )?entrada/],
        ['maxPropertyValue', /(?:posso gastar|quero investir|posso pagar)\s*(?:ate\s*)?(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|k|m)?/],
      ];
      for (const [field, pattern] of patterns) { const match = normalized.match(pattern); if (match) { const value = money(match[1], match[2]); if (value !== undefined) put(field, value); } }
      const kind = normalized.match(/(?:quero|procuro|busco|pretendo comprar|preciso de|interesse em|procurando|buscando)\s+(?:comprar\s+|alugar\s+)?(?:um[a]?\s+)?(apartamento|apto|casa(?: em condominio)?|sobrado|terreno|cobertura|studio|loft|sala comercial)/);
      if (kind) { const value = propertyType(kind[1]); if (value) put('preferredPropertyType', value); }
      const region = sentence.match(/(?:quero|procuro|busco|comprar|alugar|morar|buscando|procurando).{0,60}?\b(?:em|no bairro|na cidade de)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]{1,65})(?=,|\.|$)/i);
      if (region && !/condom[ií]nio|torno|at[eé]|m[eé]dia/i.test(region[1])) put('targetRegions', [region[1].trim()]);
      const email = sentence.match(/(?:meu\s+)?e-?mail\s*(?:e|é|:)?\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})/i);
      if (email) put('email', email[1]);
    }
  }
  return { facts, classification };
}
export function applyQualification(contact: Contact, facts: QualificationFacts) {
  const next = { ...contact, qualificationFields: { ...contact.qualificationFields } };
  const conflicts: QualificationField[] = [];
  for (const field of qualificationFields) {
    const fact = facts[field]; if (!fact) continue;
    const current = contact[field]; const provenance = contact.qualificationFields?.[field];
    if (provenance?.source === 'AI' && Date.parse(provenance.at) > Date.parse(fact.at)) continue;
    const empty = current === undefined || current === null || current === '' || (Array.isArray(current) && !current.length);
    const same = JSON.stringify(current) === JSON.stringify(fact.value);
    const aiOwned = provenance?.source === 'AI' && JSON.stringify(provenance.value) === JSON.stringify(current);
    if (provenance?.source === 'HUMAN' || (!empty && !aiOwned)) { if (!same) conflicts.push(field); continue; }
    (next as any)[field] = fact.value; next.qualificationFields[field] = fact;
  }
  next.updatedAt = new Date().toISOString();
  return { contact: next, conflicts };
}

const evidenceSchema = z.array(z.object({ field: z.enum(qualificationFields), value: z.union([z.number().finite().min(0).max(1_000_000_000), z.string().min(1).max(150), z.array(z.string().min(1).max(100)).min(1).max(5)]), messageId: z.string(), quote: z.string().min(3).max(2000), confidence: z.number().min(0).max(1) })).max(30);
export function validatedModelFacts(raw: unknown, messages: Message[]): QualificationFacts {
  const parsed = evidenceSchema.safeParse(raw); if (!parsed.success) return {};
  const facts: QualificationFacts = {};
  for (const item of parsed.data) {
    const message = messages.find(m => m.id === item.messageId && m.senderType === 'CONTACT');
    if (!message || !message.content.includes(item.quote) || item.confidence < 0.9) continue;
    const quote = normalize(item.quote);
    if (/\b(nao|nem|exemplo|suponha|talvez|se eu|disse|simulacao|hipotese|meu cliente|minha cliente)\b/.test(quote)) continue;
    let supported = false;
    if (['monthlyIncome', 'downPaymentAvailable', 'maxPropertyValue'].includes(item.field) && typeof item.value === 'number') {
      const values = Array.from(quote.matchAll(/([\d.,]+)\s*(milhoes|milhao|mil|k|m)?/g)).map(m => money(m[1], m[2]));
      const contexts: Record<string, RegExp> = { monthlyIncome: /renda|ganho|recebo|salario|por mes|mensal/, downPaymentAvailable: /entrada|sinal|recursos|poupanca|disponivel/, maxPropertyValue: /orcamento|teto|ate|limite|maximo|gastar|investir|pagar/ };
      supported = values.includes(item.value) && contexts[item.field].test(quote);
    } else if (item.field === 'targetRegions' && Array.isArray(item.value)) supported = item.value.every(v => quote.includes(normalize(v)));
    else if (item.field === 'preferredPropertyType' && typeof item.value === 'string') supported = propertyType(quote) === item.value && ['APARTMENT', 'HOUSE', 'STUDIO', 'LAND', 'COMMERCIAL', 'PENTHOUSE'].includes(item.value);
    else if (item.field === 'email' && typeof item.value === 'string') supported = /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(item.value) && quote.includes(normalize(item.value));
    if (!supported) continue;
    const fact: QualificationFact = { ...item, at: message.timestamp, source: 'AI' };
    if (!facts[item.field] || Date.parse(facts[item.field]!.at) <= Date.parse(fact.at)) facts[item.field] = fact;
  }
  return facts;
}
export function validatedClassification(raw: unknown, kind: unknown, messages: Message[]): QualificationType {
  const evidence = z.object({ messageId: z.string(), quote: z.string().min(3).max(2000), confidence: z.number().min(0.9).max(1) }).safeParse(raw);
  if (!evidence.success || !['REAL_ESTATE_LEAD', 'PERSONAL_OR_OTHER', 'OPERATIONAL_OR_VENDOR'].includes(String(kind))) return 'INSUFFICIENT_DATA';
  const message = messages.find(m => m.senderType === 'CONTACT' && m.id === evidence.data.messageId && m.content.includes(evidence.data.quote));
  if (!message) return 'INSUFFICIENT_DATA';
  const quote = normalize(evidence.data.quote);
  if (kind === 'REAL_ESTATE_LEAD' && (!/imovel|apartamento|casa|terreno|lote|cobertura|studio|comprar|alugar|financiar|visitar|fgts/.test(quote) || /nao quero|sem interesse|nao tenho interesse|desisti/.test(quote))) return 'INSUFFICIENT_DATA';
  return kind as QualificationType;
}
