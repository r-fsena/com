import { NextRequest, NextResponse } from 'next/server';
import { processZapiWebhookRequest } from '@/lib/zapi-webhook-handler';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  return processZapiWebhookRequest(request, { tenantId: params.tenantId });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  return NextResponse.json({
    status: 'ACTIVE',
    endpoint: `/api/v1/webhooks/zapi/${params.tenantId}`,
    ready: true,
  });
}
