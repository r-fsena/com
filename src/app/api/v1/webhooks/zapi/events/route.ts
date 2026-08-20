import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get('since') || '0');

  const messages = since > 0 
    ? webhookStore.getMessagesSince(since)
    : webhookStore.getAllMessages();

  return NextResponse.json({
    success: true,
    count: messages.length,
    messages,
    serverTime: Date.now(),
  });
}
