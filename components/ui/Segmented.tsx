import React from 'react';

// Grupo de botones donde solo uno está activo.
export const Segmented = <T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string }[], value: T, onChange: (v: T) => void, label: string,
}) => (
  <div role="group" aria-label={label} className="flex bg-slate-800/60 border border-slate-700 rounded-lg p-0.5">
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onChange(o.id)}
        aria-pressed={value === o.id}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
          value === o.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-100'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);
