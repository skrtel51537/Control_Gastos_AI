import React from 'react';
import type { Tab } from '../../types';

export const Header = ({ activeTab, years, selectedYear, onYearChange }: { activeTab: Tab, years: string[], selectedYear: string, onYearChange: (y: string) => void }) => (
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
          aria-label="Filtrar por año"
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
