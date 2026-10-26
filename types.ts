// --- Data Types for Finance Logic ---

export interface Transaction {
  id: string;
  date: string; // ISO format YYYY-MM-DD
  concept: string;
  category: string; // Cat 1 (General)
  subcategory: string; // Cat 2 (Specific)
  amount: number;
  type: 'income' | 'expense';
  monthKey: string; // Helper for grouping e.g. "NOV 25"
  // Solo con datos del bot (si su API los envía):
  registeredAt?: string; // ISO 8601: cuándo se apuntó en el bot
  sharedTotal?: number; // gasto compartido: importe total (positivo); `amount` es la parte propia
}

export interface MonthlySummary {
  monthKey: string; // "NOV 2025"
  dateObj: Date;
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
  transactions: Transaction[];
}

export interface DashboardData {
  allTransactions: Transaction[];
  monthlyData: MonthlySummary[];
  globalKPIs: {
    totalIncome: number;
    totalExpense: number;
    totalBalance: number;
    averageSavingsRate: number;
  };
  categories: string[]; // List of unique Cat 1
  categoryHierarchy: Record<string, string[]>; // Map Cat 1 -> List of Cat 2
}

// De dónde salen los datos cargados. Solo con 'bot' se recargan al abrir la app.
export interface DataSource {
  type: 'excel' | 'backup' | 'bot';
  generatedAt?: string; // ISO 8601: cuándo generó el bot los datos
  loadedAt: string; // ISO 8601: cuándo se cargaron en la app
}

// Tipo de pestaña activa del dashboard (navegación del menú lateral).
export type Tab = 'RESUMEN' | 'MENSUAL' | 'CATEGORIAS' | 'TENDENCIAS' | 'COMPARAR' | 'OBJETIVOS';
