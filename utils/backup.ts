// Copia de seguridad de los datos de la app.
//
// El cifrado con safeStorage ata los datos guardados a la cuenta de usuario del
// equipo: si se reinstala el sistema o se cambia de ordenador, no se pueden
// recuperar. Este módulo permite exportarlos a un archivo JSON (sin cifrar, con
// aviso al usuario) y restaurarlos después en cualquier equipo.

import type { DashboardData } from '../types';
import type { FinanceSettings, SavingsGoal } from './finance';

export interface BackupFile {
  app: 'dashboard-gastos';
  backupVersion: 1;
  exportedAt: string; // ISO 8601
  data: DashboardData | null;
  settings: FinanceSettings | null;
}

export interface RestoredBackup {
  data: DashboardData | null;
  settings: FinanceSettings | null;
  exportedAt: string;
}

export const buildBackup = (
  data: DashboardData | null,
  settings: FinanceSettings | null,
): BackupFile => ({
  app: 'dashboard-gastos',
  backupVersion: 1,
  exportedAt: new Date().toISOString(),
  data,
  settings,
});

export const backupFilename = (now: Date = new Date()): string => {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `copia-gastos-${yyyy}-${mm}-${dd}.json`;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// Claves que nunca se copian (evita contaminar prototipos de objetos).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Valida la configuración (objetivos y presupuestos) de una copia. Lo que no
// tenga el formato esperado se descarta en vez de cargarse en la app.
export const sanitizeSettings = (raw: unknown): FinanceSettings | null => {
  if (!isPlainObject(raw)) return null;

  let savingsGoal: SavingsGoal | null = null;
  const g = raw.savingsGoal;
  if (isPlainObject(g) && (g.type === 'amount' || g.type === 'percent') && isAmount(g.value)) {
    if (g.type === 'amount' || g.value <= 100) savingsGoal = { type: g.type, value: g.value };
  }

  const categoryBudgets: Record<string, number> = {};
  if (isPlainObject(raw.categoryBudgets)) {
    for (const [category, limit] of Object.entries(raw.categoryBudgets)) {
      if (category.trim() && !FORBIDDEN_KEYS.has(category) && isAmount(limit)) categoryBudgets[category] = limit;
    }
  }

  return { savingsGoal, categoryBudgets };
};

// Valida y reconstruye una copia de seguridad. Lanza errores con mensajes
// claros para el usuario si el archivo no es válido.
export const parseBackup = (text: string): RestoredBackup => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida (no se pudo leer su contenido).');
  }

  const b = parsed as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || b.app !== 'dashboard-gastos') {
    throw new Error('El archivo no es una copia de seguridad de esta aplicación.');
  }
  if (b.backupVersion !== 1) {
    throw new Error('La copia de seguridad es de una versión no compatible de la aplicación.');
  }

  let data: DashboardData | null = null;
  if (b.data != null) {
    const d = b.data as DashboardData;
    if (!Array.isArray(d.monthlyData) || !Array.isArray(d.allTransactions)) {
      throw new Error('La copia de seguridad está dañada: faltan los datos mensuales.');
    }
    // Las fechas se serializan como texto en JSON: reconstruirlas como Date.
    data = {
      ...d,
      monthlyData: d.monthlyData.map((m) => ({ ...m, dateObj: new Date(m.dateObj) })),
    };
  }

  return {
    data,
    settings: sanitizeSettings(b.settings),
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
  };
};
