import React, { useEffect, useRef, useState } from 'react';
import type { AppInfo, UpdateStatus } from '../../electron-env';

// Panel "Acerca de": versión de la app, búsqueda manual de actualizaciones y
// el resultado de la última comprobación (con los errores explicados).

const formatTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '';

const describeStatus = (s: UpdateStatus, current: string): { text: string; tone: 'ok' | 'info' | 'error' } => {
  switch (s.state) {
    case 'checking':
      return { text: 'Buscando actualizaciones…', tone: 'info' };
    case 'not-available':
      return { text: `Tienes la última versión (v${current}).`, tone: 'ok' };
    case 'available':
      return { text: `Hay una versión nueva${s.version ? ` (v${s.version})` : ''}. Descargándola…`, tone: 'info' };
    case 'downloading':
      return { text: `Descargando la versión nueva${s.version ? ` (v${s.version})` : ''}… ${s.percent ?? 0} %`, tone: 'info' };
    case 'downloaded':
      return { text: `La versión${s.version ? ` v${s.version}` : ' nueva'} está lista. Reinicia la aplicación para instalarla.`, tone: 'ok' };
    case 'error':
      return { text: s.message ?? 'No se ha podido comprobar si hay actualizaciones.', tone: 'error' };
    default:
      return { text: 'Todavía no se ha comprobado en esta sesión.', tone: 'info' };
  }
};

const TONE_CLASSES = {
  ok: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  info: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200',
  error: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
};

export const AboutPanel = ({ onClose }: { onClose: () => void }) => {
  const api = window.electronAPI;
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  const closeRef = useRef<HTMLButtonElement>(null);
  // Referencia estable: así el efecto no se repite cada vez que el padre se redibuja.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    api?.getAppInfo?.()
      .then((i) => {
        if (i) {
          setInfo(i);
          setStatus(i.update);
        }
      })
      .catch(() => {});
    const unsubscribe = api?.onUpdateStatus?.(setStatus);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unsubscribe?.();
      window.removeEventListener('keydown', onKey);
    };
  }, [api]);

  const version = info?.version ?? __APP_VERSION__;
  const busy = status.state === 'checking' || status.state === 'available' || status.state === 'downloading';
  const { text, tone } = describeStatus(status, version);

  const checkNow = () => {
    setStatus({ state: 'checking' });
    api?.checkForUpdates().then((s) => s && setStatus(s)).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl" aria-hidden="true">💸</div>
            <div>
              <h2 id="about-title" className="text-lg font-bold text-slate-100">Control de Gastos</h2>
              <p className="text-sm text-slate-400">Versión {version}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 font-bold px-2 py-1 rounded-lg hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-slate-300">Actualizaciones</h3>
        {api ? (
          <>
            <div role="status" aria-live="polite" className={`mt-2 p-3 border rounded-xl text-sm ${TONE_CLASSES[tone]}`}>
              {text}
              {status.at && status.state !== 'checking' && (
                <span className="block mt-1 text-xs opacity-70">Última comprobación: {formatTime(status.at)}</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {status.state === 'downloaded' ? (
                <button
                  onClick={() => api.restartApp()}
                  className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  Reiniciar e instalar
                </button>
              ) : (
                <button
                  onClick={checkNow}
                  disabled={busy}
                  className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors"
                >
                  {busy ? 'Buscando…' : 'Buscar actualizaciones'}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Las actualizaciones automáticas solo funcionan en la aplicación de escritorio.
          </p>
        )}

        {info && (
          <details className="mt-6 text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-300">Detalles técnicos</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt>Electron</dt><dd>{info.electron}</dd>
              <dt>Chromium</dt><dd>{info.chrome}</dd>
              <dt>Node.js</dt><dd>{info.node}</dd>
              <dt>Instalada</dt><dd>{info.isPackaged ? 'Sí' : 'No (modo desarrollo)'}</dd>
              {status.detail && (<><dt>Error</dt><dd className="break-all">{status.detail}</dd></>)}
            </dl>
          </details>
        )}
      </div>
    </div>
  );
};
