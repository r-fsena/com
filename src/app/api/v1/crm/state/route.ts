import { NextRequest, NextResponse } from 'next/server';
import { serverCRMStore } from '@/lib/server-crm-store';

export const dynamic = 'force-dynamic';

export async function GET() {
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
