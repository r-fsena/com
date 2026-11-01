// Optional dedicated runner. Do not run against production as a smoke test.
require('dotenv').config({ path: '.env.local', quiet: true });
const origin = process.env.CRM_WORKER_URL || process.env.NEXT_PUBLIC_APP_URL;
const secret = process.env.AUTOMATIONS_CRON_SECRET;
if (!origin || !secret || secret.length < 32) { console.error('Configure CRM_WORKER_URL e AUTOMATIONS_CRON_SECRET (mínimo 32 caracteres).'); process.exit(1); }
const target = new URL('/api/internal/automations/run', origin);
if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) { console.error('O processador exige uma origem HTTPS.'); process.exit(1); }
let stopped = false;
process.on('SIGTERM', () => { stopped = true; }); process.on('SIGINT', () => { stopped = true; });
async function main() {
  do {
    const startedAt = Date.now();
    try {
      const response = await fetch(target, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(65000), redirect: 'error' });
      const result = await response.json();
      console.log(JSON.stringify({ at: new Date().toISOString(), status: response.status, success: result.success === true, completed: result.completed, failed: result.failed }));
    } catch { console.error('O processador não confirmou a execução. Confira a disponibilidade do servidor.'); }
    if (process.argv.includes('--once') || stopped) break;
    // Poll due parts frequently; the database enforces the configured minimum interval.
    // Requests never overlap. Slow requests may increase the effective interval.
    const delay = Math.max(1000, 5000 - (Date.now() - startedAt));
    await new Promise(resolve => setTimeout(resolve, delay));
  } while (!stopped);
}
main().catch(() => { console.error('Processador encerrado sem confirmação.'); process.exitCode = 1; });
