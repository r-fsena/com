import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { qualificationTenantIds, runQualificationWorker } from '@/lib/lead-qualification-service';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const expected = process.env.QUALIFICATION_CRON_SECRET || process.env.AUTOMATIONS_CRON_SECRET || '';
  const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (expected.length < 32) return NextResponse.json({ error: 'Processador de qualificação não configurado.' }, { status: 503 });
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const deadline = Date.now() + 45000;
  let completed = 0, failed = 0;
  for (const tenantId of await qualificationTenantIds()) {
    if (Date.now() >= deadline - 10000) break;
    try { await runQualificationWorker(tenantId, { deadline: Math.min(deadline, Date.now() + 12000), maxChunks: 80, scheduled: true }); completed++; } catch { failed++; }
  }
  return NextResponse.json({ success: failed === 0, completed, failed }, { status: failed ? 503 : 200 });
}
