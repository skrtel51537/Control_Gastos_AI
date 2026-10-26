// Lógica de la lista de movimientos del mes (pestaña Análisis Mensual):
// filtrar, ordenar y agrupar por día. Sin React, para poder probarla.

import type { Transaction } from '../types';

export type MovementSort = 'recent' | 'date' | 'amount';
export type MovementKind = 'expense' | 'income' | 'all';

export interface MovementFilter {
  kind: MovementKind;
  category: string | null; // null = todas
  search: string;
}

export interface MovementGroup {
  key: string;
  label: string | null; // null = lista sin encabezados
  items: Transaction[];
}

// Sin tildes ni mayúsculas: buscar "cafe" encuentra "Café".
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const filterMovements = (txs: Transaction[], { kind, category, search }: MovementFilter): Transaction[] => {
  const q = fold(search.trim());
  return txs.filter((t) =>
    (kind === 'all' || t.type === kind) &&
    (!category || t.category === category) &&
    (!q || fold(`${t.concept} ${t.category} ${t.subcategory}`).includes(q)));
};

// El bot numera los movimientos al apuntarlos ("g-812"): sirve para ordenar
// por "últimos apuntados" cuando la API no envía la hora de registro.
const idParts = (id: string): { prefix: string; n: number } | null => {
  const m = /^(.*?)(\d+)$/.exec(id);
  return m ? { prefix: m[1], n: Number(m[2]) } : null;
};

const byDateDesc = (a: Transaction, b: Transaction): number => b.date.localeCompare(a.date);

const byIdDesc = (a: Transaction, b: Transaction): number => {
  const ia = idParts(a.id);
  const ib = idParts(b.id);
  return ia && ib && ia.prefix === ib.prefix ? ib.n - ia.n : 0;
};

const byRecent = (a: Transaction, b: Transaction): number => {
  if (a.registeredAt && b.registeredAt) {
    const diff = Date.parse(b.registeredAt) - Date.parse(a.registeredAt);
    if (diff !== 0) return diff;
  }
  return byIdDesc(a, b) || byDateDesc(a, b);
};

export const sortMovements = (txs: Transaction[], sort: MovementSort): Transaction[] => {
  const compare =
    sort === 'recent' ? byRecent
      : sort === 'date' ? (a: Transaction, b: Transaction) => byDateDesc(a, b) || byRecent(a, b)
        : (a: Transaction, b: Transaction) => Math.abs(b.amount) - Math.abs(a.amount) || byDateDesc(a, b);
  return txs.slice().sort(compare);
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "Hoy", "Ayer" o "Jue, 23 oct" (con año si no es el actual).
export const dayLabel = (day: string, now: Date = new Date()): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  const text = date.toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(y !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Agrupa una lista YA ordenada en bloques por día consecutivos:
// - 'date': por la fecha del gasto.
// - 'recent': por el día en que se apuntó (solo si todos traen esa hora).
// - 'amount' (o sin hora de registro): una sola lista sin encabezados.
export const groupMovements = (sorted: Transaction[], sort: MovementSort, now: Date = new Date()): MovementGroup[] => {
  const byRegistration = sort === 'recent' && sorted.length > 0 && sorted.every((t) => t.registeredAt);
  if (sort === 'amount' || (sort === 'recent' && !byRegistration)) {
    return [{ key: 'all', label: null, items: sorted }];
  }

  const groups: MovementGroup[] = [];
  for (const t of sorted) {
    const day = byRegistration ? isoDay(new Date(t.registeredAt!)) : t.date;
    const last = groups[groups.length - 1];
    if (last && last.key === day) {
      last.items.push(t);
    } else {
      const label = dayLabel(day, now);
      groups.push({
        key: day,
        label: byRegistration ? `Apuntados ${label === 'Hoy' || label === 'Ayer' ? label.toLowerCase() : `el ${label.toLowerCase()}`}` : label,
        items: [t],
      });
    }
  }
  return groups;
};

export const summarizeMovements = (txs: Transaction[]) => ({
  count: txs.length,
  income: txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
  expense: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0),
});

// Apuntado en las últimas 24 horas (etiqueta "Nuevo").
export const isNew = (t: Transaction, now: Date = new Date()): boolean =>
  !!t.registeredAt && now.getTime() - Date.parse(t.registeredAt) < 86_400_000;
