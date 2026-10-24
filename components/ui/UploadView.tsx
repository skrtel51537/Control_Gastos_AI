import React from 'react';
import { downloadSampleExcel } from '../../utils/excelParser';

export const UploadView = ({ isLoading, error, onUpload, onRestore, onBot }: {
  isLoading: boolean,
  error: string | null,
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onBot?: () => void, // solo en la app de escritorio
}) => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e51a_1px,transparent_1px),linear-gradient(to_bottom,#4f46e51a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 relative z-10 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
          📂
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Cargar Datos</h2>
        <p className="text-slate-400 text-sm">
          {onBot ? 'Carga tus gastos desde el bot o sube tu Excel.' : 'Sube tu Excel de gastos para visualizar el dashboard.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="space-y-4">
        {onBot && (
          <>
            <button
              type="button"
              onClick={onBot}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl p-4 transition-colors"
            >
              <span className="text-xl" aria-hidden="true">🤖</span> Cargar desde el bot
            </button>
            <p className="text-center text-xs text-slate-500">o, si prefieres, un Excel:</p>
          </>
        )}
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

        <div className="pt-1 text-center border-t border-slate-800 mt-2">
          <p className="text-xs text-slate-500 mt-3 mb-1">¿Vienes de otro equipo o reinstalaste?</p>
          <label className="text-sm text-slate-300 hover:text-white font-medium cursor-pointer underline-offset-4 hover:underline transition-colors">
            Restaurar copia de seguridad
            <input type="file" accept=".json,application/json" onChange={onRestore} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  </div>
);