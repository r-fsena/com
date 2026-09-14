import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Converte de forma resiliente qualquer formato de timestamp do WhatsApp
 * (milissegundos numéricos, segundos unix, ISO 8601, pt-BR "DD/MM/AAAA, HH:mm", "HH:mm, DD/MM", relativos, etc.)
 * para milissegundos numéricos legítimos sem distorções de fuso e sem inversão de mês/dia pelo V8.
 */
export function parseWhatsAppTimestamp(raw: any, fallbackMs: number = 0): number {
  if (!raw) return fallbackMs;
  if (typeof raw === 'number') {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw !== 'string') return fallbackMs;

  const trimmed = raw.replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, ' ').trim();
  if (!trimmed) return fallbackMs;

  // Se for puramente dígitos numéricos
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return num < 1e12 ? num * 1000 : num;
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // 1. ISO 8601 padrão: 2024-01-13T14:32:00.000Z ou 2024-01-13
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      // Proteção rigorosa contra anos no futuro (ex: 2029)
      if (dt.getFullYear() > currentYear) {
        dt.setFullYear(currentYear);
      }
      // Se a data deste ano ainda está no futuro em relação a agora (ex: novembro gravado erroneamente em 2026),
      // corrige para o ano anterior (novembro de 2025)
      if (dt.getTime() > now.getTime() + 86400000) {
        dt.setFullYear(dt.getFullYear() - 1);
      }
      return dt.getTime();
    }
  }

  // 2. Formatos relativos: "Hoje, 14:32", "14:32, Hoje", "Ontem, 14:32", "14:32, Ontem" ou apenas "Hoje"/"Ontem"
  const relMatch = trimmed.match(/^(ontem|yesterday|hoje|today)(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i) ||
                   trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?[,\s]+(ontem|yesterday|hoje|today)$/i);
  if (relMatch) {
    const isFirstWord = isNaN(Number(relMatch[1]));
    const word = (isFirstWord ? relMatch[1] : relMatch[4]).toLowerCase();
    const h = isFirstWord ? (relMatch[2] ? Number(relMatch[2]) : 12) : Number(relMatch[1]);
    const m = isFirstWord ? (relMatch[3] ? Number(relMatch[3]) : 0) : Number(relMatch[2]);
    const s = isFirstWord ? (relMatch[4] ? Number(relMatch[4]) : 0) : (relMatch[3] ? Number(relMatch[3]) : 0);

    const d = new Date(now);
    if (word === 'ontem' || word === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(h, m, s, 0);
    return d.getTime();
  }

  // 3. Formato BR com DATA PRIMEIRO: "13/01/2024, 14:32", "13/01/24 14:32", "13/01/2024", "13/01/24", "13/01"
  const dateFirstMatch = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dateFirstMatch) {
    const day = Number(dateFirstMatch[1]);
    const month = Number(dateFirstMatch[2]) - 1;
    let year = dateFirstMatch[3] ? Number(dateFirstMatch[3]) : currentYear;
    if (year < 100) year += 2000;
    if (year > currentYear) year = currentYear; // Trava anos futuros como 2029

    const hours = dateFirstMatch[4] ? Number(dateFirstMatch[4]) : 12;
    const minutes = dateFirstMatch[5] ? Number(dateFirstMatch[5]) : 0;
    const seconds = dateFirstMatch[6] ? Number(dateFirstMatch[6]) : 0;

    let dt = new Date(year, month, day, hours, minutes, seconds);
    // Se não tinha ano explícito e a data resultante está no futuro (ex: 15/11 quando hoje é setembro),
    // pertence obrigatoriamente ao ano anterior (ex: novembro do ano passado)
    if (!dateFirstMatch[3] && dt.getTime() > now.getTime() + 60000) {
      year = currentYear - 1;
      dt = new Date(year, month, day, hours, minutes, seconds);
    }
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  // 4. Formato BR com HORA PRIMEIRO: "14:32, 13/01/2024", "14:32, 13/01/24", "14:32, 13/01"
  const timeFirstMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?[,\s]+(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?$/);
  if (timeFirstMatch) {
    const hours = Number(timeFirstMatch[1]);
    const minutes = Number(timeFirstMatch[2]);
    const seconds = timeFirstMatch[3] ? Number(timeFirstMatch[3]) : 0;
    const day = Number(timeFirstMatch[4]);
    const month = Number(timeFirstMatch[5]) - 1;
    let year = timeFirstMatch[6] ? Number(timeFirstMatch[6]) : currentYear;
    if (year < 100) year += 2000;
    if (year > currentYear) year = currentYear; // Trava anos futuros como 2029

    let dt = new Date(year, month, day, hours, minutes, seconds);
    if (!timeFirstMatch[6] && dt.getTime() > now.getTime() + 60000) {
      year = currentYear - 1;
      dt = new Date(year, month, day, hours, minutes, seconds);
    }
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  // 5. Formato com nome de mês em português: "13 de janeiro de 2024", "13 de jan", etc.
  const ptMonths: Record<string, number> = {
    'JAN': 0, 'JANEIRO': 0, 'FEV': 1, 'FEVEREIRO': 1, 'MAR': 2, 'MARÇO': 2, 'MARCO': 2,
    'ABR': 3, 'ABRIL': 3, 'MAI': 4, 'MAIO': 4, 'JUN': 5, 'JUNHO': 5,
    'JUL': 6, 'JULHO': 6, 'AGO': 7, 'AGOSTO': 7, 'SET': 8, 'SETEMBRO': 8,
    'OUT': 9, 'OUTUBRO': 9, 'NOV': 10, 'NOVEMBRO': 10, 'DEZ': 11, 'DEZEMBRO': 11
  };
  const ptExtMatch = trimmed.match(/(\d{1,2})\s+DE\s+([A-ZÇ]+)\.?(?:\s+DE\s+(\d{2,4}))?(?:[,\s]+(\d{1,2}):(\d{2}))?/i);
  if (ptExtMatch) {
    const day = Number(ptExtMatch[1]);
    const mStr = ptExtMatch[2].toUpperCase();
    const month = ptMonths[mStr] !== undefined ? ptMonths[mStr] : 0;
    let year = ptExtMatch[3] ? Number(ptExtMatch[3]) : currentYear;
    if (year < 100) year += 2000;
    if (year > currentYear) year = currentYear;

    const hours = ptExtMatch[4] ? Number(ptExtMatch[4]) : 12;
    const minutes = ptExtMatch[5] ? Number(ptExtMatch[5]) : 0;

    let dt = new Date(year, month, day, hours, minutes, 0);
    if (!ptExtMatch[3] && dt.getTime() > now.getTime() + 60000) {
      year = currentYear - 1;
      dt = new Date(year, month, day, hours, minutes, 0);
    }
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  // 6. Apenas Horário: "14:32" ou "14:32:00"
  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const d = new Date(now);
    d.setHours(Number(timeOnly[1]), Number(timeOnly[2]), timeOnly[3] ? Number(timeOnly[3]) : 0, 0);
    return d.getTime();
  }

  return fallbackMs;
}

/**
 * Formatação inteligente de data estilo WhatsApp para a lista de conversas do Inbox:
 * - Se a mensagem foi hoje: "14:32"
 * - Se foi ontem: "Ontem"
 * - Qualquer outra data: Exibe sempre DD/MM/AAAA com 4 dígitos (ex: "15/11/2025", "25/08/2026")
 *   garantindo que o ano nunca fique oculto ou ambíguo.
 */
export function formatWhatsAppDate(dateStr: any): string {
  if (!dateStr) return '';
  try {
    const ms = parseWhatsAppTimestamp(dateStr);
    if (!ms || ms <= 0) return '';
    const date = new Date(ms);
    const now = new Date();

    const isToday = 
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return format(date, 'HH:mm', { locale: ptBR });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = 
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Ontem';
    }

    // Retorna DD/MM/AAAA com 4 dígitos completos
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '';
  }
}

export function safeFormatDate(dateStr: any, formatPattern: string = 'HH:mm'): string {
  if (!dateStr) return '--:--';
  try {
    const ms = parseWhatsAppTimestamp(dateStr);
    if (!ms || ms <= 0) return '--:--';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '--:--';
    return format(d, formatPattern, { locale: ptBR });
  } catch {
    return '--:--';
  }
}
