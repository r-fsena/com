import { NextRequest, NextResponse } from 'next/server';
import { webhookStore } from '@/lib/webhook-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { session, errorResponse } = validateApiSession(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get('since') || '0');
  const targetTenantId = session?.isSuperAdmin 
    ? (searchParams.get('tenantId') || session.tenantId) 
    : session?.tenantId || 'tenant-amabile-barbarotti';

  const allMessages = since > 0 
    ? webhookStore.getMessagesSince(since)
    : webhookStore.getAllMessages();

  // Filtra estritamente pelo tenant autorizado do usuário
  const messages = allMessages.filter(m => !m.tenantId || m.tenantId === targetTenantId);

  return NextResponse.json({
    success: true,
    tenantId: targetTenantId,
    count: messages.length,
    messages,
    serverTime: Date.now(),
  });
}
