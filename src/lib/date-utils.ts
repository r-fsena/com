import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function safeFormatDate(dateStr: any, formatPattern: string = 'HH:mm'): string {
  if (!dateStr) return '--:--';
  try {
    const timestamp = typeof dateStr === 'number' ? dateStr : isNaN(Number(dateStr)) ? dateStr : Number(dateStr);
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '--:--';
    return format(d, formatPattern, { locale: ptBR });
  } catch {
    return '--:--';
  }
}
