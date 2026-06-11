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

export const OverviewTab = ({ data, selectedYear }: { data: DashboardData, selectedYear: string }) => {
  const [alertThreshold, setAlertThreshold] = useState<number>(60);

  // Chart Data: Income vs Expense
  const chartData = data.monthlyData.map(m => ({
    name: m.monthKey,
    Ingresos: m.income,
    Gastos: m.expense,
    Balance: m.balance,
    AhorroPct: m.savingsRate
  }));

  // Cumulative Savings Data
  const cumulativeData = useMemo(() => {
    let runningTotal = 0;
    return data.monthlyData.map(m => {
      runningTotal += m.balance;
      return {
        name: m.monthKey,
        Acumulado: runningTotal
      };
    });
  }, [data]);

  // Alert Data: Months where Expense > Threshold % Income
  const alerts = useMemo(() => {
    // Más recientes primero: lo último que ha pasado es lo más relevante.
    return data.monthlyData
      .filter(m => m.expense > (m.income * (alertThreshold / 100)))
      .slice()
      .reverse();
  }, [data, alertThreshold]);

  // F3: anomalías de gasto por categoría (desviación sobre la media histórica)
  const anomalies = useMemo(() => detectAnomalies(data), [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl text-sm min-w-[180px]">
          <p className="font-bold text-slate-200 mb-3 border-b border-slate-800 pb-2">{label}</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-emerald-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div>Ingresos:</span> 
               <span className="font-mono font-bold">{formatEuro(d.Ingresos)}</span>
            </div>
            <div className="flex justify-between items-center text-rose-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400"></div>Gastos:</span> 
               <span className="font-mono font-bold">{formatEuro(d.Gastos)}</span>
            </div>
             <div className="flex justify-between items-center text-indigo-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400"></div>Ahorro Total:</span> 
               <span className="font-mono font-bold">{formatEuro(d.Balance)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400 pt-2 mt-1 border-t border-slate-800">
               <span>Tasa Ahorro:</span> 
               <span className="font-mono font-bold">{formatPercent(d.AhorroPct)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Changed label from Balance to Ahorro Total as requested */}
        <KPIBox label={`Ahorro Total (${selectedYear === 'TOTAL' ? 'Histórico' : selectedYear})`} value={data.globalKPIs.totalBalance} isCurrency />
        <KPIBox label="Ingresos Totales" value={data.globalKPIs.totalIncome} isCurrency positive />
        <KPIBox label="Gastos Totales" value={data.globalKPIs.totalExpense} isCurrency negative />
        <KPIBox label="Tasa Ahorro Promedio" value={data.globalKPIs.averageSavingsRate} suffix="%" />
      </div>

      {/* Main Evolution Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Evolución de Ingresos vs Gastos</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="99%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                <linearGradient id="colExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis 
                 dataKey="name" 
                 stroke={AXIS_STROKE} 
                 tick={{fontSize: 12}} 
                 minTickGap={30}
                 padding={{ left: 10, right: 10 }}
              />
              <YAxis stroke={AXIS_STROKE} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="Ingresos" stroke="#10b981" fill="url(#colInc)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="Gastos" stroke="#ef4444" fill="url(#colExp)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* F3: Detección de gastos atípicos */}
      {anomalies.length > 0 && (
        <div className="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🔎</span>
            <h3 className="text-lg font-semibold text-white">Gastos fuera de lo habitual</h3>
          </div>
          <p className="text-sm text-slate-500 mb-5">Meses y categorías cuyo gasto se desvía claramente al alza respecto a tu media histórica.</p>
          <div className="space-y-3">
            {anomalies.slice(0, 6).map((a, i) => (
              <div key={`${a.monthKey}-${a.category}-${i}`} className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/40 rounded-lg px-4 py-3">
                <div>
                  <span className="text-slate-200 font-medium">{a.category}</span>
                  <span className="text-slate-500 text-sm ml-2">· {a.monthKey}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">media {formatEuro(a.average)}</span>
                  <span className="text-white font-mono font-bold">{formatEuro(a.amount)}</span>
                  <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 font-bold text-xs">{formatSignedPercent(a.deltaPct)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative Savings Chart */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Ahorro Acumulado</h3>
          <p className="text-sm text-slate-500 mb-6">Evolución del capital disponible en el periodo seleccionado.</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colSav" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis 
                   dataKey="name" 
                   stroke={AXIS_STROKE}
                   tick={{fontSize: 12}} 
                   minTickGap={30}
                   padding={{ left: 10, right: 10 }}
                />
                <YAxis stroke={AXIS_STROKE} />
                <Tooltip 
                  contentStyle={CHART_TOOLTIP.contentStyle} 
                  itemStyle={CHART_TOOLTIP.itemStyle} 
                  formatter={(val: number) => formatEuro(val)} 
                />
                <Area type="monotone" dataKey="Acumulado" stroke="#6366f1" fill="url(#colSav)" strokeWidth={3} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warning Table > Configurable Threshold */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="text-lg font-semibold text-white">Alertas de Gasto</h3>
              <p className="text-sm text-slate-500">Meses donde el gasto supera el {alertThreshold}% del ingreso.</p>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
               <label htmlFor="threshold" className="text-xs text-slate-400 font-bold uppercase hidden sm:inline">Límite:</label>
               <input 
                  id="threshold"
                  type="range" 
                  min="1" 
                  max="100" 
                  value={alertThreshold} 
                  onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                  className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
               />
               <span className="text-sm font-bold text-indigo-400 w-8 text-right">{alertThreshold}%</span>
               <div className="p-1 px-2 bg-red-500/10 rounded ml-2">
                 <span className="text-red-400 font-bold text-xs">⚠️ {alerts.length}</span>
               </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto max-h-[250px] pr-2">
            {alerts.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                  <span className="text-4xl mb-2">✅</span>
                  <p>¡Todo bajo control!</p>
               </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">
                  <tr>
                    <th className="pb-2">Mes</th>
                    <th className="pb-2 text-right">Gasto %</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {alerts.map(m => {
                    const ratio = (m.expense / m.income) * 100;
                    return (
                      <tr key={m.monthKey} className="group hover:bg-slate-800/50">
                        <td className="py-3 px-1 text-slate-300 font-medium">{m.monthKey}</td>
                        <td className="py-3 px-1 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${ratio > 80 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            {Math.round(ratio)}%
                          </span>
                        </td>
                        <td className="py-3 px-1 text-right text-slate-400">{formatEuro(m.balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
