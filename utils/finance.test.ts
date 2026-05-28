import { describe, it, expect } from 'vitest';
import type { DashboardData, MonthlySummary, Transaction } from '../types';
import {
  monthlyGoalStatus,
  budgetStatuses,
  topExpenses,
  detectAnomalies,
  comparePeriods,
  projectYear,
  expenseByCategory,
} from './finance';

let idCounter = 0;
const expense = (category: string, amount: number, subcategory = 'General'): Transaction => ({
  id: `t${idCounter++}`,
  date: '2025-01-01',
  concept: subcategory,
  category,
  subcategory,
  amount: -Math.abs(amount),
  type: 'expense',
  monthKey: 'ENE 25',
});

const month = (
  monthKey: string,
  income: number,
  transactions: Transaction[],
): MonthlySummary => {
  const exp = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return {
    monthKey,
    dateObj: new Date('2025-01-01'),
    income,
    expense: exp,
    balance: income - exp,
    savingsRate: income > 0 ? ((income - exp) / income) * 100 : 0,
    transactions,
  };
};

describe('expenseByCategory', () => {
  it('suma importes absolutos por categoría e ignora ingresos', () => {
    const txs: Transaction[] = [
      expense('Comida', 100),
      expense('Comida', 50),
      expense('Ocio', 30),
      { ...expense('Ingresos', 0), type: 'income', amount: 2000 },
    ];
    const totals = expenseByCategory(txs);
    expect(totals).toEqual({ Comida: 150, Ocio: 30 });
  });
});

describe('monthlyGoalStatus', () => {
  it('devuelve null si no hay objetivo', () => {
    const m = month('ENE 25', 2000, [expense('Comida', 500)]);
    expect(monthlyGoalStatus(m, null)).toBeNull();
  });

  it('objetivo en € fijo: marca cumplido cuando el ahorro alcanza la meta', () => {
    const m = month('ENE 25', 2000, [expense('Comida', 1500)]); // balance 500
    const status = monthlyGoalStatus(m, { type: 'amount', value: 500 })!;
    expect(status.target).toBe(500);
    expect(status.actual).toBe(500);
    expect(status.progressPct).toBe(100);
    expect(status.met).toBe(true);
  });

  it('objetivo en %: calcula la meta sobre los ingresos', () => {
    const m = month('ENE 25', 2000, [expense('Comida', 1700)]); // balance 300
    const status = monthlyGoalStatus(m, { type: 'percent', value: 20 })!; // meta 400
    expect(status.target).toBe(400);
    expect(status.met).toBe(false);
    expect(Math.round(status.progressPct)).toBe(75);
  });
});

describe('budgetStatuses', () => {
  it('clasifica ok / warning / over y ordena por % usado', () => {
    const m = month('ENE 25', 2000, [
      expense('Comida', 450), // budget 500 -> 90% warning
      expense('Ocio', 200), // budget 100 -> 200% over
      expense('Ropa', 50), // budget 500 -> 10% ok
    ]);
    const result = budgetStatuses(m, { Comida: 500, Ocio: 100, Ropa: 500 });
    expect(result.map((b) => b.category)).toEqual(['Ocio', 'Comida', 'Ropa']);
    expect(result.find((b) => b.category === 'Ocio')!.state).toBe('over');
    expect(result.find((b) => b.category === 'Comida')!.state).toBe('warning');
    expect(result.find((b) => b.category === 'Ropa')!.state).toBe('ok');
  });

  it('ignora presupuestos de 0 o negativos', () => {
    const m = month('ENE 25', 2000, [expense('Comida', 100)]);
    expect(budgetStatuses(m, { Comida: 0 })).toEqual([]);
  });
});

describe('topExpenses', () => {
  it('devuelve los mayores gastos ordenados de mayor a menor', () => {
    const m = month('ENE 25', 2000, [
      expense('Comida', 100),
      expense('Ocio', 300),
      expense('Ropa', 50),
    ]);
    const top = topExpenses(m, 2);
    expect(top).toHaveLength(2);
    expect(Math.abs(top[0].amount)).toBe(300);
    expect(Math.abs(top[1].amount)).toBe(100);
  });
});

describe('comparePeriods', () => {
  it('devuelve null sin mes anterior', () => {
    const cur = month('FEB 25', 2000, [expense('Comida', 100)]);
    expect(comparePeriods(cur, null)).toBeNull();
  });

  it('calcula variaciones y categorías que más suben/bajan', () => {
    const prev = month('ENE 25', 2000, [expense('Comida', 100), expense('Ocio', 200)]);
    const cur = month('FEB 25', 2200, [expense('Comida', 300), expense('Ocio', 50)]);
    const cmp = comparePeriods(cur, prev)!;
    expect(Math.round(cmp.incomeDeltaPct)).toBe(10);
    expect(cmp.topRiser!.category).toBe('Comida');
    expect(cmp.topFaller!.category).toBe('Ocio');
  });
});

describe('detectAnomalies', () => {
  const makeData = (monthsArr: MonthlySummary[]): DashboardData => ({
    allTransactions: monthsArr.flatMap((m) => m.transactions),
    monthlyData: monthsArr,
    globalKPIs: { totalIncome: 0, totalExpense: 0, totalBalance: 0, averageSavingsRate: 0 },
    categories: ['Comida'],
    categoryHierarchy: { Comida: ['General'] },
  });

  it('no detecta nada con menos de 3 meses', () => {
    const data = makeData([
      month('ENE 25', 2000, [expense('Comida', 100)]),
      month('FEB 25', 2000, [expense('Comida', 1000)]),
    ]);
    expect(detectAnomalies(data)).toEqual([]);
  });

  it('detecta un mes muy por encima de la media de la categoría', () => {
    const data = makeData([
      month('ENE 25', 2000, [expense('Comida', 100)]),
      month('FEB 25', 2000, [expense('Comida', 100)]),
      month('MAR 25', 2000, [expense('Comida', 100)]),
      month('ABR 25', 2000, [expense('Comida', 1000)]),
    ]);
    const anomalies = detectAnomalies(data);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].category).toBe('Comida');
    expect(anomalies[0].monthKey).toBe('ABR 25');
    expect(anomalies[0].deltaPct).toBeGreaterThan(30);
  });
});

describe('projectYear', () => {
  it('devuelve null sin meses', () => {
    expect(projectYear([])).toBeNull();
  });

  it('proyecta a 12 meses a partir de la media', () => {
    const months = [
      month('ENE 25', 2000, [expense('Comida', 1000)]), // balance 1000
      month('FEB 25', 2000, [expense('Comida', 1500)]), // balance 500
    ];
    const p = projectYear(months)!;
    expect(p.monthsRecorded).toBe(2);
    expect(p.avgMonthlyBalance).toBe(750);
    expect(p.projectedAnnualBalance).toBe(9000);
  });
});
