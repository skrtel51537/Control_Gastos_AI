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

export const MonthlyTab = ({ data, settings }: { data: DashboardData, settings: FinanceSettings }) => {
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(data.monthlyData.length > 0 ? data.monthlyData.length - 1 : 0);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);

  // Group Data by Year to create the 2-level selector
  const groupedData = useMemo(() => {
    const groups: Record<string, { label: string, index: number, fullLabel: string }[]> = {};
    data.monthlyData.forEach((m, idx) => {
        const year = m.dateObj.getFullYear().toString();
        
        // Get full month name (e.g. "Noviembre")
        const monthName = m.dateObj.toLocaleString('es-ES', { month: 'long' });
        const fullLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1); // Capitalize

        if (!groups[year]) groups[year] = [];
        groups[year].push({ 
            label: m.monthKey, 
            index: idx,
            fullLabel: fullLabel 
        });
    });
    return groups;
  }, [data.monthlyData]);

  const availableYears = useMemo(() => Object.keys(groupedData).sort((a, b) => b.localeCompare(a)), [groupedData]);
  
  // State for the Year Selector (Level 1)
  const [activeYearSelector, setActiveYearSelector] = useState<string>(availableYears[0] || '');

  // Effect: When data loads/changes, default to the latest year and latest month
  useEffect(() => {
    if (availableYears.length > 0) {
        // Only reset if current selection is invalid or empty
        if (!activeYearSelector || !availableYears.includes(activeYearSelector)) {
            const latestYear = availableYears[0];
            setActiveYearSelector(latestYear);
            
            // Auto select latest month of that year
            const monthsInYear = groupedData[latestYear];
            if (monthsInYear && monthsInYear.length > 0) {
                setSelectedMonthIdx(monthsInYear[monthsInYear.length - 1].index);
            }
        }
    }
  }, [availableYears, groupedData, activeYearSelector]);

  // Handle Year Click
  const handleYearClick = (year: string) => {
      setActiveYearSelector(year);
      // Auto-select the last month of this year
      const monthsInYear = groupedData[year];
      if (monthsInYear && monthsInYear.length > 0) {
          setSelectedMonthIdx(monthsInYear[monthsInYear.length - 1].index);
      }
  };

  // Reset drilldown on month change
  useEffect(() => {
    setDrilldownCategory(null);
  }, [selectedMonthIdx]);

  if (data.monthlyData.length === 0) return <div className="p-8 text-center text-slate-500">No hay datos para el año seleccionado.</div>;

  const safeIndex = (selectedMonthIdx >= data.monthlyData.length) ? data.monthlyData.length - 1 : selectedMonthIdx;
  const monthData = data.monthlyData[safeIndex];
  if (!monthData) return <div>Error cargando datos del mes.</div>;

  // F4: comparativa con el mes anterior. F3: mayores gastos del mes. F2: presupuestos.
  const prevMonth = safeIndex > 0 ? data.monthlyData[safeIndex - 1] : null;
  const comparison = comparePeriods(monthData, prevMonth);
  const biggestExpenses = topExpenses(monthData, 5);
  const monthBudgets = budgetStatuses(monthData, settings.categoryBudgets);

  // --- Aggregate Data for Pie Chart (Supports Drill-down) ---
  const activePieData = useMemo(() => {
    if (!drilldownCategory) {
        // Level 1: Main Categories
        const cats: Record<string, number> = {};
        monthData.transactions.filter(t => t.type === 'expense').forEach(t => {
            cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount);
        });
        
        // FIX: Sort BEFORE mapping colors. This ensures that the first color (index 0) 
        // is always assigned to the largest value, matching the logic in cat1ColorMap.
        return Object.entries(cats)
            .sort((a, b) => b[1] - a[1]) // Sort first
            .map(([name, value], i) => ({ 
                name, 
                value, 
                color: COLORS[i % COLORS.length] 
            }));
    } else {
        // Level 2: Subcategories of selected drilldownCategory
        const cats: Record<string, number> = {};
        monthData.transactions
            .filter(t => t.type === 'expense' && t.category === drilldownCategory)
            .forEach(t => {
                const sub = t.subcategory || 'Otros';
                cats[sub] = (cats[sub] || 0) + Math.abs(t.amount);
            });
            
        // Also sort first for subcategories for consistency
        return Object.entries(cats)
            .sort((a, b) => b[1] - a[1]) // Sort first
            .map(([name, value], i) => ({ 
                name, 
                value, 
                color: COLORS_DRILLDOWN[i % COLORS_DRILLDOWN.length] // Changed here to distinct palette
            }));
    }
  }, [monthData, drilldownCategory]);

  // Stable color map for Level 1 Categories based on current month's data
  // Using the same logic as the initial Pie Chart to ensure color consistency
  const cat1ColorMap = useMemo(() => {
      const cats: Record<string, number> = {};
      monthData.transactions.filter(t => t.type === 'expense').forEach(t => {
          cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount);
      });
      // Sort by value desc (same as Pie chart) to assign colors deterministically
      return Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [name], index) => {
            acc[name] = COLORS[index % COLORS.length];
            return acc;
        }, {} as Record<string, string>);
  }, [monthData]);

  // Table Data: Group by Cat 1, then Aggregate by Cat 2
  const groupedAggregatedData = useMemo(() => {
    const groups: Record<string, { subcategory: string; amount: number }[]> = {};
    
    // 1. Group by Cat 1
    const byCat1: Record<string, Transaction[]> = {};
    monthData.transactions.filter(t => t.type === 'expense').forEach(t => {
       if (!byCat1[t.category]) byCat1[t.category] = [];
       byCat1[t.category].push(t);
    });

    // 2. Aggregate by Subcategory within Cat 1
    Object.keys(byCat1).forEach(cat1 => {
        const subMap: Record<string, number> = {};
        byCat1[cat1].forEach(t => {
            const sub = t.subcategory || 'Otros';
            subMap[sub] = (subMap[sub] || 0) + Math.abs(t.amount);
        });
        
        groups[cat1] = Object.entries(subMap)
            .map(([sub, amt]) => ({ subcategory: sub, amount: amt }))
            .sort((a, b) => b.amount - a.amount);
    });

    return groups;
  }, [monthData]);

  // Sort the categories for the table view based on total amount
  const sortedTableCategories = useMemo(() => {
      return Object.keys(groupedAggregatedData).sort((a, b) => {
          const totalA = groupedAggregatedData[a].reduce((s, i) => s + i.amount, 0);
          const totalB = groupedAggregatedData[b].reduce((s, i) => s + i.amount, 0);
          return totalB - totalA;
      });
  }, [groupedAggregatedData]);

  return (
    <div className="space-y-6">
      {/* NEW 2-ROW SELECTOR */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
         
         {/* Row 1: Years */}
         <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2">Año:</span>
            {availableYears.map(year => (
                <button
                    key={year}
                    onClick={() => handleYearClick(year)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        activeYearSelector === year 
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                >
                    {year}
                </button>
            ))}
         </div>

         {/* Row 2: Months (Full Names) */}
         <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2">Mes:</span>
            {groupedData[activeYearSelector]?.map(m => (
                <button
                    key={m.index}
                    onClick={() => setSelectedMonthIdx(m.index)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedMonthIdx === m.index 
                        ? 'bg-slate-100 text-slate-900 font-bold' 
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    {m.fullLabel}
                </button>
            ))}
         </div>
      </div>

      {/* KPIs con tendencia frente al mes anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPIBox label="Ingresos" value={monthData.income} isCurrency positive trendPct={comparison ? comparison.incomeDeltaPct : null} />
        <KPIBox label="Gastos" value={monthData.expense} isCurrency negative trendPct={comparison ? comparison.expenseDeltaPct : null} />
        <KPIBox label="Tasa de ahorro" value={monthData.savingsRate} suffix="%" />
      </div>

      {/* F4: Comparativa con el mes anterior */}
      {comparison && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-1">Comparativa frente a {comparison.previous.monthKey}</h3>
          <p className="text-sm text-slate-500 mb-5">Variación de {monthData.monthKey} respecto al mes anterior.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/40 rounded-xl p-4">
              <span className="text-xs text-slate-400 uppercase font-bold">Variación del ahorro</span>
              <p className={`text-xl font-bold mt-1 ${comparison.balanceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {comparison.balanceDelta >= 0 ? '+' : '−'}{formatEuro(Math.abs(comparison.balanceDelta))}
              </p>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-4">
              <span className="text-xs text-slate-400 uppercase font-bold">Categoría que más sube</span>
              {comparison.topRiser ? (
                <p className="text-base font-bold mt-1 text-rose-400">
                  {comparison.topRiser.category} <span className="text-sm font-mono">{formatSignedPercent(comparison.topRiser.deltaPct)}</span>
                </p>
              ) : <p className="text-base mt-1 text-slate-500">—</p>}
            </div>
            <div className="bg-slate-800/40 rounded-xl p-4">
              <span className="text-xs text-slate-400 uppercase font-bold">Categoría que más baja</span>
              {comparison.topFaller ? (
                <p className="text-base font-bold mt-1 text-emerald-400">
                  {comparison.topFaller.category} <span className="text-sm font-mono">{formatSignedPercent(comparison.topFaller.deltaPct)}</span>
                </p>
              ) : <p className="text-base mt-1 text-slate-500">—</p>}
            </div>
          </div>
        </div>
      )}

      {/* F3: Mayores gastos del mes + F2: presupuestos del mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Mayores gastos del mes</h3>
          {biggestExpenses.length === 0 ? (
            <p className="text-slate-500 text-sm">No hay gastos registrados este mes.</p>
          ) : (
            <ul className="space-y-2">
              {biggestExpenses.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between gap-3 bg-slate-800/40 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{t.subcategory || t.category}</p>
                      <p className="text-slate-500 text-xs truncate">{t.category}</p>
                    </div>
                  </div>
                  <span className="text-white font-mono font-bold text-sm shrink-0">{formatEuro(Math.abs(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Presupuestos del mes</h3>
          {monthBudgets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 py-6">
              <span className="text-3xl mb-2">🎯</span>
              <p className="text-sm text-center">Define límites en la pestaña <span className="text-indigo-400">Objetivos y Presupuestos</span>.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {monthBudgets.map((b) => {
                const s = stateStyles[b.state];
                const pct = Math.min(100, b.usedPct);
                return (
                  <div key={b.category}>
                    <div className="flex justify-between items-center mb-1 text-sm">
                      <span className="text-slate-300 font-medium">{b.category}</span>
                      <span className={`font-mono font-bold ${s.text}`}>{formatEuro(b.spent)} / {formatEuro(b.budget)}</span>
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown Chart (Interactive Drill-down) */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                 {drilldownCategory ? `Distribución: ${drilldownCategory}` : 'Distribución por Categoría'}
              </h3>
              <p className="text-xs text-slate-500">
                 {drilldownCategory 
                    ? 'Visualizando subcategorías. Pulsa "Volver" para regresar.' 
                    : 'Pulsa en una categoría para ver su desglose.'}
              </p>
            </div>
            {drilldownCategory && (
                <button 
                    onClick={() => setDrilldownCategory(null)}
                    className="text-xs flex items-center bg-slate-800 hover:bg-slate-700 text-indigo-400 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                >
                    <span className="mr-1">←</span> Volver
                </button>
            )}
          </div>
          <div className="flex-1 w-full">
             <ResponsiveContainer width="99%" height="100%">
               <PieChart>
                 <Pie 
                    data={activePieData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value" 
                    isAnimationActive={true}
                    paddingAngle={2}
                    onClick={(data) => {
                         if (!drilldownCategory) {
                              setDrilldownCategory(data.name);
                         }
                    }}
                    style={{ cursor: !drilldownCategory ? 'pointer' : 'default' }}
                 >
                   {activePieData.map((e, i) => <Cell key={`c-${i}`} fill={e.color} stroke="#0f172a" strokeWidth={2} style={{ outline: 'none' }} />)}
                 </Pie>
                 <Tooltip 
                    contentStyle={CHART_TOOLTIP.contentStyle} 
                    itemStyle={CHART_TOOLTIP.itemStyle}
                    formatter={(val: number) => formatEuro(val)}
                 />
                 <Legend wrapperStyle={{fontSize: '12px'}} />
               </PieChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table (Aggregated) */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
           <h3 className="text-lg font-semibold text-white mb-4">Detalle de Gastos (Acumulado)</h3>
           <div className="overflow-x-auto max-h-[400px]">
             <table className="w-full text-left text-sm">
               <thead className="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">
                 <tr><th className="pb-2 pl-2">Concepto</th><th className="pb-2 text-right pr-2">Total</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                 {sortedTableCategories.map(cat1 => {
                   const totalCat = groupedAggregatedData[cat1].reduce((s, i) => s + i.amount, 0);
                   const catColor = cat1ColorMap[cat1] || '#818cf8'; // fallback

                   return (
                   <React.Fragment key={cat1}>
                     <tr className="bg-slate-800/30">
                       <td className="py-2 px-3 font-bold text-xs uppercase tracking-wider" style={{ color: catColor }}>{cat1}</td>
                       <td className="py-2 px-3 font-bold text-xs uppercase tracking-wider text-right" style={{ color: catColor }}>{formatEuro(totalCat)}</td>
                     </tr>
                     {groupedAggregatedData[cat1].map((item, idx) => (
                       <tr key={`${cat1}-${idx}`} className="group hover:bg-slate-800/50">
                         <td className="py-3 px-3 text-slate-300 pl-6">{item.subcategory}</td>
                         <td className="py-3 px-3 text-right text-slate-200">{formatEuro(item.amount)}</td>
                       </tr>
                     ))}
                   </React.Fragment>
                 )})}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};
