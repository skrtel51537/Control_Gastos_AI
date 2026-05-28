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

export interface ChartDataPoint {
  name: string;
  value?: number;
  income?: number;
  expense?: number;
  [key: string]: any;
}
