import { db } from '@/db';
import { contacts, conversations, messages, deals, aiInsights } from '@/db/schema';
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
   * Busca contato pelo número de telefone
   */
  static async getContactByPhone(tenantId: string, phone: string) {
    const raw = this.cleanPhone(phone);
    if (!raw) return null;

    try {
      const result = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneNormalized, raw)))
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
    if (!data.phone) throw new Error('Telefone é obrigatório');
    const raw = this.cleanPhone(data.phone);

    try {
      const existing = await this.getContactByPhone(tenantId, raw);

      if (existing) {
        // Atualiza preservando dados existentes
        const updated = await db
          .update(contacts)
          .set({
            name: data.name || existing.name,
            email: data.email || existing.email,
            monthlyIncome: data.monthlyIncome !== undefined ? String(data.monthlyIncome) : existing.monthlyIncome,
            downPaymentAvailable: data.downPaymentAvailable !== undefined ? String(data.downPaymentAvailable) : existing.downPaymentAvailable,
            maxPropertyValue: data.maxPropertyValue !== undefined ? String(data.maxPropertyValue) : existing.maxPropertyValue,
            preferredPropertyType: (data.preferredPropertyType as any) || existing.preferredPropertyType,
            targetRegions: data.targetRegions || existing.targetRegions,
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
          tenantId,
          name: data.name || `WhatsApp (${raw.slice(-4)})`,
          phoneNormalized: raw,
          email: data.email,
          monthlyIncome: data.monthlyIncome !== undefined ? String(data.monthlyIncome) : undefined,
          downPaymentAvailable: data.downPaymentAvailable !== undefined ? String(data.downPaymentAvailable) : undefined,
          maxPropertyValue: data.maxPropertyValue !== undefined ? String(data.maxPropertyValue) : undefined,
          preferredPropertyType: (data.preferredPropertyType as any) || 'APARTMENT',
          targetRegions: data.targetRegions || ['São Paulo'],
          temperature: (data.temperature as any) || 'HOT',
          aiPriorityScore: data.aiPriorityScore || 85,
          tags: data.tags || ['Novo Lead WhatsApp'],
          source: data.source || 'WHATSAPP',
          consentGiven: true,
        })
        .returning();

      return created[0];
    } catch (err) {
      console.error('Erro no upsert de contato no banco:', err);
      throw err;
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
