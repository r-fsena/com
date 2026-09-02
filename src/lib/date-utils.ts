import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Converte de forma resiliente qualquer formato de timestamp retornado pela Z-API / WhatsApp
 * (número, string de milissegundos, segundos unix, ou ISO string) para milissegundos numéricos.
 */
export function parseWhatsAppTimestamp(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === 'number') {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return num < 1e12 ? num * 1000 : num;
    }
    const parsed = new Date(trimmed).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Formatação inteligente de data estilo WhatsApp para a lista de conversas do Inbox:
 * - Se a mensagem foi hoje: "14:32"
 * - Se foi ontem: "Ontem"
 * - Se foi nos últimos 6 dias: dia da semana ("seg", "ter", etc.)
 * - Se foi anterior neste ano: "25/08"
 * - Se for de anos anteriores: "25/08/23"
 */
export function formatWhatsAppDate(dateStr: any): string {
  if (!dateStr) return '';
  try {
    const ms = parseWhatsAppTimestamp(dateStr);
    if (!ms) return '';
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

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 2 && diffDays <= 6) {
      const weekday = format(date, 'EEE', { locale: ptBR }).replace('.', '');
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }

    // Mesmo ano: dd/MM (ex: 25/08)
    if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'dd/MM', { locale: ptBR });
    }

    // Outros anos: dd/MM/yy
    return format(date, 'dd/MM/yy', { locale: ptBR });
  } catch {
    return '';
  }
}

export function safeFormatDate(dateStr: any, formatPattern: string = 'HH:mm'): string {
  if (!dateStr) return '--:--';
  try {
    const ms = parseWhatsAppTimestamp(dateStr);
    if (!ms) return '--:--';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '--:--';
    return format(d, formatPattern, { locale: ptBR });
  } catch {
    return '--:--';
  }
}
