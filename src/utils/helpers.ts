import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { Settings, Expense, ExpenseCategory, MonthSummary, Income, FixedExpense, Debt, BudgetLimit, CategoryInfo, FreelanceInvoice, FreelanceProject, WorkSession } from '../types';
import { DEFAULT_SETTINGS, EXPENSE_CATEGORIES } from './constants';
import { calculateDebtProjection } from './debtCalculations';

// Generate unique ID
export const generateId = (): string => uuidv4();

// Format currency
export const formatCurrency = (
  amount: number,
  settings: Settings = DEFAULT_SETTINGS
): string => {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: settings.currency,
    minimumFractionDigits: settings.showCents ? 2 : 0,
    maximumFractionDigits: settings.showCents ? 2 : 0,
  };
  return new Intl.NumberFormat(settings.locale, options).format(amount);
};

// Format date
export const formatDate = (
  date: string | Date,
  formatStr: string = 'dd.MM.yyyy'
): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: de });
};

// Get current month string (e.g., "2026-04")
export const getCurrentMonth = (): string => {
  return format(new Date(), 'yyyy-MM');
};

// Get month display name
export const getMonthDisplayName = (monthStr: string): string => {
  const date = parseISO(`${monthStr}-01`);
  return format(date, 'MMMM yyyy', { locale: de });
};

// Get short month name
export const getShortMonthName = (monthStr: string): string => {
  const date = parseISO(`${monthStr}-01`);
  return format(date, 'MMM yyyy', { locale: de });
};

export const shiftMonth = (monthStr: string, offset: number): string => {
  const date = parseISO(`${monthStr}-01`);
  date.setMonth(date.getMonth() + offset);
  return format(date, 'yyyy-MM');
};

export const isSaturday = (date: string): boolean => new Date(`${date}T12:00:00`).getDay() === 6;

export const calculateWorkSessionHours = (
  session: Pick<WorkSession, 'startTime' | 'endTime' | 'breakMinutes' | 'durationHours'>
): number => {
  if (typeof session.durationHours === 'number' && session.durationHours > 0) {
    return session.durationHours;
  }

  const [startHour, startMinute] = session.startTime.split(':').map(Number);
  const [endHour, endMinute] = session.endTime.split(':').map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) {
    return 0;
  }

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const worked = endTotal - startTotal - session.breakMinutes;
  return Math.max(0, worked / 60);
};

export const calculateFreelanceSessionLaborAmount = (session: WorkSession, project?: FreelanceProject): number => {
  if (!project || !session.billable) return 0;
  const hours = calculateWorkSessionHours(session);
  const baseRate = session.customHourlyRate ?? project.hourlyRate;
  const saturdayPercent = session.customSaturdaySurchargePercent ?? project.saturdaySurchargePercent ?? 0;
  const saturdayMultiplier = isSaturday(session.date) ? 1 + (saturdayPercent / 100) : 1;
  return hours * baseRate * saturdayMultiplier;
};

export const calculateFreelanceSessionTravelAmount = (session: WorkSession, project?: FreelanceProject): number => {
  if (!project || !session.billable) return 0;
  return project.travelFlatFee || 0;
};

export const calculateFreelanceSessionExtraAmount = (session: WorkSession): number => {
  if (!session.billable) return 0;
  return session.extraFlatFee || 0;
};

export const calculateFreelanceSessionNetAmount = (session: WorkSession, project?: FreelanceProject): number => {
  return calculateFreelanceSessionLaborAmount(session, project)
    + calculateFreelanceSessionTravelAmount(session, project)
    + calculateFreelanceSessionExtraAmount(session);
};

export interface PlannedFreelanceIncomeSummary {
  total: number;
  uninvoicedAmount: number;
  openInvoiceAmount: number;
  plannedHours: number;
  sessionCount: number;
  openInvoiceCount: number;
}

export const calculatePlannedFreelanceIncomeForMonth = (
  month: string,
  workSessions: WorkSession[],
  freelanceProjects: FreelanceProject[],
  freelanceInvoices: FreelanceInvoice[]
): PlannedFreelanceIncomeSummary => {
  const uninvoicedSessions = workSessions.filter(
    (session) => session.billable && !session.invoiceId && session.date.slice(0, 7) === month
  );

  const uninvoicedAmount = uninvoicedSessions.reduce((sum, session) => {
    const project = freelanceProjects.find((item) => item.id === session.projectId);
    if (!project) return sum;
    return sum + calculateFreelanceSessionNetAmount(session, project);
  }, 0);

  const openInvoices = freelanceInvoices.filter(
    (invoice) => invoice.serviceMonth === month && invoice.status === 'issued'
  );
  const openInvoiceAmount = openInvoices.reduce((sum, invoice) => sum + invoice.netAmount, 0);
  const plannedHours = uninvoicedSessions.reduce((sum, session) => sum + calculateWorkSessionHours(session), 0);

  return {
    total: uninvoicedAmount + openInvoiceAmount,
    uninvoicedAmount,
    openInvoiceAmount,
    plannedHours,
    sessionCount: uninvoicedSessions.length,
    openInvoiceCount: openInvoices.length,
  };
};

export const getMonthPickerRange = (centerMonth: string, before = 8, after = 7): string[] => {
  const months: string[] = [];
  for (let i = before; i > 0; i--) {
    months.push(shiftMonth(centerMonth, -i));
  }
  months.push(centerMonth);
  for (let i = 1; i <= after; i++) {
    months.push(shiftMonth(centerMonth, i));
  }
  return months;
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getIncomeMonth = (income: Income): string | null => {
  if (income.month) return income.month;
  if (income.date?.length) return income.date.slice(0, 7);
  if (income.createdAt?.length) return income.createdAt.slice(0, 7);
  return null;
};

const isBankImportedIncome = (income: Income): boolean =>
  Boolean((income.note || '').includes('Quelle:'));

function getReconciliationMatchScore(recurring: Income, bankIncome: Income): number {
  const amountDiff = Math.abs(recurring.amount - bankIncome.amount);
  const recurringText = normalizeText(recurring.name);
  const bankText = normalizeText(bankIncome.name);
  const recurringTokens = recurringText.split(' ').filter((token) => token.length >= 4);
  const hasKeywordOverlap = recurringTokens.some((token) => bankText.includes(token));

  let score = amountDiff;
  if (hasKeywordOverlap) score -= 2;
  if (
    recurringText.includes('stipendium')
    && (bankText.includes('studien') || bankText.includes('forderung'))
  ) {
    score -= 2;
  }

  return score;
}

export interface IncomeReconciliationResult {
  totalPlanned: number;
  totalActualImported: number;
  totalEffective: number;
  matchedRecurringIds: Set<string>;
  matchedImportedIds: Set<string>;
}

export function reconcileIncomesForMonth(incomes: Income[], month: string): IncomeReconciliationResult {
  const monthIncomes = incomes.filter((income) => income.isRecurring || getIncomeMonth(income) === month);
  const recurring = monthIncomes.filter((income) => income.isRecurring);
  const oneTime = monthIncomes.filter((income) => !income.isRecurring);
  const imported = oneTime.filter(isBankImportedIncome);
  const manualOneTime = oneTime.filter((income) => !isBankImportedIncome(income));

  const usedImportedIds = new Set<string>();
  const matchedRecurringIds = new Set<string>();
  const matchedImportedIds = new Set<string>();

  const recurringEffectiveSum = recurring.reduce((sum, recurringIncome) => {
    const tolerance = Math.max(5, recurringIncome.amount * 0.03);
    const candidates = imported
      .filter((importedIncome) => !usedImportedIds.has(importedIncome.id))
      .filter((importedIncome) => Math.abs(importedIncome.amount - recurringIncome.amount) <= tolerance)
      .sort(
        (a, b) =>
          getReconciliationMatchScore(recurringIncome, a) - getReconciliationMatchScore(recurringIncome, b)
      );

    const match = candidates[0];
    if (match) {
      usedImportedIds.add(match.id);
      matchedRecurringIds.add(recurringIncome.id);
      matchedImportedIds.add(match.id);
      return sum + match.amount;
    }

    return sum + recurringIncome.amount;
  }, 0);

  const unmatchedImported = imported.filter((income) => !usedImportedIds.has(income.id));
  const unmatchedImportedSum = unmatchedImported.reduce((sum, income) => sum + income.amount, 0);
  const manualOneTimeSum = manualOneTime.reduce((sum, income) => sum + income.amount, 0);
  const totalPlanned = recurring.reduce((sum, income) => sum + income.amount, 0) + manualOneTimeSum;
  const totalActualImported = imported.reduce((sum, income) => sum + income.amount, 0);
  const totalEffective = recurringEffectiveSum + unmatchedImportedSum + manualOneTimeSum;

  return {
    totalPlanned,
    totalActualImported,
    totalEffective,
    matchedRecurringIds,
    matchedImportedIds,
  };
}

function getFixedReconciliationMatchScore(fixedExpense: FixedExpense, expense: Expense): number {
  const amountDiff = Math.abs(fixedExpense.amount - expense.amount);
  const fixedText = normalizeText(`${fixedExpense.name} ${fixedExpense.note || ''}`);
  const expenseText = normalizeText(`${expense.description} ${expense.note || ''}`);
  const fixedTokens = fixedText.split(' ').filter((token) => token.length >= 4);
  const hasKeywordOverlap = fixedTokens.some((token) => expenseText.includes(token));

  let score = amountDiff;
  if (hasKeywordOverlap) score -= 2;
  return score;
}

export interface FixedExpenseReconciliationResult {
  totalPlanned: number;
  totalActualImported: number;
  totalEffective: number;
  matchedFixedExpenseIds: Set<string>;
  matchedImportedExpenseIds: Set<string>;
}

export function reconcileFixedExpensesForMonth(
  fixedExpenses: FixedExpense[],
  expenses: Expense[],
  month: string
): FixedExpenseReconciliationResult {
  const activeFixedExpenses = fixedExpenses.filter((fixedExpense) => fixedExpense.isActive);
  const monthExpenses = expenses.filter((expense) => expense.month === month);
  const importedExpenses = monthExpenses.filter((expense) => expense.tags?.includes('bankimport') || expense.tags?.includes('banksync'));

  const usedImportedIds = new Set<string>();
  const matchedFixedExpenseIds = new Set<string>();
  const matchedImportedExpenseIds = new Set<string>();

  const fixedEffectiveSum = activeFixedExpenses.reduce((sum, fixedExpense) => {
    const tolerance = Math.max(5, fixedExpense.amount * 0.03);
    const candidates = importedExpenses
      .filter((expense) => !usedImportedIds.has(expense.id))
      .filter((expense) => Math.abs(expense.amount - fixedExpense.amount) <= tolerance)
      .sort(
        (a, b) =>
          getFixedReconciliationMatchScore(fixedExpense, a) - getFixedReconciliationMatchScore(fixedExpense, b)
      );

    const match = candidates[0];
    if (match) {
      usedImportedIds.add(match.id);
      matchedFixedExpenseIds.add(fixedExpense.id);
      matchedImportedExpenseIds.add(match.id);
      return sum + match.amount;
    }

    return sum + fixedExpense.amount;
  }, 0);

  const totalPlanned = activeFixedExpenses.reduce((sum, fixedExpense) => sum + fixedExpense.amount, 0);
  const totalActualImported = importedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalEffective = fixedEffectiveSum;

  return {
    totalPlanned,
    totalActualImported,
    totalEffective,
    matchedFixedExpenseIds,
    matchedImportedExpenseIds,
  };
}

// Get expenses for a specific month
export const getExpensesForMonth = (expenses: Expense[], month: string): Expense[] => {
  return expenses.filter(e => e.month === month);
};

// Calculate total for expenses
export const calculateTotal = (items: { amount: number }[]): number => {
  return items.reduce((sum, item) => sum + item.amount, 0);
};

// Calculate expenses by category for a month
export const calculateExpensesByCategory = (
  expenses: Expense[],
  month: string
): Record<string, number> => {
  const monthExpenses = getExpensesForMonth(expenses, month);
  const categories: Record<string, number> = Object.keys(EXPENSE_CATEGORIES).reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<string, number>);
  
  monthExpenses.forEach(expense => {
    categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
  });
  
  return categories;
};

// Calculate month summary
export const calculateMonthSummary = (
  month: string,
  incomes: Income[],
  fixedExpenses: FixedExpense[],
  debts: Debt[],
  expenses: Expense[]
): MonthSummary => {
  const incomeReconciliation = reconcileIncomesForMonth(incomes, month);
  const fixedReconciliation = reconcileFixedExpensesForMonth(fixedExpenses, expenses, month);
  
  const totalIncome = incomeReconciliation.totalEffective;
  const totalFixedExpenses = fixedReconciliation.totalEffective;
  const totalDebtPayments = calculateTotal(debts.map(d => ({ amount: d.monthlyPayment })));
  const monthExpenses = getExpensesForMonth(expenses, month);
  const variableExpenses = monthExpenses.filter((expense) => !fixedReconciliation.matchedImportedExpenseIds.has(expense.id));
  const totalVariableExpenses = calculateTotal(variableExpenses);
  const expensesByCategory = calculateExpensesByCategory(expenses, month);
  
  const remaining = totalIncome - totalFixedExpenses - totalDebtPayments - totalVariableExpenses;
  
  return {
    month,
    totalIncome,
    totalFixedExpenses,
    totalDebtPayments,
    totalVariableExpenses,
    totalSavings: 0,
    remaining,
    expensesByCategory,
  };
};

// Get budget usage percentage
export const getBudgetUsage = (
  category: ExpenseCategory,
  expenses: Expense[],
  budgetLimits: BudgetLimit[],
  month: string
): { used: number; limit: number; percentage: number } | null => {
  const limit = budgetLimits.find(
    b => b.category === category && (b.month === month || b.isRecurring)
  );
  
  if (!limit) return null;
  
  const used = calculateExpensesByCategory(expenses, month)[category] || 0;
  const percentage = Math.min((used / limit.monthlyLimit) * 100, 100);
  
  return { used, limit: limit.monthlyLimit, percentage };
};

// Calculate debt payoff time
export const calculateDebtPayoffMonths = (debt: Debt): number => {
  return calculateDebtProjection(debt).months;
};

// Get next X months
export const getNextMonths = (count: number, startMonth?: string): string[] => {
  const start = startMonth ? parseISO(`${startMonth}-01`) : new Date();
  const months: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setMonth(date.getMonth() + i);
    months.push(format(date, 'yyyy-MM'));
  }
  
  return months;
};

// Get previous X months
export const getPreviousMonths = (count: number, startMonth?: string): string[] => {
  const start = startMonth ? parseISO(`${startMonth}-01`) : new Date();
  const months: string[] = [];
  
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(start);
    date.setMonth(date.getMonth() - i);
    months.push(format(date, 'yyyy-MM'));
  }
  
  return months;
};

// Validate expense data
export const validateExpense = (expense: Partial<Expense>): string[] => {
  const errors: string[] = [];
  
  if (!expense.description?.trim()) {
    errors.push('Beschreibung ist erforderlich');
  }
  if (!expense.amount || expense.amount <= 0) {
    errors.push('Betrag muss größer als 0 sein');
  }
  if (!expense.category) {
    errors.push('Kategorie ist erforderlich');
  }
  if (!expense.date) {
    errors.push('Datum ist erforderlich');
  }
  
  return errors;
};

// Calculate savings goal progress
export const calculateSavingsProgress = (current: number, target: number): number => {
  if (target <= 0) return 100;
  return Math.min((current / target) * 100, 100);
};

// Get color based on percentage (for budget warnings)
export const getProgressColor = (percentage: number): string => {
  if (percentage >= 100) return '#ef4444'; // red
  if (percentage >= 80) return '#f59e0b'; // orange
  if (percentage >= 60) return '#eab308'; // yellow
  return '#10b981'; // green
};

// Local Storage helpers
export const saveToLocalStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return defaultValue;
  }
};

// Export data as JSON
export const exportData = (data: object, filename: string): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadTextFile = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const convertRowsToCsv = (rows: Array<Record<string, string | number | boolean | null | undefined>>): string => {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const escapeValue = (value: string | number | boolean | null | undefined): string => {
    const stringValue = value == null ? '' : String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(',')),
  ];

  return lines.join('\n');
};

// Import data from JSON
export const importData = (file: File): Promise<object> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
};

// Calculate net worth
export const calculateNetWorth = (
  accounts: { balance: number }[],
  debts: { remainingAmount: number }[]
): number => {
  const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalDebts = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  return totalAssets - totalDebts;
};

export const getExpenseCategoryMap = (settings: Settings): Record<string, CategoryInfo> => {
  const customCategories = settings.customExpenseCategories.reduce((acc, category) => {
    acc[category.id] = category;
    return acc;
  }, {} as Record<string, CategoryInfo>);

  return {
    ...EXPENSE_CATEGORIES,
    ...customCategories,
  };
};

export const getExpenseCategoryInfo = (category: string, settings: Settings): CategoryInfo => {
  const categoryMap = getExpenseCategoryMap(settings);
  return categoryMap[category] || {
    id: category,
    label: category,
    labelDe: category,
    icon: 'Tag',
    color: '#6b7280',
  };
};

export const parseTags = (value: string): string[] => {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

export const calculateBudgetStatus = (
  expense: Expense,
  expenses: Expense[],
  budgetLimits: BudgetLimit[],
  warningThreshold: number
): { isWarning: boolean; isOver: boolean; percentage: number } => {
  const budget = budgetLimits.find((item) => item.category === expense.category && (item.month === expense.month || item.isRecurring));
  if (!budget) {
    return { isWarning: false, isOver: false, percentage: 0 };
  }

  const spent = expenses
    .filter((item) => item.month === expense.month && item.category === expense.category)
    .reduce((sum, item) => sum + item.amount, 0);

  const percentage = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
  return {
    isWarning: percentage >= warningThreshold,
    isOver: percentage >= 100,
    percentage,
  };
};
