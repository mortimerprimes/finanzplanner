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
  if (recurring.accountId && bankIncome.accountId && recurring.accountId !== bankIncome.accountId) {
    score += 5;
  }
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
  // Only include recurring incomes if this month >= their startMonth (or startMonth not set = legacy data, always include)
  const monthIncomes = incomes.filter((income) => {
    if (income.isRecurring) {
      // Respect startMonth: recurring income only applies from the month it was created onwards
      const startMonth = income.startMonth || income.createdAt?.slice(0, 7);
      if (startMonth && month < startMonth) return false;
      // Also respect effectiveFromMonth for future-planned incomes
      if (income.effectiveFromMonth && month < income.effectiveFromMonth) return false;
      return true;
    }
    return getIncomeMonth(income) === month;
  });
  const recurring = monthIncomes.filter((income) => income.isRecurring);
  const oneTime = monthIncomes.filter((income) => !income.isRecurring);
  const imported = oneTime.filter(isBankImportedIncome);
  const manualOneTime = oneTime.filter((income) => !isBankImportedIncome(income));

  const usedImportedIds = new Set<string>();
  const matchedRecurringIds = new Set<string>();
  const matchedImportedIds = new Set<string>();

  const recurringEffectiveSum = recurring.reduce((sum, recurringIncome) => {
    const explicitMatch = imported.find(
      (importedIncome) =>
        !usedImportedIds.has(importedIncome.id)
        && importedIncome.bankImportMatch?.type === 'recurringIncome'
        && importedIncome.bankImportMatch.targetId === recurringIncome.id
    );

    if (explicitMatch) {
      usedImportedIds.add(explicitMatch.id);
      matchedRecurringIds.add(recurringIncome.id);
      matchedImportedIds.add(explicitMatch.id);
      return sum + explicitMatch.amount;
    }

    const tolerance = Math.max(5, recurringIncome.amount * 0.03);
    const candidates = imported
      .filter((importedIncome) => !usedImportedIds.has(importedIncome.id))
      .filter((importedIncome) => !recurringIncome.accountId || !importedIncome.accountId || recurringIncome.accountId === importedIncome.accountId)
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
  if (fixedExpense.accountId && expense.accountId && fixedExpense.accountId !== expense.accountId) {
    score += 5;
  }
  if (hasKeywordOverlap) score -= 2;
  return score;
}

export interface FixedExpenseEffectiveEntry {
  fixedExpenseId: string;
  linkedDebtId?: string;
  effectiveAmount: number;
  matchedImportedExpenseId?: string;
}

export interface FixedExpenseReconciliationResult {
  totalPlanned: number;
  totalActualImported: number;
  totalEffective: number;
  matchedFixedExpenseIds: Set<string>;
  matchedImportedExpenseIds: Set<string>;
  entries: FixedExpenseEffectiveEntry[];
}

function isFixedExpenseActiveForMonth(fixedExpense: FixedExpense, month: string): boolean {
  const createdMonth = fixedExpense.createdAt?.slice(0, 7);
  if (createdMonth && month < createdMonth) return false;
  return fixedExpense.isActive;
}

function isDebtActiveForMonth(debt: Debt, month: string): boolean {
  const startMonth = debt.startDate?.slice(0, 7);
  if (startMonth && month < startMonth) return false;
  return debt.remainingAmount > 0;
}

export function reconcileFixedExpensesForMonth(
  fixedExpenses: FixedExpense[],
  expenses: Expense[],
  month: string
): FixedExpenseReconciliationResult {
  const activeFixedExpenses = fixedExpenses.filter((fixedExpense) => isFixedExpenseActiveForMonth(fixedExpense, month));
  const monthExpenses = expenses.filter((expense) => expense.month === month);
  const importedExpenses = monthExpenses.filter((expense) => expense.tags?.includes('bankimport') || expense.tags?.includes('banksync'));

  const usedImportedIds = new Set<string>();
  const matchedFixedExpenseIds = new Set<string>();
  const matchedImportedExpenseIds = new Set<string>();
  const entries: FixedExpenseEffectiveEntry[] = [];

  const fixedEffectiveSum = activeFixedExpenses.reduce((sum, fixedExpense) => {
    const explicitMatch = importedExpenses.find(
      (expense) =>
        !usedImportedIds.has(expense.id)
        && expense.bankImportMatch?.type === 'fixedExpense'
        && expense.bankImportMatch.targetId === fixedExpense.id
    );

    if (explicitMatch) {
      usedImportedIds.add(explicitMatch.id);
      matchedFixedExpenseIds.add(fixedExpense.id);
      matchedImportedExpenseIds.add(explicitMatch.id);
      entries.push({
        fixedExpenseId: fixedExpense.id,
        linkedDebtId: fixedExpense.linkedDebtId,
        effectiveAmount: explicitMatch.amount,
        matchedImportedExpenseId: explicitMatch.id,
      });
      return sum + explicitMatch.amount;
    }

    const tolerance = Math.max(5, fixedExpense.amount * 0.03);
    const candidates = importedExpenses
      .filter((expense) => !usedImportedIds.has(expense.id))
      .filter((expense) => !fixedExpense.accountId || !expense.accountId || fixedExpense.accountId === expense.accountId)
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
      entries.push({
        fixedExpenseId: fixedExpense.id,
        linkedDebtId: fixedExpense.linkedDebtId,
        effectiveAmount: match.amount,
        matchedImportedExpenseId: match.id,
      });
      return sum + match.amount;
    }

    entries.push({
      fixedExpenseId: fixedExpense.id,
      linkedDebtId: fixedExpense.linkedDebtId,
      effectiveAmount: fixedExpense.amount,
    });
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
    entries,
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
  const monthExpenses = getExpensesForMonth(expenses, month);
  const totalFixedExpenses = fixedReconciliation.entries
    .filter((entry) => !entry.linkedDebtId)
    .reduce((sum, entry) => sum + entry.effectiveAmount, 0);

  const excludedExpenseIds = new Set<string>([
    ...fixedReconciliation.matchedImportedExpenseIds,
    ...monthExpenses
      .filter((expense) => expense.autoBookedType === 'fixedExpense')
      .map((expense) => expense.id),
  ]);

  const coveredDebtIds = new Set<string>();
  let totalDebtPayments = fixedReconciliation.entries
    .filter((entry) => Boolean(entry.linkedDebtId))
    .reduce((sum, entry) => {
      if (entry.linkedDebtId) {
        coveredDebtIds.add(entry.linkedDebtId);
      }
      return sum + entry.effectiveAmount;
    }, 0);

  const manualDebtExpenses = monthExpenses.filter(
    (expense) => Boolean(expense.linkedDebtId) && !excludedExpenseIds.has(expense.id)
  );
  manualDebtExpenses.forEach((expense) => {
    excludedExpenseIds.add(expense.id);
    if (expense.linkedDebtId) {
      coveredDebtIds.add(expense.linkedDebtId);
    }
  });
  totalDebtPayments += calculateTotal(manualDebtExpenses);

  totalDebtPayments += debts
    .filter((debt) => isDebtActiveForMonth(debt, month) && !coveredDebtIds.has(debt.id))
    .reduce((sum, debt) => sum + debt.monthlyPayment, 0);

  const variableExpenses = monthExpenses.filter((expense) => !excludedExpenseIds.has(expense.id));
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

function findLatestBudget(
  budgetLimits: BudgetLimit[],
  predicate: (budget: BudgetLimit) => boolean
): BudgetLimit | undefined {
  for (let index = budgetLimits.length - 1; index >= 0; index -= 1) {
    if (predicate(budgetLimits[index])) {
      return budgetLimits[index];
    }
  }
  return undefined;
}

export const getBudgetLimitValue = (
  budget: Pick<BudgetLimit, 'amount' | 'monthlyLimit' | 'rolloverAmount'>
): number => {
  const baseAmount = budget.monthlyLimit > 0 ? budget.monthlyLimit : budget.amount;
  return Math.max(0, baseAmount + (budget.rolloverAmount || 0));
};

export const getBudgetLimitForMonth = (
  budgetLimits: BudgetLimit[],
  category: ExpenseCategory,
  month: string
): BudgetLimit | undefined => {
  const exact = findLatestBudget(
    budgetLimits,
    (budget) => budget.category === category && budget.month === month
  );
  if (exact) {
    return exact;
  }

  return findLatestBudget(
    budgetLimits,
    (budget) => budget.category === category && budget.isRecurring
  );
};

export const getActiveBudgetLimits = (
  budgetLimits: BudgetLimit[],
  month: string
): BudgetLimit[] => {
  const resolved: BudgetLimit[] = [];
  const seenCategories = new Set<string>();

  for (let index = budgetLimits.length - 1; index >= 0; index -= 1) {
    const budget = budgetLimits[index];
    if (budget.month === month && !seenCategories.has(budget.category)) {
      resolved.unshift(budget);
      seenCategories.add(budget.category);
    }
  }

  for (let index = budgetLimits.length - 1; index >= 0; index -= 1) {
    const budget = budgetLimits[index];
    if (budget.isRecurring && !seenCategories.has(budget.category)) {
      resolved.unshift(budget);
      seenCategories.add(budget.category);
    }
  }

  return resolved;
};

// Get budget usage percentage
export const getBudgetUsage = (
  category: ExpenseCategory,
  expenses: Expense[],
  budgetLimits: BudgetLimit[],
  month: string
): { used: number; limit: number; percentage: number } | null => {
  const limit = getBudgetLimitForMonth(budgetLimits, category, month);

  if (!limit) return null;

  const effectiveLimit = getBudgetLimitValue(limit);
  const used = calculateExpensesByCategory(expenses, month)[category] || 0;
  const percentage = effectiveLimit > 0 ? Math.min((used / effectiveLimit) * 100, 100) : 0;

  return { used, limit: effectiveLimit, percentage };
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
  const budget = getBudgetLimitForMonth(budgetLimits, expense.category, expense.month);
  if (!budget) {
    return { isWarning: false, isOver: false, percentage: 0 };
  }

  const spent = expenses
    .filter((item) => item.month === expense.month && item.category === expense.category)
    .reduce((sum, item) => sum + item.amount, 0);

  const effectiveLimit = getBudgetLimitValue(budget);
  const percentage = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
  return {
    isWarning: percentage >= warningThreshold,
    isOver: percentage >= 100,
    percentage,
  };
};

// ========== NEW HELPERS ==========

// Debt: Generate amortization schedule
export const generateAmortizationSchedule = (
  remainingAmount: number,
  monthlyPayment: number,
  annualInterestRate: number,
  extraPayment = 0
): { month: number; date: string; payment: number; principal: number; interest: number; remaining: number }[] => {
  const schedule: { month: number; date: string; payment: number; principal: number; interest: number; remaining: number }[] = [];
  let balance = remainingAmount;
  const monthlyRate = annualInterestRate / 100 / 12;
  let monthNum = 0;
  const startDate = new Date();

  while (balance > 0 && monthNum < 600) {
    monthNum++;
    const interest = balance * monthlyRate;
    const totalPayment = Math.min(balance + interest, monthlyPayment + extraPayment);
    const principal = totalPayment - interest;
    balance = Math.max(0, balance - principal);
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + monthNum);
    schedule.push({
      month: monthNum,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      payment: totalPayment,
      principal,
      interest,
      remaining: balance,
    });
  }
  return schedule;
};

// Debt: Compare snowball vs avalanche
export const compareDebtStrategies = (
  debts: { name: string; remainingAmount: number; monthlyPayment: number; interestRate: number }[],
  extraBudget = 0
): { strategy: string; totalInterest: number; months: number }[] => {
  const simulate = (ordered: typeof debts) => {
    const balances = ordered.map(d => d.remainingAmount);
    const payments = ordered.map(d => d.monthlyPayment);
    let totalInterest = 0;
    let months = 0;
    while (balances.some(b => b > 0) && months < 600) {
      months++;
      let extra = extraBudget;
      for (let i = 0; i < ordered.length; i++) {
        if (balances[i] <= 0) continue;
        const rate = ordered[i].interestRate / 100 / 12;
        const interest = balances[i] * rate;
        totalInterest += interest;
        const payment = Math.min(balances[i] + interest, payments[i] + extra);
        extra = Math.max(0, extra - (payment - payments[i]));
        balances[i] = Math.max(0, balances[i] - (payment - interest));
      }
    }
    return { totalInterest, months };
  };

  const avalanche = [...debts].sort((a, b) => b.interestRate - a.interestRate);
  const snowball = [...debts].sort((a, b) => a.remainingAmount - b.remainingAmount);

  return [
    { strategy: 'Avalanche (höchster Zins zuerst)', ...simulate(avalanche) },
    { strategy: 'Snowball (kleinster Betrag zuerst)', ...simulate(snowball) },
  ];
};

// Savings: Calculate streak (consecutive months with deposits)
export const calculateSavingsStreak = (
  depositHistory: { month: string; amount: number }[] | undefined
): number => {
  if (!depositHistory || depositHistory.length === 0) return 0;
  const months = [...new Set(depositHistory.map(d => d.month))].sort().reverse();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let streak = 0;
  let checkMonth = currentMonth;
  for (let i = 0; i < 120; i++) {
    if (months.includes(checkMonth)) {
      streak++;
      const [y, m] = checkMonth.split('-').map(Number);
      const prev = new Date(y, m - 2, 1);
      checkMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    } else {
      break;
    }
  }
  return streak;
};

// Budget: Calculate rollover from previous month
export const calculateBudgetRollover = (
  category: string,
  month: string,
  budgetLimits: BudgetLimit[],
  expenses: { category: string; month: string; amount: number }[]
): number => {
  const currentBudget = budgetLimits.find(
    (budget) => budget.category === category && budget.month === month && budget.enableRollover
  );
  if (currentBudget?.rolloverAmount) {
    return currentBudget.rolloverAmount;
  }

  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevBudget = budgetLimits.find(
    (budget) => budget.category === category && budget.month === prevMonth && budget.enableRollover
  );
  if (!prevBudget) return 0;
  const prevSpent = expenses.filter(e => e.month === prevMonth && e.category === category).reduce((s, e) => s + e.amount, 0);
  return Math.max(0, getBudgetLimitValue(prevBudget) - prevSpent);
};

// Global search across all data
export interface SearchResult {
  type: 'expense' | 'income' | 'fixed-expense' | 'debt' | 'savings' | 'transfer' | 'freelance-project' | 'invoice';
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  date?: string;
  icon: string;
  color: string;
}

export const globalSearch = (
  query: string,
  state: {
    expenses: { id: string; description: string; amount: number; date: string; category: string; tags?: string[]; note?: string }[];
    incomes: { id: string; name: string; amount: number; month?: string }[];
    fixedExpenses: { id: string; name: string; amount: number; category: string }[];
    debts: { id: string; name: string; remainingAmount: number; totalAmount: number }[];
    savingsGoals: { id: string; name: string; currentAmount: number; targetAmount: number }[];
    transfers: { id: string; amount: number; date: string; note?: string }[];
    freelanceProjects: { id: string; name: string; clientName: string }[];
    freelanceInvoices: { id: string; invoiceNumber: string; clientName: string; grossAmount: number; issueDate: string }[];
    settings: Settings;
  }
): SearchResult[] => {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: SearchResult[] = [];

  for (const e of state.expenses) {
    if (e.description.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q)) || e.note?.toLowerCase().includes(q)) {
      const info = getExpenseCategoryInfo(e.category, state.settings);
      results.push({ type: 'expense', id: e.id, title: e.description, subtitle: `${formatCurrency(e.amount, state.settings)} · ${e.date}`, amount: e.amount, date: e.date, icon: info.icon, color: info.color });
    }
  }
  for (const i of state.incomes) {
    if (i.name.toLowerCase().includes(q)) {
      results.push({ type: 'income', id: i.id, title: i.name, subtitle: formatCurrency(i.amount, state.settings), amount: i.amount, date: i.month, icon: 'TrendingUp', color: '#10b981' });
    }
  }
  for (const f of state.fixedExpenses) {
    if (f.name.toLowerCase().includes(q)) {
      results.push({ type: 'fixed-expense', id: f.id, title: f.name, subtitle: formatCurrency(f.amount, state.settings), amount: f.amount, icon: 'Receipt', color: '#6366f1' });
    }
  }
  for (const d of state.debts) {
    if (d.name.toLowerCase().includes(q)) {
      results.push({ type: 'debt', id: d.id, title: d.name, subtitle: `${formatCurrency(d.remainingAmount, state.settings)} verbleibend`, amount: d.remainingAmount, icon: 'CreditCard', color: '#ef4444' });
    }
  }
  for (const s of state.savingsGoals) {
    if (s.name.toLowerCase().includes(q)) {
      results.push({ type: 'savings', id: s.id, title: s.name, subtitle: `${formatCurrency(s.currentAmount, state.settings)} / ${formatCurrency(s.targetAmount, state.settings)}`, amount: s.currentAmount, icon: 'PiggyBank', color: '#10b981' });
    }
  }
  for (const p of state.freelanceProjects) {
    if (p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q)) {
      results.push({ type: 'freelance-project', id: p.id, title: p.name, subtitle: p.clientName, icon: 'Briefcase', color: '#8b5cf6' });
    }
  }
  for (const inv of state.freelanceInvoices) {
    if (inv.invoiceNumber.toLowerCase().includes(q) || inv.clientName.toLowerCase().includes(q)) {
      results.push({ type: 'invoice', id: inv.id, title: inv.invoiceNumber, subtitle: `${inv.clientName} · ${formatCurrency(inv.grossAmount, state.settings)}`, amount: inv.grossAmount, date: inv.issueDate, icon: 'FileText', color: '#f59e0b' });
    }
  }

  return results.slice(0, 50);
};

// Duplicate detection for expenses
export const findDuplicateExpenses = (
  expense: { amount: number; date: string; description: string },
  existingExpenses: { id: string; amount: number; date: string; description: string }[]
): { id: string; amount: number; date: string; description: string }[] => {
  return existingExpenses.filter(e =>
    Math.abs(e.amount - expense.amount) < 0.01 &&
    e.date === expense.date &&
    e.description.toLowerCase() === expense.description.toLowerCase()
  );
};
