import React from 'react';
import type { DataSource } from '../../types';

// Franja que indica de cuándo son los datos del bot, si se están actualizando
// o si la última carga ha fallado (en ese caso se siguen viendo los guardados).

const formatTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '';

export const BotStatusBar = ({ source, loading, error, onReload, onDismissError }: {
  source: DataSource | null,
  loading: boolean,
  error: string | null,
  onReload: () => void,
  onDismissError: () => void,
}) => {
  const fromBot = source?.type === 'bot';
  const when = fromBot ? formatTime(source.generatedAt || source.loadedAt) : '';

  if (loading) {
    return (
      <div role="status" className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-200 text-sm animate-pulse">
        🤖 Cargando datos del bot…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="flex items-start justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
        <span>
          ⚠️ {error}
          {fromBot && when && <span className="block mt-1 text-xs opacity-80">Se muestran los datos guardados del {when}.</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <button onClick={onReload} className="text-amber-200 hover:text-white font-medium px-2 py-1 rounded-lg hover:bg-amber-500/10">
            Reintentar
          </button>
          <button onClick={onDismissError} className="text-amber-400 hover:text-amber-200 font-bold px-1" title="Cerrar aviso" aria-label="Cerrar aviso">
            ✕
          </button>
        </span>
      </div>
    );
  }

  if (!fromBot) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-sm">
      <span>🤖 Datos del bot{when ? ` · actualizados el ${when}` : ''}</span>
      <button onClick={onReload} className="text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-lg hover:bg-slate-800 shrink-0">
        Recargar
      </button>
    </div>
  );
};
