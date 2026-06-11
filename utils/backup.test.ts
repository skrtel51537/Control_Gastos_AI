import { describe, it, expect } from 'vitest';
import type { DashboardData } from '../types';
import { buildBackup, parseBackup, backupFilename } from './backup';
import { DEFAULT_SETTINGS } from './finance';

const sampleData: DashboardData = {
  allTransactions: [
    {
      id: 't1',
      date: '2025-01-10',
      concept: 'Super',
      category: 'Comida',
      subcategory: 'Super',
      amount: -100,
      type: 'expense',
      monthKey: 'ENE 25',
    },
  ],
  monthlyData: [
    {
      monthKey: 'ENE 25',
      dateObj: new Date('2025-01-01'),
      income: 2000,
      expense: 100,
      balance: 1900,
      savingsRate: 95,
      transactions: [],
    },
  ],
  globalKPIs: { totalIncome: 2000, totalExpense: 100, totalBalance: 1900, averageSavingsRate: 95 },
  categories: ['Comida'],
  categoryHierarchy: { Comida: ['Super'] },
};

describe('backup', () => {
  it('exporta y restaura los datos sin pérdidas (ida y vuelta)', () => {
    const backup = buildBackup(sampleData, { ...DEFAULT_SETTINGS, savingsGoal: { type: 'amount', value: 500 } });
    const restored = parseBackup(JSON.stringify(backup));

    expect(restored.data).not.toBeNull();
    expect(restored.data!.monthlyData).toHaveLength(1);
    expect(restored.data!.monthlyData[0].income).toBe(2000);
    // Las fechas deben volver como objetos Date reales, no texto.
    expect(restored.data!.monthlyData[0].dateObj).toBeInstanceOf(Date);
    expect(restored.settings!.savingsGoal).toEqual({ type: 'amount', value: 500 });
  });

  it('acepta una copia sin datos (solo configuración)', () => {
    const backup = buildBackup(null, DEFAULT_SETTINGS);
    const restored = parseBackup(JSON.stringify(backup));
    expect(restored.data).toBeNull();
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rechaza un archivo que no es JSON', () => {
    expect(() => parseBackup('esto no es json')).toThrow(/no es una copia de seguridad válida/);
  });

  it('rechaza un JSON que no es de esta aplicación', () => {
    expect(() => parseBackup(JSON.stringify({ foo: 'bar' }))).toThrow(/no es una copia de seguridad de esta aplicación/);
  });

  it('rechaza versiones de copia no compatibles', () => {
    const bad = { app: 'dashboard-gastos', backupVersion: 99, data: null, settings: null };
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/versión no compatible/);
  });

  it('rechaza una copia con los datos dañados', () => {
    const bad = { app: 'dashboard-gastos', backupVersion: 1, data: { monthlyData: 'roto' }, settings: null };
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/dañada/);
  });

  it('genera nombres de archivo con la fecha del día', () => {
    expect(backupFilename(new Date('2026-06-11T10:00:00'))).toBe('copia-gastos-2026-06-11.json');
  });
});
