import { describe, it, expect } from 'vitest';
import { formatEuro, formatEuroCents, formatPercent, formatSignedPercent } from './format';

// Intl usa espacio duro (U+00A0) entre cifra y €: normalizar para comparar.
const norm = (s: string) => s.replace(/ /g, ' ');

describe('formatEuro', () => {
  it('formatea en es-ES sin decimales y con separador de miles', () => {
    // Ojo: la regla es-ES no agrupa números de 4 cifras (2600 -> "2600 €").
    expect(norm(formatEuro(2600))).toBe('2600 €');
    expect(norm(formatEuro(12345))).toBe('12.345 €');
    expect(norm(formatEuro(0))).toBe('0 €');
    expect(norm(formatEuro(-12345))).toBe('-12.345 €');
  });

  it('redondea los decimales', () => {
    expect(norm(formatEuro(99.6))).toBe('100 €');
  });
});

describe('formatEuroCents', () => {
  it('siempre muestra dos decimales con coma', () => {
    expect(norm(formatEuroCents(12345.5))).toBe('12.345,50 €');
    expect(norm(formatEuroCents(10))).toBe('10,00 €');
  });
});

describe('formatPercent', () => {
  it('redondea al entero y añade el símbolo', () => {
    expect(formatPercent(42.4)).toBe('42 %');
    expect(formatPercent(-7.6)).toBe('-8 %');
    expect(formatPercent(0)).toBe('0 %');
  });
});

describe('formatSignedPercent', () => {
  it('antepone + a los positivos y conserva el - de los negativos', () => {
    expect(formatSignedPercent(12.3)).toBe('+12 %');
    expect(formatSignedPercent(-5.4)).toBe('-5 %');
    expect(formatSignedPercent(0)).toBe('0 %');
  });
});
