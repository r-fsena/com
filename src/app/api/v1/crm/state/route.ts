import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';
import { validateApiSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  try {
    const state = serverCRMStore.getState();
    return NextResponse.json({
      success: true,
      ...state,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao obter estado do CRM',
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const updatedState = serverCRMStore.updateState(body);
    return NextResponse.json({
      success: true,
      ...updatedState,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao persistir estado do CRM',
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { session, errorResponse } = validateApiSession(req, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    let conversationId = searchParams.get('conversationId') || '';
    let phone = searchParams.get('phone') || '';

    try {
      const body = await req.json();
      if (body.conversationId) conversationId = body.conversationId;
      if (body.phone) phone = body.phone;
    } catch {}

    if (!conversationId && !phone) {
      return NextResponse.json({ success: false, error: 'Identificador obrigatório' }, { status: 400 });
    }

    const deletedKeys = serverCRMStore.deleteChat(conversationId, phone);
    const updatedState = serverCRMStore.getState();

    return NextResponse.json({
      success: true,
      deletedKeys,
      ...updatedState,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao deletar do estado do CRM',
    }, { status: 500 });
  }
}
