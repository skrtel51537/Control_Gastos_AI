import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList, ReferenceLine
} from 'recharts';
import { DashboardData, MonthlySummary, Transaction } from '../types';
import { processExcelFile, downloadSampleExcel } from '../utils/excelParser';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
// Distinct palette for drill-down view to differentiate from main category view
const COLORS_DRILLDOWN = ['#3b82f6', '#14b8a6', '#f97316', '#a855f7', '#f43f5e', '#84cc16', '#eab308', '#64748b'];
const COLORS_LIGHT = ['#818cf8', '#f472b6', '#a78bfa', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#94a3b8'];

type Tab = 'RESUMEN' | 'MENSUAL' | 'CATEGORIAS' | 'TENDENCIAS';

export const DashboardPrototype: React.FC = () => {
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('RESUMEN');
  
  // Year Filter State
  const [selectedYear, setSelectedYear] = useState<string>('TOTAL');
  
  useEffect(() => {
    const saved = localStorage.getItem('finance_data_v3');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        // Hydrate dates properly from JSON strings
        if (parsed.monthlyData) {
            parsed.monthlyData = parsed.monthlyData.map((m: any) => ({
                ...m,
                dateObj: new Date(m.dateObj)
            }));
        }
        setRawData(parsed); 
      } catch (e) { console.error(e); }
    }
  }, []);

  // Calculate available years from raw data
  const availableYears = useMemo(() => {
    if (!rawData) return [];
    const years = new Set(rawData.monthlyData.map(m => new Date(m.dateObj).getFullYear().toString()));
    return Array.from(years).sort((a: string, b: string) => b.localeCompare(a));
  }, [rawData]);

  // Derive Filtered Data based on Year Selection
  const filteredData = useMemo((): DashboardData | null => {
    if (!rawData) return null;
    if (selectedYear === 'TOTAL') return rawData;

    const filteredMonths = rawData.monthlyData.filter(m => 
      new Date(m.dateObj).getFullYear().toString() === selectedYear
    );

    const filteredTxs = rawData.allTransactions.filter(t => 
      new Date(t.date).getFullYear().toString() === selectedYear
    );

    // Re-calculate Global KPIs for the specific year
    const totalIncome = filteredMonths.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = filteredMonths.reduce((sum, m) => sum + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;
    const avgSavings = filteredMonths.length > 0 
      ? filteredMonths.reduce((sum, m) => sum + m.savingsRate, 0) / filteredMonths.length 
      : 0;

    return {
      ...rawData,
      allTransactions: filteredTxs,
      monthlyData: filteredMonths,
      globalKPIs: {
        totalIncome,
        totalExpense,
        totalBalance,
        averageSavingsRate: avgSavings
      }
    };
  }, [rawData, selectedYear]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true); setError(null);
    try {
      const processed = await processExcelFile(file);
      setRawData(processed);
      localStorage.setItem('finance_data_v3', JSON.stringify(processed));
      setSelectedYear('TOTAL'); // Reset filter on new upload
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearData = () => { localStorage.removeItem('finance_data_v3'); setRawData(null); };

  if (!filteredData) return <UploadView isLoading={isLoading} error={error} onUpload={handleFileUpload} />;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200 font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onClear={clearData} />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header 
          activeTab={activeTab} 
          years={availableYears} 
          selectedYear={selectedYear} 
          onYearChange={setSelectedYear} 
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'RESUMEN' && <OverviewTab data={filteredData} selectedYear={selectedYear} />}
            {activeTab === 'MENSUAL' && <MonthlyTab data={filteredData} />}
            {activeTab === 'CATEGORIAS' && <CategoriesTab data={filteredData} />}
            {activeTab === 'TENDENCIAS' && <TrendsTab data={filteredData} />}
          </div>
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const Sidebar = ({ activeTab, onTabChange, onClear }: { activeTab: Tab, onTabChange: (t: Tab) => void, onClear: () => void }) => (
  <aside className="w-20 lg:w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden sm:flex">
    <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">💸</div>
      <span className="ml-3 font-bold text-lg hidden lg:block text-slate-100 tracking-tight">Control de Gastos</span>
    </div>
    <nav className="flex-1 py-6 px-3 space-y-2">
      {[
        { id: 'RESUMEN', label: 'Resumen Global', icon: '📊' },
        { id: 'MENSUAL', label: 'Análisis Mensual', icon: '📅' },
        { id: 'CATEGORIAS', label: 'Desglose Categorías', icon: '🏷️' },
        { id: 'TENDENCIAS', label: 'Tendencias', icon: '📈' }
      ].map((item) => (
        <button key={item.id} onClick={() => onTabChange(item.id as Tab)}
          className={`w-full flex items-center p-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-400 font-medium border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
          <span className="mr-0 lg:mr-3 text-xl">{item.icon}</span>
          <span className="hidden lg:block">{item.label}</span>
        </button>
      ))}
    </nav>
    <div className="p-4 border-t border-slate-800 space-y-2">
      <button onClick={onClear} className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm">
        <span className="mr-2">🗑️</span><span className="hidden lg:inline">Borrar Datos</span>
      </button>
    </div>
  </aside>
);

const Header = ({ activeTab, years, selectedYear, onYearChange }: { activeTab: Tab, years: string[], selectedYear: string, onYearChange: (y: string) => void }) => (
  <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md sticky top-0 z-20">
    <div className="flex items-center lg:hidden gap-2">
        <span className="text-xl">💸</span>
        <span className="font-bold">Control de Gastos</span>
    </div>
    
    <div className="flex items-center text-sm text-slate-400">
      <span className="hidden lg:inline">Dashboard</span><span className="mx-2 hidden lg:inline">/</span><span className="text-white capitalize">{activeTab.toLowerCase()}</span>
    </div>

    <div className="flex items-center gap-4">
      <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
        <span className="text-xs text-slate-400 px-2 font-medium uppercase hidden sm:inline">Año:</span>
        <select 
          value={selectedYear} 
          onChange={(e) => onYearChange(e.target.value)}
          className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer py-1 px-2 rounded hover:bg-slate-700"
        >
          <option value="TOTAL" className="bg-slate-900">Total (Todos)</option>
          {years.map(y => (
            <option key={y} value={y} className="bg-slate-900">{y}</option>
          ))}
        </select>
      </div>
      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full ring-2 ring-slate-800"></div>
    </div>
  </header>
);

const KPIBox = ({ label, value, isCurrency, suffix, positive, negative }: { label: string, value: number, isCurrency?: boolean, suffix?: string, positive?: boolean, negative?: boolean }) => {
  const colorClass = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-white";
  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
       <span className="text-slate-400 text-xs font-bold uppercase">{label}</span>
       <p className={`text-2xl font-bold mt-1 ${colorClass}`}>
         {isCurrency && '€'}{Math.round(value).toLocaleString()}
         {suffix}
       </p>
    </div>
  );
};

// --- VIEW TABS ---

const OverviewTab = ({ data, selectedYear }: { data: DashboardData, selectedYear: string }) => {
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
    return data.monthlyData.filter(m => m.expense > (m.income * (alertThreshold / 100)));
  }, [data, alertThreshold]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl text-sm min-w-[180px]">
          <p className="font-bold text-slate-200 mb-3 border-b border-slate-800 pb-2">{label}</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-emerald-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div>Ingresos:</span> 
               <span className="font-mono font-bold">€{Math.round(d.Ingresos).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-rose-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400"></div>Gastos:</span> 
               <span className="font-mono font-bold">€{Math.round(d.Gastos).toLocaleString()}</span>
            </div>
             <div className="flex justify-between items-center text-indigo-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400"></div>Ahorro Total:</span> 
               <span className="font-mono font-bold">€{Math.round(d.Balance).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400 pt-2 mt-1 border-t border-slate-800">
               <span>Tasa Ahorro:</span> 
               <span className="font-mono font-bold">{Math.round(d.AhorroPct)}%</span>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                 dataKey="name" 
                 stroke="#64748b" 
                 tick={{fontSize: 12}} 
                 minTickGap={30}
                 padding={{ left: 10, right: 10 }}
              />
              <YAxis stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="Ingresos" stroke="#10b981" fill="url(#colInc)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="Gastos" stroke="#ef4444" fill="url(#colExp)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                   dataKey="name" 
                   stroke="#64748b"
                   tick={{fontSize: 12}} 
                   minTickGap={30}
                   padding={{ left: 10, right: 10 }}
                />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} 
                  itemStyle={{ color: '#f8fafc' }} 
                  formatter={(val: number) => `€${Math.round(val).toLocaleString()}`} 
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
                        <td className="py-3 px-1 text-right text-slate-400">€{Math.round(m.balance).toLocaleString()}</td>
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

const MonthlyTab = ({ data }: { data: DashboardData }) => {
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

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
           <span className="text-slate-400 text-xs">Ingresos</span>
           <p className="text-xl font-bold text-emerald-400">€{Math.round(monthData.income).toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
           <span className="text-slate-400 text-xs">Gastos</span>
           <p className="text-xl font-bold text-rose-400">€{Math.round(monthData.expense).toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
           <span className="text-slate-400 text-xs">Ahorro</span>
           <p className="text-xl font-bold text-indigo-400">{Math.round(monthData.savingsRate)}%</p>
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
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(val: number) => `€${Math.round(val).toLocaleString()}`}
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
                       <td className="py-2 px-3 font-bold text-xs uppercase tracking-wider text-right" style={{ color: catColor }}>{Math.round(totalCat).toLocaleString()} €</td>
                     </tr>
                     {groupedAggregatedData[cat1].map((item, idx) => (
                       <tr key={`${cat1}-${idx}`} className="group hover:bg-slate-800/50">
                         <td className="py-3 px-3 text-slate-300 pl-6">{item.subcategory}</td>
                         <td className="py-3 px-3 text-right text-slate-200">{Math.round(item.amount).toLocaleString()} €</td>
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

const CategoriesTab = ({ data }: { data: DashboardData }) => {
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
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(val: number) => `€${Math.round(val).toLocaleString()}`}
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
                   <p className="text-2xl font-bold text-white">€{Math.round(totalSelectedCategory).toLocaleString()}</p>
                </div>
             </div>
             
             <ResponsiveContainer width="99%" height={350}>
               <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 40, left: 40, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                 <XAxis type="number" stroke="#64748b" tickFormatter={(val) => `€${val}`} />
                 <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} tick={{fontSize: 12}} />
                 <Tooltip 
                    cursor={{fill: '#334155', opacity: 0.2}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} 
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(val: number) => `€${Math.round(val).toLocaleString()}`}
                 />
                 <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                   <LabelList dataKey="value" position="right" fill="#94a3b8" fontSize={12} formatter={(val: number) => `€${Math.round(val).toLocaleString()}`} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

const TrendsTab = ({ data }: { data: DashboardData }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcat, setSelectedSubcat] = useState<string | null>(null);
  const [isSubcatDropdownOpen, setIsSubcatDropdownOpen] = useState(false);

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

          {/* Subcategory Single Select Dropdown */}
          <div className="relative min-w-[220px]">
             <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Subcategoría (Opcional)</h3>
             <button 
               onClick={() => setIsSubcatDropdownOpen(!isSubcatDropdownOpen)}
               className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm flex justify-between items-center hover:bg-slate-700 transition-colors"
             >
               <span className="truncate font-medium text-slate-200">{selectedSubcat || 'Total Categoría'}</span>
               <span className="text-xs ml-2">▼</span>
             </button>
             
             {isSubcatDropdownOpen && (
               <div className="absolute top-full left-0 mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto p-1">
                  <button 
                    onClick={() => { setSelectedSubcat(null); setIsSubcatDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${!selectedSubcat ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                  >
                    Total Categoría
                  </button>
                  {subcategories.map(sub => (
                    <button 
                       key={sub}
                       onClick={() => { setSelectedSubcat(sub); setIsSubcatDropdownOpen(false); }}
                       className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${selectedSubcat === sub ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                    >
                       {sub}
                    </button>
                  ))}
               </div>
             )}
          </div>
       </div>

       {/* Chart */}
       <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 min-h-[500px]">
         <div className="flex justify-between items-end mb-6">
            <div>
                <h3 className="text-lg font-semibold text-white">Evolución: <span style={{ color: activeColor }}>{currentLabel}</span></h3>
                <p className="text-sm text-slate-500">
                    Gasto Promedio: <span className="text-red-400 font-bold">€{Math.round(average).toLocaleString()}</span> / mes
                </p>
            </div>
         </div>
         
         <ResponsiveContainer width="99%" height={400}>
           <LineChart data={trendData} margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
             <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} />
             <YAxis stroke="#64748b" />
             <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} 
                itemStyle={{ color: '#f8fafc' }}
                formatter={(val: number) => [`€${val.toLocaleString()}`, currentLabel]}
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

const UploadView = ({ isLoading, error, onUpload }: any) => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e51a_1px,transparent_1px),linear-gradient(to_bottom,#4f46e51a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 relative z-10 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
          📂
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Cargar Datos</h2>
        <p className="text-slate-400 text-sm">Sube tu Excel de gastos para visualizar el dashboard.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="space-y-4">
        <label className={`block w-full cursor-pointer group ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 hover:bg-slate-800/50 transition-all">
             <span className="block text-4xl mb-2">📄</span>
             <span className="block text-sm font-medium text-slate-300 group-hover:text-white">Click para seleccionar Excel</span>
             <span className="block text-xs text-slate-500 mt-1">.xlsx, .xls</span>
          </div>
          <input type="file" accept=".xlsx, .xls" onChange={onUpload} className="hidden" />
        </label>
        
        {isLoading && <p className="text-center text-indigo-400 animate-pulse text-sm">Procesando datos...</p>}

        <div className="pt-2 text-center">
          <p className="text-xs text-slate-500 mb-2">¿No sabes qué formato usar?</p>
          <button
            type="button"
            onClick={downloadSampleExcel}
            className="text-sm text-indigo-400 hover:text-indigo-300 font-medium underline-offset-4 hover:underline transition-colors"
          >
            Descargar plantilla de ejemplo
          </button>
        </div>
      </div>
    </div>
  </div>
);