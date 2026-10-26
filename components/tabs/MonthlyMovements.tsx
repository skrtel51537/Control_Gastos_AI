import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import { formatEuroCents } from '../../utils/format';
import {
  MovementKind, MovementSort, filterMovements, sortMovements, groupMovements, summarizeMovements, isNew,
} from '../../utils/movements';

// Lista de movimientos del mes, para comprobar que está todo apuntado.
// Se filtra por tipo, categoría y texto, y se ordena por último apuntado,
// por fecha o por importe.

const KIND_OPTIONS: { id: MovementKind; label: string }[] = [
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Ingresos' },
  { id: 'all', label: 'Todos' },
];

const SORT_OPTIONS: { id: MovementSort; label: string }[] = [
  { id: 'recent', label: 'Últimos apuntados' },
  { id: 'date', label: 'Por fecha' },
  { id: 'amount', label: 'Por importe' },
];

const INCOME_COLOR = '#34d399';

const shortDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

// Grupo de botones donde solo uno está activo.
const Segmented = <T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string }[], value: T, onChange: (v: T) => void, label: string,
}) => (
  <div role="group" aria-label={label} className="flex bg-slate-800/60 border border-slate-700 rounded-lg p-0.5">
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onChange(o.id)}
        aria-pressed={value === o.id}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
          value === o.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-100'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const MovementRow = ({ t, color, showDate }: { t: Transaction, color: string, showDate: boolean }) => {
  const income = t.type === 'income';
  const detail = t.concept === t.subcategory ? t.category : `${t.category} › ${t.subcategory}`;
  return (
    <li
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/50 transition-colors"
      title={t.registeredAt ? `Apuntado el ${formatTime(t.registeredAt)}` : undefined}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 font-medium truncate">
          {t.concept}
          {isNew(t) && (
            <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
              Nuevo
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {detail}{showDate && <> · {shortDate(t.date)}</>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-mono font-semibold ${income ? 'text-emerald-400' : 'text-slate-100'}`}>
          {income ? '+' : '−'}{formatEuroCents(Math.abs(t.amount))}
        </p>
        {t.sharedTotal != null && (
          <p className="text-[11px] text-slate-500" title="Gasto compartido: tu parte y el total">
            🤝 de {formatEuroCents(t.sharedTotal)}
          </p>
        )}
      </div>
    </li>
  );
};

export const MonthlyMovements = ({ transactions, categoryColors, focusCategory }: {
  transactions: Transaction[],
  categoryColors: Record<string, string>,
  focusCategory: string | null, // categoría pulsada en el gráfico de tarta
}) => {
  const [kind, setKind] = useState<MovementKind>('expense');
  const [sort, setSort] = useState<MovementSort>('recent');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(focusCategory);

  // Pulsar una categoría en el gráfico (o cambiar de mes) filtra la lista.
  useEffect(() => {
    setCategory(focusCategory);
    if (focusCategory) setKind('expense');
  }, [focusCategory, transactions]);

  const categories = useMemo(
    () => Array.from(new Set(transactions.filter((t) => t.type === 'expense').map((t) => t.category))).sort(),
    [transactions],
  );

  const shown = useMemo(
    () => sortMovements(filterMovements(transactions, { kind, category: kind === 'income' ? null : category, search }), sort),
    [transactions, kind, category, search, sort],
  );
  const groups = useMemo(() => groupMovements(shown, sort), [shown, sort]);
  const summary = summarizeMovements(shown);
  const filtered = !!search.trim() || (!!category && kind !== 'income');

  const summaryText = [
    `${summary.count} ${summary.count === 1 ? 'movimiento' : 'movimientos'}`,
    summary.expense > 0 && `gastos ${formatEuroCents(summary.expense)}`,
    summary.income > 0 && `ingresos ${formatEuroCents(summary.income)}`,
  ].filter(Boolean).join(' · ');

  const clearFilters = () => {
    setSearch('');
    setCategory(null);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Movimientos del mes</h3>
          <p className="text-sm text-slate-500" aria-live="polite">{summaryText}</p>
        </div>
        <Segmented label="Ordenar" options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented label="Tipo de movimiento" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <select
          value={category ?? ''}
          onChange={(e) => setCategory(e.target.value || null)}
          disabled={kind === 'income'}
          aria-label="Filtrar por categoría"
          className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-40"
        >
          <option value="" className="bg-slate-900">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" aria-hidden="true">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar concepto…"
            aria-label="Buscar movimiento"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
        {filtered && (
          <button type="button" onClick={clearFilters} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1.5">
            Quitar filtros
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-10">No hay movimientos con estos filtros.</p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto -mx-2 px-2">
          {groups.map((g) => (
            <section key={g.key} className="mb-2">
              {g.label && (
                <h4 className="sticky top-0 z-10 bg-slate-900 flex justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>{g.label}</span>
                  <span className="font-mono normal-case">
                    {(() => {
                      const s = summarizeMovements(g.items);
                      return s.expense > 0 ? `−${formatEuroCents(s.expense)}` : `+${formatEuroCents(s.income)}`;
                    })()}
                  </span>
                </h4>
              )}
              <ul>
                {g.items.map((t) => (
                  <MovementRow
                    key={t.id}
                    t={t}
                    color={t.type === 'income' ? INCOME_COLOR : categoryColors[t.category] ?? '#64748b'}
                    // En la vista por fecha el día ya está en el encabezado.
                    showDate={sort !== 'date'}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
