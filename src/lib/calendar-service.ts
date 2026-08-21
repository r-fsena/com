/**
 * Serviço de Geração de Convites de Calendário (.ICS / Google Calendar / Outlook / WhatsApp)
 * Padrão RFC 5545 iCalendar para integração universal com Gmail, Apple Calendar e Outlook
 */

export interface CalendarEventData {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date | string;
  durationMinutes?: number;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail?: string;
  attendeePhone?: string;
}

/**
 * Formata data no padrão UTC iCalendar (YYYYMMDDTHHMMSSZ)
 */
export function formatToICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Gera arquivo .ics no padrão RFC 5545 com METHOD: REQUEST
 * Isso faz com que Gmail, iPhone e Outlook mostrem botões de aceite (Sim / Não / Talvez)
 */
export function generateICSContent(event: CalendarEventData): string {
  const start = new Date(event.startTime);
  const duration = event.durationMinutes || 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const now = new Date();

  const uid = `invite-${event.id}-${Date.now()}@crm.faithhubs.com`;
  const cleanSummary = (event.title || 'Visita ao Imóvel').replace(/\n/g, ' ');
  const cleanDescription = (event.description || `Visita agendada com ${event.organizerName} pelo Vanguard CRM.`)
    .replace(/\n/g, '\\n');
  const cleanLocation = (event.location || 'A combinar com o corretor').replace(/\n/g, ' ');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vanguard CRM//Agenda Imobiliaria//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatToICSDate(now)}`,
    `DTSTART:${formatToICSDate(start)}`,
    `DTEND:${formatToICSDate(end)}`,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${cleanLocation}`,
    `ORGANIZER;CN="${event.organizerName}":mailto:${event.organizerEmail}`,
    event.attendeeEmail ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${event.attendeeName}":mailto:${event.attendeeEmail}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'PRIORITY:5',
    'CLASS:PUBLIC',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete de Visita ao Imóvel em 30 minutos',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return icsLines.join('\r\n');
}

/**
 * Gera link de 1 clique para Adicionar ao Google Calendar
 */
export function generateGoogleCalendarUrl(event: CalendarEventData): string {
  const start = new Date(event.startTime);
  const duration = event.durationMinutes || 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const startFormatted = formatToICSDate(start);
  const endFormatted = formatToICSDate(end);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startFormatted}/${endFormatted}`,
    details: `${event.description || 'Visita agendada pelo Vanguard CRM.'}\n\nCorretor: ${event.organizerName} (${event.organizerEmail})`,
    location: event.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Gera link de 1 clique para Adicionar ao Outlook Calendar
 */
export function generateOutlookCalendarUrl(event: CalendarEventData): string {
  const start = new Date(event.startTime);
  const duration = event.durationMinutes || 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: `${event.description || ''}\n\nCorretor: ${event.organizerName}`,
    location: event.location || '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Monta a mensagem formatada para envio direto no WhatsApp com link de 1-clique
 */
export function generateWhatsAppInviteMessage(event: CalendarEventData): string {
  const start = new Date(event.startTime);
  const dateFormatted = start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeFormatted = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const googleLink = generateGoogleCalendarUrl(event);

  return `📅 *Convite de Agendamento • Vanguard Prime*

Olá *${event.attendeeName}*, seu agendamento foi confirmado com sucesso!

🏠 *Compromisso:* ${event.title}
🗓️ *Data:* ${dateFormatted} às ${timeFormatted}
📍 *Local:* ${event.location || 'A combinar'}
👤 *Corretor Responsável:* ${event.organizerName}

👉 *Adicione à sua agenda com 1 clique:*
🔗 ${googleLink}

_Nos vemos lá! Qualquer dúvida ou alteração de horário, é só me responder por aqui._`;
}

/**
 * Dispara o download do arquivo .ics no navegador
 */
export function downloadICSFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
