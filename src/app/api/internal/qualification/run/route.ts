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
  const deadline = Date.now() + 24000;
  let completed = 0, failed = 0, hasPending = false;
  for (const tenantId of await qualificationTenantIds()) {
    if (Date.now() >= deadline - 10000) { hasPending = true; break; }
    try {
      const state = await runQualificationWorker(tenantId, { deadline, maxChunks: 80, scheduled: true });
      if (Object.values(state.qualification?.jobs || {}).some(job => ['QUEUED', 'PROCESSING'].includes(job.status))) hasPending = true;
      completed++;
    } catch { failed++; }
  }
  return NextResponse.json({ success: failed === 0, completed, failed, hasPending }, { status: failed ? 503 : 200 });
}
