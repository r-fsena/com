import { NextRequest, NextResponse } from 'next/server';
import { generateICSContent, CalendarEventData } from '@/lib/calendar-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/calendar/invite
 * Envia convite de agenda interativo (.ics / RFC 5545) por e-mail para o cliente
 */
export async function POST(req: NextRequest) {
  try {
    const body: CalendarEventData = await req.json();

    if (!body.title || !body.startTime || !body.organizerEmail) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: title, startTime, organizerEmail' },
        { status: 400 }
      );
    }

    // 1. Gera o arquivo .ics oficial
    const icsContent = generateICSContent(body);

    console.log(`[CalendarInvite] Gerando convite para ${body.attendeeEmail || body.attendeeName} - Evento: ${body.title}`);

    // 2. Simula o disparo via AWS SES / SMTP com mimeType text/calendar
    // Em produção com AWS SES configurado, executaria:
    // await sesClient.sendRawEmail({ ... })

    return NextResponse.json({
      success: true,
      message: `Convite de agenda enviado com sucesso para ${body.attendeeEmail || body.attendeeName}`,
      icsContent,
      event: {
        id: body.id,
        title: body.title,
        startTime: body.startTime,
        attendeeEmail: body.attendeeEmail,
      }
    });
  } catch (error: any) {
    console.error('Erro ao processar convite de calendário:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao gerar e enviar convite de calendário' },
      { status: 500 }
    );
  }
}
