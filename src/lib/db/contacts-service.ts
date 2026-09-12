import { db } from '@/db';
import { contacts, conversations, messages, deals, aiInsights, tenants } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { Contact, Deal, Message } from '@/types/crm';

/**
 * Serviço de Acesso a Dados do CRM (PostgreSQL / AWS RDS)
 * Ancorado 100% no número de telefone normalizado (E.164)
 */
export class ContactsDBService {
  /**
   * Normaliza telefone para formato numérico puro (ex: 554891079478)
   */
  static cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Resolve o UUID do tenant a partir de slug, id legada ou UUID puro
   */
  static async resolveTenantId(rawTenantId: string): Promise<string | null> {
    if (!rawTenantId) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTenantId);
    if (isUuid) return rawTenantId;

    const slug = rawTenantId.replace(/^tenant-/, '');
    try {
      const existing = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);

      if (existing[0]?.id) return existing[0].id;

      const created = await db
        .insert(tenants)
        .values({
          name: slug === 'amabile-barbarotti' ? 'Amábile Barbarotti' : 'Vanguard Imóveis',
          slug: slug,
          documentCnpj: '00.000.000/0001-00',
        })
        .returning();

      return created[0]?.id || null;
    } catch (err) {
      console.warn('[ContactsDBService] Aviso ao resolver tenant UUID no banco:', err);
      return null;
    }
  }

  /**
   * Busca contato pelo número de telefone
   */
  static async getContactByPhone(tenantId: string, phone: string) {
    const raw = this.cleanPhone(phone);
    if (!raw) return null;

    try {
      const resolvedTenant = await this.resolveTenantId(tenantId);
      if (!resolvedTenant) return null;

      const result = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, resolvedTenant), eq(contacts.phoneNormalized, raw)))
        .limit(1);

      return result[0] || null;
    } catch (err) {
      console.error('Erro ao buscar contato por telefone no banco:', err);
      return null;
    }
  }

  /**
   * Upsert de Contato: Insere se não existir ou atualiza preservando a qualificação
   */
  static async upsertContact(tenantId: string, data: Partial<Contact>) {
    const raw = this.cleanPhone(data.phone || (data.id && data.id.includes('zapi') ? data.id : ''));
    if (!raw || raw.length < 8) return null;

    try {
      const resolvedTenant = await this.resolveTenantId(tenantId);
      if (!resolvedTenant) return null;

      const existing = await this.getContactByPhone(resolvedTenant, raw);

      if (existing) {
        // Atualiza preservando dados existentes
        const updated = await db
          .update(contacts)
          .set({
            name: data.name || existing.name,
            email: data.email !== undefined ? data.email : existing.email,
            monthlyIncome: data.monthlyIncome !== undefined ? (data.monthlyIncome !== null ? String(data.monthlyIncome) : null) : existing.monthlyIncome,
            downPaymentAvailable: data.downPaymentAvailable !== undefined ? (data.downPaymentAvailable !== null ? String(data.downPaymentAvailable) : null) : existing.downPaymentAvailable,
            maxPropertyValue: data.maxPropertyValue !== undefined ? (data.maxPropertyValue !== null ? String(data.maxPropertyValue) : null) : existing.maxPropertyValue,
            preferredPropertyType: (data.preferredPropertyType as any) !== undefined ? (data.preferredPropertyType as any) : existing.preferredPropertyType,
            purchasePurpose: (data.purchasePurpose as any) !== undefined ? (data.purchasePurpose as any) : existing.purchasePurpose,
            purchaseTimeline: data.purchaseTimeline !== undefined ? data.purchaseTimeline : existing.purchaseTimeline,
            targetBedrooms: data.targetBedrooms !== undefined ? data.targetBedrooms : existing.targetBedrooms,
            targetRegions: data.targetRegions !== undefined ? data.targetRegions : existing.targetRegions,
            whatsappLid: data.lid || existing.whatsappLid,
            temperature: (data.temperature as any) || existing.temperature,
            aiPriorityScore: Math.max(data.aiPriorityScore || 70, existing.aiPriorityScore || 70),
            avatarUrl: data.avatarUrl || existing.avatarUrl,
            tags: data.tags || existing.tags,
            lastClientInteractionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing.id))
          .returning();

        return updated[0];
      }

      // Cria novo contato
      const created = await db
        .insert(contacts)
        .values({
          tenantId: resolvedTenant,
          name: data.name || `WhatsApp (${raw.slice(-4)})`,
          phoneNormalized: raw,
          whatsappLid: data.lid || undefined,
          email: data.email || undefined,
          monthlyIncome: data.monthlyIncome !== undefined && data.monthlyIncome !== null ? String(data.monthlyIncome) : undefined,
          downPaymentAvailable: data.downPaymentAvailable !== undefined && data.downPaymentAvailable !== null ? String(data.downPaymentAvailable) : undefined,
          maxPropertyValue: data.maxPropertyValue !== undefined && data.maxPropertyValue !== null ? String(data.maxPropertyValue) : undefined,
          preferredPropertyType: (data.preferredPropertyType as any) || undefined,
          purchasePurpose: (data.purchasePurpose as any) || 'LIVING',
          purchaseTimeline: data.purchaseTimeline || '1_TO_3_MONTHS',
          targetBedrooms: data.targetBedrooms !== undefined ? data.targetBedrooms : undefined,
          targetRegions: data.targetRegions || [],
          temperature: (data.temperature as any) || 'COLD',
          aiPriorityScore: data.aiPriorityScore !== undefined ? data.aiPriorityScore : 0,
          tags: data.tags || ['Novo Lead WhatsApp'],
          source: data.source || 'WHATSAPP',
          consentGiven: true,
        })
        .returning();

      return created[0];
    } catch (err) {
      console.error('Erro no upsert de contato no banco:', err);
      return null;
    }
  }

  /**
   * Atualização de Qualificação Rápida
   */
  static async updateQualification(tenantId: string, phone: string, qualification: {
    monthlyIncome?: number;
    downPayment?: number;
    maxBudget?: number;
    preferredPropertyType?: string;
    targetRegions?: string[];
    targetBedrooms?: number;
    purchasePurpose?: string;
    purchaseTimeline?: string;
    email?: string;
  }) {
    const raw = this.cleanPhone(phone);
    const existing = await this.getContactByPhone(tenantId, raw);
    if (!existing) return null;

    return db
      .update(contacts)
      .set({
        monthlyIncome: qualification.monthlyIncome !== undefined ? String(qualification.monthlyIncome) : existing.monthlyIncome,
        downPaymentAvailable: qualification.downPayment !== undefined ? String(qualification.downPayment) : existing.downPaymentAvailable,
        maxPropertyValue: qualification.maxBudget !== undefined ? String(qualification.maxBudget) : existing.maxPropertyValue,
        preferredPropertyType: (qualification.preferredPropertyType as any) || existing.preferredPropertyType,
        purchasePurpose: (qualification.purchasePurpose as any) || existing.purchasePurpose,
        purchaseTimeline: qualification.purchaseTimeline || existing.purchaseTimeline,
        targetBedrooms: qualification.targetBedrooms !== undefined ? qualification.targetBedrooms : existing.targetBedrooms,
        targetRegions: qualification.targetRegions || existing.targetRegions,
        email: qualification.email || existing.email,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, existing.id))
      .returning();
  }

  /**
   * Salva mensagem do WhatsApp no histórico definitivo
   */
  /**
   * Salva mensagem do WhatsApp no histórico definitivo
   */
  static async saveWhatsAppMessage(tenantId: string, conversationId: string, msg: {
    senderType: 'CONTACT' | 'USER';
    senderName?: string;
    content: string;
    externalId?: string;
  }) {
    return db
      .insert(messages)
      .values({
        tenantId,
        conversationId,
        senderType: msg.senderType,
        senderName: msg.senderName || (msg.senderType === 'USER' ? 'Corretor' : 'Cliente'),
        content: msg.content,
        externalId: msg.externalId,
        status: 'DELIVERED',
        timestamp: new Date(),
      })
      .returning();
  }

  /**
   * Busca histórico completo de mensagens pela conversa
   */
  static async getMessagesByConversation(tenantId: string, conversationId: string) {
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
      .orderBy(asc(messages.timestamp));
  }
}
