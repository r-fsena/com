'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-950 text-white select-none">
      <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-5 shadow-xl">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <h1 className="text-xl font-bold text-white mb-2">
        Falha temporária ao carregar a página
      </h1>

      <p className="text-xs text-slate-400 max-w-md text-center mb-6">
        Detectamos uma instabilidade temporária na renderização da tela. Clique no botão abaixo para restaurar a interface instantaneamente.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg cursor-pointer active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Restaurar Aplicação</span>
        </button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}
