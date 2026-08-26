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

  const allMessages = webhookStore.getAllMessages();

  // Filtra pelo tenant autorizado do usuário ou entrega para a instância ativa
  const messages = allMessages.filter(m => 
    !m.tenantId || 
    m.tenantId === targetTenantId || 
    session?.isSuperAdmin || 
    targetTenantId === 'tenant-amabile-barbarotti'
  );

  return NextResponse.json({
    success: true,
    tenantId: targetTenantId,
    count: messages.length,
    messages,
    serverTime: Date.now(),
  });
}
