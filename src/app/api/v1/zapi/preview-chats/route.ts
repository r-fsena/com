import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/api-auth';
import { normalizePhoneNumber } from '@/lib/vcf-parser';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  let instanceId = process.env.ZAPI_INSTANCE_ID || '3F8144490C66805B4E3FD64A35E2F2DC';
  let instanceToken = process.env.ZAPI_INSTANCE_TOKEN || '550DBC07B2F984AB74E4BCE5';
  let securityToken = process.env.ZAPI_WEBHOOK_SECRET || process.env.ZAPI_CLIENT_TOKEN || 'Fc78d61c833db4b50864816b70766aee8S';
  let historyDays = 30; // Padrão: 30 dias

  try {
    const body = await req.json().catch(() => ({}));
    if (body.instanceId) instanceId = body.instanceId;
    if (body.token) instanceToken = body.token;
    if (body.clientToken) securityToken = body.clientToken;
    if (body.historyDays !== undefined) historyDays = Number(body.historyDays);
  } catch {}

  const cutoffMs = historyDays > 0 ? Date.now() - (historyDays * 24 * 60 * 60 * 1000) : 0;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': securityToken,
    };

    // Busca chats (páginas 1 a 3 = até 300 conversas), agenda de contatos e etiquetas do WhatsApp Business em paralelo
    const [chatResults, contactResults, labelsRes] = await Promise.all([
      Promise.allSettled(
        [1, 2, 3].map(page =>
          fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/chats?page=${page}&pageSize=100`, { headers })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      ),
      Promise.allSettled(
        [1, 2, 3].map(page =>
          fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/contacts?page=${page}&pageSize=100`, { headers })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      ),
      fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/labels`, { headers })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]);

    // Mapeamento de Etiquetas do WhatsApp Business
    const labelsMap = new Map<string, string>();
    if (Array.isArray(labelsRes)) {
      labelsRes.forEach((lbl: any) => {
        if (lbl && (lbl.name || lbl.labelName)) {
          const name = lbl.name || lbl.labelName;
          const id = String(lbl.id || lbl.labelId || name);
          labelsMap.set(id, name);
        }
      });
    }

    // Consolida lista de chats
    let rawChats: any[] = [];
    chatResults.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        rawChats.push(...res.value);
      }
    });

    // Mapeamento da agenda de contatos
    const contactsMap = new Map<string, { name: string; lid?: string }>();
    contactResults.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        res.value.forEach((cnt: any) => {
          if (!cnt) return;
          const raw = (cnt.phone || '').replace(/\D/g, '');
          const resolvedName = cnt.name || cnt.vname || cnt.short || cnt.notify;
          const lid = cnt.lid ? String(cnt.lid).replace(/@.*$/, '').replace(/\D/g, '') : undefined;
          if (raw && resolvedName) {
            contactsMap.set(raw, { name: resolvedName, lid });
          }
        });
      }
    });

    // Processamento e filtragem de chats individuais
    const previewList: any[] = [];
    const seenPhones = new Set<string>();

    for (const chat of rawChats) {
      if (!chat) continue;

      const chatIdStr = String(chat.phone || chat.id || '');
      // Ignora grupos do WhatsApp
      const isGroup = Boolean(chat.isGroup || chatIdStr.includes('@g.us') || chat.groupMetadata);
      if (isGroup) continue;

      let cleanPhone = (chat.phone || chat.id || '').replace(/@.*$/, '').replace(/\D/g, '');
      let lid = chat.lid ? String(chat.lid).replace(/@.*$/, '').replace(/\D/g, '') : undefined;

      // Se for LID puro (14+ dígitos iniciando com 13/14/26/90), busca se tem telefone na agenda
      if (cleanPhone.length >= 14 && (cleanPhone.startsWith('13') || cleanPhone.startsWith('14') || cleanPhone.startsWith('26') || cleanPhone.startsWith('90'))) {
        lid = cleanPhone;
        const agendaMatch = Array.from(contactsMap.entries()).find(([_, info]) => info.lid === lid);
        if (agendaMatch) {
          cleanPhone = agendaMatch[0];
        }
      }

      if (!cleanPhone || cleanPhone === '0') continue;

      // Normaliza para DDI 55 caso seja DDD + 8/9 dígitos
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }

      if (seenPhones.has(cleanPhone)) continue;
      seenPhones.add(cleanPhone);

      // Checa data da última mensagem em relação ao período filtrado
      let lastMsgTime = chat.lastMessageTime || chat.updatedAt || chat.timestamp;
      let timestampMs = 0;
      if (typeof lastMsgTime === 'number') {
        timestampMs = lastMsgTime < 1e12 ? lastMsgTime * 1000 : lastMsgTime;
      } else if (typeof lastMsgTime === 'string') {
        timestampMs = new Date(lastMsgTime).getTime();
      }

      if (cutoffMs > 0 && timestampMs > 0 && timestampMs < cutoffMs) {
        continue; // Ignora conversas inativas anteriores ao período
      }

      const agendaEntry = contactsMap.get(cleanPhone);
      const rawName = agendaEntry?.name || chat.name || chat.pushName || chat.shortName || '';
      const hasRealName = Boolean(rawName && !rawName.startsWith('+') && !rawName.startsWith('WhatsApp') && rawName !== 'Cliente');
      const { display } = normalizePhoneNumber(cleanPhone);

      // Extrai etiquetas/tags do WhatsApp associadas à conversa
      const rawLabels = chat.labels || chat.labelIds || chat.tags || [];
      const resolvedLabels: string[] = [];
      if (Array.isArray(rawLabels)) {
        rawLabels.forEach((l: any) => {
          if (typeof l === 'string' || typeof l === 'number') {
            const mapped = labelsMap.get(String(l));
            if (mapped && !resolvedLabels.includes(mapped)) resolvedLabels.push(mapped);
            else if (typeof l === 'string' && isNaN(Number(l)) && !resolvedLabels.includes(l)) resolvedLabels.push(l);
          } else if (l && typeof l === 'object' && (l.name || l.labelName)) {
            const n = l.name || l.labelName;
            if (!resolvedLabels.includes(n)) resolvedLabels.push(n);
          }
        });
      }

      previewList.push({
        id: cleanPhone,
        phone: cleanPhone,
        phoneDisplay: display,
        lid: lid || agendaEntry?.lid,
        name: hasRealName ? rawName : `WhatsApp ${cleanPhone.slice(-4)}`,
        hasRealName,
        avatarUrl: chat.profilePictureUrl || chat.photo || chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(hasRealName ? rawName : 'Cliente')}&background=059669&color=fff`,
        lastMessagePreview: chat.lastMessage || chat.snippet || 'Mensagem recente',
        lastMessageTimestamp: timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date().toISOString(),
        unreadCount: Number(chat.unreadCount || 0),
        isGroup: false,
        whatsappLabels: resolvedLabels,
      });
    }

    // Ordena pelo timestamp mais recente
    previewList.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());

    return NextResponse.json({
      success: true,
      chats: previewList,
      totalFound: previewList.length,
      availableLabels: Array.from(labelsMap.values()),
      historyDays,
    });
  } catch (error: any) {
    console.error('Erro ao buscar preview de chats da Z-API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao buscar pré-visualização de conversas do WhatsApp',
    }, { status: 500 });
  }
}
