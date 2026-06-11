// Tema visual compartido por todas las gráficas y tablas del dashboard.
// Único sitio donde tocar colores y estilos de Recharts: antes estos valores
// estaban duplicados en cada pestaña.

// Paleta principal (categorías) y paleta del drill-down (subcategorías),
// distinta a propósito para diferenciar ambos niveles.
export const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
export const COLORS_DRILLDOWN = ['#3b82f6', '#14b8a6', '#f97316', '#a855f7', '#f43f5e', '#84cc16', '#eab308', '#64748b'];

// Estilo unificado de los tooltips de Recharts.
export const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: '8px',
    color: '#f8fafc',
  },
  itemStyle: { color: '#f8fafc' },
  cursor: { fill: '#334155', opacity: 0.2 },
} as const;

// Colores de ejes y rejilla.
export const GRID_STROKE = '#1e293b';
export const AXIS_STROKE = '#64748b';
export const AXIS_STROKE_LIGHT = '#94a3b8';

// Estilos del semáforo (objetivos y presupuestos): texto, barra y etiqueta.
export const stateStyles: Record<'ok' | 'warning' | 'over', { text: string; bar: string; label: string }> = {
  ok: { text: 'text-emerald-400', bar: 'bg-emerald-500', label: 'En objetivo' },
  warning: { text: 'text-amber-400', bar: 'bg-amber-500', label: 'Cerca del límite' },
  over: { text: 'text-rose-400', bar: 'bg-rose-500', label: 'Superado' },
};
