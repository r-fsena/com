import type { Contact } from '@/types/crm';

type LabelContact = Pick<Contact, 'id' | 'tags' | 'whatsappLabels'>;
export function resolveWhatsAppLabels(raw: unknown, catalog: Map<string, string>) {
  const values = Array.isArray(raw) ? raw.flat() : [raw], names = new Map<string, string>();
  for (const value of values) {
    const named = value && typeof value === 'object' ? value.name ?? value.labelName : undefined;
    const id = value && typeof value === 'object' ? value.id ?? value.labelId : value;
    const name = typeof named === 'string' ? named : id !== undefined && id !== null && catalog.has(String(id)) ? catalog.get(String(id))
      : typeof value === 'string' && !/^\d+$/.test(value.trim()) ? value : undefined;
    if (typeof name !== 'string') continue;
    const clean = name.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (clean) names.set(clean.toLocaleLowerCase('pt-BR'), clean);
  }
  return Array.from(names.values());
}
export function campaignLabelKey(value: string) {
  return value.normalize('NFC').replace(/^\s*\[etiqueta\]\s*/i, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
export function contactCampaignLabels(contact: Pick<LabelContact, 'tags' | 'whatsappLabels'>) {
  const labels = new Map<string, { id: string; name: string; sources: ('CRM' | 'WHATSAPP')[] }>();
  const add = (raw: unknown, source: 'CRM' | 'WHATSAPP') => {
    if (typeof raw !== 'string') return;
    const name = raw.normalize('NFC').replace(/^\s*\[etiqueta\]\s*/i, '').trim().replace(/\s+/g, ' ');
    const id = campaignLabelKey(name); if (!id) return;
    const old = labels.get(id);
    labels.set(id, { id, name: old?.name || name, sources: Array.from(new Set([...(old?.sources || []), source])) });
  };
  for (const label of contact.whatsappLabels || []) add(label, 'WHATSAPP');
  for (const tag of contact.tags || []) add(tag, /^\s*\[etiqueta\]/i.test(tag) ? 'WHATSAPP' : 'CRM');
  return Array.from(labels.values());
}
export function campaignLabelOptions(contacts: LabelContact[]) {
  const options = new Map<string, { id: string; name: string; sources: ('CRM' | 'WHATSAPP')[]; contacts: Set<string> }>();
  for (const contact of contacts) for (const label of contactCampaignLabels(contact)) {
    const old = options.get(label.id);
    options.set(label.id, { ...label, name: old?.name || label.name, sources: Array.from(new Set([...(old?.sources || []), ...label.sources])), contacts: new Set([...Array.from(old?.contacts || []), contact.id]) });
  }
  return Array.from(options.values()).map(({ contacts, ...label }) => ({ ...label, count: contacts.size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
