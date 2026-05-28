const euroFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const euroFormatterCents = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un importe en euros sin decimales (uso general en el dashboard). */
export const formatEuro = (value: number): string => euroFormatter.format(value ?? 0);

/** Formatea un importe en euros con dos decimales (uso en detalles finos). */
export const formatEuroCents = (value: number): string => euroFormatterCents.format(value ?? 0);

/** Formatea un porcentaje entero (ej. 42 -> "42 %"). */
export const formatPercent = (value: number): string => `${Math.round(value ?? 0)} %`;

/** Formatea una variación con signo (ej. 12 -> "+12 %", -5 -> "-5 %"). */
export const formatSignedPercent = (value: number): string => {
  const rounded = Math.round(value ?? 0);
  return `${rounded > 0 ? '+' : ''}${rounded} %`;
};
