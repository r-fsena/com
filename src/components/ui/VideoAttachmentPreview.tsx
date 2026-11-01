'use client';

import { useEffect, useState } from 'react';

export function VideoAttachmentPreview({ url, label, preload = 'metadata' }: { url: string; label: string; preload?: 'metadata' | 'none' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/api/v1/campaigns/media?')) return <p className="text-sm text-slate-500">Arquivo original do vídeo não disponível.</p>;
  return <div className="space-y-2">
    <video key={url} aria-label={label} src={url} controls playsInline preload={preload} className="max-h-64 w-full rounded-lg bg-slate-900" onError={() => setFailed(true)} />
    {failed && <p role="status" className="text-sm text-amber-800">Não foi possível reproduzir a prévia. Confira o arquivo ou tente abrir o vídeo pelo link abaixo.</p>}
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 underline">Abrir vídeo para conferir</a>
  </div>;
}

