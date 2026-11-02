'use client';
import React from 'react';
import { useCRM } from '@/lib/crm-context';
import type { Contact } from '@/types/crm';
import type { QualificationJob, QualificationField } from '@/lib/lead-qualification';
const labels: Record<QualificationField, string> = { monthlyIncome: 'Renda mensal', downPaymentAvailable: 'Entrada disponível', maxPropertyValue: 'Orçamento', preferredPropertyType: 'Tipo de imóvel', targetRegions: 'Regiões', email: 'E-mail' };
const states = { QUEUED: 'Aguardando análise', PROCESSING: 'Analisando conversa', UPDATED: 'Qualificação atualizada', REVIEW: 'Qualificação disponível para revisão', ERROR: 'Análise pendente — nova tentativa programada', DISABLED: 'Análise automática desativada' };
const format = (value: unknown) => value === undefined || value === null || value === '' ? 'Não informado' : typeof value === 'number' ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : Array.isArray(value) ? value.join(', ') : ({APARTMENT:'Apartamento',HOUSE:'Casa',STUDIO:'Studio / Loft',LAND:'Terreno',COMMERCIAL:'Comercial',PENTHOUSE:'Cobertura'} as Record<string,string>)[String(value)] || String(value);
export function LeadQualificationStatus({ conversationId, contact, onChange }: { conversationId: string; contact: Contact; onChange: () => void }) {
  const { currentTenant } = useCRM();
  const [job, setJob] = React.useState<QualificationJob>();
  const [scheduler, setScheduler] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const abort = new AbortController();
    setJob(undefined); setError('');
    const read = async () => {
      try {
        const response = await fetch(`/api/v1/ai/qualification?conversationId=${encodeURIComponent(conversationId)}`, { headers: { 'x-tenant-id': currentTenant.id }, cache: 'no-store', signal: abort.signal });
        if (!response.ok) throw Error('Não foi possível consultar a análise.');
        const data = await response.json(); if (abort.signal.aborted) return;
        setJob(data.jobs?.[conversationId]);
        const healthy = data.schedulerConfigured && data.lastWorkerAt && Date.now() - Date.parse(data.lastWorkerAt) < 10 * 60_000;
        setScheduler(!!healthy);
      } catch (e: any) { if (!abort.signal.aborted) setError(e.message); }
    };
    void read(); const timer = setInterval(() => { void read(); }, 5000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [conversationId, currentTenant.id]);
  const act = async (body: object) => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/v1/ai/qualification', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-id': currentTenant.id }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'A alteração não foi confirmada.');
      setJob(data.jobs?.[conversationId]); onChange();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <section aria-label="Qualificação automática" className="rounded-xl border border-emerald-200 bg-white p-3 text-xs space-y-2">
    <p role="status" className="font-semibold text-emerald-900">{job ? job.status === 'ERROR' && job.attempts >= 5 ? 'Análise pendente — tente novamente para retomar' : states[job.status] : 'Qualificação aguardando mensagens do cliente'}</p>
    {job && ['QUEUED', 'PROCESSING'].includes(job.status) && <p className="text-slate-600">{job.cursor} de {job.total} mensagens disponíveis analisadas. O progresso é salvo no servidor.</p>}
    {job?.degraded && <p className="text-amber-800">Leitura básica de informações explícitas. A análise contextual por IA não confirmou esta leitura.</p>}
    {scheduler === false && <p className="text-amber-800">A análise automática em segundo plano ainda precisa ser confirmada pelo administrador. Novas importações e o botão de análise continuam disponíveis.</p>}
    {job?.error && <p className="text-amber-800">{job.error}</p>}
    {job?.humanClassificationPreserved && <p className="text-slate-600">A equipe marcou este contato como pessoal. Essa escolha e os dados comerciais foram preservados.</p>}
    {!!job?.conflicts?.length && <p className="text-slate-600">Os dados já preenchidos foram preservados. Revise somente estas diferenças:</p>}
    {job?.conflicts?.map(field => <div key={field} className="rounded-lg bg-amber-50 p-2 space-y-1">
      <p className="font-semibold">{labels[field]}</p><p>Atual: {format(contact[field])}</p><p>Identificado: {format(job.facts[field]?.value)}</p>
      <blockquote className="text-slate-600">“{job.facts[field]?.quote}”</blockquote>
      <div className="flex gap-2"><button disabled={busy} className="underline disabled:opacity-50" onClick={() => void act({ operation: 'resolve', conversationId, field, decision: 'KEEP' })}>Manter atual</button><button disabled={busy} className="underline disabled:opacity-50" onClick={() => void act({ operation: 'resolve', conversationId, field, decision: 'ACCEPT' })}>Usar informação da conversa</button></div>
    </div>)}
    {job?.status === 'ERROR' && <button disabled={busy} className="underline" onClick={() => void act({ operation: 'run', conversationIds: [conversationId] })}>Tentar novamente</button>}
    <details><summary className="cursor-pointer text-emerald-800">Origem das informações preenchidas</summary><div className="space-y-2 mt-2">
      {Object.entries(contact.qualificationFields || {}).map(([field, fact]) => <div key={field}><strong>{labels[field as QualificationField] || field}: </strong>{format(fact?.value)}<p className="text-slate-500">{fact?.source === 'HUMAN' ? 'Confirmado pela equipe' : 'Identificado na conversa'}{fact?.at ? ` · ${new Date(fact.at).toLocaleDateString('pt-BR')}` : ''}</p>{fact?.quote && <blockquote>“{fact.quote}”</blockquote>}</div>)}
      {!Object.keys(contact.qualificationFields || {}).length && <p className="text-slate-500">Os dados anteriores foram preservados. Novas extrações terão a origem registrada.</p>}
    </div></details>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
