// Carga de datos desde la API de solo lectura del bot de gastos (Telegram).
//
// La petición la hace el proceso principal de Electron (electron/botClient.js)
// por IPC: así no hay que abrir la CSP de la ventana y el token viaja solo en
// una cabecera. Aquí se valida la respuesta (se trata como datos no fiables) y
// se convierte al mismo formato que produce el lector de Excel.

import type { DashboardData, Transaction } from '../types';
import type { BotErrorKind } from '../electron-env';
import { buildDashboardData, monthKeyFor, normalizeText } from './excelParser';

export const DEFAULT_BOT_URL = 'http://127.0.0.1:8765';

export interface BotConfig {
  url: string;
  token: string;
}

export interface BotLoad {
  data: DashboardData;
  user: string; // dueño del token, según el bot
  generatedAt: string; // ISO 8601 (campo generado_en), o '' si no venía
  skipped: number; // movimientos descartados por formato incorrecto
}

export type BotLoadErrorKind = BotErrorKind | 'unavailable' | 'empty';

// Mensajes para el usuario. Nunca incluyen el token ni detalles técnicos.
const MESSAGES: Record<BotLoadErrorKind, string> = {
  offline: 'El bot no está en marcha. Arráncalo y vuelve a intentarlo.',
  timeout: 'El bot no ha respondido a tiempo. Comprueba que está en marcha y vuelve a intentarlo.',
  unauthorized: 'Token incorrecto. Comprueba en «Conexión con el bot» que lo has copiado entero.',
  server: 'El bot no pudo leer los datos. Revisa la ventana del bot.',
  invalid: 'La respuesta no parece venir del bot. Revisa la dirección en «Conexión con el bot».',
  'too-large': 'La respuesta del bot es demasiado grande y se ha descartado.',
  'bad-url': 'La dirección del bot no es válida. Debe empezar por http:// o https://.',
  unavailable: 'Cargar desde el bot solo está disponible en la aplicación de escritorio.',
  empty: 'El bot no tiene ningún movimiento guardado para tu usuario.',
};

export class BotLoadError extends Error {
  kind: BotLoadErrorKind;

  constructor(kind: BotLoadErrorKind) {
    const known = kind in MESSAGES ? kind : 'invalid';
    super(MESSAGES[known]);
    this.name = 'BotLoadError';
    this.kind = known;
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Claves que no pueden usarse como nombre de categoría (se usan como claves de objeto).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// "AAAA-MM-DD" como fecha LOCAL. `new Date('2026-10-01')` la interpretaría en
// UTC y, según la zona horaria, podría caer en el mes anterior.
const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // Rechaza fechas imposibles (p. ej. 2026-02-31), que Date "corregiría" sola.
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
};

const toTransaction = (raw: unknown): Transaction | null => {
  if (!isPlainObject(raw)) return null;
  const id = text(raw.id, 100);
  const date = parseIsoDate(raw.date);
  const amount = raw.amount;
  if (!id || !date || typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (raw.type !== 'income' && raw.type !== 'expense') return null;

  // Misma normalización que el Excel, para que presupuestos y objetivos coincidan.
  const category = normalizeText(text(raw.category));
  const subcategory = normalizeText(text(raw.subcategory));
  if (FORBIDDEN_KEYS.has(category) || FORBIDDEN_KEYS.has(subcategory)) return null;

  return {
    id,
    date: raw.date as string,
    concept: text(raw.concept) || subcategory,
    category,
    subcategory,
    // Gastos en negativo e ingresos en positivo, como el lector de Excel.
    amount: raw.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
    type: raw.type,
    monthKey: monthKeyFor(date),
  };
};

// Convierte la respuesta de GET /api/movimientos en los datos del dashboard.
export const mapBotResponse = (body: unknown): BotLoad => {
  if (!isPlainObject(body) || !Array.isArray(body.movimientos)) throw new BotLoadError('invalid');

  const seen = new Set<string>();
  const transactions: Transaction[] = [];
  let skipped = 0;
  for (const raw of body.movimientos) {
    const t = toTransaction(raw);
    if (!t || seen.has(t.id)) {
      skipped++;
      continue;
    }
    seen.add(t.id);
    transactions.push(t);
  }

  if (transactions.length === 0) throw new BotLoadError(skipped > 0 ? 'invalid' : 'empty');

  // Ordenar por fecha descendente, igual que el lector de Excel.
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const generatedAt = typeof body.generado_en === 'string' && !Number.isNaN(Date.parse(body.generado_en))
    ? body.generado_en
    : '';

  return { data: buildDashboardData(transactions), user: text(body.usuario, 50), generatedAt, skipped };
};

export const isBotAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.electronAPI?.botFetchMovements === 'function';

export const loadFromBot = async (config: BotConfig): Promise<BotLoad> => {
  const fetchMovements = typeof window !== 'undefined' ? window.electronAPI?.botFetchMovements : undefined;
  if (!fetchMovements) throw new BotLoadError('unavailable');
  const result = await fetchMovements(config.url, config.token);
  if (!result) throw new BotLoadError('unavailable');
  if (!result.ok) throw new BotLoadError(result.error);
  return mapBotResponse(result.body);
};

// Valida la configuración guardada; descarta lo que no tenga la forma esperada.
export const sanitizeBotConfig = (raw: unknown): BotConfig | null => {
  if (!isPlainObject(raw)) return null;
  const url = text(raw.url, 500);
  const token = typeof raw.token === 'string' ? raw.token.trim() : '';
  return url && token ? { url, token } : null;
};

// Muestra solo los 4 últimos caracteres, para reconocer el token sin revelarlo.
export const maskToken = (token: string): string =>
  token.length <= 8 ? '••••••••' : `••••••••${token.slice(-4)}`;
