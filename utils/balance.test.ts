import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mapBalanceResponse, loadBalanceFromBot, monthLabel, isSettled, displayName,
  mapSettleResponse, settleMonthInBot, pendingPayment,
} from './balance';

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

describe('pagos (saldar)', () => {
  const settlement = (id: string, date: string, paidBy: 'me' | 'partner', amount: number) => ({ id, date, paid_by: paidBy, amount });

  it('lee los pagos y el saldo antes de pagar', () => {
    const data = mapBalanceResponse(response([
      month('2026-10', [item('g-1', '2026-10-05', 'partner', 40.5)], {
        paid_by_partner: 40.5, balance: 0, shared_balance: -20.25,
        settlements: [settlement('l-1', '2026-11-03', 'me', 20.25)],
      }),
    ]));
    const m = data.months[0];
    expect(m.balance).toBe(0);
    expect(m.sharedBalance).toBe(-20.25);
    // El pago se apunta en noviembre pero salda octubre.
    expect(m.settlements).toEqual([{ id: 'l-1', date: '2026-11-03', paidBy: 'me', amount: 20.25 }]);
    expect(data.skipped).toBe(0);
  });

  it('un bot sin /saldar (sin pagos ni shared_balance) sigue funcionando', () => {
    const data = mapBalanceResponse(response([month('2026-10', [], { balance: 12 })]));
    expect(data.months[0].settlements).toEqual([]);
    expect(data.months[0].sharedBalance).toBe(12);
  });

  it('descarta pagos mal formados o repetidos y los cuenta', () => {
    const data = mapBalanceResponse(response([
      month('2026-10', [], {
        settlements: [
          settlement('l-1', '2026-11-03', 'me', 5),
          settlement('l-1', '2026-11-03', 'me', 5), // repetido
          settlement('l-2', '2026-11-31', 'me', 5), // fecha imposible
          settlement('l-3', '2026-11-03', 'yo' as never, 5), // quién pagó desconocido
          settlement('l-4', '2026-11-03', 'me', 0), // importe cero
          settlement('l-5', '2026-11-03', 'me', -5), // negativo
        ],
      }),
    ]));
    expect(data.months[0].settlements.map((s) => s.id)).toEqual(['l-1']);
    expect(data.skipped).toBe(5);
  });

  it('pendingPayment dice quién paga a quién', () => {
    const base = mapBalanceResponse(response([month('2026-10', [], { balance: -20.25 }), month('2026-11', [], { balance: 7 })]));
    expect(pendingPayment(base.months[0])).toEqual({ payer: 'me', amount: 20.25 });
    expect(pendingPayment(base.months[1])).toEqual({ payer: 'partner', amount: 7 });
    const paz = mapBalanceResponse(response([month('2026-10', [], { balance: 0.001 })]));
    expect(pendingPayment(paz.months[0])).toBeNull();
  });

  it('mapSettleResponse devuelve el pago y el mes actualizado', () => {
    const body = {
      settlement: settlement('l-9', '2026-11-10', 'partner', 7),
      month: month('2026-11', [], { balance: 0, shared_balance: 7, settlements: [settlement('l-9', '2026-11-10', 'partner', 7)] }),
    };
    const r = mapSettleResponse(body, '2026-11');
    expect(r.settlement).toEqual({ id: 'l-9', date: '2026-11-10', paidBy: 'partner', amount: 7 });
    expect(r.month.balance).toBe(0);
    // Respuesta de otro mes o mal formada: no se acepta.
    expect(() => mapSettleResponse(body, '2026-10')).toThrow();
    expect(() => mapSettleResponse({ settlement: null, month: body.month }, '2026-11')).toThrow();
  });
});

describe('settleMonthInBot', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ok = {
    ok: true,
    body: {
      settlement: { id: 'l-1', date: '2026-11-10', paid_by: 'me', amount: 20.25 },
      month: month('2026-10', [], { balance: 0, settlements: [{ id: 'l-1', date: '2026-11-10', paid_by: 'me', amount: 20.25 }] }),
    },
  };

  it('envía solo la URL, el token y el mes (nunca un importe)', async () => {
    const botSettleMonth = vi.fn(async () => ok);
    vi.stubGlobal('window', { electronAPI: { botSettleMonth } });
    const r = await settleMonthInBot({ url: 'http://127.0.0.1:8765', token: 'secreto' }, '2026-10');
    expect(botSettleMonth).toHaveBeenCalledWith('http://127.0.0.1:8765', 'secreto', '2026-10');
    expect(r.settlement.amount).toBe(20.25);
  });

  it('no llama al bot con un mes inválido', async () => {
    const botSettleMonth = vi.fn(async () => ok);
    vi.stubGlobal('window', { electronAPI: { botSettleMonth } });
    await expect(settleMonthInBot({ url: 'http://x', token: 't' }, 'octubre')).rejects.toMatchObject({ kind: 'rejected' });
    expect(botSettleMonth).not.toHaveBeenCalled();
  });

  it('un mes que ya está en paz da un mensaje claro', async () => {
    vi.stubGlobal('window', { electronAPI: { botSettleMonth: async () => ({ ok: false, error: 'already-settled' }) } });
    await expect(settleMonthInBot({ url: 'http://x', token: 't' }, '2026-10')).rejects.toThrow(/ya está en paz/);
  });

  it('sin Electron indica que no está disponible', async () => {
    vi.stubGlobal('window', {});
    await expect(settleMonthInBot({ url: 'http://x', token: 't' }, '2026-10')).rejects.toMatchObject({ kind: 'unavailable' });
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
