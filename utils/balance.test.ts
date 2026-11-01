import { describe, it, expect, afterEach, vi } from 'vitest';
import { mapBalanceResponse, loadBalanceFromBot, monthLabel, isSettled, displayName } from './balance';

const item = (id: string, date: string, paidBy: 'me' | 'partner', total: number, extra: Record<string, unknown> = {}) => ({
  id, date, concept: 'cine', total, paid_by: paidBy,
  my_share: paidBy === 'me' ? total - Math.floor(total * 50) / 100 : Math.floor(total * 50) / 100,
  partner_share: paidBy === 'me' ? Math.floor(total * 50) / 100 : total - Math.floor(total * 50) / 100,
  other_half_added: true,
  ...extra,
});

const month = (m: string, items: unknown[], extra: Record<string, unknown> = {}) =>
  ({ month: m, paid_by_me: 0, paid_by_partner: 0, balance: 0, items, ...extra });

const response = (meses: unknown[], pareja: unknown = 'kelly') =>
  ({ usuario: 'miguel', pareja, generado_en: '2026-11-01T10:00:00+01:00', meses });

describe('mapBalanceResponse', () => {
  it('convierte meses y gastos con el punto de vista del dueño del token', () => {
    const data = mapBalanceResponse(response([
      month('2026-10', [item('g-1', '2026-10-05', 'me', 69), item('g-2', '2026-10-19', 'partner', 10, { other_half_added: false })],
        { paid_by_me: 69, paid_by_partner: 10, balance: 29.5 }),
    ]));
    expect(data.partner).toBe('Kelly');
    expect(data.user).toBe('Miguel');
    expect(data.generatedAt).toBe('2026-11-01T10:00:00+01:00');
    expect(data.months).toHaveLength(1);
    expect(data.months[0]).toMatchObject({ month: '2026-10', paidByMe: 69, paidByPartner: 10, balance: 29.5 });
    // Más reciente primero dentro del mes.
    expect(data.months[0].items.map((i) => i.id)).toEqual(['g-2', 'g-1']);
    expect(data.months[0].items[0]).toMatchObject({ paidBy: 'partner', myShare: 5, partnerShare: 5, otherHalfAdded: false });
  });

  it('ordena los meses del más antiguo al más reciente', () => {
    const data = mapBalanceResponse(response([month('2026-10', []), month('2026-08', []), month('2026-09', [])]));
    expect(data.months.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('descarta meses y gastos mal formados o repetidos y los cuenta', () => {
    const data = mapBalanceResponse(response([
      month('2026-10', [
        item('g-1', '2026-10-05', 'me', 10),
        item('g-1', '2026-10-05', 'me', 10), // repetido
        item('g-2', '2026-02-31', 'me', 10), // fecha imposible
        item('g-3', '2026-10-05', 'yo' as never, 10), // quién pagó desconocido
        item('g-4', '2026-10-05', 'me', -10), // importe negativo
        { ...item('g-5', '2026-10-05', 'me', 10), my_share: '5' }, // texto
        null,
      ]),
      month('2026-10', []), // mes repetido
      month('2026-13', []), // mes imposible
      month('2026-09', [], { balance: 'mucho' }),
      'texto',
    ]));
    expect(data.months.map((m) => m.month)).toEqual(['2026-10']);
    expect(data.months[0].items.map((i) => i.id)).toEqual(['g-1']);
    expect(data.skipped).toBe(10);
  });

  it('sin pareja configurada en el bot devuelve partner null', () => {
    expect(mapBalanceResponse(response([], null))).toMatchObject({ partner: null, months: [] });
  });

  it('rechaza respuestas sin la forma esperada', () => {
    expect(() => mapBalanceResponse(null)).toThrow(/no parece venir del bot/);
    expect(() => mapBalanceResponse({ movimientos: [] })).toThrow(/no parece venir del bot/);
  });
});

describe('loadBalanceFromBot', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pide el balance al proceso principal con la URL y el token', async () => {
    const botFetchBalance = vi.fn(async () => ({ ok: true, body: response([]) }));
    vi.stubGlobal('window', { electronAPI: { botFetchBalance } });
    await loadBalanceFromBot({ url: 'http://127.0.0.1:8765', token: 'secreto' });
    expect(botFetchBalance).toHaveBeenCalledWith('http://127.0.0.1:8765', 'secreto');
  });

  it('un bot sin actualizar da un mensaje claro', async () => {
    vi.stubGlobal('window', { electronAPI: { botFetchBalance: async () => ({ ok: false, error: 'not-found' }) } });
    await expect(loadBalanceFromBot({ url: 'http://x', token: 't' })).rejects.toThrow(/Actualízalo y reinícialo/);
  });

  it('sin Electron indica que no está disponible', async () => {
    vi.stubGlobal('window', {});
    await expect(loadBalanceFromBot({ url: 'http://x', token: 't' })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('utilidades', () => {
  it('monthLabel, isSettled y displayName', () => {
    expect(monthLabel('2026-10')).toMatch(/octubre.*2026/);
    expect(isSettled(0.004)).toBe(true);
    expect(isSettled(-0.01)).toBe(false);
    expect(displayName('kelly')).toBe('Kelly');
  });
});
