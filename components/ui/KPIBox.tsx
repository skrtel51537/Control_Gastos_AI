import React from 'react';
import { formatEuro, formatPercent, formatSignedPercent } from '../../utils/format';

// lowerIsBetter: para gastos, subir es malo (rojo) y bajar es bueno (verde).
export const KPIBox = ({ label, value, isCurrency, suffix, positive, negative, trendPct, lowerIsBetter }: { label: string, value: number, isCurrency?: boolean, suffix?: string, positive?: boolean, negative?: boolean, trendPct?: number | null, lowerIsBetter?: boolean }) => {
  const colorClass = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-white";
  const trendGood = trendPct != null && (lowerIsBetter ? trendPct < 0 : trendPct > 0);
  const trendBad = trendPct != null && (lowerIsBetter ? trendPct > 0 : trendPct < 0);
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
         <p className={`text-xs font-medium mt-1 ${trendGood ? 'text-emerald-400' : trendBad ? 'text-rose-400' : 'text-slate-500'}`}>
           {trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '→'} {formatSignedPercent(trendPct)} vs periodo anterior
         </p>
       )}
    </div>
  );
};

// --- VIEW TABS ---
