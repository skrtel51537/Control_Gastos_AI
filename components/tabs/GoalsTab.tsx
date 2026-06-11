import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList, ReferenceLine
} from 'recharts';
import { DashboardData, MonthlySummary, Transaction } from '../../types';
import { formatEuro, formatPercent, formatSignedPercent } from '../../utils/format';
import {
  FinanceSettings, DEFAULT_SETTINGS, SavingsGoal, monthlyGoalStatus, budgetStatuses, topExpenses,
  detectAnomalies, comparePeriods, projectYear, expenseByCategory,
} from '../../utils/finance';
import { COLORS, COLORS_DRILLDOWN, CHART_TOOLTIP, GRID_STROKE, AXIS_STROKE, AXIS_STROKE_LIGHT, stateStyles } from '../../utils/theme';
import { KPIBox } from '../ui/KPIBox';

export const GoalsTab = ({ data, settings, onChange }: { data: DashboardData, settings: FinanceSettings, onChange: (s: FinanceSettings) => void }) => {
  const months = data.monthlyData;
  const [budgetMonthIdx, setBudgetMonthIdx] = useState(months.length > 0 ? months.length - 1 : 0);

  const goal = settings.savingsGoal;

  const setGoal = (next: SavingsGoal | null) => onChange({ ...settings, savingsGoal: next });

  const setBudget = (category: string, value: number) => {
    const next = { ...settings.categoryBudgets };
    if (value > 0) next[category] = value;
    else delete next[category];
    onChange({ ...settings, categoryBudgets: next });
  };

  const safeBudgetIdx = budgetMonthIdx >= months.length ? months.length - 1 : budgetMonthIdx;
  const budgetMonth = months[safeBudgetIdx] || null;

  const goalRows = useMemo(
    // Más recientes primero: lo último que ha pasado es lo más relevante.
    () => months.slice().reverse().map((m) => ({ month: m, status: monthlyGoalStatus(m, goal) })),
    [months, goal],
  );

  const budgets = budgetMonth ? budgetStatuses(budgetMonth, settings.categoryBudgets) : [];
  const projection = projectYear(months);

  if (months.length === 0) {
    return <div className="p-8 text-center text-slate-500">No hay datos para el periodo seleccionado.</div>;
  }

  return (
    <div className="space-y-6">
      {/* F1: Objetivo de ahorro */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-1">Objetivo de ahorro mensual</h3>
        <p className="text-sm text-slate-500 mb-5">Define cuánto quieres ahorrar cada mes. Se compara con tu ahorro real.</p>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Tipo de objetivo</label>
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setGoal({ type: 'amount', value: goal?.value ?? 0 })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${goal?.type === 'amount' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                € al mes
              </button>
              <button
                onClick={() => setGoal({ type: 'percent', value: goal?.value ?? 0 })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${goal?.type === 'percent' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                % de ingresos
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Valor</label>
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <input
                type="number"
                min="0"
                value={goal?.value ?? ''}
                placeholder="0"
                onChange={(e) => setGoal({ type: goal?.type ?? 'amount', value: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-24 bg-transparent text-white outline-none text-sm font-bold"
              />
              <span className="text-slate-400 text-sm ml-1">{goal?.type === 'percent' ? '%' : '€'}</span>
            </div>
          </div>

          {goal && (
            <button onClick={() => setGoal(null)} className="text-sm text-rose-400 hover:text-rose-300 px-3 py-2">
              Quitar objetivo
            </button>
          )}
        </div>

        {goal && goal.value > 0 && (
          <div className="mt-6 overflow-x-auto max-h-[280px]">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">
                <tr>
                  <th className="pb-2">Mes</th>
                  <th className="pb-2 text-right">Objetivo</th>
                  <th className="pb-2 text-right">Ahorro real</th>
                  <th className="pb-2 pl-4 w-1/3">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {goalRows.map(({ month, status }) => {
                  if (!status) return null;
                  const pct = Math.max(0, Math.min(100, status.progressPct));
                  const st = status.met ? 'ok' : status.progressPct >= 70 ? 'warning' : 'over';
                  const s = stateStyles[st];
                  return (
                    <tr key={month.monthKey} className="hover:bg-slate-800/40">
                      <td className="py-3 text-slate-300 font-medium">{month.monthKey}</td>
                      <td className="py-3 text-right text-slate-400 font-mono">{formatEuro(status.target)}</td>
                      <td className={`py-3 text-right font-mono font-bold ${s.text}`}>
                        {formatEuro(status.actual)}
                        <span className="text-slate-500 font-normal ml-1">({formatPercent(month.savingsRate)})</span>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-bold w-10 text-right ${s.text}`}>{formatPercent(status.progressPct)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* F2: Presupuestos por categoría */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h3 className="text-lg font-semibold text-white">Presupuestos por categoría</h3>
          {months.length > 0 && (
            <div className="flex items-center bg-slate-800 rounded-lg px-3 py-1 border border-slate-700">
              <span className="text-xs text-slate-400 uppercase font-bold mr-2">Mes:</span>
              <select
                value={safeBudgetIdx}
                onChange={(e) => setBudgetMonthIdx(parseInt(e.target.value))}
                className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
              >
                {months.map((m, i) => (
                  <option key={m.monthKey} value={i} className="bg-slate-900">{m.monthKey}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-5">Asigna un límite mensual a cada categoría y compáralo con el gasto real del mes elegido.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuración de límites */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Límites mensuales (€)</h4>
            {data.categories.map((cat) => (
              <div key={cat} className="flex items-center justify-between gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-300 truncate">{cat}</span>
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    value={settings.categoryBudgets[cat] ?? ''}
                    placeholder="—"
                    onChange={(e) => setBudget(cat, Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 bg-transparent text-white outline-none text-sm text-right font-bold"
                  />
                  <span className="text-slate-400 text-xs ml-1">€</span>
                </div>
              </div>
            ))}
          </div>

          {/* Estado del mes seleccionado */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Gasto vs presupuesto · {budgetMonth?.monthKey}</h4>
            {budgets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 py-8">
                <span className="text-3xl mb-2">🎯</span>
                <p className="text-sm text-center">Define algún límite a la izquierda para ver el seguimiento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map((b) => {
                  const s = stateStyles[b.state];
                  const pct = Math.min(100, b.usedPct);
                  return (
                    <div key={b.category}>
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-slate-300 font-medium">{b.category}</span>
                        <span className={`font-mono font-bold ${s.text}`}>
                          {formatEuro(b.spent)} / {formatEuro(b.budget)}
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className={`text-xs ${s.text}`}>{s.label}</span>
                        <span className={`text-xs font-bold ${s.text}`}>{formatPercent(b.usedPct)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* F5: Proyección a fin de año */}
      {projection && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-1">Proyección a 12 meses</h3>
          <p className="text-sm text-slate-500 mb-5">
            Estimación basada en la media de los {projection.monthsRecorded} {projection.monthsRecorded === 1 ? 'mes registrado' : 'meses registrados'} en el periodo seleccionado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPIBox label="Ahorro medio / mes" value={projection.avgMonthlyBalance} isCurrency positive={projection.avgMonthlyBalance >= 0} negative={projection.avgMonthlyBalance < 0} />
            <KPIBox label="Gasto medio / mes" value={projection.avgMonthlyExpense} isCurrency negative />
            <KPIBox label="Ahorro anual estimado" value={projection.projectedAnnualBalance} isCurrency positive={projection.projectedAnnualBalance >= 0} negative={projection.projectedAnnualBalance < 0} />
            <KPIBox label="Gasto anual estimado" value={projection.projectedAnnualExpense} isCurrency negative />
          </div>
        </div>
      )}
    </div>
  );
};
