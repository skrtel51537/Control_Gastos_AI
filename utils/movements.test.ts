import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { filterMovements, sortMovements, groupMovements, dayLabel, summarizeMovements, isNew } from './movements';

const tx = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, date, amount,
  concept: 'Mercadona', category: 'Gasto fijo', subcategory: 'Compra semanal',
  type: amount < 0 ? 'expense' : 'income', monthKey: 'OCT 26',
  ...extra,
});

const NOW = new Date(2026, 9, 26, 12, 0); // 26-oct-2026, 12:00 local

describe('filterMovements', () => {
  const txs = [
    tx('g-1', '2026-10-05', -10, { concept: 'Café Central', category: 'Ocio', subcategory: 'Bares' }),
    tx('g-2', '2026-10-06', -20),
    tx('i-1', '2026-10-01', 1000, { concept: 'nómina', category: 'Ingresos', subcategory: 'General' }),
  ];

  it('filtra por tipo', () => {
    expect(filterMovements(txs, { kind: 'expense', category: null, search: '' }).map((t) => t.id)).toEqual(['g-1', 'g-2']);
    expect(filterMovements(txs, { kind: 'income', category: null, search: '' }).map((t) => t.id)).toEqual(['i-1']);
    expect(filterMovements(txs, { kind: 'all', category: null, search: '' })).toHaveLength(3);
  });

  it('busca sin distinguir tildes ni mayúsculas, también en categorías', () => {
    expect(filterMovements(txs, { kind: 'all', category: null, search: 'cafe' }).map((t) => t.id)).toEqual(['g-1']);
    expect(filterMovements(txs, { kind: 'all', category: null, search: 'NOMINA' }).map((t) => t.id)).toEqual(['i-1']);
    expect(filterMovements(txs, { kind: 'all', category: null, search: 'bares' }).map((t) => t.id)).toEqual(['g-1']);
  });

  it('filtra por categoría', () => {
    expect(filterMovements(txs, { kind: 'expense', category: 'Ocio', search: '' }).map((t) => t.id)).toEqual(['g-1']);
  });
});

describe('sortMovements', () => {
  it('«últimos apuntados» usa la hora de registro si existe', () => {
    const txs = [
      tx('g-1', '2026-10-20', -1, { registeredAt: '2026-10-25T10:00:00+02:00' }),
      tx('g-2', '2026-10-24', -1, { registeredAt: '2026-10-24T10:00:00+02:00' }),
    ];
    expect(sortMovements(txs, 'recent').map((t) => t.id)).toEqual(['g-1', 'g-2']);
  });

  it('sin hora de registro, ordena por el número del bot (último apuntado primero)', () => {
    const txs = [tx('g-9', '2026-10-24', -1), tx('g-10', '2026-10-02', -1), tx('g-8', '2026-10-25', -1)];
    expect(sortMovements(txs, 'recent').map((t) => t.id)).toEqual(['g-10', 'g-9', 'g-8']);
  });

  it('por fecha (más reciente primero) y por importe (mayor primero)', () => {
    const txs = [tx('g-1', '2026-10-05', -50), tx('g-2', '2026-10-20', -5), tx('g-3', '2026-10-10', -20)];
    expect(sortMovements(txs, 'date').map((t) => t.id)).toEqual(['g-2', 'g-3', 'g-1']);
    expect(sortMovements(txs, 'amount').map((t) => t.id)).toEqual(['g-1', 'g-3', 'g-2']);
  });

  it('no modifica la lista original', () => {
    const txs = [tx('g-1', '2026-10-05', -50), tx('g-2', '2026-10-20', -5)];
    sortMovements(txs, 'date');
    expect(txs.map((t) => t.id)).toEqual(['g-1', 'g-2']);
  });
});

describe('dayLabel', () => {
  it('dice Hoy, Ayer o el día de la semana', () => {
    expect(dayLabel('2026-10-26', NOW)).toBe('Hoy');
    expect(dayLabel('2026-10-25', NOW)).toBe('Ayer');
    expect(dayLabel('2026-10-23', NOW)).toMatch(/^Vie.*23.*oct/);
    expect(dayLabel('2025-10-23', NOW)).toMatch(/2025/);
  });
});

describe('groupMovements', () => {
  it('por fecha agrupa los días consecutivos', () => {
    const sorted = sortMovements([tx('g-1', '2026-10-25', -1), tx('g-2', '2026-10-25', -1), tx('g-3', '2026-10-20', -1)], 'date');
    const groups = groupMovements(sorted, 'date', NOW);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Ayer', 2], [expect.stringMatching(/20/), 1]]);
  });

  it('«últimos apuntados» agrupa por el día en que se apuntó', () => {
    const sorted = sortMovements([
      tx('g-1', '2026-10-01', -1, { registeredAt: '2026-10-26T09:00:00' }),
      tx('g-2', '2026-10-20', -1, { registeredAt: '2026-10-25T09:00:00' }),
    ], 'recent');
    expect(groupMovements(sorted, 'recent', NOW).map((g) => g.label)).toEqual(['Apuntados hoy', 'Apuntados ayer']);
  });

  it('sin hora de registro o por importe, una sola lista sin encabezados', () => {
    const sorted = [tx('g-1', '2026-10-25', -1), tx('g-2', '2026-10-20', -1)];
    expect(groupMovements(sorted, 'recent', NOW)).toEqual([{ key: 'all', label: null, items: sorted }]);
    expect(groupMovements(sorted, 'amount', NOW)[0].label).toBeNull();
  });
});

describe('summarizeMovements e isNew', () => {
  it('cuenta y suma ingresos y gastos por separado', () => {
    expect(summarizeMovements([tx('g-1', '2026-10-05', -10.5), tx('g-2', '2026-10-05', -4.5), tx('i-1', '2026-10-01', 100)]))
      .toEqual({ count: 3, income: 100, expense: 15 });
  });

  it('«Nuevo» solo si se apuntó en las últimas 24 horas', () => {
    expect(isNew(tx('g-1', '2026-10-26', -1, { registeredAt: '2026-10-26T08:00:00' }), NOW)).toBe(true);
    expect(isNew(tx('g-1', '2026-10-24', -1, { registeredAt: '2026-10-24T08:00:00' }), NOW)).toBe(false);
    expect(isNew(tx('g-1', '2026-10-26', -1), NOW)).toBe(false);
  });
});
