import { db } from '@/db';
import { contacts, conversations, messages, deals, aiInsights, tenants, whatsappInstances } from '@/db/schema';
import { eq, and, desc, asc, gt } from 'drizzle-orm';
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
   * Resolve ou registra a instância do WhatsApp para garantir a chave estrangeira
   */
  static async resolveInstanceId(resolvedTenantId: string, zapiInstanceId?: string): Promise<string | null> {
    const rawInst = zapiInstanceId || '3F1B67FC8139425171C79ED390C0144C';
    try {
      const existing = await db
        .select()
        .from(whatsappInstances)
        .where(and(eq(whatsappInstances.tenantId, resolvedTenantId), eq(whatsappInstances.zapiInstanceId, rawInst)))
        .limit(1);

      if (existing[0]?.id) return existing[0].id;

      const created = await db
        .insert(whatsappInstances)
        .values({
          tenantId: resolvedTenantId,
          name: 'WhatsApp Z-API',
          phoneNumber: '+554888774408',
          zapiInstanceId: rawInst,
          zapiTokenSecretRef: 'zapi-default-secret',
          status: 'CONNECTED',
        })
        .returning();

      return created[0]?.id || null;
    } catch (err) {
      console.warn('[ContactsDBService] Aviso ao resolver instanceId:', err);
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
   * Obtém ou cria uma conversa vinculada ao contato
   */
  static async getOrCreateConversation(tenantIdUuid: string, contactIdUuid: string, instanceIdUuid: string, lastMessagePreview?: string) {
    try {
      const existing = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.tenantId, tenantIdUuid), eq(conversations.contactId, contactIdUuid)))
        .limit(1);

      if (existing[0]?.id) {
        if (lastMessagePreview) {
          await db
            .update(conversations)
            .set({
              lastMessagePreview,
              lastMessageAt: new Date(),
            })
            .where(eq(conversations.id, existing[0].id));
        }
        return existing[0];
      }

      const created = await db
        .insert(conversations)
        .values({
          tenantId: tenantIdUuid,
          instanceId: instanceIdUuid,
          contactId: contactIdUuid,
          status: 'OPEN',
          lastMessagePreview: lastMessagePreview || 'Conversa iniciada',
          lastMessageAt: new Date(),
        })
        .returning();

      return created[0] || null;
    } catch (err) {
      console.warn('[ContactsDBService] Aviso ao criar conversa:', err);
      return null;
    }
  }

  /**
   * Persiste mensagem recebida via Webhook Z-API em tempo real de forma atômica
   */
  static async persistIncomingWebhookMessage(data: {
    tenantId: string;
    instanceId?: string;
    phone: string;
    lid?: string;
    senderName?: string;
    content: string;
    mediaType?: string;
    mediaUrl?: string;
    fromMe: boolean;
    externalId?: string;
    timestamp?: string;
  }) {
    const raw = this.cleanPhone(data.phone);
    if (!raw || raw.length < 8) return null;

    try {
      const resolvedTenant = await this.resolveTenantId(data.tenantId);
      if (!resolvedTenant) return null;

      const contact = await this.upsertContact(data.tenantId, {
        phone: raw,
        lid: data.lid,
        name: data.senderName,
      });
      if (!contact) return null;

      const resolvedInst = await this.resolveInstanceId(resolvedTenant, data.instanceId);
      if (!resolvedInst) return null;

      const conversation = await this.getOrCreateConversation(
        resolvedTenant, 
        contact.id, 
        resolvedInst, 
        (data.content || '').substring(0, 100)
      );
      if (!conversation) return null;

      // Idempotency: verifica se a mensagem já foi salva por externalId
      if (data.externalId) {
        const existingMsg = await db
          .select()
          .from(messages)
          .where(and(eq(messages.tenantId, resolvedTenant), eq(messages.externalId, data.externalId)))
          .limit(1);

        if (existingMsg[0]?.id) {
          return existingMsg[0];
        }
      }

      const msgDate = data.timestamp ? new Date(data.timestamp) : new Date();

      const createdMsg = await db
        .insert(messages)
        .values({
          tenantId: resolvedTenant,
          conversationId: conversation.id,
          externalId: data.externalId,
          idempotencyKey: data.externalId ? `${resolvedTenant}_${data.externalId}` : undefined,
          senderType: data.fromMe ? 'USER' : 'CONTACT',
          senderName: data.senderName || (data.fromMe ? 'Corretor' : 'Cliente'),
          messageType: (data.mediaType === 'audio' ? 'AUDIO' : data.mediaType === 'image' ? 'IMAGE' : data.mediaType === 'document' ? 'DOCUMENT' : 'TEXT') as any,
          content: data.content,
          status: 'DELIVERED',
          timestamp: msgDate,
        })
        .returning();

      return createdMsg[0] || null;
    } catch (err) {
      console.warn('[ContactsDBService] Falha ao persistir mensagem de webhook no banco:', err);
      return null;
    }
  }

  /**
   * Busca mensagens persistidas no PostgreSQL com timestamp maior que `sinceMs`
   */
  static async getMessagesSince(tenantId: string, sinceMs: number) {
    try {
      const resolvedTenant = await this.resolveTenantId(tenantId);
      if (!resolvedTenant) return [];

      const conditions = [eq(messages.tenantId, resolvedTenant)];
      if (sinceMs > 0) {
        conditions.push(gt(messages.timestamp, new Date(sinceMs)));
      }

      const rows = await db
        .select({
          msg: messages,
          conv: conversations,
          cnt: contacts,
        })
        .from(messages)
        .leftJoin(conversations, eq(messages.conversationId, conversations.id))
        .leftJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(and(...conditions))
        .orderBy(desc(messages.timestamp))
        .limit(300);

      return rows.map(r => ({
        id: r.msg.externalId || r.msg.id,
        tenantId,
        instanceId: '3F1B67FC8139425171C79ED390C0144C',
        phone: r.cnt?.phoneNormalized || '',
        lid: r.cnt?.whatsappLid || undefined,
        senderName: r.msg.senderName || r.cnt?.name || (r.msg.senderType === 'USER' ? 'Corretor' : 'Cliente'),
        content: r.msg.content,
        mediaType: (r.msg.messageType ? r.msg.messageType.toLowerCase() : 'text') as any,
        fromMe: r.msg.senderType === 'USER',
        timestamp: new Date(r.msg.timestamp).toISOString(),
        receivedAt: new Date(r.msg.timestamp).getTime(),
      }));
    } catch (err) {
      console.warn('[ContactsDBService] Falha ao buscar mensagens since:', err);
      return [];
    }
  }

  /**
   * Sincroniza / faz seed de lote de mensagens do frontend no banco para garantir zero perda
   */
  static async seedMessages(tenantId: string, messagesList: Message[]) {
    if (!messagesList || messagesList.length === 0) return 0;
    try {
      const resolvedTenant = await this.resolveTenantId(tenantId);
      if (!resolvedTenant) return 0;

      let savedCount = 0;
      for (const m of messagesList) {
        if (!m || !m.content) continue;
        let phone = (m as any).phone ? this.cleanPhone((m as any).phone) : '';
        if (!phone && m.conversationId) {
          phone = this.cleanPhone(m.conversationId);
        }
        if (!phone || phone.length < 8) continue;

        await this.persistIncomingWebhookMessage({
          tenantId,
          phone,
          content: m.content,
          fromMe: m.senderType === 'USER',
          senderName: m.senderName,
          externalId: m.externalId || m.id,
          timestamp: m.timestamp,
        });
        savedCount++;
      }
      return savedCount;
    } catch (err) {
      console.warn('[ContactsDBService] Falha ao executar seed de mensagens:', err);
      return 0;
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
