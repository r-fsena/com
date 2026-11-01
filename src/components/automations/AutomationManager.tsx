'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Zap, Pencil, Copy, Pause, Archive, ArrowLeft, ArrowRight, RefreshCw, X } from 'lucide-react';
import { useCRM } from '@/lib/crm-context';
import { ruleConfigSchema, triggerLabels, fieldLabels, valueLabels, renderAutomationMessage, type RuleConfig, type RuleAction, type StoredRule, type AutomationJob, type AutomationAudit } from '@/lib/automations';
import { MessageTemplatesModal } from '@/components/templates/MessageTemplatesModal';

const actionLabels: Record<RuleAction['type'], string> = {
  CREATE_TASK: 'Criar lembrete na agenda', PREPARE_MESSAGE: 'Preparar mensagem para revisão',
  SEND_WHATSAPP_MESSAGE: 'Enviar mensagem automaticamente', ADD_TAG: 'Adicionar etiqueta ao contato', ASSIGN_BROKER: 'Distribuir entre responsáveis',
};
const statusLabels = { DRAFT: 'Rascunho', ACTIVE: 'Ativa', PAUSED: 'Pausada', ARCHIVED: 'Arquivada' };
const jobLabels: Record<AutomationJob['status'], string> = { QUEUED: 'Aguardando', WAITING_CHANNEL: 'Aguardando conexão', DISPATCHING: 'Envio em andamento', ACCEPTED: 'Aceito pelo provedor', DONE: 'Concluído', SKIPPED: 'Ignorado', UNKNOWN: 'Precisa de conferência' };
const operationLabels: Record<string, string> = { save: 'Rascunho salvo', simulate: 'Teste sem envio', publish: 'Versão ativada', pause: 'Regra pausada', archive: 'Regra arquivada' };
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const buttonClass = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
const primaryClass = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed';
const dateLabel = (value: string) => new Date(value).toLocaleString('pt-BR');
function newAction(type: RuleAction['type']): RuleAction {
  switch (type) {
    case 'CREATE_TASK': return { type, title: 'Fazer o primeiro atendimento', dueHours: 2, assignee: 'OWNER' };
    case 'PREPARE_MESSAGE': return { type, message: 'Olá {{primeiro_nome}}! Recebemos seu contato na {{empresa}}. Como podemos ajudar?', assignee: 'OWNER' };
    case 'SEND_WHATSAPP_MESSAGE': return { type, message: 'Olá {{primeiro_nome}}! Recebemos seu contato na {{empresa}}. Como podemos ajudar?' };
    case 'ADD_TAG': return { type, tag: 'Novo interessado' };
    case 'ASSIGN_BROKER': return { type, userIds: [] };
  }
}
export function AutomationManager() {
  const { currentTenant } = useCRM();
  return <AutomationWorkspace key={currentTenant.id} />;
}
function AutomationWorkspace() {
  const { currentTenant, currentUser, contacts, pipelines, quickReplies } = useCRM();
  const [rules, setRules] = useState<StoredRule[]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [audit, setAudit] = useState<AutomationAudit[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [capabilities, setCapabilities] = useState({ workerReady: false, outboundEnabled: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'RULES' | 'HISTORY'>('RULES');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<StoredRule | null>(null);
  const [dirty, setDirty] = useState(false);
  const [simulation, setSimulation] = useState<any>(null);
  const [sampleId, setSampleId] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const canManage = ['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(currentUser.role);
  const emptyConfig = (): RuleConfig => ({ name: '', description: '', trigger: 'LEAD_CREATED', inactivityHours: 24, match: 'ALL', conditions: [],
    actions: [newAction('CREATE_TASK')], schedule: { onlyBusinessHours: false, timezone: currentTenant.timezone || 'America/Sao_Paulo',
      start: currentTenant.businessHours?.start || '08:30', end: currentTenant.businessHours?.end || '19:00', workDays: currentTenant.businessHours?.workDays || [1, 2, 3, 4, 5] } });
  const [config, setConfig] = useState<RuleConfig>(emptyConfig);
  const stages = pipelines.flatMap(pipeline => pipeline.stages.map(stage => ({ id: stage.id, name: `${pipeline.name} — ${stage.name}` })));
  const headers = { 'Content-Type': 'application/json', 'x-tenant-id': currentTenant.id };
  async function request(body?: any, signal?: AbortSignal) {
    const response = await fetch('/api/v1/automations', { method: body ? 'POST' : 'GET', headers, credentials: 'include', cache: 'no-store', signal, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok || !data.success || data.tenantId !== currentTenant.id) throw new Error(data.error || 'A operação não foi confirmada. Tente novamente.');
    return data;
  }
  async function refresh(signal?: AbortSignal) {
    const data = await request(undefined, signal);
    setRules(data.rules); setJobs(data.jobs); setAudit(data.audit); setMembers(data.members); setCapabilities(data.capabilities);
  }
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // Tenant changes remount this workspace and cancel requests from the old tenant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!editor || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [editor, dirty]);
  useEffect(() => { if (editor) headingRef.current?.focus(); }, [step, editor]);
  function change(patch: Partial<RuleConfig>) { setConfig(previous => ({ ...previous, ...patch })); setDirty(true); setSimulation(null); setError(''); }
  function changeAction(index: number, action: RuleAction) { change({ actions: config.actions.map((item, i) => i === index ? action : item) }); }
  function open(rule?: StoredRule, duplicate = false) {
    setEditing(duplicate ? null : rule || null); setConfig(rule ? JSON.parse(JSON.stringify({ ...rule.draft, ...(duplicate ? { name: `${rule.draft.name} (cópia)` } : {}) })) : emptyConfig());
    setDirty(duplicate); setStep(0); setSimulation(null); setError(''); setNotice(''); setSampleId(''); setEditor(true);
  }
  function close() {
    if (dirty && !window.confirm('Há alterações sem salvar. Deseja sair e descartá-las?')) return;
    setEditor(false); setError('');
  }
  async function saveDraft() {
    const parsed = ruleConfigSchema.safeParse(config);
    if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join(' '));
    if (editing && !dirty) return editing;
    const data = await request({ operation: 'save', id: editing?.id, revision: editing?.revision, config: parsed.data });
    setEditing(data.rule); setDirty(false); setRules(previous => [data.rule, ...previous.filter(rule => rule.id !== data.rule.id)]);
    return data.rule as StoredRule;
  }
  async function act(operation: 'save' | 'simulate' | 'publish') {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await saveDraft();
      if (operation === 'save') setNotice('Rascunho salvo no servidor. A versão ativa, quando existir, continua em uso.');
      else {
        const data = await request({ operation, id: saved.id, revision: saved.revision, ...(operation === 'simulate' && sampleId ? { contactId: sampleId } : {}) });
        setEditing(data.rule);
        if (operation === 'simulate') { setSimulation(data.simulation); setNotice('Teste concluído sem enviar mensagens ou alterar contatos.'); }
        else { setNotice('Regra ativada para novos acontecimentos. Contatos e mensagens antigos não serão processados.'); setEditor(false); }
      }
      await refresh();
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function control(rule: StoredRule, operation: 'pause' | 'archive') {
    if (operation === 'archive' && !window.confirm(`Arquivar “${rule.draft.name}”? As ações que ainda não começaram serão canceladas.`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await request({ operation, id: rule.id, revision: rule.revision }); await refresh(); setNotice(operation === 'pause' ? 'Regra pausada. Ações ainda não iniciadas foram canceladas. Um envio já iniciado pode ser concluído.' : 'Regra arquivada.'); }
    catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  function labelValue(field: string, value: string) { return valueLabels[value] || (field === 'stageId' ? stages.find(stage => stage.id === value)?.name : field === 'assignedUserId' ? members.find(member => member.id === value)?.name : '') || value; }
  function summary(rule: RuleConfig) {
    return <div className="space-y-2 text-sm text-slate-700"><p><strong>Quando:</strong> {triggerLabels[rule.trigger]}{rule.trigger === 'LEAD_INACTIVE' ? ` por ${rule.inactivityHours} hora(s)` : ''}.</p>
      <p><strong>Para quem:</strong> {rule.conditions.length ? rule.conditions.map(condition => `${fieldLabels[condition.field]} ${condition.operator === 'IS_EMPTY' ? 'não preenchido' : `${condition.operator === 'NOT_EQUALS' ? 'diferente de' : 'igual a'} ${labelValue(condition.field, condition.value)}`}`).join(rule.match === 'ALL' ? ' e ' : ' ou ') : 'contatos comerciais, sem pedido de interrupção'}.</p>
      <p><strong>O que fazer:</strong> {rule.actions.map(action => actionLabels[action.type]).join('; ')}.</p>
      <p><strong>Horário:</strong> {rule.schedule.onlyBusinessHours ? `${rule.schedule.start} às ${rule.schedule.end}, nos dias escolhidos (${rule.schedule.timezone})` : 'assim que o acontecimento chegar ao servidor'}.</p>
    </div>;
  }
  return <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900">Automações e regras comerciais</h1><p className="mt-1 text-sm text-slate-600">Organize o atendimento com regras que você pode entender, testar e alterar.</p></div>
      {!editor && <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => setTemplatesOpen(true)}>Modelos de mensagem</button><button className={primaryClass} disabled={!canManage || loading || busy || !!error} onClick={() => open()}><Plus className="mr-1 inline h-4 w-4" />Criar automação</button></div>}
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 underline" disabled={busy} onClick={async () => { setError(''); setLoading(true); try { await refresh(); } catch (error: any) { setError(error.message); } finally { setLoading(false); } }}>Atualizar lista</button></div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
    {!canManage && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Você pode acompanhar as regras. Administradores e gestores podem editar e ativar.</p>}
    {loading ? <p role="status">Carregando as regras salvas…</p> : editor ? <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="flex items-center justify-between gap-3"><button className={buttonClass} disabled={busy} onClick={close}><ArrowLeft className="mr-1 inline h-4 w-4" />Voltar à lista</button><span className="text-sm text-slate-500">Etapa {step + 1} de 5</span></div>
      {editing?.status === 'ACTIVE' && <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">Você está editando um rascunho. A versão publicada continua ativa até você testar e ativar a alteração.</p>}
      <nav aria-label="Etapas da configuração" className="my-5 flex flex-wrap gap-2">{['Objetivo', 'Critérios', 'Ações', 'Horários', 'Conferir e testar'].map((label, index) => <button key={label} aria-current={step === index ? 'step' : undefined} className={`rounded-full px-3 py-1 text-sm ${step === index ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`} disabled={busy} onClick={() => setStep(index)}>{index + 1}. {label}</button>)}</nav>
      <h2 ref={headingRef} tabIndex={-1} className="mb-4 text-lg font-bold text-slate-900 outline-none">{['Qual é o objetivo?', 'Só para quem atender aos critérios', 'O que deve acontecer?', 'Quando as ações podem acontecer?', 'Confira antes de ativar'][step]}</h2>
      <fieldset disabled={busy || !canManage} className="space-y-4">
      {step === 0 && <>
        {!editing && <div className="grid gap-2 sm:grid-cols-3">{[{ name: 'Receber novos interessados', type: 'PREPARE_MESSAGE' }, { name: 'Lembrar primeiro atendimento', type: 'CREATE_TASK' }, { name: 'Organizar novos contatos', type: 'ADD_TAG' }].map(preset => <button key={preset.name} className={`${buttonClass} text-left`} onClick={() => change({ name: preset.name, actions: [newAction(preset.type as RuleAction['type'])] })}><Zap className="mb-2 h-5 w-5 text-indigo-600" />{preset.name}</button>)}</div>}
        <label className="block text-sm font-semibold">Nome da regra<input maxLength={120} className={`${inputClass} mt-1`} value={config.name} onChange={event => change({ name: event.target.value })} /></label>
        <label className="block text-sm font-semibold">Descrição (opcional)<input maxLength={500} className={`${inputClass} mt-1`} value={config.description} onChange={event => change({ description: event.target.value })} /></label>
        <label className="block text-sm font-semibold">Quando acontecer…<select className={`${inputClass} mt-1`} value={config.trigger} onChange={event => change({ trigger: event.target.value as RuleConfig['trigger'] })}>{Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value} disabled={value === 'LEAD_INACTIVE' && !capabilities.workerReady}>{label}{value === 'LEAD_INACTIVE' && !capabilities.workerReady ? ' (agendamento indisponível)' : ''}</option>)}</select></label>
        {config.trigger === 'LEAD_INACTIVE' && <label className="block text-sm font-semibold">Sem interação há quantas horas?<input className={`${inputClass} mt-1`} type="number" min={1} max={8760} value={config.inactivityHours} onChange={event => change({ inactivityHours: Number(event.target.value) })} /><span className="mt-1 block font-normal text-slate-600">Conta a última interação do cliente ou da equipe. Vale somente para contatos com novos acontecimentos após a configuração.</span></label>}
      </>}
      {step === 1 && <><p className="text-sm text-slate-600">Sem filtros adicionais, a regra vale para contatos comerciais. Contatos pessoais e pedidos de interrupção ficam de fora.</p>
        {config.conditions.length > 1 && <label className="block text-sm font-semibold">Combinar os critérios<select className={`${inputClass} mt-1`} value={config.match} onChange={event => change({ match: event.target.value as 'ALL' | 'ANY' })}><option value="ALL">Atender a todos</option><option value="ANY">Atender a pelo menos um</option></select></label>}
        {config.conditions.map((condition, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          <label className="text-sm">Critério<select className={inputClass} value={condition.field} onChange={event => change({ conditions: config.conditions.map((item, i) => i === index ? { field: event.target.value as typeof condition.field, operator: 'EQUALS', value: '' } : item) })}>{Object.entries(fieldLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">Comparação<select className={inputClass} value={condition.operator} onChange={event => change({ conditions: config.conditions.map((item, i) => i === index ? { ...item, operator: event.target.value as typeof condition.operator } : item) })}><option value="EQUALS">É igual a</option><option value="NOT_EQUALS">É diferente de</option><option value="IS_EMPTY">Não preenchido</option></select></label>
          {condition.operator !== 'IS_EMPTY' && <label className="text-sm">Valor{condition.field === 'tags' ? <input className={inputClass} value={condition.value} onChange={event => change({ conditions: config.conditions.map((item, i) => i === index ? { ...item, value: event.target.value } : item) })} /> : <select className={inputClass} value={condition.value} onChange={event => change({ conditions: config.conditions.map((item, i) => i === index ? { ...item, value: event.target.value } : item) })}><option value="">Escolha…</option>{(condition.field === 'temperature' ? ['HOT', 'WARM', 'COLD'].map(id => ({ id, name: valueLabels[id] })) : condition.field === 'source' ? Object.entries(valueLabels).filter(([id]) => !['HOT', 'WARM', 'COLD'].includes(id)).map(([id, name]) => ({ id, name })) : condition.field === 'stageId' ? stages : members).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}</label>}
          <button className={`${buttonClass} self-end`} onClick={() => change({ conditions: config.conditions.filter((_, i) => i !== index) })}>Remover critério {index + 1}</button>
        </div>)}<button className={buttonClass} disabled={config.conditions.length >= 8} onClick={() => change({ conditions: [...config.conditions, { field: 'source', operator: 'EQUALS', value: 'WHATSAPP' }] })}>Adicionar critério</button>
      </>}
      {step === 2 && <>{config.actions.map((action, index) => <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-end gap-2"><label className="flex-1 text-sm font-semibold">Ação {index + 1}<select className={`${inputClass} mt-1`} value={action.type} onChange={event => changeAction(index, newAction(event.target.value as RuleAction['type']))}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value} disabled={value === 'SEND_WHATSAPP_MESSAGE' && !capabilities.outboundEnabled}>{label}{value === 'SEND_WHATSAPP_MESSAGE' && !capabilities.outboundEnabled ? ' (indisponível)' : ''}</option>)}</select></label><button aria-label={`Remover ação ${index + 1}`} className={buttonClass} disabled={config.actions.length <= 1} onClick={() => change({ actions: config.actions.filter((_, i) => i !== index) })}><X className="h-4 w-4" /></button></div>
        {'assignee' in action && <label className="block text-sm font-semibold">Responsável pela tarefa<select className={`${inputClass} mt-1`} value={action.assignee} onChange={event => changeAction(index, { ...action, assignee: event.target.value })}><option value="OWNER">Responsável atual do contato</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
        {action.type === 'CREATE_TASK' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">O que lembrar?<input className={`${inputClass} mt-1`} value={action.title} maxLength={200} onChange={event => changeAction(index, { ...action, title: event.target.value })} /></label><label className="text-sm font-semibold">Prazo em horas após a criação<input type="number" min={0} max={8760} step={0.25} className={`${inputClass} mt-1`} value={action.dueHours} onChange={event => changeAction(index, { ...action, dueHours: Number(event.target.value) })} /></label></div>}
        {'message' in action && <>
          <label className="block text-sm font-semibold">Começar com um modelo (opcional)<select className={`${inputClass} mt-1`} value="" onChange={event => { const template = quickReplies.find(template => template.id === event.target.value); if (template) changeAction(index, { ...action, message: template.content }); }}><option value="">Escolher modelo…</option>{quickReplies.filter(template => template.isActive !== false).map(template => <option key={template.id} value={template.id}>{template.title}{template.imageUrl ? ' (somente texto)' : ''}</option>)}</select></label>
          <p className="text-xs text-slate-600">O texto é copiado para esta regra. Alterar o modelo depois não muda uma automação já publicada. Anexos não são enviados por este fluxo.</p>
          <label className="block text-sm font-semibold">Mensagem<textarea rows={5} maxLength={4000} className={`${inputClass} mt-1`} value={action.message} onChange={event => changeAction(index, { ...action, message: event.target.value })} /></label>
          <div className="flex flex-wrap gap-2">{[{ label: 'Nome do cliente', value: '{{nome}}' }, { label: 'Primeiro nome', value: '{{primeiro_nome}}' }, { label: 'Nome da empresa', value: '{{empresa}}' }].map(variable => <button key={variable.value} className={buttonClass} onClick={() => changeAction(index, { ...action, message: `${action.message}${variable.value}` })}>Inserir {variable.label.toLowerCase()}</button>)}</div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="mb-1 text-xs font-bold text-emerald-900">Prévia com dados fictícios</p><p className="whitespace-pre-wrap text-sm">{renderAutomationMessage(action.message, 'Marina Exemplo', currentTenant.name)}</p></div>
          <p className={`text-sm ${action.type === 'SEND_WHATSAPP_MESSAGE' ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>{action.type === 'SEND_WHATSAPP_MESSAGE' ? 'Ao ativar, esta ação enviará mensagens reais pelo WhatsApp conectado. Se o envio ficar sem confirmação, será necessária conferência antes de reenviar.' : 'Cria uma tarefa na agenda com o texto para o corretor revisar. Nenhuma mensagem é enviada automaticamente.'}</p>
        </>}
        {action.type === 'ADD_TAG' && <label className="block text-sm font-semibold">Nome da etiqueta<input className={`${inputClass} mt-1`} value={action.tag} maxLength={80} onChange={event => changeAction(index, { ...action, tag: event.target.value })} /></label>}
        {action.type === 'ASSIGN_BROKER' && <div><p className="mb-2 text-sm text-slate-600">Escolha quem participará da distribuição. Cada novo contato vai para o próximo responsável da lista.</p>{members.map(member => <label key={member.id} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={action.userIds.includes(member.id)} onChange={event => changeAction(index, { ...action, userIds: event.target.checked ? [...action.userIds, member.id] : action.userIds.filter(id => id !== member.id) })} />{member.name}</label>)}</div>}
      </div>)}<button className={buttonClass} disabled={config.actions.length >= 8} onClick={() => change({ actions: [...config.actions, newAction('CREATE_TASK')] })}>Adicionar ação</button><p className="text-sm text-slate-500">As ações internas são realizadas na ordem exibida. Enviar automaticamente depende do processamento do servidor.</p></>}
      {step === 3 && <><label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={config.schedule.onlyBusinessHours} disabled={!capabilities.workerReady} onChange={event => change({ schedule: { ...config.schedule, onlyBusinessHours: event.target.checked } })} />Executar somente no horário de atendimento</label>
        {!capabilities.workerReady && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O agendamento do servidor ainda não está operacional. As regras imediatas continuam disponíveis. Horários, inatividade e envios automáticos exigem esse serviço.</p>}
        {config.schedule.onlyBusinessHours && <><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Início<input className={inputClass} type="time" value={config.schedule.start} onChange={event => change({ schedule: { ...config.schedule, start: event.target.value } })} /></label><label className="text-sm">Fim<input className={inputClass} type="time" value={config.schedule.end} onChange={event => change({ schedule: { ...config.schedule, end: event.target.value } })} /></label><label className="text-sm">Fuso horário<select className={inputClass} value={config.schedule.timezone} onChange={event => change({ schedule: { ...config.schedule, timezone: event.target.value } })}>{Array.from(new Set([config.schedule.timezone, 'America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Rio_Branco', 'America/Noronha'])).map(timezone => <option key={timezone} value={timezone}>{timezone}</option>)}</select></label></div><div className="flex flex-wrap gap-3">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={config.schedule.workDays.includes(index)} onChange={event => change({ schedule: { ...config.schedule, workDays: event.target.checked ? [...config.schedule.workDays, index] : config.schedule.workDays.filter(day => day !== index) } })} />{day}</label>)}</div><p className="text-sm text-slate-600">Fora desse horário, as ações aguardam. Pendências expiram após 24 horas para evitar contatos atrasados.</p></>}
        <p className="text-sm text-slate-600">Prazos dos lembretes são contados em horas corridas. A importação da extensão não aciona estas regras. Para mensagens recebidas acionarem regras sem o navegador, é necessária uma conexão de servidor operacional.</p>
      </>}
      {step === 4 && <><div className="rounded-xl bg-slate-50 p-4"><h3 className="mb-3 font-bold">{config.name || 'Dê um nome à regra'}</h3>{summary(config)}</div>
        <label className="block text-sm font-semibold">Testar com<select className={`${inputClass} mt-1`} value={sampleId} onChange={event => { setSampleId(event.target.value); setSimulation(null); }}><option value="">Contato fictício de exemplo</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}{contact.isPersonal ? ' (pessoal)' : ''}</option>)}</select></label>
        <button className={buttonClass} onClick={() => void act('simulate')}>Testar sem enviar</button><p className="text-sm text-slate-600">O teste salva o rascunho e mostra as ações previstas. Não altera contatos, não cria tarefas e não envia mensagens.</p>
        {simulation && <div role="status" className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm"><strong>Resultado para {simulation.contactName}</strong><p>{simulation.reason}</p>{simulation.outsideBusinessHours && <p>A execução aguardaria o próximo horário de atendimento.</p>}{simulation.matches && simulation.actions.map((action: any, index: number) => <div key={index} className="rounded-lg bg-white p-3"><p className="font-semibold">{actionLabels[action.type as RuleAction['type']]}</p><p className="whitespace-pre-wrap">{action.text}</p>{action.warning && <p className="mt-1 text-amber-800">{action.warning}</p>}</div>)}<p>{simulation.warning}</p></div>}
        {config.actions.some(action => action.type === 'SEND_WHATSAPP_MESSAGE') && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Ativar esta regra autoriza envios reais para novos acontecimentos que atendam aos critérios acima.</p>}
      </>}
      </fieldset>
      <footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4"><button className={buttonClass} disabled={busy || !canManage} onClick={() => void act('save')}>{busy ? 'Aguarde…' : 'Salvar rascunho'}</button><div className="flex gap-2">{step > 0 && <button className={buttonClass} disabled={busy} onClick={() => setStep(step - 1)}>Anterior</button>}{step < 4 ? <button className={primaryClass} disabled={busy} onClick={() => setStep(step + 1)}>Próximo<ArrowRight className="ml-1 inline h-4 w-4" /></button> : <button className={primaryClass} disabled={busy || !canManage || !simulation || dirty || (editing?.status === 'ACTIVE' && editing.publishedRevision === editing.revision)} onClick={() => void act('publish')}>Ativar esta versão</button>}</div></footer>
    </div> : <>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Conteúdo de automações"><button className={tab === 'RULES' ? primaryClass : buttonClass} onClick={() => setTab('RULES')}>Regras ({rules.filter(rule => rule.status !== 'ARCHIVED').length})</button><button className={tab === 'HISTORY' ? primaryClass : buttonClass} onClick={() => setTab('HISTORY')}>Histórico real</button><button aria-label="Atualizar regras e histórico" className={buttonClass} disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); setError(''); } catch (error: any) { setError(error.message); } finally { setBusy(false); } }}><RefreshCw className="h-4 w-4" /></button></nav>
      {tab === 'RULES' ? <><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Mostrar arquivadas</label>
        {!rules.length && !error && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Zap className="mx-auto mb-3 h-8 w-8 text-indigo-600" /><h2 className="font-bold">Crie sua primeira automação</h2><p className="mt-2 text-sm text-slate-600">Comece com um lembrete ou uma mensagem para revisão. Você poderá testar antes de ativar.</p></div>}
        {rules.filter(rule => showArchived || rule.status !== 'ARCHIVED').map(rule => <article key={rule.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold text-slate-900">{rule.published?.name || rule.draft.name}</h2><p className="text-sm text-slate-500">{rule.published?.description || rule.draft.description}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${rule.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>{statusLabels[rule.status]}</span></div>
          {summary(rule.published || rule.draft)}
          {rule.published && rule.revision !== rule.publishedRevision && rule.status === 'ACTIVE' && <p className="text-sm font-semibold text-indigo-700">Há um rascunho para revisar. A versão anterior continua ativa.</p>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button className={buttonClass} disabled={!canManage || busy || rule.status === 'ARCHIVED'} onClick={() => open(rule)}><Pencil className="mr-1 inline h-4 w-4" />{rule.status === 'PAUSED' || rule.status === 'DRAFT' ? 'Editar e testar' : 'Editar'}</button><button className={buttonClass} disabled={!canManage || busy} onClick={() => open(rule, true)}><Copy className="mr-1 inline h-4 w-4" />Duplicar</button>{rule.status === 'ACTIVE' && <button className={buttonClass} disabled={!canManage || busy} onClick={() => void control(rule, 'pause')}><Pause className="mr-1 inline h-4 w-4" />Pausar</button>}{rule.status !== 'ARCHIVED' && <button className={buttonClass} disabled={!canManage || busy} onClick={() => void control(rule, 'archive')}><Archive className="mr-1 inline h-4 w-4" />Arquivar</button>}</div>
        </article>)}
      </> : <><div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{capabilities.workerReady ? 'Agendador do servidor operacional.' : 'Agendador sem confirmação recente. Regras imediatas não dependem dele.'} Abaixo estão as últimas 300 ações. Aceito pelo provedor significa que o envio foi aceito; confira a entrega na conversa.</div>
        {!jobs.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-600">Ainda não há execuções. Simulações aparecem no registro de alterações, sem gerar ações reais.</p>}
        {jobs.map(job => <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{rules.find(rule => rule.id === job.ruleId)?.published?.name || 'Regra arquivada'} · {actionLabels[job.action.type]}</strong><span className={job.status === 'UNKNOWN' ? 'font-bold text-amber-800' : 'text-slate-600'}>{jobLabels[job.status]}</span></div><p className="mt-2">{job.reason}</p><p className="mt-1 text-xs text-slate-500">{contacts.find(contact => contact.id === job.event.contactId)?.name || 'Contato removido'} · versão {job.revision} · {dateLabel(job.updatedAt)}</p></article>)}
        <h2 className="pt-3 font-bold">Registro de alterações e testes</h2>{audit.map(entry => <div key={entry.id} className="rounded-xl bg-white p-3 text-sm">{operationLabels[entry.action] || entry.action} · {rules.find(rule => rule.id === entry.ruleId)?.draft.name || 'Regra'} · {members.find(member => member.id === entry.userId)?.name || 'Administrador'} · {dateLabel(entry.at)}{entry.config && <details className="mt-2"><summary className="cursor-pointer font-semibold">Ver configuração desta versão</summary><div className="mt-2">{summary(entry.config)}</div></details>}</div>)}
      </>}
    </>}
    <MessageTemplatesModal isOpen={templatesOpen} onClose={() => setTemplatesOpen(false)} />
  </div></div>;
}
