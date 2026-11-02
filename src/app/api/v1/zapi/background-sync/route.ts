import { kickQualification } from '@/lib/lead-qualification-service';
import { resolveWhatsAppLabels } from '@/lib/contact-labels';
import { writeCRMState, readCRMState } from '@/lib/crm-repository';
import { ZapiCredentialsService } from '@/lib/db/zapi-credentials-service';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';
import { syncJobStore } from '@/lib/sync-job-store';
import { serverCRMStore } from '@/lib/server-crm-store';
import { isRealWhatsAppConversation, isWhatsAppChannelOrGroup } from '@/lib/whatsapp-filter';
import { parseWhatsAppTimestamp } from '@/lib/date-utils';
import { normalizePhoneNumber } from '@/lib/vcf-parser';
import { Contact, Conversation, Message, MessageType } from '@/types/crm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runBackgroundSyncWorker(params: {
  jobId: string;
  tenantId: string;
  instanceId: string;
  instanceToken: string;
  securityToken: string;
  historyDays: number;
  assignedUserId?: string;
  importMode: 'CHATS' | 'PHONEBOOK' | 'ALL';
}) {
  const {
    jobId,
    tenantId,
    instanceId,
    instanceToken,
    securityToken,
    historyDays,
    assignedUserId,
    importMode,
  } = params;

  await syncJobStore.updateJob(jobId, {
    status: 'RUNNING',
    currentStepText: 'Carregando agenda e etiquetas do WhatsApp...',
    progress: 5,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Client-Token': securityToken,
  };

  const cutoffMs = historyDays > 0 ? Date.now() - (historyDays * 24 * 60 * 60 * 1000) : 0;

  try {
    // 1. Busca contatos da agenda do aparelho e etiquetas do WhatsApp Business em paralelo
    const [tagsRes, contactsRes] = await Promise.all([
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/tags`, { headers, signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/contacts?page=1&pageSize=300`, { headers, signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]);

    // Mapeamento de Etiquetas
    const tagsMap = new Map<string, string>();
    if (Array.isArray(tagsRes)) {
      tagsRes.forEach((t: any) => {
        const name = t?.name || t?.labelName;
        if (typeof name === 'string' && name.trim()) {
          tagsMap.set(String(t.id ?? t.labelId ?? name), name);
        }
      });
    }

    // Mapeamento de Nomes da Agenda do Celular
    const phonebookMap = new Map<string, { name: string; lid?: string }>();
    if (Array.isArray(contactsRes)) {
      contactsRes.forEach((cnt: any) => {
        if (!cnt) return;
        const raw = (cnt.phone || '').replace(/\D/g, '');
        const name = cnt.name || cnt.vname || cnt.short || cnt.notify;
        if (raw && name) {
          phonebookMap.set(raw, { name, lid: cnt.lid });
        }
      });
    }

    await syncJobStore.updateJob(jobId, {
      progress: 15,
      currentStepText: 'Iniciando varredura contínua de conversas...',
    });

    // 2. Itera todas as páginas de chats até o fim
    const previousJob = await syncJobStore.getJob(jobId);
    const startPage = (previousJob?.pagesScanned || 0) + 1;
    let page = startPage;
    let keepPaging = true;
    const allValidChatsMap = new Map<string, any>();
    let totalRawScanned = 0;
    const maxPages = startPage; // Uma página por execução; progresso confirmado antes da próxima chamada.

    while (keepPaging && page <= maxPages) {
      try {
        const res = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats?page=${page}&pageSize=100`,
          { headers, signal: AbortSignal.timeout(15000) }
        );

        if (!res.ok) throw new Error(`Z-API indisponível (HTTP ${res.status}).`);

        const chatBatch = await res.json();
        if (!Array.isArray(chatBatch) || chatBatch.length === 0) {
          keepPaging = false;
          break;
        }

        totalRawScanned += chatBatch.length;

        for (const chat of chatBatch) {
          if (!chat) continue;

          // Se o modo for apenas CHATS, exige que seja conversa real com mensagens
          if (importMode === 'CHATS') {
            if (!isRealWhatsAppConversation(chat)) continue;
          } else {
            if (isWhatsAppChannelOrGroup(chat)) continue;
          }

          let cleanPhone = (chat.phone || chat.id || '').replace(/@.*$/, '').replace(/\D/g, '');
          if (!cleanPhone || cleanPhone === '0' || cleanPhone.length < 8) continue;

          // DDI 55
          if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
            cleanPhone = `55${cleanPhone}`;
          }

          // Checa filtro de período (se configurado)
          const lastMsgTime = chat.lastMessageTime || chat.updatedAt || chat.timestamp;
          const timestampMs = parseWhatsAppTimestamp(lastMsgTime);
          if (cutoffMs > 0 && timestampMs > 0 && timestampMs < cutoffMs) {
            continue;
          }

          // Mantém o mais recente
          const existing = allValidChatsMap.get(cleanPhone);
          if (!existing || timestampMs > parseWhatsAppTimestamp(existing.lastMessageTime)) {
            allValidChatsMap.set(cleanPhone, chat);
          }
        }

        const calculatedProgress = Math.min(15 + Math.round((page / 15) * 60), 75);
        await syncJobStore.updateJob(jobId, {
          pagesScanned: page,
          totalChatsFound: totalRawScanned,
          contactsImported: allValidChatsMap.size,
          progress: calculatedProgress,
          currentStepText: `Varrendo página ${page}: ${allValidChatsMap.size} conversas qualificadas encontradas...`,
        });

        if (chatBatch.length < 100) keepPaging = false;
        page++;
        // Pausa suave de 150ms para evitar rate-limit da Z-API
        await new Promise(r => setTimeout(r, 150));
      } catch (pageErr) {
        console.error(`[BackgroundSync] Erro na página ${page}:`, pageErr);
        throw pageErr;
      }
    }

    await syncJobStore.updateJob(jobId, {
      progress: 80,
      currentStepText: `Construindo registros para ${allValidChatsMap.size} contatos...`,
    });

    // 3. Monta Contatos e Conversas no Padrão do CRM
    const newContacts: Contact[] = [];
    const newConversations: Conversation[] = [];
    const newMessages: Message[] = [];
    const nowIso = new Date().toISOString();

    const sortedEntries = Array.from(allValidChatsMap.entries()).sort(([, a], [, b]) => {
      const timeA = parseWhatsAppTimestamp(a.lastMessageTime);
      const timeB = parseWhatsAppTimestamp(b.lastMessageTime);
      return timeB - timeA;
    });

    for (const [cleanPhone, chat] of sortedEntries) {
      const { display } = normalizePhoneNumber(cleanPhone);
      const contactId = `contact-zapi-${cleanPhone}`;
      const conversationId = `conv-zapi-${cleanPhone}`;

      // Resolução inteligente de nome
      const phonebookEntry = phonebookMap.get(cleanPhone);
      const rawName = chat.name || phonebookEntry?.name || chat.pushName || '';
      const resolvedName = rawName && !rawName.startsWith('+') && !rawName.startsWith('WhatsApp')
        ? rawName
        : `WhatsApp ${cleanPhone.slice(-4)}`;

      // Mapeamento de Tags / Etiquetas do WhatsApp Business
      const contactTags: string[] = ['WhatsApp Lead', 'Importação Z-API'];
      const resolvedLabels = resolveWhatsAppLabels([chat.tags, chat.labels, chat.labelIds, chat.label], tagsMap);
      contactTags.push(...resolvedLabels.map(label => `[Etiqueta] ${label}`));

      const timestampMs = parseWhatsAppTimestamp(chat.lastMessageTime);
      const interactionIso = timestampMs > 0 ? new Date(timestampMs).toISOString() : nowIso;

      newContacts.push({
        id: contactId,
        tenantId,
        name: resolvedName,
        phone: display,
        lid: chat.lid,
        assignedUserId: assignedUserId || undefined,
        createdAt: interactionIso,
        updatedAt: nowIso,
        lastClientInteractionAt: interactionIso,
        tags: contactTags,
        whatsappLabels: resolvedLabels,
        source: 'WHATSAPP',
        temperature: 'WARM',
        aiPriorityScore: 80,
        notesCount: 0,
        consentGiven: false,
        consentDate: interactionIso,
        hasOptedOut: false,
        isPersonal: false,
        targetRegions: [],
        firstSyncedAt: nowIso,
        lastSyncedAt: nowIso,
        avatarUrl: chat.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=0D9488&color=fff`,
      });

      newConversations.push({
        id: conversationId,
        tenantId,
        instanceId,
        contactId,
        status: 'OPEN',
        assignedUserId: assignedUserId || undefined,
        lastMessageAt: interactionIso,
        lastMessagePreview: chat.lastMessage || `Conversa ativa no WhatsApp com ${resolvedName}`,
        unreadCount: Number(chat.unread || chat.messagesUnread || 0),
        slaBreached: false,
        isPersonal: false,
      });

      if (chat.lastMessage) {
        newMessages.push({
          id: `msg-sync-${cleanPhone}`,
          tenantId,
          conversationId,
          senderType: 'CONTACT',
          senderName: resolvedName,
          messageType: 'TEXT',
          content: chat.lastMessage,
          status: 'DELIVERED',
          isInternalNote: false,
          timestamp: interactionIso,
        });
      }
    }

    // 3.5. Busca histórico real de mensagens para as 25 conversas mais recentes em paralelo controlado
    await syncJobStore.updateJob(jobId, {
      progress: 85,
      currentStepText: 'Baixando histórico de mensagens das conversas ativas...',
    });

    const activeChatsSlice = sortedEntries.slice(0, 25);
    await Promise.allSettled(
      activeChatsSlice.map(async ([cleanPhone, chat]: [string, any]) => {
        try {
          if (!cleanPhone) return;

          const msgRes = await fetch(
            `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chat-messages/${cleanPhone}?page=1&pageSize=25`,
            { headers, signal: AbortSignal.timeout(15000) }
          );

          if (msgRes.ok) {
            const msgsData = await msgRes.json();
            if (Array.isArray(msgsData)) {
              msgsData.forEach((m: any, idx: number) => {
                if (m && (m.text || m.body || m.caption || m.message || m.audio || m.image || m.document)) {
                  const isFromMe = Boolean(m.fromMe);
                  const text = m.text?.message || m.body || m.caption || m.message || (m.image ? '📷 [Foto]' : m.audio ? '🎙️ [Áudio]' : m.document ? '📄 [Documento]' : '');
                  const timestamp = m.momment ? new Date(Number(m.momment)).toISOString() : (m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString());

                  if (cutoffMs > 0 && new Date(timestamp).getTime() < cutoffMs) return;

                  const mId = m.id || m.zaapId || m.messageId || `hist-bg-${cleanPhone}-${idx}-${Date.now()}`;
                  const mediaUrl = m.image?.imageUrl || m.audio?.audioUrl || m.document?.documentUrl;

                  newMessages.push({
                    id: mId,
                    tenantId,
                    conversationId: `conv-zapi-${cleanPhone}`,
                    senderType: isFromMe ? 'USER' : 'CONTACT',
                    senderName: isFromMe ? 'Corretor' : (chat.name || 'Cliente'),
                    messageType: m.audio ? 'AUDIO' : m.image ? 'IMAGE' : m.document ? 'DOCUMENT' : 'TEXT',
                    attachments: mediaUrl ? [{
                      id: `att-${mId}`,
                      url: mediaUrl,
                      fileName: m.document?.fileName || (m.image ? 'Foto.jpg' : 'Audio.ogg'),
                      fileSize: 1024,
                      mimeType: m.image ? 'image/jpeg' : m.audio ? 'audio/ogg' : 'application/pdf',
                    }] : undefined,
                    content: text,
                    status: 'DELIVERED',
                    isInternalNote: false,
                    timestamp,
                  });
                }
              });
            }
          }
        } catch {}
      })
    );

    // 4. Salva no Store Global do Servidor e Auto-sincroniza Deals no Funil
    const persisted = await writeCRMState(tenantId, {
      contacts: newContacts,
      conversations: newConversations,
      messages: newMessages,
    });
    await kickQualification(tenantId);

    await syncJobStore.updateJob(jobId, {
      status: keepPaging ? 'RUNNING' : 'COMPLETED',
      progress: keepPaging ? Math.min(95, page * 3) : 100,
      pagesScanned: page - 1,
      totalChatsFound: (previousJob?.totalChatsFound || 0) + totalRawScanned,
      contactsImported: (previousJob?.contactsImported || 0) + newContacts.length,
      currentStepText: keepPaging ? `Página ${page - 1} salva; aguardando próxima página...` : `Sincronização concluída: ${(previousJob?.contactsImported || 0) + newContacts.length} contatos.`,
      completedAt: keepPaging ? undefined : new Date().toISOString(),
      resultSummary: {
        totalContacts: newContacts.length,
        totalConversations: newConversations.length,
      },
      resultContacts: keepPaging ? [] : persisted.contacts,
      resultConversations: keepPaging ? [] : persisted.conversations,
      resultMessages: keepPaging ? [] : persisted.messages,
    });
  } catch (err: any) {
    console.error('[BackgroundSync] Falha no job:', err);
    await syncJobStore.updateJob(jobId, {
      status: 'FAILED',
      progress: 100,
      currentStepText: 'Falha durante o processamento em segundo plano.',
      error: err.message || 'Erro desconhecido na sincronização',
      completedAt: new Date().toISOString(),
    });
  }
}

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['BROKER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] });
  if (errorResponse) return errorResponse;
  try {
    const body = await req.json();
    if (body.tenantId && body.tenantId !== session!.tenantId && !session!.isSuperAdmin) return NextResponse.json({ error: 'Imobiliária não autorizada.' }, { status: 403 });
    const tenantId = session!.isSuperAdmin ? (body.tenantId || req.headers.get('x-tenant-id') || session!.tenantId) : session!.tenantId;
    const creds = await ZapiCredentialsService.resolveCredentials({ tenantId, instanceId: body.instanceId });
    const job = await syncJobStore.createJob(tenantId, { instanceId: creds.instanceId, assignedUserId: session!.userId,
      historyDays: Math.max(0, Number(body.historyDays) || 0), importMode: ['CHATS', 'PHONEBOOK', 'ALL'].includes(body.importMode) ? body.importMode : 'CHATS' });
    // O cliente avança o job por POST; nenhum trabalho fica solto depois da resposta HTTP.
    return NextResponse.json({ success: true, job }, { status: 202 });
  } catch { return NextResponse.json({ success: false, error: 'Não foi possível criar a sincronização. Verifique a conexão e o banco.' }, { status: 503 }); }
}

export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    const tenantId = session!.isSuperAdmin ? (req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id') || session!.tenantId) : session!.tenantId;
    const job = jobId ? await syncJobStore.getJob(jobId) : await syncJobStore.getActiveJobForTenant(tenantId);
    if (job && job.tenantId !== session!.tenantId && !session!.isSuperAdmin) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, job });
  } catch { return NextResponse.json({ success: false, error: 'Sincronização indisponível.' }, { status: 503 }); }
}

export async function PUT(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, { requiredRoles: ['BROKER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] });
  if (errorResponse) return errorResponse;
  try {
    const { jobId } = await req.json();
    const job = await syncJobStore.getJob(jobId);
    if (!job || (job.tenantId !== session!.tenantId && !session!.isSuperAdmin)) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 });
    if (await syncJobStore.claimJob(job.id)) {
      const creds = await ZapiCredentialsService.resolveCredentials({ tenantId: job.tenantId, instanceId: job.instanceId });
      try { await runBackgroundSyncWorker({ jobId: job.id, tenantId: job.tenantId, ...creds,
        historyDays: job.historyDays, assignedUserId: job.assignedUserId, importMode: job.importMode }); } finally { await syncJobStore.releaseJob(job.id); }
    }
    return NextResponse.json({ success: true, job: await syncJobStore.getJob(job.id) });
  } catch { return NextResponse.json({ success: false, error: 'Sincronização interrompida. O progresso salvo pode ser retomado.' }, { status: 503 }); }
}
