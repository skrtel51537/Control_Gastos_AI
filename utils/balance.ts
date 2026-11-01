// Balance mensual de los gastos compartidos (pestaña Balances).
//
// El cálculo lo hace el bot (GET /api/balance), que ve los apuntes de las dos
// personas; la app solo valida la respuesta (datos no fiables) y la muestra.
// Las cifras vienen desde el punto de vista del dueño del token.

import type { BotConfig } from './botApi';
import { BotLoadError } from './botApi';

export type Payer = 'me' | 'partner';

export interface SharedExpense {
  id: string;
  date: string; // AAAA-MM-DD
  concept: string;
  total: number; // euros, positivo
  paidBy: Payer;
  myShare: number;
  partnerShare: number;
  otherHalfAdded: boolean; // quien no pagó ya añadió su mitad a sus gastos
}

export interface BalanceMonth {
  month: string; // AAAA-MM
  paidByMe: number;
  paidByPartner: number;
  balance: number; // positivo: la pareja te debe; negativo: tú le debes
  items: SharedExpense[];
}

export interface BalanceData {
  user: string; // dueño del token, para mostrar
  partner: string | null; // nombre para mostrar, o null si el bot no tiene otra persona
  generatedAt: string;
  months: BalanceMonth[]; // del más antiguo al más reciente
  skipped: number; // gastos descartados por formato incorrecto
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const euros = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9 ? v : null;

const isIsoDay = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
};

const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

// "kelly" → "Kelly", como lo escribe el bot en Telegram.
export const displayName = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

const toItem = (raw: unknown): SharedExpense | null => {
  if (!isPlainObject(raw)) return null;
  const id = text(raw.id, 100);
  const total = euros(raw.total);
  const myShare = euros(raw.my_share);
  const partnerShare = euros(raw.partner_share);
  if (!id || !isIsoDay(raw.date) || total === null || myShare === null || partnerShare === null) return null;
  if (raw.paid_by !== 'me' && raw.paid_by !== 'partner') return null;
  return {
    id,
    date: raw.date,
    concept: text(raw.concept) || 'Gasto compartido',
    total,
    paidBy: raw.paid_by,
    myShare,
    partnerShare,
    otherHalfAdded: raw.other_half_added === true,
  };
};

// Convierte la respuesta de GET /api/balance. Lanza BotLoadError si no tiene la forma esperada.
export const mapBalanceResponse = (body: unknown): BalanceData => {
  if (!isPlainObject(body) || !Array.isArray(body.meses)) throw new BotLoadError('invalid');

  let skipped = 0;
  const seenMonths = new Set<string>();
  const months: BalanceMonth[] = [];
  for (const raw of body.meses) {
    const paidByMe = isPlainObject(raw) ? euros(raw.paid_by_me) : null;
    const paidByPartner = isPlainObject(raw) ? euros(raw.paid_by_partner) : null;
    const balance = isPlainObject(raw) && typeof raw.balance === 'number' && Number.isFinite(raw.balance) ? raw.balance : null;
    if (!isPlainObject(raw) || !isMonth(raw.month) || seenMonths.has(raw.month)
      || paidByMe === null || paidByPartner === null || balance === null || !Array.isArray(raw.items)) {
      skipped++;
      continue;
    }
    seenMonths.add(raw.month);

    const seen = new Set<string>();
    const items: SharedExpense[] = [];
    for (const rawItem of raw.items) {
      const item = toItem(rawItem);
      if (!item || seen.has(item.id)) {
        skipped++;
        continue;
      }
      seen.add(item.id);
      items.push(item);
    }
    // Más reciente primero, como la lista de movimientos.
    items.sort((a, b) => b.date.localeCompare(a.date));
    months.push({ month: raw.month, paidByMe, paidByPartner, balance, items });
  }
  months.sort((a, b) => a.month.localeCompare(b.month));

  const user = text(body.usuario, 50);
  const partner = text(body.pareja, 50);
  const generatedAt = typeof body.generado_en === 'string' && !Number.isNaN(Date.parse(body.generado_en))
    ? body.generado_en
    : '';
  return { user: user ? displayName(user) : 'Tú', partner: partner ? displayName(partner) : null, generatedAt, months, skipped };
};

export const loadBalanceFromBot = async (config: BotConfig): Promise<BalanceData> => {
  const fetchBalance = typeof window !== 'undefined' ? window.electronAPI?.botFetchBalance : undefined;
  if (!fetchBalance) throw new BotLoadError('unavailable');
  const result = await fetchBalance(config.url, config.token);
  if (!result) throw new BotLoadError('unavailable');
  if (!result.ok) throw new BotLoadError(result.error);
  return mapBalanceResponse(result.body);
};

// "2026-10" → "octubre 2026".
export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

// Diferencias de menos de medio céntimo se consideran "en paz".
export const isSettled = (balance: number): boolean => Math.abs(balance) < 0.005;
