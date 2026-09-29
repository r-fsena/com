import { NextRequest, NextResponse } from 'next/server';
import { processZapiWebhookRequest } from '@/lib/zapi-webhook-handler';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string; instanceId: string } }
) {
  return processZapiWebhookRequest(request, params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { tenantId: string; instanceId: string } }
) {
  return processZapiWebhookRequest(request, params);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; instanceId: string } }
) {
  return NextResponse.json({
    status: 'ACTIVE',
    endpoint: `/api/v1/webhooks/zapi/${params.tenantId}/${params.instanceId}`,
    ready: true,
  });
}
