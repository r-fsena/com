'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus, ArrowLeft, Send, RefreshCw, Copy, Pencil, Pause, Play, X, ShieldCheck } from 'lucide-react';
import { useCRM } from '@/lib/crm-context';
import { campaignConfigSchema, campaignAttachmentSchema, campaignPhone, campaignParts, renderCampaignMessage, type CampaignPart, recipientLabels, type CampaignConfig, type CampaignAttachment, type MarketingPermission } from '@/lib/campaigns';
import { CampaignSequenceEditor, CampaignSequencePreview, sequenceIntervalLabel, sequenceSizeLabel } from './CampaignSequenceEditor';
import { valueLabels } from '@/lib/automations';
import { campaignLabelKey, campaignLabelOptions } from '@/lib/contact-labels';

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const button = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
const primary = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed';
const statusLabels: Record<string, string> = { DRAFT: 'Rascunho', SCHEDULED: 'Agendada', RUNNING: 'Em andamento', PAUSED: 'Pausada', COMPLETED: 'Processamento concluído', CANCELLED: 'Cancelada' };
const date = (value?: string) => value ? new Date(value).toLocaleString('pt-BR') : 'Não informado';
const localDate = () => { const value = new Date(); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toggle = (items: string[], value: string) => items.includes(value) ? items.filter(item => item !== value) : [...items, value];
const goals: { value: CampaignConfig['objective']; name: string; text: string }[] = [
  { value: 'PROPERTY', name: 'Apresentar um imóvel', text: 'Olá {{primeiro_nome}}! Aqui é da {{empresa}}. Temos uma oportunidade que pode combinar com sua busca. Gostaria de receber mais informações?\n\nSe preferir não receber novidades, responda SAIR.' },
  { value: 'VISIT', name: 'Convidar para uma visita', text: 'Olá {{primeiro_nome}}! Aqui é da {{empresa}}. Gostaríamos de convidar você para conhecer um imóvel. Qual seria um bom horário?\n\nSe preferir não receber novidades, responda SAIR.' },
  { value: 'FOLLOW_UP', name: 'Retomar um atendimento', text: 'Olá {{primeiro_nome}}! Aqui é da {{empresa}}. Você ainda está procurando um imóvel? Podemos ajudar na próxima etapa.\n\nSe preferir não receber novidades, responda SAIR.' },
];
export function CampaignManager() { const { currentTenant } = useCRM(); return <CampaignWorkspace key={currentTenant.id} />; }
function CampaignWorkspace() {
  const { currentTenant, currentUser, quickReplies, pipelines } = useCRM();
  const [data, setData] = useState<any>({ campaigns: [], contacts: [], connections: [], members: [], pipelines: [], permissions: {}, capabilities: { workerReady: false, outboundEnabled: false, storageReady: false } });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'CAMPAIGNS' | 'PERMISSIONS'>('CAMPAIGNS');
  const [editor, setEditor] = useState(false), [editing, setEditing] = useState<any>(null), [step, setStep] = useState(0), [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<any>(null), [simulation, setSimulation] = useState<any>(null), [confirmed, setConfirmed] = useState(false);
  const [ownTest, setOwnTest] = useState<any>(null), [connectionChecked, setConnectionChecked] = useState(false);
  const [recipientView, setRecipientView] = useState<any>(null), [recipientFilter, setRecipientFilter] = useState(''), [search, setSearch] = useState('');
  const [timerNow, setTimerNow] = useState(Date.now);
  const [permissionContactId, setPermissionContactId] = useState(''), [permissionGranted, setPermissionGranted] = useState(true), [permissionSource, setPermissionSource] = useState('');
  const [permissionObtainedAt, setPermissionObtainedAt] = useState(localDate);
  const [permissionNotes, setPermissionNotes] = useState(''), [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const permissionBaseline = useRef<string | undefined>();
  const testRequest = useRef<string | null>(null), stepHeading = useRef<HTMLHeadingElement>(null);
  const canManage = ['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(currentUser.role);
  const defaultConfig = (): CampaignConfig => ({ name: '', objective: 'PROPERTY', instanceId: '',
    audience: { mode: 'FILTERED', selectedIds: [], excludedIds: [], temperatures: [], sources: [], stageIds: [], tags: [], regions: [], assignedUserIds: [] }, message: goals[0].text, parts: [{ message: goals[0].text }], intervalSeconds: 30,
    schedule: { hours: { onlyBusinessHours: true, timezone: currentTenant.timezone || 'America/Sao_Paulo', start: currentTenant.businessHours?.start || '08:30', end: currentTenant.businessHours?.end || '18:00',
      workDays: currentTenant.businessHours?.workDays || [1, 2, 3, 4, 5] }, expiresAfterHours: 48 } });
  const [config, setConfig] = useState<CampaignConfig>(defaultConfig);
  const headers = { 'Content-Type': 'application/json', 'x-tenant-id': currentTenant.id };
  async function api(body?: any, query = '', signal?: AbortSignal) {
    const response = await fetch(`/api/v1/campaigns${query}`, { method: body ? 'POST' : 'GET', headers, credentials: 'include', cache: 'no-store', signal, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json();
    if (!response.ok || !value.success || value.tenantId !== currentTenant.id) throw new Error(value.error || 'A operação não foi confirmada. Tente novamente.');
    return value;
  }
  async function refresh(signal?: AbortSignal) { const value = await api(undefined, '', signal); setData(value); }
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort();
  // The workspace remounts and aborts requests when the selected tenant changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (editor || loading) return;
    const controller = new AbortController(); const timer = setInterval(() => { if (!document.hidden) refresh(controller.signal).catch(() => {}); }, 15000);
    return () => { clearInterval(timer); controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, loading]);
  useEffect(() => { if (editor) stepHeading.current?.focus(); }, [step, editor]);
  useEffect(() => {
    if (!recipientView) return;
    setTimerNow(Date.now()); const timer = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recipientView]);
  useEffect(() => {
    if (!editor || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [editor, dirty]);
  function change(patch: Partial<CampaignConfig>) { setConfig(previous => ({ ...previous, ...patch })); setDirty(true); setPreview(null); setSimulation(null); setConfirmed(false); setOwnTest(null); setError(''); testRequest.current = null; }
  function changeParts(parts: CampaignPart[]) { change({ parts, message: parts[0].message, attachment: parts[0].attachment }); }
  function audienceChange(patch: Partial<CampaignConfig['audience']>) { change({ audience: { ...config.audience, ...patch } }); }
  function open(campaign?: any, duplicate = false) {
    const next = campaign ? JSON.parse(JSON.stringify(campaign.payload.config)) : defaultConfig();
    next.parts = campaignParts(next); next.intervalSeconds ??= 30;
    next.audience.tags = Array.from(new Set(next.audience.tags.map(campaignLabelKey)));
    if (duplicate) { next.name += ' (cópia)'; delete next.schedule.startsAt; }
    setConfig(next); setEditing(duplicate ? null : campaign || null); setEditor(true); setStep(0); setDirty(duplicate); setPreview(null); setSimulation(null); setConfirmed(false); setOwnTest(null);
    setError(''); setNotice(''); setConnectionChecked(false); testRequest.current = null;
  }
  function close() { if (dirty && !window.confirm('Há alterações sem salvar. Deseja sair e descartá-las?')) return; setEditor(false); setError(''); }
  async function saveDraft() {
    const parsed = campaignConfigSchema.safeParse(config);
    if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join(' '));
    if (editing && !dirty) return editing;
    const value = await api({ operation: 'save', id: editing?.id, revision: editing?.payload.revision, config: parsed.data });
    setEditing(value.campaign); setConfig(value.campaign.payload.config); setDirty(false); return value.campaign;
  }
  async function act(operation: 'save' | 'simulate' | 'start' | 'send-test') {
    if (busy || !canManage) return; setBusy(true); setError(''); setNotice('');
    try {
      const campaign = await saveDraft();
      if (operation === 'save') setNotice('Rascunho salvo no servidor. Nenhum disparo foi iniciado.');
      else {
        if (operation === 'start' && (!confirmed || !simulation?.audience.eligible)) throw new Error('Confira e confirme os destinatários antes de iniciar.');
        if (operation === 'send-test' && !window.confirm(`Enviar a sequência inteira de teste somente para o telefone do seu perfil: +${data.ownPhone}?`)) return;
        if (operation === 'send-test') testRequest.current ||= crypto.randomUUID();
        const value = await api({ operation, id: campaign.id, revision: campaign.payload.revision,
          ...(operation === 'start' ? { confirmed: true, confirmedCount: simulation.audience.eligible } : operation === 'send-test' ? { confirmed: true, requestId: testRequest.current } : {}) });
        if (value.campaign) setEditing(value.campaign);
        if (operation === 'simulate') { setPreview(value.simulation); setSimulation(value.simulation); setConfirmed(false); setNotice('Simulação concluída. Nenhuma mensagem foi enviada.'); }
        if (operation === 'start') { setNotice('Campanha confirmada no servidor. Acompanhe os resultados por destinatário.'); setEditor(false); }
        if (operation === 'send-test') { setOwnTest(value.test); setNotice('Teste registrado na fila. Acompanhe o resultado em “Ver destinatários”; isso ainda não confirma entrega.'); }
      }
      await refresh();
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  async function checkAudience() {
    setBusy(true); setError(''); try { const value = await api({ operation: 'preview', config }); setPreview(value); } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  async function control(campaign: any, operation: 'pause' | 'resume' | 'cancel') {
    if (operation === 'cancel' && !window.confirm('Cancelar os envios que ainda não começaram? Mensagens já enviadas não serão desfeitas.')) return;
    setBusy(true); setError(''); try {
      await api({ operation, id: campaign.id, revision: campaign.payload.revision }); await refresh();
      setNotice(operation === 'pause' ? 'Campanha pausada. Um envio que já começou pode ser concluído.' : operation === 'resume' ? 'Campanha retomada. Envios já confirmados não serão repetidos.' : 'Pendências canceladas.');
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  async function showRecipients(id: string, offset = 0, status = recipientFilter) {
    setBusy(true); setError(''); try { const value = await api(undefined, `?id=${encodeURIComponent(id)}&offset=${offset}${status ? `&status=${status}` : ''}`); setRecipientView(value); } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  async function upload(index: number, file?: File) {
    if (!file) return;
    if (!campaignAttachmentSchema.safeParse({ key: 'pending-upload', fileName: file.name, mimeType: file.type, size: file.size }).success) {
      setError('Escolha uma imagem JPG, PNG, WebP ou PDF de até 10 MB, ou um vídeo MP4 de até 25 MB.'); return;
    }
    setBusy(true); setError(''); try {
      const response = await fetch('/api/v1/uploads/presigned-url', { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ tenantId: currentTenant.id, fileName: file.name, fileType: file.type, fileSizeBytes: file.size }) });
      const value = await response.json(); if (!response.ok || !value.data?.uploadUrl) throw new Error(value.error || 'Não foi possível preparar o upload.');
      const sent = await fetch(value.data.uploadUrl, { method: 'PUT', headers: value.data.headers, body: file });
      if (!sent.ok) throw new Error('O arquivo não foi confirmado. Confira o armazenamento antes de continuar.');
      changeParts(campaignParts(config).map((part, current) => current === index ? { ...part, attachment: { key: value.data.fileKey, fileName: file.name, mimeType: file.type as CampaignAttachment['mimeType'], size: file.size } } : part));
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  function selectPermission(id: string) {
    setPermissionContactId(id); setPermissionConfirmed(false); setPermissionNotes(''); setPermissionSource(''); setPermissionObtainedAt(localDate());
    const contact = data.contacts.find((contact: any) => contact.id === id);
    const phone = contact ? campaignPhone(contact.phone) : null;
    permissionBaseline.current = phone ? data.permissions[phone]?.recordedAt : undefined;
  }
  async function savePermission(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); try {
      await api({ operation: 'permission', contactId: permissionContactId, granted: permissionGranted, source: permissionSource, notes: permissionNotes, confirmed: permissionConfirmed, expectedRecordedAt: permissionBaseline.current, obtainedAt: new Date(permissionObtainedAt).toISOString() });
      await refresh(); setPermissionContactId(''); setPermissionConfirmed(false); setNotice('Preferência registrada. Pedidos de interrupção valem para todas as campanhas deste ambiente.');
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  const stages = (data.pipelines.length ? data.pipelines : pipelines).flatMap((pipeline: any) => pipeline.stages.map((stage: any) => ({ id: stage.id, name: `${pipeline.name} — ${stage.name}` })));
  const tags = campaignLabelOptions(data.contacts);
  const regions = Array.from(new Set<string>(data.contacts.flatMap((contact: any) => contact.targetRegions || []))).sort();
  const memberNames = Object.fromEntries(data.members.map((member: any) => [member.id, member.name]));
  const shownContacts = data.contacts.filter((contact: any) => `${contact.name} ${contact.phone}`.toLowerCase().includes(search.toLowerCase()));
  const permissionContact = data.contacts.find((contact: any) => contact.id === permissionContactId);
  const selectedPermission: MarketingPermission | undefined = permissionContact && data.permissions[campaignPhone(permissionContact.phone) || ''];
  function filterChoices(label: string, choices: { id: string; name: string }[], values: string[], field: 'temperatures' | 'sources' | 'stageIds' | 'tags' | 'regions' | 'assignedUserIds') {
    return <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">{label} {values.length ? `(${values.length} selecionado${values.length > 1 ? 's' : ''})` : '(qualquer)'}</summary><div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">{choices.length ? choices.map(choice => <label key={choice.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.includes(choice.id)} onChange={() => audienceChange({ [field]: toggle(values, choice.id) })} />{choice.name}</label>) : <p className="text-sm text-slate-500">Nenhuma opção cadastrada.</p>}</div></details>;
  }
  return <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900">Campanhas de WhatsApp</h1><p className="mt-1 text-sm text-slate-600">Escolha os contatos, prepare sua mensagem e confira antes de enviar.</p></div>{!editor && <button className={primary} disabled={!canManage || busy || loading || !!error} onClick={() => open()}><Plus className="mr-1 inline h-4 w-4" />Criar campanha</button>}</header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={async () => { try { await refresh(); setError(''); } catch (error: any) { setError(error.message); } }}>Atualizar lista</button></div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
    {!canManage && <p className="rounded-xl bg-slate-100 p-3 text-sm">Você pode acompanhar. Gestores e administradores podem configurar e iniciar campanhas.</p>}
    {loading ? <p role="status">Carregando campanhas salvas…</p> : editor ? <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="flex justify-between gap-2"><button className={button} disabled={busy} onClick={close}><ArrowLeft className="mr-1 inline h-4 w-4" />Voltar à lista</button><span className="text-sm text-slate-500">Etapa {step + 1} de 5</span></div>
      <nav aria-label="Etapas da campanha" className="my-5 flex flex-wrap gap-2">{['Objetivo', 'Destinatários', 'Mensagem', 'Linha e horário', 'Conferir e enviar'].map((label, index) => <button key={label} disabled={busy} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined} className={`rounded-full px-3 py-1 text-sm ${index === step ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{index + 1}. {label}</button>)}</nav>
      <h2 ref={stepHeading} tabIndex={-1} className="mb-4 text-lg font-bold outline-none">{['Qual é o objetivo da campanha?', 'Quem deve receber?', 'O que você quer dizer?', 'Por qual linha e em qual horário?', 'Confira antes de confirmar'][step]}</h2>
      <fieldset disabled={busy || !canManage} className="space-y-4 min-w-0">
      {step === 0 && <><div className="grid gap-2 sm:grid-cols-3">{goals.map(goal => <button key={goal.value} className={`${button} text-left ${config.objective === goal.value ? 'border-indigo-500 bg-indigo-50' : ''}`} onClick={() => change({ objective: goal.value, name: config.name || goal.name, ...(campaignParts(config).length === 1 && !config.attachment && goals.some(item => item.text === config.message) ? { message: goal.text, parts: [{ message: goal.text }] } : {}) })}>{goal.name}</button>)}</div><label className="block text-sm font-semibold">Nome da campanha<input className={input} maxLength={120} value={config.name} onChange={event => change({ name: event.target.value })} /></label><p className="text-sm text-slate-600">Os modelos são pontos de partida. Você poderá editar toda a mensagem e salvar sem iniciar envios.</p></>}
      {step === 1 && <><p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">Contatos pessoais, números repetidos, pedidos de interrupção e autorizações não confirmadas ficam de fora. Um contato precisa ter autorização registrada em “Autorizações”.</p>
        <label className="block text-sm font-semibold">Como escolher os contatos?<select className={input} value={config.audience.mode} onChange={event => audienceChange({ mode: event.target.value as 'FILTERED' | 'SELECTED' })}><option value="FILTERED">Usar critérios de seleção</option><option value="SELECTED">Escolher contatos individualmente</option></select></label>
        {config.audience.mode === 'FILTERED' ? <><p className="text-sm text-slate-600">O contato deve atender a todos os grupos de critérios. Dentro de um grupo, basta uma das opções marcadas. Etiquetas incluem as importadas do WhatsApp e as cadastradas no CRM, sem repetir nomes equivalentes.</p><div className="grid gap-2 sm:grid-cols-2">
          {filterChoices('Interesse', ['HOT', 'WARM', 'COLD'].map(id => ({ id, name: valueLabels[id] })), config.audience.temperatures, 'temperatures')}
          {filterChoices('Origem', Object.entries(valueLabels).filter(([id]) => !['HOT','WARM','COLD'].includes(id)).map(([id, name]) => ({ id, name })), config.audience.sources, 'sources')}
          {filterChoices('Etapa do funil', stages, config.audience.stageIds, 'stageIds')}{filterChoices('Responsável', data.members, config.audience.assignedUserIds, 'assignedUserIds')}
          {filterChoices('Etiquetas', tags.map(label => ({ id: label.id, name: label.name })), config.audience.tags, 'tags')}{filterChoices('Regiões', regions.map(id => ({ id, name: id })), config.audience.regions, 'regions')}
        </div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Orçamento mínimo do contato (R$)<input className={input} type="number" min={0} value={config.audience.minValue ?? ''} onChange={event => audienceChange({ minValue: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="text-sm">Orçamento máximo do contato (R$)<input className={input} type="number" min={0} value={config.audience.maxValue ?? ''} onChange={event => audienceChange({ maxValue: event.target.value ? Number(event.target.value) : undefined })} /></label></div></> : <><label className="block text-sm">Buscar contato<input className={input} value={search} onChange={event => setSearch(event.target.value)} /></label><div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{shownContacts.map((contact: any) => <label key={contact.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.audience.selectedIds.includes(contact.id)} onChange={() => audienceChange({ selectedIds: toggle(config.audience.selectedIds, contact.id) })} />{contact.name} · {contact.phone}</label>)}</div></>}
        <button className={button} onClick={() => void checkAudience()}>Conferir destinatários</button>
        {preview?.audience && <div className="space-y-2 rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold">{preview.stale ? 'Última conferência: ' : ''}{preview.audience.total} encontrados · {preview.audience.eligible} elegíveis · {preview.audience.excluded} não selecionados</p><p className="text-xs text-slate-500">{preview.stale && 'A seleção mudou. Clique em Conferir destinatários novamente. '}Cada contato tem um motivo principal. A lista será conferida novamente antes de cada envio.</p><div className="max-h-64 space-y-2 overflow-y-auto">{preview.audience.rows.map((row: any) => <div key={row.id} className="flex items-start justify-between gap-2 border-t border-slate-100 pt-2 text-sm"><div><strong>{row.name}</strong><p className={row.eligible ? 'text-emerald-700' : 'text-slate-600'}>{row.eligible ? 'Elegível para esta campanha' : row.reason}</p></div><button className={button} onClick={() => { setConfig(previous => ({ ...previous, audience: { ...previous.audience, excludedIds: toggle(previous.audience.excludedIds, row.id) } })); setDirty(true); setSimulation(null); setConfirmed(false); setPreview((previous: any) => ({ ...previous, stale: true })); }}>{config.audience.excludedIds.includes(row.id) ? 'Reconsiderar' : 'Retirar'}</button></div>)}</div></div>}
      </>}
      {step === 2 && <CampaignSequenceEditor config={config} onChange={changeParts} onIntervalChange={intervalSeconds => change({ intervalSeconds })} upload={upload} storageReady={data.capabilities.storageReady} tenantId={currentTenant.id} company={currentTenant.name} templates={quickReplies} />}
      {step === 3 && <><label className="block text-sm font-semibold">Linha que enviará a campanha<select className={input} value={config.instanceId} onChange={event => { change({ instanceId: event.target.value }); setConnectionChecked(false); }}><option value="">Escolha uma linha…</option>{data.connections.map((connection: any) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.phone}</option>)}</select></label>
        <button className={button} disabled={!config.instanceId} onClick={async () => { setBusy(true); setError(''); try { await api({ operation: 'check-connection', instanceId: config.instanceId }); setConnectionChecked(true); } catch (error: any) { setError(error.message); setConnectionChecked(false); } finally { setBusy(false); } }}>Verificar conexão</button>{connectionChecked && <p role="status" className="text-sm text-emerald-700">Linha conectada na última verificação. O servidor verificará novamente antes do envio.</p>}
        {!data.connections.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nenhuma linha de envio cadastrada. Você pode salvar o rascunho. A extensão de importação, sozinha, não envia campanhas pelo servidor.</p>}
        <label className="block text-sm font-semibold">Quando começar?<select className={input} value={config.schedule.startsAt ? 'LATER' : 'NOW'} onChange={event => change({ schedule: { ...config.schedule, startsAt: event.target.value === 'LATER' ? new Date(Date.now() + 3600000).toISOString() : undefined } })}><option value="NOW">Após minha confirmação</option><option value="LATER">Escolher data e hora</option></select></label>
        {config.schedule.startsAt && <label className="block text-sm font-semibold">Data e hora de início (fuso deste computador)<input className={input} type="datetime-local" min={localDate()} value={new Date(Date.parse(config.schedule.startsAt) - new Date(config.schedule.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={event => { if (event.target.value) change({ schedule: { ...config.schedule, startsAt: new Date(event.target.value).toISOString() } }); }} /></label>}
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={config.schedule.hours.onlyBusinessHours} onChange={event => change({ schedule: { ...config.schedule, hours: { ...config.schedule.hours, onlyBusinessHours: event.target.checked } } })} />Enviar somente no horário de atendimento</label>
        {config.schedule.hours.onlyBusinessHours && <><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Início<input className={input} type="time" value={config.schedule.hours.start} onChange={event => change({ schedule: { ...config.schedule, hours: { ...config.schedule.hours, start: event.target.value } } })} /></label><label className="text-sm">Fim<input className={input} type="time" value={config.schedule.hours.end} onChange={event => change({ schedule: { ...config.schedule, hours: { ...config.schedule.hours, end: event.target.value } } })} /></label><label className="text-sm">Fuso de atendimento<select className={input} value={config.schedule.hours.timezone} onChange={event => change({ schedule: { ...config.schedule, hours: { ...config.schedule.hours, timezone: event.target.value } } })}>{Array.from(new Set([config.schedule.hours.timezone, 'America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha'])).map(timezone => <option key={timezone}>{timezone}</option>)}</select></label></div><div className="flex flex-wrap gap-3">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={config.schedule.hours.workDays.includes(index)} onChange={() => change({ schedule: { ...config.schedule, hours: { ...config.schedule.hours, workDays: config.schedule.hours.workDays.includes(index) ? config.schedule.hours.workDays.filter(day => day !== index) : [...config.schedule.hours.workDays, index] } } })} />{day}</label>)}</div></>}
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Validade das pendências</summary><label className="mt-2 block text-sm">Desistir dos envios pendentes após quantas horas do início?<input className={input} type="number" min={24} max={168} value={config.schedule.expiresAfterHours} onChange={event => change({ schedule: { ...config.schedule, expiresAfterHours: Number(event.target.value) } })} /></label></details>
        <p className="text-sm text-slate-600">O ritmo é controlado pelo servidor e compartilhado com automações da mesma linha. A duração depende da fila, do agendador e da conexão. Reduzir o ritmo não garante ausência de bloqueios.</p>
      </>}
      {step === 4 && <><div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm"><h3 className="font-bold">{config.name}</h3><p><strong>Linha:</strong> {data.connections.find((connection: any) => connection.id === config.instanceId)?.name || 'Ainda não escolhida'}</p><p><strong>Início:</strong> {config.schedule.startsAt ? date(config.schedule.startsAt) : 'Após minha confirmação'}</p><p><strong>Atendimento:</strong> {config.schedule.hours.onlyBusinessHours ? `${config.schedule.hours.start} às ${config.schedule.hours.end} (${config.schedule.hours.timezone})` : 'Sem restrição de horário'}</p><p><strong>Sequência:</strong> {sequenceSizeLabel(campaignParts(config).length)} por contato · intervalo mínimo de {sequenceIntervalLabel(config.intervalSeconds ?? 30)}</p><p><strong>Anexos:</strong> {campaignParts(config).filter(part => part.attachment).map(part => part.attachment!.fileName).join(', ') || 'Sem anexo'}</p><p><strong>Destinatários:</strong> {simulation ? `${simulation.audience.eligible} elegíveis, ${simulation.audience.excluded} fora da seleção` : 'Conferir na simulação abaixo'}</p></div>
        <CampaignSequencePreview parts={campaignParts(config)} intervalSeconds={config.intervalSeconds} name="Marina Exemplo" company={currentTenant.name} broker="Corretor de exemplo" />
        <button className={button} onClick={() => void act('simulate')}>Testar sem enviar</button><p className="text-sm text-slate-600">Salva o rascunho e confere destinatários e personalização. Nenhum contato recebe mensagem nesta simulação.</p>
        {simulation && <div role="status" className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm"><strong>{simulation.audience.eligible} destinatários elegíveis</strong>{simulation.sample.map((sample: any, index: number) => <div key={index} className="rounded-xl bg-white p-3"><p className="mb-1 font-semibold">Prévia para {sample.name}</p><CampaignSequencePreview parts={sample.parts || [{ message: sample.message }]} intervalSeconds={config.intervalSeconds} /></div>)}{!simulation.audience.eligible && <p>Nenhum envio pode ser iniciado. Volte a Destinatários para conferir os motivos.</p>}<p>{simulation.warning}</p></div>}
        <div className="space-y-2 rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold">Teste real somente para você</p><p className="text-sm text-slate-600">{data.ownPhone ? `Telefone cadastrado no seu perfil: +${data.ownPhone}` : 'Cadastre seu telefone internacional no perfil para habilitar este teste.'}</p><button className={button} disabled={!!ownTest || !data.ownPhone || !data.capabilities.workerReady || !data.capabilities.outboundEnabled} onClick={() => void act('send-test')}>Enviar teste para meu número</button>{ownTest && <p className="text-sm">{recipientLabels[ownTest.status as keyof typeof recipientLabels]}: {ownTest.reason}</p>}</div>
        {(!data.capabilities.workerReady || !data.capabilities.outboundEnabled) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O envio precisa de um agendador operacional e da liberação de campanhas no servidor. Você pode salvar e simular enquanto essa configuração é concluída.</p>}
        <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold"><input className="mt-1" type="checkbox" checked={confirmed} disabled={!simulation?.audience.eligible || dirty} onChange={event => setConfirmed(event.target.checked)} />Confirmo o envio real de {sequenceSizeLabel(campaignParts(config).length)} por contato para {simulation?.audience.eligible || 0} {(simulation?.audience.eligible || 0) === 1 ? 'contato' : 'contatos'}, com o intervalo, linha e horário acima.</label>
      </>}
      </fieldset>
      <footer className="sticky bottom-0 mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-white py-4"><button className={button} disabled={busy || !canManage} onClick={() => void act('save')}>{busy ? 'Aguarde…' : 'Salvar rascunho'}</button><div className="flex gap-2">{step > 0 && <button className={button} disabled={busy} onClick={() => setStep(step - 1)}>Anterior</button>}{step < 4 ? <button className={primary} disabled={busy} onClick={() => setStep(step + 1)}>Próximo</button> : <button className={primary} disabled={busy || !canManage || !confirmed || dirty || !simulation?.audience.eligible || !data.capabilities.workerReady || !data.capabilities.outboundEnabled} onClick={() => void act('start')}>Confirmar e iniciar campanha</button>}</div></footer>
    </section> : <>
      <nav aria-label="Conteúdo de campanhas" className="flex flex-wrap gap-2"><button className={tab === 'CAMPAIGNS' ? primary : button} onClick={() => setTab('CAMPAIGNS')}>Campanhas</button><button className={tab === 'PERMISSIONS' ? primary : button} onClick={() => setTab('PERMISSIONS')}>Autorizações</button><button aria-label="Atualizar campanhas" className={button} disabled={busy} onClick={async () => { try { await refresh(); setError(''); } catch (error: any) { setError(error.message); } }}><RefreshCw className="h-4 w-4" /></button></nav>
      {tab === 'PERMISSIONS' ? <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Autorizações para receber campanhas</h2><p className="text-sm text-slate-600">Ter uma conversa ou um telefone salvo não confirma autorização para ofertas. Registre uma autorização real, com sua origem. Pedidos de interrupção retiram o número das campanhas e das automações de comunicação deste ambiente.</p>
        <form onSubmit={savePermission} className="space-y-3"><fieldset disabled={busy || !canManage} className="space-y-3"><label className="block text-sm font-semibold">Contato<select className={input} value={permissionContactId} onChange={event => selectPermission(event.target.value)}><option value="">Escolha um contato…</option>{data.contacts.map((contact: any) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.phone}</option>)}</select></label>
          {permissionContact && <p className="text-sm">Situação: {selectedPermission ? selectedPermission.status === 'GRANTED' ? `Autorização registrada em ${date(selectedPermission.recordedAt)}` : 'Pediu para não receber' : 'Sem autorização registrada'}</p>}
          <label className="block text-sm font-semibold">Preferência<select className={input} value={permissionGranted ? 'GRANT' : 'REVOKE'} onChange={event => { setPermissionGranted(event.target.value === 'GRANT'); setPermissionConfirmed(false); }}><option value="GRANT">Autorizou receber campanhas</option><option value="REVOKE">Não deseja receber mensagens</option></select></label>
          <label className="block text-sm font-semibold">Origem do registro<input className={input} required minLength={3} maxLength={100} value={permissionSource} placeholder="Ex.: formulário do site, atendimento presencial" onChange={event => setPermissionSource(event.target.value)} /></label>
          <label className="block text-sm font-semibold">Quando a preferência foi informada? (horário deste computador)<input className={input} type="datetime-local" required max={localDate()} value={permissionObtainedAt} onChange={event => setPermissionObtainedAt(event.target.value)} /></label>
          <label className="block text-sm font-semibold">Como e quando essa preferência foi informada?<textarea className={input} required minLength={10} maxLength={1000} rows={3} value={permissionNotes} onChange={event => setPermissionNotes(event.target.value)} /></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={permissionConfirmed} onChange={event => setPermissionConfirmed(event.target.checked)} />Confirmo que estou registrando uma preferência informada por este contato. Importar um histórico não é autorização para campanhas.</label><button className={primary} disabled={!permissionContactId || !permissionConfirmed || !canManage || busy}>Registrar preferência</button>
        </fieldset></form></section> : <>
        <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">{data.capabilities.workerReady ? 'Agendador com confirmação recente.' : 'Agendador sem confirmação recente.'} {data.capabilities.outboundEnabled ? 'Envios de campanhas habilitados no servidor.' : 'Envios ainda não habilitados no servidor; rascunhos e simulações disponíveis.'}</p>
        {!data.campaigns.length && !error && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Send className="mx-auto mb-3 h-8 w-8 text-indigo-600" /><h2 className="font-bold">Prepare sua primeira campanha</h2><p className="mt-2 text-sm text-slate-600">Comece pelo objetivo, confira os destinatários e teste antes de enviar.</p></div>}
        {data.campaigns.map((campaign: any) => {
          const counts = campaign.counts || {}, total = Object.values(counts).reduce((sum: number, count) => sum + Number(count), 0);
          const accepted = (counts.ACCEPTED || 0) + (counts.DELIVERED || 0) + (counts.READ || 0);
          return <article key={campaign.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{campaign.payload.config.name}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabels[campaign.status]}{counts.UNKNOWN ? ' · requer conferência' : ''}</span></div><details className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Ver sequência · {sequenceSizeLabel(campaignParts(campaign.payload.config).length)} por contato · intervalo mínimo de {sequenceIntervalLabel(campaign.payload.config.intervalSeconds ?? 30)}</summary><div className="mt-3"><CampaignSequencePreview parts={campaignParts(campaign.payload.config)} intervalSeconds={campaign.payload.config.intervalSeconds} /></div></details>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">{[['Destinatários', total], ['Sequências aceitas', accepted], ['Entregues', (counts.DELIVERED || 0) + (counts.READ || 0)], ['Lidos', counts.READ || 0], ['Respostas após envio', campaign.replies || 0]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong>{String(value)}</strong></div>)}</div>
            <p className="text-xs text-slate-500">Os indicadores contam contatos; cada sequência só é aceita, entregue ou lida por inteiro quando todas as suas partes atingem esse estado. Aceite não confirma entrega. Conclusão significa que todas as tentativas tiveram um resultado registrado. Respostas após o envio não comprovam conversão.</p>
            <div className="flex flex-wrap gap-2">{campaign.status === 'DRAFT' && <button className={button} disabled={!canManage || busy} onClick={() => open(campaign)}><Pencil className="mr-1 inline h-4 w-4" />Editar</button>}<button className={button} disabled={!canManage || busy} onClick={() => open(campaign, true)}><Copy className="mr-1 inline h-4 w-4" />Duplicar</button>{['RUNNING','SCHEDULED'].includes(campaign.status) && <button className={button} disabled={!canManage || busy} onClick={() => void control(campaign, 'pause')}><Pause className="mr-1 inline h-4 w-4" />Pausar</button>}{campaign.status === 'PAUSED' && <button className={button} disabled={!canManage || busy} onClick={() => void control(campaign, 'resume')}><Play className="mr-1 inline h-4 w-4" />Retomar</button>}{!['COMPLETED','CANCELLED'].includes(campaign.status) && <button className={button} disabled={!canManage || busy} onClick={() => void control(campaign, 'cancel')}>Cancelar pendentes</button>}<button className={button} disabled={busy} onClick={() => void showRecipients(campaign.id)}>Ver destinatários</button></div>
            <details className="text-sm"><summary className="cursor-pointer font-semibold">Registro de alterações</summary><div className="mt-2 space-y-1">{campaign.payload.audit.map((entry: any, index: number) => <p key={index}>{({ save: 'Rascunho salvo', simulate: 'Simulação', start: 'Início confirmado', pause: 'Pausa', resume: 'Retomada', cancel: 'Cancelamento' } as Record<string, string>)[entry.operation] || entry.operation} · versão {entry.revision} · {memberNames[entry.userId] || 'Administrador'} · {date(entry.at)}</p>)}</div></details>
          </article>;
        })}
        {data.nextOffset !== null && data.nextOffset !== undefined && <button className={button} disabled={busy} onClick={async () => { setBusy(true); try { const more = await api(undefined, `?offset=${data.nextOffset}`); setData((previous: any) => ({ ...more, campaigns: [...previous.campaigns, ...more.campaigns.filter((campaign: any) => !previous.campaigns.some((old: any) => old.id === campaign.id))] })); } catch (error: any) { setError(error.message); } finally { setBusy(false); } }}>Carregar mais campanhas</button>}
      </>}
      {recipientView && <section className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">Destinatários · {recipientView.campaign.payload.config.name}</h2><button className={button} onClick={() => setRecipientView(null)}>Fechar resultados</button></div>
        <div className="flex flex-wrap gap-2"><label className="text-sm">Filtrar resultado<select className={input} value={recipientFilter} onChange={event => { setRecipientFilter(event.target.value); void showRecipients(recipientView.campaign.id, 0, event.target.value); }}><option value="">Todos os resultados</option>{Object.entries(recipientLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className={`${button} self-end`} disabled={busy} onClick={() => void showRecipients(recipientView.campaign.id, recipientView.offset)}>Atualizar resultados</button></div>
        <p className="text-sm text-slate-600">{recipientView.total} mensagens; cada parte aparece separadamente. Testes para seu número aparecem identificados e não entram nos totais da campanha.</p>
        {!!recipientView.campaign.payload.selectionSummary?.excluded.length && <details className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Contatos que ficaram fora na confirmação ({recipientView.campaign.payload.selectionSummary.excluded.length})</summary><div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{recipientView.campaign.payload.selectionSummary.excluded.map((contact: any) => <p key={contact.id}><strong>{contact.name}</strong> · {contact.reason}</p>)}</div></details>}
        {recipientView.recipients.map((recipient: any) => <article key={recipient.id} className="space-y-1 border-t border-slate-100 py-3 text-sm"><strong>{recipient.payload.isTest ? 'Teste para meu número' : recipient.payload.name} · +{recipient.phone}</strong><p className={recipient.status === 'UNKNOWN' ? 'font-semibold text-amber-800' : 'text-slate-700'}>{recipientLabels[recipient.status as keyof typeof recipientLabels]}</p><p className="font-semibold">Mensagem {(recipient.payload.partIndex || 0) + 1} de {recipient.payload.partCount || 1}</p><p className="whitespace-pre-wrap break-words">{recipient.payload.message}</p><p>{recipient.reason}</p>{['PENDING','WAITING_CHANNEL'].includes(recipient.status) && (recipient.payload.partIndex || 0) > 0 && <p className="text-sm font-semibold text-indigo-800">{recipient.nextMessageAt ? Date.parse(recipient.nextMessageAt) > timerNow ? `Timer: faltam ${Math.ceil((Date.parse(recipient.nextMessageAt) - timerNow) / 1000)} segundos para liberar esta parte.` : 'Intervalo cumprido. Aguardando o processador, a linha e o horário de atendimento.' : 'Aguardando a confirmação da mensagem anterior para iniciar o timer.'}</p>}<p className="text-xs text-slate-500">Atualizado em {date(recipient.updatedAt)}{recipient.repliedAt ? ` · resposta após envio em ${date(recipient.repliedAt)}` : ''}</p></article>)}
        <div className="flex gap-2"><button className={button} disabled={busy || recipientView.offset === 0} onClick={() => void showRecipients(recipientView.campaign.id, Math.max(0, recipientView.offset - 100))}>Página anterior</button><button className={button} disabled={busy || recipientView.nextOffset === null} onClick={() => void showRecipients(recipientView.campaign.id, recipientView.nextOffset)}>Próxima página</button></div>
      </section>}
    </>}
  </div></div>;
}
