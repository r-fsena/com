import { Contact } from '@/types/crm';

/**
 * Utilitário de Governança e Auditoria LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018)
 * Implementa mascaramento de PII, registro de consentimento, portabilidade e direito ao esquecimento.
 */

export interface LGPDAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: 'DATA_ACCESS' | 'DATA_EXPORT' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED' | 'DATA_ANONYMIZED' | 'DATA_DELETED';
  contactId?: string;
  contactNameMasked?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
}

// Armazenamento em memória com limite de retenção para auditoria
const lgpdAuditStore: LGPDAuditLog[] = [];

/**
 * Mascaramento de Dados Pessoais Sensíveis (PII)
 */
export function maskPii(value: string | number | undefined | null, type: 'CPF' | 'PHONE' | 'EMAIL' | 'INCOME' | 'NAME'): string {
  if (!value) return '';
  const str = String(value).trim();

  switch (type) {
    case 'CPF':
      // Ex: 123.***.***-90
      const digitsCpf = str.replace(/\D/g, '');
      if (digitsCpf.length === 11) {
        return `${digitsCpf.slice(0, 3)}.***.***-${digitsCpf.slice(-2)}`;
      }
      return '***.***.***-**';

    case 'PHONE':
      // Ex: +55 11 9****-1234
      const digitsPhone = str.replace(/\D/g, '');
      if (digitsPhone.length >= 10) {
        return `+55 (${digitsPhone.slice(-11, -9)}) 9****-${digitsPhone.slice(-4)}`;
      }
      return '****-****';

    case 'EMAIL':
      // Ex: r***@domain.com
      const parts = str.split('@');
      if (parts.length === 2) {
        const name = parts[0];
        const maskedName = name.length > 2 ? `${name[0]}***${name.slice(-1)}` : `${name[0]}***`;
        return `${maskedName}@${parts[1]}`;
      }
      return '***@***.com';

    case 'INCOME':
      // Ex: R$ **.***,00 (Oculta valor exato para proteção financeira)
      return 'R$ [CONFIDENCIAL]';

    case 'NAME':
      const names = str.split(' ');
      if (names.length > 1) {
        return `${names[0]} ${names[names.length - 1][0]}.`;
      }
      return names[0];

    default:
      return '***';
  }
}

/**
 * Registra evento no Log de Auditoria LGPD
 */
export function recordLgpdAuditLog(entry: Omit<LGPDAuditLog, 'id' | 'timestamp'>): LGPDAuditLog {
  const log: LGPDAuditLog = {
    id: `lgpd-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    ...entry,
    timestamp: new Date().toISOString(),
  };

  lgpdAuditStore.unshift(log);

  // Mantém histórico recente em memória (até 500 registros)
  if (lgpdAuditStore.length > 500) {
    lgpdAuditStore.pop();
  }

  return log;
}

/**
 * Obtém logs de auditoria filtrados por tenant
 */
export function getLgpdAuditLogs(tenantId: string): LGPDAuditLog[] {
  return lgpdAuditStore.filter(l => l.tenantId === tenantId);
}

/**
 * Anonimiza dados de um Contato / Lead (Direito ao Esquecimento - Art. 18, VI LGPD)
 */
export function anonymizeContact(contact: Contact): Contact {
  const anonId = `anon-${Date.now().toString().slice(-4)}`;
  return {
    ...contact,
    name: `Titular Anonimizado (${anonId})`,
    phone: `+5500000000000`,
    email: `anonimizado-${anonId}@privacidade.local`,
    avatarUrl: undefined,
    monthlyIncome: undefined,
    downPaymentAvailable: undefined,
    maxPropertyValue: undefined,
    targetRegions: [],
    presentedProperties: [],
    tags: ['LGPD Anonimizado', 'Opt-out'],
    hasOptedOut: true,
    consentGiven: false,
    consentDate: undefined,
    updatedAt: new Date().toISOString(),
  };
}
