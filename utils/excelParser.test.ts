import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelData } from './excelParser';

// Construye un libro Excel en memoria con el formato esperado por la app:
// B1 = fecha del mes, B4 = ingresos, filas 5+ con F=importe, G=cat1, H=cat2.
const buildWorkbook = (
  sheets: { name: string; b1: string; income: number; rows: [number, string, string][] }[],
): Uint8Array => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, b1, income, rows }) => {
    const maxRow = 5 + rows.length;
    const aoa: any[][] = Array.from({ length: maxRow }, () => Array(8).fill(''));
    aoa[0][1] = b1; // B1
    aoa[3][1] = income; // B4
    rows.forEach(([amount, cat1, cat2], i) => {
      const r = 4 + i; // fila 5 en adelante (índice 4)
      aoa[r][5] = amount; // F
      aoa[r][6] = cat1; // G
      aoa[r][7] = cat2; // H
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
};

describe('parseExcelData', () => {
  it('parsea ingresos, gastos y agrega por categoría', () => {
    const buf = buildWorkbook([
      {
        name: 'Enero',
        b1: 'Enero 2025',
        income: 2000,
        rows: [
          [800, 'Gastos Fijos', 'Alquiler'],
          [200, 'Alimentación', 'Supermercado'],
          [100, 'Alimentación', 'Restaurantes'],
        ],
      },
    ]);

    const data = parseExcelData(buf);
    expect(data.monthlyData).toHaveLength(1);
    const m = data.monthlyData[0];
    expect(m.income).toBe(2000);
    expect(m.expense).toBe(1100);
    expect(m.balance).toBe(900);
    // El parser normaliza el texto (mayúscula inicial, resto en minúscula) para
    // unificar variantes de may/min, por eso "Gastos Fijos" -> "Gastos fijos".
    expect(data.categories).toEqual(['Alimentación', 'Gastos fijos']);
  });

  it('respeta el punto decimal (formato del usuario)', () => {
    const buf = buildWorkbook([
      { name: 'Enero', b1: 'Enero 2025', income: 1000, rows: [[1234.56, 'Ocio', 'Cine']] },
    ]);
    const data = parseExcelData(buf);
    expect(data.monthlyData[0].expense).toBeCloseTo(1234.56, 2);
  });

  it('ignora filas marcadas como TOTAL', () => {
    const buf = buildWorkbook([
      {
        name: 'Enero',
        b1: 'Enero 2025',
        income: 1000,
        rows: [
          [100, 'Comida', 'Super'],
          [999, 'TOTAL', 'TOTAL'],
        ],
      },
    ]);
    const data = parseExcelData(buf);
    expect(data.monthlyData[0].expense).toBe(100);
  });

  it('ordena los meses cronológicamente entre hojas', () => {
    const buf = buildWorkbook([
      { name: 'Marzo', b1: 'Marzo 2025', income: 1000, rows: [[100, 'Comida', 'Super']] },
      { name: 'Enero', b1: 'Enero 2025', income: 1000, rows: [[50, 'Comida', 'Super']] },
    ]);
    const data = parseExcelData(buf);
    expect(data.monthlyData.map((m) => m.monthKey)).toEqual(['ENE 25', 'MAR 25']);
  });

  it('lanza error claro si no hay datos', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['vacío']]), 'Hoja');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    expect(() => parseExcelData(buf)).toThrow(/No se encontraron datos/);
  });
});
