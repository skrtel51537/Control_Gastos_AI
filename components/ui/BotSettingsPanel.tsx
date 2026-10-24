import React, { useEffect, useRef, useState } from 'react';
import { BotConfig, DEFAULT_BOT_URL, maskToken } from '../../utils/botApi';

// Panel "Conexión con el bot": dirección de la API y token. Antes de guardar
// se prueba la conexión cargando los datos; si falla, no se guarda nada.

export const BotSettingsPanel = ({ config, willReplaceData, onConnect, onForget, onClose }: {
  config: BotConfig | null,
  willReplaceData: boolean, // hay datos de un Excel o copia que el bot sustituirá
  onConnect: (config: BotConfig) => Promise<string | null>, // devuelve el error, o null si ha ido bien
  onForget: () => void,
  onClose: () => void,
}) => {
  const [url, setUrl] = useState(config?.url ?? DEFAULT_BOT_URL);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Referencia estable: así el efecto no se repite cada vez que el padre se redibuja.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Con el campo vacío se mantiene el token ya guardado.
    const finalToken = token.trim() || config?.token || '';
    if (!url.trim()) return setMessage('Escribe la dirección del bot.');
    if (!finalToken) return setMessage('Escribe el token.');
    if (willReplaceData) {
      const ok = window.confirm(
        'Los datos del bot sustituirán a los que tienes cargados ahora (Excel o copia de seguridad). ' +
        'Tus objetivos y presupuestos no cambian.\n\n¿Continuar?'
      );
      if (!ok) return;
    }
    setBusy(true);
    setMessage(null);
    const error = await onConnect({ url: url.trim(), token: finalToken });
    setBusy(false);
    if (error) setMessage(error);
    else onClose();
  };

  const forget = () => {
    const ok = window.confirm(
      'Se borrarán la dirección y el token guardados en este equipo. Los datos ya cargados se mantienen.\n\n¿Continuar?'
    );
    if (!ok) return;
    onForget();
    onClose();
  };

  const inputClass =
    'mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 ' +
    'placeholder:text-slate-500 outline-none focus:border-indigo-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-title"
        onSubmit={submit}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl" aria-hidden="true">🤖</div>
            <div>
              <h2 id="bot-title" className="text-lg font-bold text-slate-100">Conexión con el bot</h2>
              <p className="text-sm text-slate-400">Carga los gastos que apuntas en Telegram.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-100 font-bold px-2 py-1 rounded-lg hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <label className="block mt-6 text-sm font-semibold text-slate-300">
          Dirección del bot
          <input
            ref={firstFieldRef}
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">Si el bot está en este ordenador, deja {DEFAULT_BOT_URL}.</p>

        <label className="block mt-4 text-sm font-semibold text-slate-300">
          Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={config ? `Guardado: ${maskToken(config.token)}` : 'Pega aquí tu token'}
            className={inputClass}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">
          {config ? 'Déjalo vacío para mantener el token guardado. ' : ''}
          Está en el archivo <code>.env</code> del bot, en la línea <code>API_TOKENS=tu_nombre:token</code>:
          copia solo lo que va después de los dos puntos. Se guarda cifrado en este equipo.
        </p>

        {message && (
          <div role="alert" className="mt-4 p-3 border rounded-xl text-sm bg-amber-500/10 border-amber-500/20 text-amber-300">
            {message}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          {config ? (
            <button
              type="button"
              onClick={forget}
              disabled={busy}
              className="text-sm text-red-400 hover:text-red-300 px-2 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Olvidar conexión
            </button>
          ) : <span />}
          <button
            type="submit"
            disabled={busy}
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors"
          >
            {busy ? 'Conectando…' : 'Conectar y cargar'}
          </button>
        </div>
      </form>
    </div>
  );
};
