import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList, ReferenceLine
} from 'recharts';
import { DashboardData, MonthlySummary, Transaction } from '../types';
import { processExcelFile, downloadSampleExcel } from '../utils/excelParser';
import { formatEuro, formatPercent, formatSignedPercent } from '../utils/format';
import { loadJSON, saveJSON, removeKey } from '../utils/storage';
import {
  FinanceSettings,
  DEFAULT_SETTINGS,
  SavingsGoal,
  monthlyGoalStatus,
  budgetStatuses,
  topExpenses,
  detectAnomalies,
  comparePeriods,
  projectYear,
  expenseByCategory,
} from '../utils/finance';

const pctChange = (current: number, previous: number): number | null =>
  previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;

const DATA_KEY = 'finance_data_v3';
const SETTINGS_KEY = 'finance_settings_v1';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
// Distinct palette for drill-down view to differentiate from main category view
const COLORS_DRILLDOWN = ['#3b82f6', '#14b8a6', '#f97316', '#a855f7', '#f43f5e', '#84cc16', '#eab308', '#64748b'];
const COLORS_LIGHT = ['#818cf8', '#f472b6', '#a78bfa', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#94a3b8'];

type Tab = 'RESUMEN' | 'MENSUAL' | 'CATEGORIAS' | 'TENDENCIAS' | 'COMPARAR' | 'OBJETIVOS';

const hydrateData = (parsed: any): DashboardData => {
  if (parsed?.monthlyData) {
    parsed.monthlyData = parsed.monthlyData.map((m: any) => ({
      ...m,
      dateObj: new Date(m.dateObj),
    }));
  }
  return parsed;
};

export const DashboardPrototype: React.FC = () => {
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('RESUMEN');

  // Year Filter State
  const [selectedYear, setSelectedYear] = useState<string>('TOTAL');

  useEffect(() => {
    loadJSON<any>(DATA_KEY)
      .then((parsed) => {
        if (parsed) setRawData(hydrateData(parsed));
      })
      .catch((e) => console.error(e));

    loadJSON<FinanceSettings>(SETTINGS_KEY)
      .then((saved) => {
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      })
      .catch((e) => console.error(e));
  }, []);

  const updateSettings = (next: FinanceSettings) => {
    setSettings(next);
    saveJSON(SETTINGS_KEY, next).catch((e) => console.error(e));
  };

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
      await saveJSON(DATA_KEY, processed);
      setSelectedYear('TOTAL'); // Reset filter on new upload
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearData = () => { removeKey(DATA_KEY); setRawData(null); };

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
            {activeTab === 'MENSUAL' && <MonthlyTab data={filteredData} settings={settings} />}
            {activeTab === 'CATEGORIAS' && <CategoriesTab data={filteredData} />}
            {activeTab === 'TENDENCIAS' && <TrendsTab data={filteredData} />}
            {activeTab === 'COMPARAR' && <ComparatorTab data={rawData!} />}
            {activeTab === 'OBJETIVOS' && <GoalsTab data={filteredData} settings={settings} onChange={updateSettings} />}
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
        { id: 'TENDENCIAS', label: 'Tendencias', icon: '📈' },
        { id: 'COMPARAR', label: 'Comparador', icon: '⚖️' },
        { id: 'OBJETIVOS', label: 'Objetivos y Presupuestos', icon: '🎯' }
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

const KPIBox = ({ label, value, isCurrency, suffix, positive, negative, trendPct }: { label: string, value: number, isCurrency?: boolean, suffix?: string, positive?: boolean, negative?: boolean, trendPct?: number | null }) => {
  const colorClass = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-white";
  const displayValue = isCurrency
    ? formatEuro(value)
    : suffix === '%'
      ? formatPercent(value)
      : `${Math.round(value).toLocaleString('es-ES')}${suffix ?? ''}`;
  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
       <span className="text-slate-400 text-xs font-bold uppercase">{label}</span>
       <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{displayValue}</p>
       {trendPct != null && Number.isFinite(trendPct) && (
         <p className={`text-xs font-medium mt-1 ${trendPct > 0 ? 'text-emerald-400' : trendPct < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
           {trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '→'} {formatSignedPercent(trendPct)} vs periodo anterior
         </p>
       )}
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

const MonthlyTab = ({ data, settings }: { data: DashboardData, settings: FinanceSettings }) => {
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
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                    itemStyle={{ color: '#f8fafc' }}
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
             
             <ResponsiveContainer width="99%" height={350}>
               <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 40, left: 40, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                 <XAxis type="number" stroke="#64748b" tickFormatter={(val) => `€${val}`} />
                 <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} tick={{fontSize: 12}} />
                 <Tooltip 
                    cursor={{fill: '#334155', opacity: 0.2}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} 
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(val: number) => formatEuro(val)}
                 />
                 <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                   <LabelList dataKey="value" position="right" fill="#94a3b8" fontSize={12} formatter={(val: number) => formatEuro(val)} />
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
                    Gasto Promedio: <span className="text-red-400 font-bold">{formatEuro(average)}</span> / mes
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
const stateStyles: Record<'ok' | 'warning' | 'over', { text: string; bar: string; label: string }> = {
  ok: { text: 'text-emerald-400', bar: 'bg-emerald-500', label: 'En objetivo' },
  warning: { text: 'text-amber-400', bar: 'bg-amber-500', label: 'Cerca del límite' },
  over: { text: 'text-rose-400', bar: 'bg-rose-500', label: 'Superado' },
};

const GoalsTab = ({ data, settings, onChange }: { data: DashboardData, settings: FinanceSettings, onChange: (s: FinanceSettings) => void }) => {
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
    () => months.map((m) => ({ month: m, status: monthlyGoalStatus(m, goal) })),
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
                      <td className={`py-3 text-right font-mono font-bold ${s.text}`}>{formatEuro(status.actual)}</td>
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

const ComparatorTab = ({ data }: { data: DashboardData }) => {
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
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tickFormatter={(v) => formatEuro(v)} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={110} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#334155', opacity: 0.2 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(v: number) => formatEuro(v)}
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