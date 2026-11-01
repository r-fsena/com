'use client';

import { campaignParts, renderCampaignMessage, type CampaignConfig, type CampaignPart } from '@/lib/campaigns';

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const button = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
export const sequenceIntervalLabel = (seconds: number) => seconds < 60 ? `${seconds} segundos` : seconds % 60 === 0 ? `${seconds / 60} minuto${seconds === 60 ? '' : 's'}` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
export const sequenceSizeLabel = (count: number) => `${count} mensage${count === 1 ? 'm' : 'ns'}`;

export function CampaignSequencePreview({ parts, intervalSeconds = 30, name, company, broker }: {
  parts: CampaignPart[]; intervalSeconds?: number; name?: string; company?: string; broker?: string;
}) {
  return <ol aria-label="Ordem das mensagens" className="space-y-3">
    {parts.map((part, index) => <li key={index} className="space-y-2">
      {index > 0 && <p className="text-center text-xs text-slate-600">Aguardar pelo menos {sequenceIntervalLabel(intervalSeconds)} após a confirmação da mensagem anterior</p>}
      <div className="ml-auto max-w-full rounded-xl rounded-tr-none border border-emerald-200 bg-emerald-50 p-3 text-sm sm:max-w-[90%]">
        <p className="mb-1 text-xs font-bold text-emerald-900">Mensagem {index + 1}</p>
        {part.attachment && <p className="mb-1 break-all text-xs text-slate-600">Anexo: {part.attachment.fileName}</p>}
        <p className="whitespace-pre-wrap break-words">{name ? renderCampaignMessage(part.message, name, company || '', broker) : part.message}</p>
      </div>
    </li>)}
  </ol>;
}

export function CampaignSequenceEditor({ config, onChange, onIntervalChange, upload, storageReady, tenantId, company, templates }: {
  config: CampaignConfig; onChange: (parts: CampaignPart[]) => void; onIntervalChange: (seconds: number) => void;
  upload: (index: number, file?: File) => Promise<void>; storageReady: boolean; tenantId: string; company: string;
  templates: { id: string; title: string; content: string; isActive?: boolean }[];
}) {
  const parts = campaignParts(config), interval = config.intervalSeconds ?? 30;
  const update = (index: number, patch: Partial<CampaignPart>) => onChange(parts.map((part, current) => current === index ? { ...part, ...patch } : part));
  const move = (index: number, direction: number) => { const next = [...parts]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next); };
  return <div className="space-y-5">
    <p className="text-sm text-slate-600">Monte até cinco mensagens. Cada bloco chegará como uma mensagem separada, na ordem abaixo. Se o contato responder, as próximas partes serão interrompidas para a equipe assumir.</p>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{parts.length} de 5 mensagens</strong><button type="button" className={button} disabled={parts.length >= 5} onClick={() => onChange([...parts, { message: '' }])}>Adicionar mensagem</button></div>
    {parts.map((part, index) => {
      const mediaUrl = part.attachment ? `/api/v1/campaigns/media?tenantId=${encodeURIComponent(tenantId)}&key=${encodeURIComponent(part.attachment.key)}` : '';
      return <section key={index} aria-label={`Editar mensagem ${index + 1}`} className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Mensagem {index + 1}</h3><div className="flex flex-wrap gap-2">
          <button type="button" className={button} aria-label={`Mover mensagem ${index + 1} para cima`} disabled={index === 0} onClick={() => move(index, -1)}>Subir</button>
          <button type="button" className={button} aria-label={`Mover mensagem ${index + 1} para baixo`} disabled={index === parts.length - 1} onClick={() => move(index, 1)}>Descer</button>
          <button type="button" className={button} aria-label={`Remover mensagem ${index + 1}`} disabled={parts.length === 1} onClick={() => onChange(parts.filter((_, current) => current !== index))}>Remover</button>
        </div></div>
        <label className="block text-sm font-semibold">Modelo para a mensagem {index + 1} (opcional)<select className={input} value="" onChange={event => { const template = templates.find(template => template.id === event.target.value); if (template) update(index, { message: template.content }); }}><option value="">Escolher modelo…</option>{templates.filter(template => template.isActive !== false).map(template => <option key={template.id} value={template.id}>{template.title} (texto)</option>)}</select></label>
        <label className="block text-sm font-semibold">Mensagem {index + 1}<textarea className={input} rows={4} maxLength={part.attachment ? 1024 : 4096} value={part.message} onChange={event => update(index, { message: event.target.value })} /></label>
        <p className="text-xs text-slate-500">{part.message.length} de {part.attachment ? 1024 : 4096} caracteres.</p>
        <div className="flex flex-wrap gap-2">{[{ label: 'Nome do cliente', value: '{{nome}}' }, { label: 'Primeiro nome', value: '{{primeiro_nome}}' }, { label: 'Empresa', value: '{{empresa}}' }, { label: 'Corretor responsável', value: '{{corretor_nome}}' }].map(variable => <button type="button" key={variable.value} className={button} aria-label={`Inserir ${variable.label.toLowerCase()} na mensagem ${index + 1}`} onClick={() => update(index, { message: part.message + variable.value })}>Inserir {variable.label.toLowerCase()}</button>)}</div>
        <label className="block text-sm font-semibold">Imagem ou PDF da mensagem {index + 1} (opcional)<input className={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!storageReady} onChange={event => { void upload(index, event.target.files?.[0]); event.target.value = ''; }} /></label>
        {part.attachment && <div className="space-y-2 rounded-xl bg-slate-50 p-3">{part.attachment.mimeType.startsWith('image/') ? <img alt={`Anexo da mensagem ${index + 1}`} src={mediaUrl} className="max-h-48 rounded-lg object-contain" /> : <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 underline">Abrir PDF para conferir</a>}<p className="break-all text-sm">{part.attachment.fileName} · {(part.attachment.size / 1024).toFixed(0)} KB</p><button type="button" className={button} onClick={() => update(index, { attachment: undefined })}>Remover anexo da mensagem {index + 1}</button></div>}
      </section>;
    })}
    <p className="text-xs text-slate-600">Anexos: JPG, PNG, WebP ou PDF até 10 MB por mensagem. O texto acompanha o arquivo como legenda.</p>
    {!storageReady && <p className="text-sm text-amber-800">O armazenamento de anexos ainda precisa ser configurado.</p>}
    {parts.length > 1 && <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <label className="block text-sm font-semibold">Intervalo entre mensagens (segundos)<input className={input} type="number" min={15} max={3600} step={1} value={interval} onWheel={event => event.currentTarget.blur()} onChange={event => onIntervalChange(Number(event.target.value))} /></label>
      <p className="text-sm">Padrão: 30 segundos. Escolha entre 15 segundos e uma hora. A contagem começa quando o provedor confirma a mensagem anterior.</p>
      <p className="text-xs text-slate-600">Este é um tempo mínimo, não um horário exato. A fila, a frequência do processador, pausas e o horário de atendimento podem aumentar a espera. Fechar esta tela não cancela o timer.</p>
    </div>}
    <section className="space-y-3 rounded-xl border border-emerald-200 p-4"><h3 className="text-sm font-bold">Prévia da conversa com dados fictícios</h3><CampaignSequencePreview parts={parts} intervalSeconds={interval} name="Marina Exemplo" company={company} broker="Corretor de exemplo" /></section>
  </div>;
}
