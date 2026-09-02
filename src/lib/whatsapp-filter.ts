import { parseWhatsAppTimestamp } from './date-utils';

/**
 * Utilitário central de filtragem para canais do WhatsApp (Channels / Newsletters),
 * grupos (@g.us), status/stories (@broadcast) e contatos inválidos.
 * Garante que apenas conversas diretas 1:1 com leads/clientes entrem no CRM e no Inbox.
 */
export function isWhatsAppChannelOrGroup(target: {
  phone?: string;
  id?: string;
  chatId?: string;
  lid?: string;
  name?: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
  isChannel?: boolean;
  isGroupAnnouncement?: boolean;
  groupMetadata?: any;
}): boolean {
  if (!target) return true;

  // 1. Flags explícitas da Z-API / WhatsApp
  if (
    target.isGroup === true || 
    target.isNewsletter === true || 
    target.isChannel === true || 
    target.isGroupAnnouncement === true || 
    Boolean(target.groupMetadata)
  ) {
    return true;
  }

  const rawCombined = `${target.phone || ''} ${target.id || ''} ${target.chatId || ''} ${target.lid || ''}`.toLowerCase();

  // 2. Canais de Notícias / Transmissão do WhatsApp (Newsletters)
  if (rawCombined.includes('@newsletter') || rawCombined.includes('newsletter')) {
    return true;
  }

  // 3. Grupos e Comunidades (@g.us ou sufixo -group)
  if (rawCombined.includes('@g.us') || rawCombined.includes('-group')) {
    return true;
  }

  // 4. Status e Transmissões em Massa
  if (rawCombined.includes('@broadcast') || rawCombined.includes('status@broadcast')) {
    return true;
  }

  // 5. IDs gerados pela Meta para canais e grupos (ex: 120363404701403742)
  const phoneDigits = (target.phone || '').replace(/\D/g, '');
  const idDigits = (target.id || '').replace(/\D/g, '');

  if (phoneDigits.startsWith('120363') && phoneDigits.length >= 15) {
    return true;
  }

  if (idDigits.startsWith('120363') && idDigits.length >= 15) {
    return true;
  }

  // 6. Números nulos, "0" ou incompletos
  if (phoneDigits === '0' || (phoneDigits.length > 0 && phoneDigits.length < 8)) {
    return true;
  }

  return false;
}

/**
 * Valida se um chat retornado pela Z-API é uma conversa 1:1 REAL e ATIVA (com mensagens trocadas).
 * Rejeita contatos salvos na agenda do celular que NUNCA trocaram mensagem no WhatsApp (lastMessageTime === '0' ou 0).
 */
export function isRealWhatsAppConversation(target: any): boolean {
  if (!target) return false;

  // Se for grupo, canal ou newsletter, rejeita
  if (isWhatsAppChannelOrGroup(target)) return false;

  // Rejeita telefones vazios ou do sistema
  const rawPhone = String(target.phone || target.id || target.chatId || '').replace(/\D/g, '');
  if (!rawPhone || rawPhone === '0' || rawPhone.length < 8) return false;

  // Checa timestamp da última mensagem
  const lastTime = target.lastMessageTime ?? target.timestamp ?? target.updatedAt;
  if (lastTime === '0' || lastTime === 0 || !lastTime) {
    return false; // Contato apenas salvo na agenda do celular, sem nenhuma mensagem no WhatsApp
  }

  const ms = parseWhatsAppTimestamp(lastTime);
  if (!ms || ms <= 0) {
    return false;
  }

  return true;
}
