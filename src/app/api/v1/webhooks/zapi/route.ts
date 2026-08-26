import { NextRequest, NextResponse } from 'next/server';
import { processZapiWebhookRequest } from '@/lib/zapi-webhook-handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return processZapiWebhookRequest(request);
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ACTIVE',
    endpoint: `/api/v1/webhooks/zapi`,
    ready: true,
  });
}
