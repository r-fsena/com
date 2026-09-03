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

/**
 * Normaliza qualquer telefone brasileiro ou internacional para uma chave canônica:
 * - Remove caracteres especiais e máscaras
 * - Remove DDI 55
 * - Padroniza celulares brasileiros (adicionando o 9º dígito se tiver 10 dígitos)
 * Ex: '554898379087' -> '48998379087'
 * Ex: '5548998379087' -> '48998379087'
 * Ex: '+55 (48) 9837-9087' -> '48998379087'
 */
export function canonicalPhoneKey(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Remove DDI 55 se presente no início com pelo menos 12 dígitos
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Se tem 10 dígitos (DDD + 8 dígitos móvel), insere o 9º dígito para padronizar sempre em 11 dígitos
  if (digits.length === 10) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }

  return digits;
}

/**
 * Compara dois telefones/identificadores e determina se representam a mesma pessoa:
 * - Suporta número com ou sem o 9º dígito (ex: 554898379087 == 5548998379087)
 * - Suporta números com máscaras, parênteses e espaços
 * - Compara os últimos 8 dígitos quando o DDD é o mesmo
 * - Trata sufixos e equivalências
 */
export function arePhonesEquivalent(phoneA: string | undefined | null, phoneB: string | undefined | null): boolean {
  if (!phoneA || !phoneB) return false;

  const keyA = canonicalPhoneKey(phoneA);
  const keyB = canonicalPhoneKey(phoneB);

  if (keyA && keyB && keyA === keyB) return true;

  const digitsA = String(phoneA).replace(/\D/g, '');
  const digitsB = String(phoneB).replace(/\D/g, '');

  if (!digitsA || !digitsB) return false;
  if (digitsA === digitsB) return true;

  // Compara últimos 8 dígitos se ambos tiverem ao menos 8 dígitos
  const last8A = digitsA.slice(-8);
  const last8B = digitsB.slice(-8);

  if (last8A.length === 8 && last8A === last8B) {
    const dddA = digitsA.length >= 10 ? (digitsA.startsWith('55') ? digitsA.slice(2, 4) : digitsA.slice(0, 2)) : '';
    const dddB = digitsB.length >= 10 ? (digitsB.startsWith('55') ? digitsB.slice(2, 4) : digitsB.slice(0, 2)) : '';
    if (dddA && dddB) return dddA === dddB;
    return true;
  }

  return digitsA.endsWith(digitsB) || digitsB.endsWith(digitsA);
}
