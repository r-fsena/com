import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';
import { webhookStore } from '@/lib/webhook-store';

export async function POST(req: NextRequest) {
  try {
    // 1. Limpa o buffer de estado em memória do servidor
    serverCRMStore.resetState();

    // 2. Limpa o buffer de eventos e webhooks do WhatsApp
    webhookStore.clearAll();

    return NextResponse.json({
      success: true,
      message: 'Base de dados do CRM e buffer de webhooks resetados com sucesso.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro ao resetar base do CRM:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao resetar base de dados do CRM',
    }, { status: 500 });
  }
}
