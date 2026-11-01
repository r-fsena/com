import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { automationTenantIds, runAutomationWorker } from '@/lib/automation-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const expected = process.env.AUTOMATIONS_CRON_SECRET || '';
  const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (expected.length < 32) return NextResponse.json({ error: 'Agendador não configurado.' }, { status: 503 });
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  let completed = 0; let failed = 0;
  const deadline = Date.now() + 50000;
  for (const tenantId of await automationTenantIds()) {
    if (Date.now() >= deadline - 17000) break;
    try { await runAutomationWorker(tenantId, deadline); completed++; } catch { failed++; }
  }
  return NextResponse.json({ success: failed === 0, completed, failed }, { status: failed ? 503 : 200 });
}
