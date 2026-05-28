import { DashboardData, MonthlySummary, Transaction } from '../types';

// --- Ajustes del usuario (objetivos y presupuestos) ---

export interface SavingsGoal {
  type: 'amount' | 'percent'; // € fijos al mes, o % de los ingresos
  value: number;
}

export interface FinanceSettings {
  savingsGoal: SavingsGoal | null;
  categoryBudgets: Record<string, number>; // límite mensual por categoría (€)
}

export const DEFAULT_SETTINGS: FinanceSettings = {
  savingsGoal: null,
  categoryBudgets: {},
};

// --- F1: Objetivos de ahorro ---

export interface GoalStatus {
  target: number; // objetivo en € para ese mes
  actual: number; // ahorro real (balance) del mes
  progressPct: number; // % del objetivo cubierto
  met: boolean;
}

export const monthlyGoalStatus = (month: MonthlySummary, goal: SavingsGoal | null): GoalStatus | null => {
  if (!goal) return null;
  const target = goal.type === 'amount' ? goal.value : month.income * (goal.value / 100);
  const actual = month.balance;
  const progressPct = target > 0 ? (actual / target) * 100 : 0;
  return { target, actual, progressPct, met: actual >= target };
};

// --- F2: Presupuestos por categoría ---

export interface BudgetStatus {
  category: string;
  budget: number;
  spent: number;
  usedPct: number;
  state: 'ok' | 'warning' | 'over'; // verde / ámbar / rojo
}

export const expenseByCategory = (transactions: Transaction[]): Record<string, number> => {
  const totals: Record<string, number> = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
    });
  return totals;
};

export const budgetStatuses = (
  month: MonthlySummary,
  budgets: Record<string, number>,
): BudgetStatus[] => {
  const spentByCat = expenseByCategory(month.transactions);
  return Object.entries(budgets)
    .filter(([, budget]) => budget > 0)
    .map(([category, budget]) => {
      const spent = spentByCat[category] || 0;
      const usedPct = budget > 0 ? (spent / budget) * 100 : 0;
      const state: BudgetStatus['state'] = usedPct >= 100 ? 'over' : usedPct >= 80 ? 'warning' : 'ok';
      return { category, budget, spent, usedPct, state };
    })
    .sort((a, b) => b.usedPct - a.usedPct);
};

// --- F3: Grandes gastos y anomalías ---

export const topExpenses = (month: MonthlySummary, limit = 5): Transaction[] =>
  month.transactions
    .filter((t) => t.type === 'expense')
    .slice()
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, limit);

export interface Anomaly {
  monthKey: string;
  category: string;
  amount: number;
  average: number;
  deltaPct: number; // cuánto se desvía sobre la media histórica
}

/**
 * Detecta meses/categorías cuyo gasto se desvía claramente al alza respecto a la
 * media histórica de esa categoría. Requiere al menos 3 meses de historia para
 * evitar falsos positivos.
 */
export const detectAnomalies = (data: DashboardData, minDeltaPct = 30): Anomaly[] => {
  const months = data.monthlyData;
  if (months.length < 3) return [];

  const anomalies: Anomaly[] = [];

  data.categories.forEach((category) => {
    const series = months.map((m) => {
      const total = m.transactions
        .filter((t) => t.type === 'expense' && t.category === category)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { monthKey: m.monthKey, total };
    });

    const present = series.filter((s) => s.total > 0);
    if (present.length < 3) return;

    const mean = present.reduce((s, p) => s + p.total, 0) / present.length;
    if (mean <= 0) return;

    const variance =
      present.reduce((s, p) => s + Math.pow(p.total - mean, 2), 0) / present.length;
    const std = Math.sqrt(variance);

    series.forEach((s) => {
      if (s.total <= 0) return;
      const deltaPct = ((s.total - mean) / mean) * 100;
      // Anomalía si supera el umbral relativo y al menos 1 desviación típica
      if (deltaPct >= minDeltaPct && s.total >= mean + std) {
        anomalies.push({
          monthKey: s.monthKey,
          category,
          amount: s.total,
          average: mean,
          deltaPct,
        });
      }
    });
  });

  return anomalies.sort((a, b) => b.deltaPct - a.deltaPct);
};

// --- F4: Comparativa entre periodos ---

export interface CategoryChange {
  category: string;
  current: number;
  previous: number;
  deltaPct: number;
}

export interface PeriodComparison {
  current: MonthlySummary;
  previous: MonthlySummary;
  incomeDeltaPct: number;
  expenseDeltaPct: number;
  balanceDelta: number;
  topRiser: CategoryChange | null;
  topFaller: CategoryChange | null;
}

const safeDeltaPct = (current: number, previous: number): number =>
  previous > 0 ? ((current - previous) / previous) * 100 : 0;

export const comparePeriods = (
  current: MonthlySummary,
  previous: MonthlySummary | null,
): PeriodComparison | null => {
  if (!previous) return null;

  const curCats = expenseByCategory(current.transactions);
  const prevCats = expenseByCategory(previous.transactions);
  const allCats = new Set([...Object.keys(curCats), ...Object.keys(prevCats)]);

  const changes: CategoryChange[] = Array.from(allCats).map((category) => {
    const cur = curCats[category] || 0;
    const prev = prevCats[category] || 0;
    return { category, current: cur, previous: prev, deltaPct: safeDeltaPct(cur, prev) };
  });

  const risers = changes.filter((c) => c.current > c.previous);
  const fallers = changes.filter((c) => c.current < c.previous);

  return {
    current,
    previous,
    incomeDeltaPct: safeDeltaPct(current.income, previous.income),
    expenseDeltaPct: safeDeltaPct(current.expense, previous.expense),
    balanceDelta: current.balance - previous.balance,
    topRiser: risers.sort((a, b) => b.current - b.previous - (a.current - a.previous))[0] || null,
    topFaller: fallers.sort((a, b) => a.current - a.previous - (b.current - b.previous))[0] || null,
  };
};

// --- F5: Proyección a fin de año (run-rate) ---

export interface Projection {
  monthsRecorded: number;
  avgMonthlyBalance: number;
  avgMonthlyExpense: number;
  projectedAnnualBalance: number;
  projectedAnnualExpense: number;
}

export const projectYear = (months: MonthlySummary[]): Projection | null => {
  if (months.length === 0) return null;
  const totalBalance = months.reduce((s, m) => s + m.balance, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const n = months.length;
  const avgMonthlyBalance = totalBalance / n;
  const avgMonthlyExpense = totalExpense / n;
  return {
    monthsRecorded: n,
    avgMonthlyBalance,
    avgMonthlyExpense,
    projectedAnnualBalance: avgMonthlyBalance * 12,
    projectedAnnualExpense: avgMonthlyExpense * 12,
  };
};
