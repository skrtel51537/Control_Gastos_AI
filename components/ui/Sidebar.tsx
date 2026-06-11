import React from 'react';
import type { Tab } from '../../types';

export const Sidebar = ({ activeTab, onTabChange, onClear, onExport, onRestore }: {
  activeTab: Tab,
  onTabChange: (t: Tab) => void,
  onClear: () => void,
  onExport: () => void,
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void,
}) => (
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
          title={item.label}
          aria-label={item.label}
          aria-current={activeTab === item.id ? 'page' : undefined}
          className={`w-full flex items-center p-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-400 font-medium border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
          <span className="mr-0 lg:mr-3 text-xl shrink-0" aria-hidden="true">{item.icon}</span>
          <span className="hidden lg:block text-left leading-tight">{item.label}</span>
        </button>
      ))}
    </nav>
    <div className="p-4 border-t border-slate-800 space-y-1">
      <button
        onClick={onExport}
        title="Guarda tus datos y configuración en un archivo (copia de seguridad)"
        aria-label="Exportar copia de seguridad"
        className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors text-sm"
      >
        <span className="mr-2" aria-hidden="true">💾</span><span className="hidden lg:inline">Exportar copia</span>
      </button>
      <label
        title="Recupera tus datos desde una copia de seguridad exportada"
        className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors text-sm cursor-pointer"
      >
        <span className="mr-2" aria-hidden="true">📥</span><span className="hidden lg:inline">Restaurar copia</span>
        <input type="file" accept=".json,application/json" onChange={onRestore} className="hidden" aria-label="Restaurar copia de seguridad" />
      </label>
      <button
        onClick={onClear}
        aria-label="Borrar datos"
        className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm"
      >
        <span className="mr-2" aria-hidden="true">🗑️</span><span className="hidden lg:inline">Borrar Datos</span>
      </button>
      <p className="text-center lg:text-left text-xs text-slate-600 px-1 pt-1" title="Versión de la aplicación">
        v{__APP_VERSION__}
      </p>
    </div>
  </aside>
);
