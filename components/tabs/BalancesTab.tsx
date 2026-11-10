import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BotConfig } from '../../utils/botApi';
import {
  BalanceData, BalanceMonth, Payer, SharedExpense, isSettled, loadBalanceFromBot, monthLabel,
  pendingPayment, settleMonthInBot,
} from '../../utils/balance';
import { formatEuroCents } from '../../utils/format';
import { Segmented } from '../ui/Segmented';

// Pestaña Balances: quién debe cuánto a quién cada mes por los gastos
// compartidos. Cada mes es independiente (se salda a final de mes).
// Cada persona tiene su color en toda la pestaña: tú índigo y tu pareja ámbar.

const PERSON = {
  me: { text: 'text-indigo-300', bg: 'bg-indigo-500', soft: 'bg-indigo-500/15', ring: 'ring-indigo-400/40', border: 'border-l-indigo-500' },
  partner: { text: 'text-amber-300', bg: 'bg-amber-500', soft: 'bg-amber-500/15', ring: 'ring-amber-400/40', border: 'border-l-amber-500' },
} as const;

type PayerFilter = 'all' | Payer;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const shortDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

const Avatar = ({ who, name, size = 'md' }: { who: Payer, name: string, size?: 'sm' | 'md' | 'lg' }) => {
  const dims = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <span
      className={`${dims} ${PERSON[who].soft} ${PERSON[who].text} ring-1 ${PERSON[who].ring} rounded-full flex items-center justify-center font-bold shrink-0`}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
};

// "En paz" sin deuda o "Saldado" cuando había deuda y se ha pagado.
const settledLabel = (month: BalanceMonth) => (month.settlements.length > 0 ? 'Saldado ✓' : 'Estáis en paz ✓');

// Tarjeta principal: el resultado del mes y cuánto ha pagado cada uno.
const SummaryCard = ({ month, me, partner, settling, onSettle }: {
  month: BalanceMonth, me: string, partner: string, settling: boolean, onSettle: () => void,
}) => {
  const settled = isSettled(month.balance);
  const creditor: Payer = month.balance > 0 ? 'me' : 'partner';
  const total = month.paidByMe + month.paidByPartner;
  const myPct = total > 0 ? (month.paidByMe / total) * 100 : 50;

  return (
    <div className="relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
      <div
        className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 ${settled ? 'bg-emerald-500' : PERSON[creditor].bg}`}
        aria-hidden="true"
      />
      <div className="relative flex flex-col sm:flex-row items-center gap-6">
        {/* Quien debe → quien cobra (en paz: tú = tu pareja). */}
        <div className="flex items-center gap-3" aria-hidden="true">
          {(settled ? ['me', 'partner'] as const : [creditor === 'me' ? 'partner' : 'me', creditor] as const).map((p, i) => (
            <React.Fragment key={p}>
              {i === 1 && <span className={`text-2xl ${settled ? 'text-emerald-400' : 'text-slate-500'}`}>{settled ? '=' : '→'}</span>}
              <div className="flex flex-col items-center gap-1">
                <Avatar who={p} name={p === 'me' ? me : partner} size="lg" />
                <span className="text-xs text-slate-400">{p === 'me' ? 'Tú' : partner}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="text-center sm:text-left flex-1">
          <p className="text-sm text-slate-400">Balance de {monthLabel(month.month)}</p>
          {settled ? (
            <p className="text-3xl font-bold text-emerald-400 mt-1">{settledLabel(month)}</p>
          ) : (
            <>
              <p className="text-lg text-slate-200 mt-1">
                {creditor === 'me' ? <><span className={PERSON.partner.text}>{partner}</span> te debe</> : <>Le debes a <span className={PERSON.partner.text}>{partner}</span></>}
              </p>
              <p className={`text-4xl font-bold font-mono tracking-tight ${PERSON[creditor].text}`}>
                {formatEuroCents(Math.abs(month.balance))}
              </p>
            </>
          )}
        </div>

        {!settled && (
          <button
            type="button"
            onClick={onSettle}
            disabled={settling}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            {settling ? 'Apuntando…' : `🤝 Saldar ${monthLabel(month.month)}`}
          </button>
        )}
      </div>

      {/* Pagos apuntados para este mes (los gastos compartidos no se tocan). */}
      {month.settlements.length > 0 && (
        <ul className="relative mt-5 space-y-1.5">
          {month.settlements.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <span aria-hidden="true">💸</span>
              <span className="text-slate-300">
                {capitalize(shortDate(s.date))} · {s.paidBy === 'me'
                  ? <>pagaste a <span className={PERSON.partner.text}>{partner}</span></>
                  : <><span className={PERSON.partner.text}>{partner}</span> te pagó</>}
              </span>
              <span className="ml-auto font-mono font-semibold text-emerald-300">{formatEuroCents(s.amount)}</span>
            </li>
          ))}
          {!settled && (
            <li className="text-xs text-slate-500 px-1">
              Después del pago se han apuntado más gastos de este mes: queda pendiente lo nuevo.
            </li>
          )}
        </ul>
      )}

      <div className="relative mt-6">
        <div className="flex justify-between text-xs mb-1.5">
          <span className={PERSON.me.text}>Tú pagaste <b className="font-mono">{formatEuroCents(month.paidByMe)}</b></span>
          <span className={PERSON.partner.text}>{partner} pagó <b className="font-mono">{formatEuroCents(month.paidByPartner)}</b></span>
        </div>
        <div
          className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex"
          role="img"
          aria-label={`Tú pagaste el ${Math.round(myPct)} % de los gastos compartidos`}
        >
          <div className={`${PERSON.me.bg} transition-all`} style={{ width: `${myPct}%` }} />
          <div className={`${PERSON.partner.bg} flex-1`} />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {month.items.length} {month.items.length === 1 ? 'gasto compartido' : 'gastos compartidos'} · total {formatEuroCents(total)} · a cada uno le tocan {formatEuroCents(total / 2)}
        </p>
      </div>
    </div>
  );
};

const ExpenseRow = ({ e, me, partner }: { e: SharedExpense, me: string, partner: string }) => {
  const mine = e.paidBy === 'me';
  // Lo que este gasto suma al balance: si pagué yo, me deben su parte; si no, debo la mía.
  const effect = mine ? e.partnerShare : -e.myShare;
  const pending = !e.otherHalfAdded;
  return (
    <li className={`flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg border-l-2 ${PERSON[e.paidBy].border} hover:bg-slate-800/50 transition-colors`}>
      <Avatar who={e.paidBy} name={mine ? me : partner} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 font-medium truncate">{e.concept}</p>
        <p className="text-xs text-slate-500 truncate">
          {capitalize(shortDate(e.date))} · <span className={PERSON[e.paidBy].text}>{mine ? 'Pagaste tú' : `Pagó ${partner}`}</span>
          {pending && (
            <span
              className="ml-2 inline-block text-[10px] font-semibold bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded"
              title={mine ? `${partner} aún no ha añadido su mitad a sus gastos` : 'Aún no has añadido tu mitad a tus gastos (en Telegram)'}
            >
              ⚠️ {mine ? `${partner} no ha añadido su mitad` : 'Falta añadir tu mitad'}
            </span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-mono font-semibold text-slate-100">{formatEuroCents(e.total)}</p>
        <p className={`text-[11px] ${effect > 0 ? PERSON.me.text : PERSON.partner.text}`}>
          {effect > 0 ? `${partner} te debe ${formatEuroCents(effect)}` : `Le debes ${formatEuroCents(-effect)}`}
        </p>
      </div>
    </li>
  );
};

const ExpenseList = ({ month, me, partner }: { month: BalanceMonth, me: string, partner: string }) => {
  const [filter, setFilter] = useState<PayerFilter>('all');
  useEffect(() => setFilter('all'), [month.month]);

  const count = (p: Payer) => month.items.filter((e) => e.paidBy === p).length;
  const shown = filter === 'all' ? month.items : month.items.filter((e) => e.paidBy === filter);
  const pending = month.items.filter((e) => !e.otherHalfAdded);
  const myPending = pending.filter((e) => e.paidBy === 'partner').length;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Gastos compartidos</h3>
          <p className="text-sm text-slate-500">
            {pending.length === 0
              ? 'Las dos mitades están apuntadas.'
              : `${pending.length} con una mitad sin añadir${myPending > 0 ? ` (${myPending} ${myPending === 1 ? 'es tuya' : 'son tuyas'})` : ''}. No cambia el balance.`}
          </p>
        </div>
        <Segmented
          label="Quién pagó"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: `Todos (${month.items.length})` },
            { id: 'me', label: `Pagados por mí (${count('me')})` },
            { id: 'partner', label: `Pagados por ${partner} (${count('partner')})` },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-10">No hay gastos con este filtro.</p>
      ) : (
        <ul className="space-y-1 max-h-[480px] overflow-y-auto -mx-2 px-2">
          {shown.map((e) => <ExpenseRow key={e.id} e={e} me={me} partner={partner} />)}
        </ul>
      )}
    </div>
  );
};

// Resultado de cada mes; pulsar uno lo abre arriba.
const History = ({ months, selected, onSelect, partner }: {
  months: BalanceMonth[], selected: string, onSelect: (m: string) => void, partner: string,
}) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
    <h3 className="text-lg font-semibold text-white mb-1">Todos los meses</h3>
    <p className="text-sm text-slate-500 mb-4">Cada mes se salda por separado.</p>
    <ul className="space-y-1">
      {months.slice().reverse().map((m) => {
        const settled = isSettled(m.balance);
        const total = m.paidByMe + m.paidByPartner;
        const myPct = total > 0 ? (m.paidByMe / total) * 100 : 50;
        return (
          <li key={m.month}>
            <button
              type="button"
              onClick={() => onSelect(m.month)}
              aria-current={m.month === selected ? 'true' : undefined}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg text-left transition-colors ${
                m.month === selected ? 'bg-indigo-600/10 border border-indigo-500/20' : 'hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span className="w-36 text-sm text-slate-200 shrink-0">{capitalize(monthLabel(m.month))}</span>
              <span className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:flex" aria-hidden="true">
                <span className={PERSON.me.bg} style={{ width: `${myPct}%` }} />
                <span className={`${PERSON.partner.bg} flex-1`} />
              </span>
              <span className={`text-sm font-mono text-right w-44 shrink-0 ${settled ? 'text-emerald-400' : m.balance > 0 ? PERSON.me.text : PERSON.partner.text}`}>
                {settled ? (m.settlements.length > 0 ? 'Saldado ✓' : 'En paz') : m.balance > 0 ? `${partner} te debe ${formatEuroCents(m.balance)}` : `Debes ${formatEuroCents(-m.balance)}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </div>
);

const Notice = ({ icon, title, children }: { icon: string, title: string, children?: React.ReactNode }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-10 text-center">
    <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    {children && <div className="text-sm text-slate-400 mt-2 max-w-md mx-auto">{children}</div>}
  </div>
);

export const BalancesTab = ({ botConfig, onOpenBotSettings }: {
  botConfig: BotConfig | null,
  onOpenBotSettings: () => void,
}) => {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!botConfig) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadBalanceFromBot(botConfig);
      setData(result);
      // Se abre el mes más reciente, o se mantiene el elegido si sigue existiendo.
      setSelected((prev) => (prev && result.months.some((m) => m.month === prev) ? prev : result.months.at(-1)?.month ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido cargar el balance.');
    } finally {
      setLoading(false);
    }
  }, [botConfig]);

  useEffect(() => {
    load();
  }, [load]);

  const index = useMemo(() => data?.months.findIndex((m) => m.month === selected) ?? -1, [data, selected]);
  const month = data && index >= 0 ? data.months[index] : null;

  const [settling, setSettling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setNotice(null), [selected]);

  // Saldar el mes abierto: se pide confirmación con la frase exacta y el bot
  // apunta el pago (calcula él el importe y avisa a la otra persona).
  const settle = async () => {
    if (!botConfig || !data?.partner || !month) return;
    const pending = pendingPayment(month);
    if (!pending) return;
    const amount = formatEuroCents(pending.amount);
    const label = monthLabel(month.month);
    const sentence = pending.payer === 'me'
      ? `Vas a registrar que has pagado ${amount} a ${data.partner} por ${label}.`
      : `Vas a registrar que ${data.partner} te ha pagado ${amount} por ${label}.`;
    const ok = window.confirm(
      `${sentence}\n\nEl balance de ese mes quedará a 0. Los gastos compartidos no se borran ` +
      `y ${data.partner} recibirá un aviso en Telegram (desde allí se puede anular).\n\n¿Continuar?`,
    );
    if (!ok) return;

    setSettling(true);
    setError(null);
    setNotice(null);
    try {
      const result = await settleMonthInBot(botConfig, month.month);
      setData((prev) => prev && { ...prev, months: prev.months.map((m) => (m.month === result.month.month ? result.month : m)) });
      setNotice(`Pago apuntado: ${formatEuroCents(result.settlement.amount)} por ${label}. ${data.partner} recibirá el aviso en Telegram.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido apuntar el pago.');
    } finally {
      setSettling(false);
    }
  };

  if (!botConfig) {
    return (
      <Notice icon="🤝" title="Los balances salen del bot">
        <p>Solo el bot sabe quién pagó cada gasto compartido. Conecta la app con el bot para verlos.</p>
        <button type="button" onClick={onOpenBotSettings} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">
          Conexión con el bot
        </button>
      </Notice>
    );
  }

  if (!data) {
    if (error) {
      return (
        <Notice icon="⚠️" title="No se ha podido cargar el balance">
          <p>{error}</p>
          <button type="button" onClick={load} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-medium">
            Reintentar
          </button>
        </Notice>
      );
    }
    return <div role="status" className="p-8 text-center text-slate-500 animate-pulse">🤝 Calculando balances…</div>;
  }

  if (!data.partner) {
    return <Notice icon="👤" title="No hay otra persona en el bot">El bot no tiene configurada a tu pareja, así que no hay gastos compartidos que repartir.</Notice>;
  }

  const partner = data.partner;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => index > 0 && setSelected(data.months[index - 1].month)}
            disabled={index <= 0}
            aria-label="Mes anterior"
            className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30"
          >
            ‹
          </button>
          <h2 className="text-xl font-semibold text-white min-w-[11rem] text-center">
            {month ? capitalize(monthLabel(month.month)) : 'Sin gastos compartidos'}
          </h2>
          <button
            type="button"
            onClick={() => index < data.months.length - 1 && setSelected(data.months[index + 1].month)}
            disabled={index < 0 || index >= data.months.length - 1}
            aria-label="Mes siguiente"
            className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-3 text-xs text-slate-400" aria-label="Colores">
            <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${PERSON.me.bg}`} />Tú</span>
            <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${PERSON.partner.bg}`} />{partner}</span>
          </span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300 hover:text-white disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
          ⚠️ {error} Se muestra el último balance cargado.
        </div>
      )}

      {notice && (
        <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm">
          ✓ {notice}
        </div>
      )}

      {month ? (
        <>
          <SummaryCard month={month} me={data.user} partner={partner} settling={settling} onSettle={settle} />
          <ExpenseList month={month} me={data.user} partner={partner} />
          {data.months.length > 1 && <History months={data.months} selected={month.month} onSelect={setSelected} partner={partner} />}
        </>
      ) : (
        <Notice icon="🤝" title="Aún no hay gastos compartidos">
          Cuando apuntéis un gasto «compartido» en el bot, aquí veréis quién debe cuánto a quién.
        </Notice>
      )}

      {data.skipped > 0 && (
        <p className="text-xs text-slate-500">{data.skipped} {data.skipped === 1 ? 'dato no se ha podido leer' : 'datos no se han podido leer'} y no se muestran.</p>
      )}
    </div>
  );
};
