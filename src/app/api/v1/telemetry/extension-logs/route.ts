import { NextRequest, NextResponse } from 'next/server';
import { recordExtensionLog, getExtensionLogs, ExtensionLogEntry } from '@/lib/cloudwatch-logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 50);
  const logs = getExtensionLogs(limit);

  return NextResponse.json({
    success: true,
    count: logs.length,
    logs,
  });
}
