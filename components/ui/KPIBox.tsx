import React from 'react';
import { formatEuro, formatPercent, formatSignedPercent } from '../../utils/format';

export const KPIBox = ({ label, value, isCurrency, suffix, positive, negative, trendPct }: { label: string, value: number, isCurrency?: boolean, suffix?: string, positive?: boolean, negative?: boolean, trendPct?: number | null }) => {
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
