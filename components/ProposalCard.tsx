import React from 'react';
import { SuggestionCard } from '../types';

interface Props {
  data: SuggestionCard;
  index: number;
}

export const ProposalCard: React.FC<Props> = ({ data, index }) => {
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'UI/UX': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Arquitectura': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'AI Integration': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div 
      className="group relative bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-500 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col h-full"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${getCategoryColor(data.category)}`}>
          {data.icon}
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${getCategoryColor(data.category)}`}>
          {data.category}
        </span>
      </div>

      <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-indigo-400 transition-colors">
        {data.title}
      </h3>
      
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        {data.description}
      </p>

      <div className="mt-auto">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detalles Técnicos</h4>
        <ul className="space-y-2">
          {data.details.map((detail, idx) => (
            <li key={idx} className="flex items-start text-sm text-slate-300">
              <span className="mr-2 text-indigo-500 mt-1">•</span>
              {detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
