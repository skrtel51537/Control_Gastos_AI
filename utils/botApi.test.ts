import { describe, it, expect, afterEach, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { mapBotResponse, loadFromBot, BotLoadError, sanitizeBotConfig, maskToken } from './botApi';
import { monthKeyFor, parseExcelData } from './excelParser';

const expense = (id: string, date: string, amount: number, category: string, subcategory: string, concept = 'x') =>
  ({ id, date, concept, category, subcategory, amount, type: 'expense' });
const income = (id: string, date: string, amount: number) =>
  ({ id, date, concept: 'nómina', category: 'Ingresos', subcategory: 'General', amount, type: 'income' });

const response = (movimientos: unknown[]) => ({
  usuario: 'miguel',
  generado_en: '2026-10-24T09:15:00+02:00',
  movimientos,
});

describe('mapBotResponse', () => {
  it('calcula monthKey con la misma función que el Excel, en fecha local', () => {
    const { data } = mapBotResponse(response([
      expense('g-1', '2026-10-23', -27.6, 'Gasto fijo', 'Compra semanal'),
      expense('g-2', '2026-10-01', -10, 'Gasto fijo', 'Compra semanal'),
      expense('g-3', '2026-09-30', -5, 'Ocio', 'Cine'),
    ]));
    expect(data.allTransactions.find((t) => t.id === 'g-1')?.monthKey).toBe('OCT 26');
    // El día 1 no debe caer en el mes anterior por la zona horaria.
    expect(data.allTransactions.find((t) => t.id === 'g-2')?.monthKey).toBe('OCT 26');
    expect(data.allTransactions.find((t) => t.id === 'g-3')?.monthKey).toBe(monthKeyFor(new Date(2026, 8, 1)));
    expect(data.monthlyData.map((m) => m.monthKey)).toEqual([monthKeyFor(new Date(2026, 8, 1)), 'OCT 26']);
  });

  it('pone los gastos en negativo y los ingresos en positivo, venga como venga el signo', () => {
    const { data } = mapBotResponse(response([
      expense('g-1', '2026-10-05', 30, 'Ocio', 'Cine'), // signo incorrecto
      expense('g-2', '2026-10-06', -20, 'Ocio', 'Cine'),
      income('i-1', '2026-10-01', -1000), // signo incorrecto
    ]));
    const byId = Object.fromEntries(data.allTransactions.map((t) => [t.id, t.amount]));
    expect(byId).toEqual({ 'g-1': -30, 'g-2': -20, 'i-1': 1000 });
    expect(data.monthlyData[0]).toMatchObject({ income: 1000, expense: 50, balance: 950 });
  });

  it('normaliza categorías y subcategorías como el Excel', () => {
    const { data } = mapBotResponse(response([
      expense('g-1', '2026-10-05', -1, 'GASTO fijo', 'compra SEMANAL'),
      expense('g-2', '2026-10-06', -1, ' Gasto fijo ', 'Compra semanal'),
      expense('g-3', '2026-10-07', -1, '', ''),
    ]));
    expect(data.categories).toEqual(['Gasto fijo', 'Otros']);
    expect(data.categoryHierarchy['Gasto fijo']).toEqual(['Compra semanal']);
    expect(data.categoryHierarchy['Otros']).toEqual(['Otros']);
  });

  it('da los mismos totales y categorías que el Excel para el mismo mes', async () => {
    const wb = XLSX.utils.book_new();
    const aoa: any[][] = Array.from({ length: 8 }, () => Array(8).fill(''));
    aoa[0][1] = 'Septiembre 2026';
    aoa[3][1] = 2273.11;
    aoa[4][5] = 1000; aoa[4][6] = 'Gasto fijo'; aoa[4][7] = 'Alquiler';
    aoa[5][5] = 455.26; aoa[5][6] = 'gasto ocasional'; aoa[5][7] = 'ROPA';
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sep');
    const excel = await parseExcelData(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));

    const { data: bot } = mapBotResponse(response([
      expense('g-1', '2026-09-01', -1000, 'Gasto fijo', 'Alquiler'),
      expense('g-2', '2026-09-01', -455.26, 'gasto ocasional', 'ROPA'),
      income('i-1', '2026-09-01', 2273.11),
    ]));

    const pick = (m: (typeof bot.monthlyData)[number]) =>
      ({ monthKey: m.monthKey, income: m.income, expense: m.expense, balance: m.balance });
    expect(bot.monthlyData.map(pick)).toEqual(excel.monthlyData.map(pick));
    expect(bot.categoryHierarchy).toEqual(excel.categoryHierarchy);
  });

  it('descarta movimientos mal formados o repetidos y los cuenta', () => {
    const result = mapBotResponse(response([
      expense('g-1', '2026-10-05', -1, 'Ocio', 'Cine'),
      expense('g-1', '2026-10-05', -1, 'Ocio', 'Cine'), // id repetido
      expense('g-2', '2026-02-31', -1, 'Ocio', 'Cine'), // fecha imposible
      expense('g-3', '05/10/2026', -1, 'Ocio', 'Cine'), // formato de fecha
      { ...expense('g-4', '2026-10-05', -1, 'Ocio', 'Cine'), amount: '12' }, // importe como texto
      { ...expense('g-5', '2026-10-05', -1, 'Ocio', 'Cine'), type: 'otro' },
      expense('g-6', '2026-10-05', -1, '__proto__', 'Cine'),
      expense('', '2026-10-05', -1, 'Ocio', 'Cine'),
      null,
      'texto',
    ]));
    expect(result.data.allTransactions.map((t) => t.id)).toEqual(['g-1']);
    expect(result.skipped).toBe(9);
  });

  it('ordena por fecha descendente y conserva usuario y fecha de generación', () => {
    const result = mapBotResponse(response([
      expense('g-1', '2026-09-05', -1, 'Ocio', 'Cine'),
      expense('g-2', '2026-10-05', -1, 'Ocio', 'Cine'),
    ]));
    expect(result.data.allTransactions.map((t) => t.id)).toEqual(['g-2', 'g-1']);
    expect(result.user).toBe('miguel');
    expect(result.generatedAt).toBe('2026-10-24T09:15:00+02:00');
  });

  it('rechaza respuestas sin la forma esperada o vacías', () => {
    expect(() => mapBotResponse(null)).toThrow(BotLoadError);
    expect(() => mapBotResponse({ error: 'x' })).toThrow(/no parece venir del bot/);
    expect(() => mapBotResponse(response([]))).toThrow(/ningún movimiento/);
    expect(() => mapBotResponse(response([null]))).toThrow(/no parece venir del bot/);
  });
});

describe('loadFromBot', () => {
  afterEach(() => vi.unstubAllGlobals());

  const withResult = (result: unknown) => {
    const botFetchMovements = vi.fn(async () => result);
    vi.stubGlobal('window', { electronAPI: { botFetchMovements } });
    return botFetchMovements;
  };

  it('pasa la URL y el token al proceso principal y devuelve los datos', async () => {
    const api = withResult({ ok: true, body: response([expense('g-1', '2026-10-05', -1, 'Ocio', 'Cine')]) });
    const result = await loadFromBot({ url: 'http://127.0.0.1:8765', token: 'secreto' });
    expect(api).toHaveBeenCalledWith('http://127.0.0.1:8765', 'secreto');
    expect(result.data.allTransactions).toHaveLength(1);
  });

  it.each([
    ['unauthorized', /^Token incorrecto/],
    ['offline', /^No se puede conectar con el bot/],
    ['server', /^El bot no pudo leer los datos/],
    ['timeout', /no ha respondido a tiempo/],
    ['algo-raro', /no parece venir del bot/],
  ])('traduce el error %s a un mensaje claro', async (error, message) => {
    withResult({ ok: false, error });
    await expect(loadFromBot({ url: 'http://127.0.0.1:8765', token: 'secreto' })).rejects.toThrow(message);
  });

  it('los mensajes de error nunca contienen el token', async () => {
    withResult({ ok: false, error: 'unauthorized' });
    const err = await loadFromBot({ url: 'http://127.0.0.1:8765', token: 'secreto-123' }).catch((e) => e);
    expect(String(err.message)).not.toContain('secreto-123');
  });

  it('sin Electron (navegador) indica que no está disponible', async () => {
    vi.stubGlobal('window', {});
    await expect(loadFromBot({ url: 'http://x', token: 't' })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('utilidades de configuración', () => {
  it('sanitizeBotConfig exige URL y token de texto', () => {
    expect(sanitizeBotConfig({ url: ' http://127.0.0.1:8765 ', token: ' abc ' }))
      .toEqual({ url: 'http://127.0.0.1:8765', token: 'abc' });
    expect(sanitizeBotConfig({ url: 'http://x', token: '' })).toBeNull();
    expect(sanitizeBotConfig({ url: 1, token: 'abc' })).toBeNull();
    expect(sanitizeBotConfig(null)).toBeNull();
  });

  it('maskToken solo deja ver los 4 últimos caracteres', () => {
    expect(maskToken('abcdefghijkl')).toBe('••••••••ijkl');
    expect(maskToken('corto')).toBe('••••••••');
  });
});

describe('mapBotResponse: campos opcionales', () => {
  it('guarda cuándo se apuntó y el total de un gasto compartido', () => {
    const { data } = mapBotResponse(response([
      { ...expense('g-1', '2026-10-05', -30, 'Ocio', 'Cine'), registered_at: '2026-10-05T21:30:00+02:00', shared_total: -60 },
    ]));
    expect(data.allTransactions[0]).toMatchObject({ registeredAt: '2026-10-05T21:30:00+02:00', sharedTotal: 60, amount: -30 });
  });

  it('ignora valores no válidos sin descartar el movimiento', () => {
    const result = mapBotResponse(response([
      { ...expense('g-1', '2026-10-05', -30, 'Ocio', 'Cine'), registered_at: 'ayer', shared_total: 'mucho' },
      { ...income('i-1', '2026-10-01', 1000), shared_total: 2000 }, // un ingreso no es compartido
    ]));
    expect(result.skipped).toBe(0);
    for (const t of result.data.allTransactions) {
      expect(t.registeredAt).toBeUndefined();
      expect(t.sharedTotal).toBeUndefined();
    }
  });
});
