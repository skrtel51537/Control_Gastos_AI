import type * as XLSXType from 'xlsx';
import { Transaction, DashboardData, MonthlySummary } from '../types';

// xlsx es la dependencia más pesada de la app y solo hace falta al cargar o
// descargar un Excel: se importa bajo demanda para acelerar el arranque.
const loadXLSX = async () => await import('xlsx');

// Límite de tamaño del archivo: un Excel de gastos real ocupa unos pocos MB;
// algo mucho mayor probablemente es un archivo equivocado y congelaría la app.
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Diccionario ampliado para soportar abreviaturas y variaciones comunes
const SPANISH_MONTHS: Record<string, number> = {
  'ENE': 0, 'ENERO': 0, 'JAN': 0,
  'FEB': 1, 'FEBRERO': 1,
  'MAR': 2, 'MARZO': 2,
  'ABR': 3, 'ABRIL': 3, 'APR': 3,
  'MAY': 4, 'MAYO': 4,
  'JUN': 5, 'JUNIO': 5,
  'JUL': 6, 'JULIO': 6,
  'AGO': 7, 'AGOSTO': 7, 'AUG': 7,
  'SEP': 8, 'SEPT': 8, 'SEPTIEMBRE': 8, 'SET': 8,
  'OCT': 9, 'OCTUBRE': 9,
  'NOV': 10, 'NOVIEMBRE': 10,
  'DIC': 11, 'DICIEMBRE': 11, 'DEC': 11
};

// Función para unificar "Discos/Libros" con "Discos/libros" -> "Discos/libros"
// Se usa también con los datos del bot: los presupuestos y objetivos guardados
// usan estos nombres normalizados.
export const normalizeText = (text: string): string => {
  if (!text) return 'Otros';
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Otros';
  // Capitalize first letter, lowercase the rest
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

// Clave de agrupación por mes (p. ej. "OCT 26"). Es la única fuente de esta
// expresión: el Excel y el bot deben producir exactamente la misma clave.
export const monthKeyFor = (date: Date): string =>
  `${date.toLocaleString('es-ES', { month: 'short' }).toUpperCase()} ${date.getFullYear().toString().slice(-2)}`;

// Lógica pura de parseo (sin FileReader) para poder probarla con tests.
export const parseExcelData = async (data: ArrayBuffer | Uint8Array): Promise<DashboardData> => {
  const XLSX = await loadXLSX();
  let workbook: XLSXType.WorkBook;
  try {
    workbook = XLSX.read(data, { type: 'array', cellDates: true });
  } catch {
    throw new Error("No se pudo leer el archivo. Comprueba que sea un Excel válido (.xlsx o .xls) y que no esté dañado.");
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("El archivo no contiene ninguna hoja de cálculo.");
  }

  let allTransactions: Transaction[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const transactions = parseSheet(sheet, sheetName);
    allTransactions = [...allTransactions, ...transactions];
  });

  if (allTransactions.length === 0) {
    throw new Error("No se encontraron datos. Asegúrate de que la celda B1 tenga la fecha (ej: 'Noviembre 2024') y los gastos comiencen en la fila 5.");
  }

  // Ordenar por fecha descendente
  allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return buildDashboardData(allTransactions);
};

export const processExcelFile = async (file: File): Promise<DashboardData> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'El archivo es demasiado grande (más de 50 MB). Comprueba que sea el Excel de gastos correcto.'
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      // resolve adopta la promesa: si el parseo falla, el error llega al llamador.
      resolve(parseExcelData(result as ArrayBuffer));
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

const parseSheet = (sheet: XLSXType.WorkSheet, sheetName: string): Transaction[] => {
    const transactions: Transaction[] = [];
    let globalDate: Date | null = null;
    
    // --- 1. Detección Inteligente de Fecha (B1) ---
    const cellB1 = sheet['B1'];
    if (cellB1) {
      if (cellB1.t === 'd' || cellB1.v instanceof Date) {
        globalDate = cellB1.v instanceof Date ? cellB1.v : new Date(cellB1.v);
      } else if (typeof cellB1.v === 'string') {
        globalDate = parseSpanishDateString(cellB1.v);
      }
    }

    // Fallback: Si B1 falla, intentar parsear el nombre de la pestaña (ej: "Nov 24")
    if (!globalDate || isNaN(globalDate.getTime())) {
      globalDate = parseSpanishDateString(sheetName);
    }

    // Si aún así no tenemos fecha, saltamos la hoja
    if (!globalDate || isNaN(globalDate.getTime())) return [];

    // FIX: Usar getFullYear/Month/Date localmente para evitar desfase de zona horaria (UTC)
    // toISOString() convertía 01/01/2025 00:00 local a 31/12/2024 UTC.
    const year = globalDate.getFullYear();
    const month = String(globalDate.getMonth() + 1).padStart(2, '0');
    const day = String(globalDate.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    
    const monthKey = monthKeyFor(globalDate);

    // --- 2. Ingresos (B4) ---
    const cellB4 = sheet['B4'];
    if (cellB4 && cellB4.v) {
      const incomeAmount = parseFloat(cellB4.v);
      // Number.isFinite descarta NaN e infinitos (celdas corruptas).
      if (Number.isFinite(incomeAmount) && incomeAmount > 0) {
        transactions.push({
          id: `${sheetName}-inc`,
          date: isoDate,
          concept: 'Ingresos Mensuales',
          category: 'Ingresos',
          subcategory: 'General',
          amount: incomeAmount,
          type: 'income',
          monthKey
        });
      }
    }

    // --- 3. Gastos (F5 en adelante) ---
    // NO usamos !ref porque a veces es incorrecto. 
    // Usamos un bucle "hasta encontrar vacío" con límite de seguridad.
    
    let consecutiveEmptyRows = 0;
    const MAX_ROWS = 1000; // Aumentado límite de seguridad
    const START_ROW = 5;

    for (let row = START_ROW; row <= MAX_ROWS; row++) {
      const amountCell = sheet[`F${row}`];
      const cat1Cell = sheet[`G${row}`];
      const cat2Cell = sheet[`H${row}`];

      // Verificar si hay importe válido
      let hasData = false;
      if (amountCell && amountCell.v != null) {
        const amount = parseFloat(amountCell.v);

        if (Number.isFinite(amount) && amount !== 0) {
          hasData = true;
          consecutiveEmptyRows = 0; // Reiniciar contador de vacíos

          const rawCat1 = cat1Cell ? String(cat1Cell.v) : 'General';
          const rawCat2 = cat2Cell ? String(cat2Cell.v) : 'Otros';

          // Filtrar filas de totales manuales
          if (rawCat1.toUpperCase().includes('TOTAL') || rawCat2.toUpperCase().includes('TOTAL')) {
            continue;
          }

          // Normalizar texto (Mayúscula inicial, resto minúscula)
          const cat1 = normalizeText(rawCat1);
          const cat2 = normalizeText(rawCat2);

          transactions.push({
            id: `${sheetName}-exp-${row}`,
            date: isoDate,
            concept: cat2,
            category: cat1,
            subcategory: cat2,
            amount: -Math.abs(amount), // Asegurar negativo
            type: 'expense',
            monthKey
          });
        }
      }

      if (!hasData) {
        consecutiveEmptyRows++;
      }

      // Si encontramos 10 filas seguidas sin datos en la columna F, asumimos fin de lista
      if (consecutiveEmptyRows >= 10) {
        break;
      }
    }

    return transactions;
}

const parseSpanishDateString = (str: string): Date | null => {
  try {
    const cleanStr = str.trim().toUpperCase().replace(/[-/]/g, ' '); // Reemplazar guiones/barras con espacios
    const parts = cleanStr.split(/\s+/).filter(p => p.length > 0);
    
    // Esperamos al menos [MES, AÑO] o [MES, DIA, AÑO] (aunque el formato suele ser MES AÑO)
    if (parts.length < 2) return null;

    // Buscar el mes en las partes
    let monthIndex = -1;
    let year = -1;

    for (const part of parts) {
      if (SPANISH_MONTHS[part] !== undefined) {
        monthIndex = SPANISH_MONTHS[part];
      } else if (!isNaN(parseInt(part))) {
        const val = parseInt(part);
        // Asumir que el año es > 2000 o es un año corto > 20
        if (val > 2000) year = val;
        else if (val >= 20 && val < 100) year = 2000 + val; 
      }
    }

    if (monthIndex !== -1 && year !== -1) {
      return new Date(year, monthIndex, 1);
    }
  } catch (e) {
    return null;
  }
  return null;
};

// Agrupa los movimientos por mes y calcula totales. La comparten el Excel y el bot.
export const buildDashboardData = (transactions: Transaction[]): DashboardData => {
    const groupedMap = new Map<string, Transaction[]>();
    const categoriesSet = new Set<string>();
    const categoryHierarchy: Record<string, Set<string>> = {};

    transactions.forEach(t => {
        if(!groupedMap.has(t.monthKey)) groupedMap.set(t.monthKey, []);
        groupedMap.get(t.monthKey)?.push(t);
        
        if (t.type === 'expense') {
            categoriesSet.add(t.category);
            if (!categoryHierarchy[t.category]) {
                categoryHierarchy[t.category] = new Set();
            }
            categoryHierarchy[t.category].add(t.subcategory);
        }
    });

    const finalHierarchy: Record<string, string[]> = {};
    Object.keys(categoryHierarchy).forEach(k => {
        finalHierarchy[k] = Array.from(categoryHierarchy[k]).sort();
    });

    const monthlyData: MonthlySummary[] = [];

    groupedMap.forEach((txs, key) => {
        const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const balance = income - expense;
        const savingsRate = income > 0 ? (balance / income) * 100 : 0;
        
        monthlyData.push({
            monthKey: key,
            dateObj: new Date(txs[0].date),
            income,
            expense,
            balance,
            savingsRate,
            transactions: txs
        });
    });

    monthlyData.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;
    const avgSavings = monthlyData.length > 0 ? monthlyData.reduce((sum, m) => sum + m.savingsRate, 0) / monthlyData.length : 0;

    return {
        allTransactions: transactions,
        monthlyData,
        globalKPIs: {
            totalIncome,
            totalExpense,
            totalBalance,
            averageSavingsRate: avgSavings
        },
        categories: Array.from(categoriesSet).sort(),
        categoryHierarchy: finalHierarchy
    };
};

export const getDemoData = (): DashboardData => {
    // Generación de datos de prueba simple
    const transactions: Transaction[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        // Fix demo date creation too
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const monthKey = monthKeyFor(d);

        transactions.push({
            id: `demo-${i}-inc`, date: dateStr, concept: 'Ingresos', category: 'Ingresos', subcategory: 'General', amount: 3000, type: 'income', monthKey
        });

        transactions.push({ id: `f1-${i}`, date: dateStr, concept: 'Alquiler', category: 'Gastos Fijos', subcategory: 'Alquiler', amount: -800, type: 'expense', monthKey });
        transactions.push({ id: `f2-${i}`, date: dateStr, concept: 'Internet', category: 'Gastos Fijos', subcategory: 'Internet', amount: -40, type: 'expense', monthKey });
        transactions.push({ id: `a1-${i}`, date: dateStr, concept: 'Mercadona', category: 'Alimentación', subcategory: 'Supermercado', amount: -250, type: 'expense', monthKey });
        
        // Simular caso inconsistente para demostrar la normalización
        const bookCat = i % 2 === 0 ? "Ocio" : "ocio"; // Mezcla mayúsculas
        const bookSub = i % 2 === 0 ? "Libros" : "libros";
        transactions.push({ id: `o1-${i}`, date: dateStr, concept: 'Libro', category: normalizeText(bookCat), subcategory: normalizeText(bookSub), amount: -30, type: 'expense', monthKey });
    }

    return buildDashboardData(transactions);
};

export const downloadSampleExcel = async () => {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const wsData = Array.from({ length: 42 }, () => Array(8).fill(''));
    
    const row1 = [...wsData[0]]; row1[1] = "NOVIEMBRE 2025"; wsData[0] = row1;
    const row4 = [...wsData[3]]; row4[1] = 2500; row4[5] = "Importe"; row4[6] = "Categoría 1"; row4[7] = "Categoría 2"; wsData[3] = row4;
    const row5 = [...wsData[4]]; row5[5] = 800; row5[6] = "Gastos Fijos"; row5[7] = "Alquiler"; wsData[4] = row5;

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Noviembre");
    XLSX.writeFile(wb, "Plantilla_Gastos.xlsx");
};