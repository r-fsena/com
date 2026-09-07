import { NextRequest, NextResponse } from 'next/server';
import { recordExtensionLog, getExtensionLogs, ExtensionLogEntry } from '@/lib/cloudwatch-logger';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Rate limiting (Máx 120 logs/min por IP)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`ext-logs:${clientIp}`, 120, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({ success: false, error: 'Rate limit excedido para logs' }, { status: 429 });
  }

  // Validação de Sessão ou Token de Extensão
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const entry: ExtensionLogEntry = {
      timestamp: body.timestamp || Date.now(),
      level: body.level || 'INFO',
      event: body.event || 'UNKNOWN_EVENT',
      tenantId: body.tenantId,
      brokerName: body.brokerName,
      contactName: body.contactName,
      phone: body.phone,
      messagesCount: body.messagesCount,
      details: body.details,
    };

    await recordExtensionLog(entry);

    return NextResponse.json({ success: true, recorded: entry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Apenas Administradores podem consultar logs brutos de telemetria
  const { session, errorResponse } = validateApiSession(req, { requireSuperAdmin: true });
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 50);
  const logs = getExtensionLogs(limit);

  return NextResponse.json({
    success: true,
    count: logs.length,
    logs,
  });
}
