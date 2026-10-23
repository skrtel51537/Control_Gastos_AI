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

const pctChange = (current: number, previous: number): number | null =>
  previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;

interface PeriodAggregate {
  label: string;
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
  byCategory: Record<string, number>;
}

const aggregateMonths = (months: MonthlySummary[], label: string): PeriodAggregate => {
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  const balance = income - expense;
  return {
    label,
    income,
    expense,
    balance,
    savingsRate: income > 0 ? (balance / income) * 100 : 0,
    byCategory: expenseByCategory(months.flatMap((m) => m.transactions)),
  };
};

export const ComparatorTab = ({ data }: { data: DashboardData }) => {
  const [mode, setMode] = useState<'months' | 'years'>('months');

  const monthKeys = useMemo(() => data.monthlyData.map((m) => m.monthKey), [data]);
  const years = useMemo(() => {
    const set = new Set(data.monthlyData.map((m) => m.dateObj.getFullYear().toString()));
    return Array.from(set).sort();
  }, [data]);

  const options = mode === 'months' ? monthKeys : years;

  const [aKey, setAKey] = useState('');
  const [bKey, setBKey] = useState('');

  // Al cambiar de modo o de datos, fijar por defecto los dos últimos periodos.
  useEffect(() => {
    if (options.length === 0) return;
    setBKey(options[options.length - 1]);
    setAKey(options.length >= 2 ? options[options.length - 2] : options[options.length - 1]);
  }, [mode, options.length]);

  const aggregateFor = (key: string): PeriodAggregate | null => {
    if (!key) return null;
    if (mode === 'months') {
      const m = data.monthlyData.find((x) => x.monthKey === key);
      return m ? aggregateMonths([m], key) : null;
    }
    const months = data.monthlyData.filter((x) => x.dateObj.getFullYear().toString() === key);
    return months.length ? aggregateMonths(months, key) : null;
  };

  const aggA = aggregateFor(aKey);
  const aggB = aggregateFor(bKey);

  const chartData = useMemo(() => {
    if (!aggA || !aggB) return [];
    const cats = new Set([...Object.keys(aggA.byCategory), ...Object.keys(aggB.byCategory)]);
    return Array.from(cats)
      .map((cat) => ({ name: cat, a: aggA.byCategory[cat] || 0, b: aggB.byCategory[cat] || 0 }))
      .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b))
      .slice(0, 8);
  }, [aggA, aggB]);

  if (options.length < 2) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-10 text-center text-slate-500">
        <span className="text-4xl block mb-3">⚖️</span>
        Necesitas al menos dos {mode === 'months' ? 'meses' : 'años'} de datos para comparar.
        {years.length >= 2 && mode === 'months' && (
          <button onClick={() => setMode('years')} className="block mx-auto mt-4 text-indigo-400 hover:text-indigo-300 underline">
            Comparar por años
          </button>
        )}
      </div>
    );
  }

  const selectClass = "bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer";

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        ℹ️ El comparador siempre usa todos tus datos: el filtro de año de la barra superior no se aplica en esta pestaña.
      </p>
      {/* Controles */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-wrap items-end gap-6">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase block mb-2">Comparar por</span>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button onClick={() => setMode('months')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'months' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Meses</button>
            <button onClick={() => setMode('years')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'years' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Años</button>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-indigo-400 uppercase block mb-2">Periodo A</label>
          <select value={aKey} onChange={(e) => setAKey(e.target.value)} className={selectClass}>
            {options.map((o) => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
          </select>
        </div>
        <span className="text-slate-500 font-bold pb-2">vs</span>
        <div>
          <label className="text-xs font-bold text-pink-400 uppercase block mb-2">Periodo B</label>
          <select value={bKey} onChange={(e) => setBKey(e.target.value)} className={selectClass}>
            {options.map((o) => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
          </select>
        </div>
      </div>

      {aggA && aggB && (
        <>
          {/* KPIs lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[{ agg: aggA, accent: 'text-indigo-400', ref: null as PeriodAggregate | null }, { agg: aggB, accent: 'text-pink-400', ref: aggA }].map(({ agg, accent, ref }, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className={`text-lg font-bold mb-4 ${accent}`}>{agg.label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <KPIBox label="Ingresos" value={agg.income} isCurrency positive trendPct={ref ? pctChange(agg.income, ref.income) : null} />
                  <KPIBox label="Gastos" value={agg.expense} isCurrency negative trendPct={ref ? pctChange(agg.expense, ref.expense) : null} />
                  <KPIBox label="Ahorro" value={agg.balance} isCurrency positive={agg.balance >= 0} negative={agg.balance < 0} trendPct={ref ? pctChange(agg.balance, ref.balance) : null} />
                  <KPIBox label="Tasa de ahorro" value={agg.savingsRate} suffix="%" />
                </div>
              </div>
            ))}
          </div>

          {/* Gráfica comparativa por categoría */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Gasto por categoría</h3>
            <p className="text-sm text-slate-500 mb-6">Principales categorías de gasto en ambos periodos.</p>
            <ResponsiveContainer width="99%" height={380}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" stroke={AXIS_STROKE} tickFormatter={(v) => formatEuro(v)} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" stroke={AXIS_STROKE_LIGHT} width={110} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={CHART_TOOLTIP.cursor}
                  contentStyle={CHART_TOOLTIP.contentStyle}
                  itemStyle={CHART_TOOLTIP.itemStyle}
                  formatter={(v) => formatEuro(Number(v))}
                />
                <Legend />
                <Bar dataKey="a" name={aggA.label} fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="b" name={aggB.label} fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};
