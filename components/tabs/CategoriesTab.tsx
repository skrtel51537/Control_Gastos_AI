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

export const CategoriesTab = ({ data }: { data: DashboardData }) => {
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set(data.allTransactions.filter(t => t.type === 'expense').map(t => t.category));
    return Array.from(cats).sort();
  }, [data]);

  // Global Aggregation (Main Categories) for the Pie Chart
  const allCategoriesData = useMemo(() => {
      const totals: Record<string, number> = {};
      data.allTransactions.filter(t => t.type === 'expense').forEach(t => {
          totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
      });
      return Object.entries(totals)
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
        .sort((a, b) => b.value - a.value);
  }, [data]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Data for the selected category (Breakdown by Subcategory)
  const categoryData = useMemo(() => {
    if (!activeCategory) return [];
    const subs: Record<string, number> = {};
    data.allTransactions
      .filter(t => t.type === 'expense' && t.category === activeCategory)
      .forEach(t => {
         const sub = t.subcategory || 'Otros';
         subs[sub] = (subs[sub] || 0) + Math.abs(t.amount);
      });
    return Object.entries(subs)
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [data, activeCategory]);

  const totalSelectedCategory = useMemo(() => {
      return categoryData.reduce((sum, item) => sum + item.value, 0);
  }, [categoryData]);

  // NEW: Find color for active category
  const activeCategoryColor = useMemo(() => {
    const cat = allCategoriesData.find(c => c.name === activeCategory);
    return cat ? cat.color : '#6366f1';
  }, [allCategoriesData, activeCategory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* LEFT COLUMN: Global Pie Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Gastos por Categoría Principal</h3>
          <p className="text-sm text-slate-500 mb-4">Distribución total acumulada de todos tus gastos.</p>
          <div className="flex-1 min-h-[300px]">
             <ResponsiveContainer width="99%" height="100%">
               <PieChart>
                 <Pie 
                    data={allCategoriesData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value" 
                    isAnimationActive={true}
                    paddingAngle={2}
                    onClick={(data) => setActiveCategory(data.name)}
                    style={{ cursor: 'pointer' }}
                 >
                   {allCategoriesData.map((e, i) => <Cell key={`c-${i}`} fill={e.color} stroke="#0f172a" strokeWidth={2} style={{ outline: 'none' }} />)}
                 </Pie>
                 <Tooltip 
                    contentStyle={CHART_TOOLTIP.contentStyle} 
                    itemStyle={CHART_TOOLTIP.itemStyle}
                    formatter={(val: number) => formatEuro(val)}
                 />
                 <Legend wrapperStyle={{fontSize: '11px'}} />
               </PieChart>
             </ResponsiveContainer>
          </div>
      </div>

      {/* RIGHT COLUMN: Detail Selector + Bar Chart */}
      <div className="flex flex-col space-y-6">
          {/* Selector */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">Seleccionar Categoría</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === cat 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart Breakdown */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex-1 min-h-[400px]">
             <div className="flex justify-between items-end mb-6 border-b border-slate-800 pb-4">
                <div>
                   <h3 className="text-lg font-semibold text-white">Desglose: <span style={{ color: activeCategoryColor }}>{activeCategory}</span></h3>
                   <p className="text-xs text-slate-500">Subcategorías</p>
                </div>
                <div className="text-right">
                   <p className="text-xs text-slate-400 font-bold uppercase">Total</p>
                   <p className="text-2xl font-bold text-white">{formatEuro(totalSelectedCategory)}</p>
                </div>
             </div>
             
             <ResponsiveContainer width="99%" height={Math.max(350, categoryData.length * 32)}>
               <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 40, left: 40, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                 <XAxis type="number" stroke={AXIS_STROKE} tickFormatter={(val) => `€${val}`} />
                 <YAxis dataKey="name" type="category" stroke={AXIS_STROKE_LIGHT} width={110} tick={{fontSize: 10}} interval={0} />
                 <Tooltip
                    cursor={CHART_TOOLTIP.cursor}
                    contentStyle={CHART_TOOLTIP.contentStyle}
                    itemStyle={CHART_TOOLTIP.itemStyle}
                    formatter={(val: number) => formatEuro(val)}
                 />
                 <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                   <LabelList dataKey="value" position="right" fill="#94a3b8" fontSize={10} formatter={(val: number) => formatEuro(val)} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
