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

  const isLidA = isLidIdentifier(phoneA);
  const isLidB = isLidIdentifier(phoneB);

  // Se um é LID e o outro não, não são o mesmo telefone a menos que já estejam associados
  if (isLidA !== isLidB) return false;
  if (isLidA && isLidB) {
    return cleanLid(phoneA) === cleanLid(phoneB);
  }

  const keyA = canonicalPhoneKey(phoneA);
  const keyB = canonicalPhoneKey(phoneB);

  if (keyA && keyB && keyA === keyB) return true;

  const digitsA = String(phoneA).replace(/\D/g, '');
  const digitsB = String(phoneB).replace(/\D/g, '');

  if (!digitsA || !digitsB) return false;
  if (digitsA === digitsB) return true;

  // Ambos devem ter ao menos 8 dígitos para comparação de telefone
  if (digitsA.length < 8 || digitsB.length < 8) return false;

  // Compara últimos 8 dígitos quando ambos possuem ao menos 8 dígitos
  const last8A = digitsA.slice(-8);
  const last8B = digitsB.slice(-8);

  if (last8A === last8B) {
    const dddA = digitsA.length >= 10 ? (digitsA.startsWith('55') ? digitsA.slice(2, 4) : digitsA.slice(0, 2)) : '';
    const dddB = digitsB.length >= 10 ? (digitsB.startsWith('55') ? digitsB.slice(2, 4) : digitsB.slice(0, 2)) : '';
    if (dddA && dddB) return dddA === dddB;
    return true;
  }

  return false;
}

/**
 * Detecta se o conteúdo de uma mensagem é um aviso de sistema/segurança do WhatsApp
 * (ex: criptografia de ponta a ponta, mensagens temporárias, alteração de código de segurança, aviso de conta comercial).
 * Essas mensagens não devem ser salvas nem exibidas nas conversas do CRM.
 */
export function isWhatsAppSystemMessage(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // 1. Aviso de criptografia de ponta a ponta (PT, EN, ES)
  if (
    lower.includes('criptografia de ponta a ponta') ||
    lower.includes('end-to-end encrypt') ||
    lower.includes('cifrado de extremo a extremo') ||
    lower.includes('somente as pessoas que fazem parte da conversa') ||
    (lower.includes('mensagens e ligações') && lower.includes('protegidas')) ||
    (lower.includes('mensagens e ligacoes') && lower.includes('protegidas')) ||
    (lower.includes('mensagens e chamadas') && lower.includes('protegidas')) ||
    (lower.includes('messages and calls') && lower.includes('encrypted')) ||
    (lower.includes('clique para saber mais') && (lower.includes('cripto') || lower.includes('protegid') || lower.includes('conversa'))) ||
    lower.includes('protegidas com a criptografia') ||
    lower.includes('ninguém fora desta conversa') ||
    lower.includes('ninguem fora desta conversa') ||
    lower.includes('no one outside of this chat')
  ) {
    return true;
  }

  // 2. Mensagens temporárias ativadas/desativadas
  if (
    lower.includes('mensagens temporárias') ||
    lower.includes('mensagens temporarias') ||
    lower.includes('disappearing messages') ||
    lower.includes('mensajes temporales')
  ) {
    return true;
  }

  // 3. Alteração de código de segurança
  if (
    lower.includes('código de segurança') ||
    lower.includes('codigo de seguranca') ||
    lower.includes('security code changed') ||
    lower.includes('código de seguridad') ||
    lower.includes('codigo de seguridad')
  ) {
    return true;
  }

  // 4. Avisos de conta comercial / Meta AI
  if (
    lower.includes('conta comercial oficial') ||
    (lower.includes('esta conversa é com') && lower.includes('conta comercial')) ||
    (lower.includes('esta conversa e com') && lower.includes('conta comercial')) ||
    lower.includes('official business account') ||
    lower.includes('esta empresa usa o serviço seguro da meta') ||
    lower.includes('esta empresa usa o servico seguro da meta')
  ) {
    return true;
  }

  // 5. Avisos de bloqueio / desbloqueio
  if (
    lower.includes('você bloqueou este contato') ||
    lower.includes('voce bloqueou este contato') ||
    lower.includes('você desbloqueou este contato') ||
    lower.includes('voce desbloqueou este contato') ||
    lower.includes('you blocked this contact')
  ) {
    return true;
  }

  return false;
}

/**
 * Detecta se uma string ou identificador representa um WhatsApp Linked Identity (LID).
 * Identifica tanto o sufixo '@lid' quanto sequências numéricas de 14+ dígitos fora do padrão E.164.
 */
export function isLidIdentifier(val: string | undefined | null): boolean {
  if (!val) return false;
  const str = String(val).trim().toLowerCase();
  if (str.includes('@lid') || str.includes('_lid')) return true;

  const digits = str.replace(/\D/g, '');
  // Telefones brasileiros têm no máximo 13 dígitos (55 + 2 DDD + 9 dígitos).
  // LIDs do WhatsApp Multi-Device têm 14 a 18 dígitos.
  if (digits.length >= 14) {
    return true;
  }
  return false;
}

/**
 * Extrai apenas os dígitos limpos do WhatsApp LID.
 */
export function cleanLid(val: string | undefined | null): string {
  if (!val) return '';
  return String(val).replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * Formata um número de telefone com máscara visual padrão brasileira (+55 (DD) 9XXXX-XXXX).
 */
export function formatCanonicalPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  if (isLidIdentifier(digits)) {
    return `LID ${digits}`;
  }

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `+55 (${digits.slice(0, 2)}) 9${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `+${digits}`;
}
