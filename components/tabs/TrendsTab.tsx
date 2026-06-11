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

export const TrendsTab = ({ data }: { data: DashboardData }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcat, setSelectedSubcat] = useState<string | null>(null);

  // 1. Categories
  const categories = useMemo(() => data.categories, [data]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories]);

  // 2. Subcategories
  const subcategories = useMemo(() => {
      if (!selectedCategory) return [];
      return data.categoryHierarchy[selectedCategory] || [];
  }, [selectedCategory, data]);

  // Reset selected subcategory when category changes
  useEffect(() => {
      setSelectedSubcat(null);
  }, [selectedCategory]);

  // 3. Chart Data
  const { trendData, average, currentLabel } = useMemo(() => {
      if (!selectedCategory) return { trendData: [], average: 0, currentLabel: '' };
      
      let totalSum = 0;
      const dataPoints = data.monthlyData.map(m => {
          const catTxs = m.transactions.filter(t => t.type === 'expense' && t.category === selectedCategory);
          
          let val = 0;
          // If a specific subcategory is selected, sum ONLY that subcategory
          if (selectedSubcat) {
               val = catTxs
                .filter(t => t.subcategory === selectedSubcat)
                .reduce((s, t) => s + Math.abs(t.amount), 0);
          } else {
               // Otherwise sum the whole category
               val = catTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
          }

          totalSum += val;
          return { name: m.monthKey, value: val };
      });

      const avg = dataPoints.length > 0 ? totalSum / dataPoints.length : 0;
      return { trendData: dataPoints, average: avg, currentLabel: selectedSubcat || selectedCategory };
  }, [data, selectedCategory, selectedSubcat]);

  // Active color logic based on selection
  // Soft Terracotta for Total, Sand/Beige for Subcategory (as requested: less aggressive, warm)
  const activeColor = selectedSubcat ? '#e6c79c' : '#d18e74';

  return (
    <div className="space-y-6">
       {/* Controls */}
       <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
          
          {/* Category Selector */}
          <div className="flex-1">
             <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Categoría Principal</h3>
             <div className="flex flex-wrap gap-2">
               {categories.map(cat => (
                 <button 
                   key={cat} 
                   onClick={() => setSelectedCategory(cat)}
                   className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                     selectedCategory === cat 
                     ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                     : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                   }`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
          </div>

          {/* Subcategoría: select nativo (accesible con teclado y lector de pantalla) */}
          <div className="min-w-[220px]">
             <label htmlFor="subcat-select" className="text-xs font-bold text-slate-500 uppercase mb-2 block">Subcategoría (Opcional)</label>
             <select
               id="subcat-select"
               value={selectedSubcat ?? ''}
               onChange={(e) => setSelectedSubcat(e.target.value || null)}
               className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
             >
               <option value="" className="bg-slate-900">Total Categoría</option>
               {subcategories.map(sub => (
                 <option key={sub} value={sub} className="bg-slate-900">{sub}</option>
               ))}
             </select>
          </div>
       </div>

       {/* Chart */}
       <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 min-h-[500px]">
         <div className="flex justify-between items-end mb-6">
            <div>
                <h3 className="text-lg font-semibold text-white">Evolución: <span style={{ color: activeColor }}>{currentLabel}</span></h3>
                <p className="text-sm text-slate-500">
                    Gasto Promedio: <span className="text-red-400 font-bold">{formatEuro(average)}</span> / mes
                </p>
            </div>
         </div>
         
         <ResponsiveContainer width="99%" height={400}>
           <LineChart data={trendData} margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
             <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
             <XAxis dataKey="name" stroke={AXIS_STROKE} tick={{fontSize: 12}} />
             <YAxis stroke={AXIS_STROKE} />
             <Tooltip 
                contentStyle={CHART_TOOLTIP.contentStyle} 
                itemStyle={CHART_TOOLTIP.itemStyle}
                formatter={(val: number) => [formatEuro(val), currentLabel]}
             />
             <Legend />
             {/* Single Line based on selection */}
             <Line 
                type="monotone" 
                dataKey="value" 
                name={currentLabel}
                stroke={activeColor} 
                strokeWidth={3} 
                dot={{r:4}} 
                activeDot={{r:6}} 
             />
             
             {/* Average Line in RED as requested (Label removed) */}
             <ReferenceLine y={average} stroke="#ef4444" strokeDasharray="3 3" />
           </LineChart>
         </ResponsiveContainer>
       </div>
    </div>
  );
};

// Semáforo de estado para presupuestos/objetivos (verde / ámbar / rojo)