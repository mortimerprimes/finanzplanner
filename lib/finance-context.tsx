'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode, useState } from 'react';
import { useSession } from 'next-auth/react';
import type {
  FinanceState,
  Income,
  FixedExpense,
  Debt,
  Expense,
  SavingsGoal,
  BudgetLimit,
  Account,
  AccountRule,
  Transfer,
  Settings,
  BankConnection,
  SyncSession,
  FreelanceProject,
  WorkSession,
  FreelanceInvoice,
  InvoiceProfile,
  NetWorthSnapshot,
  AppNotification,
  UndoEntry,
  ActivityLogEntry,
  CategoryRule,
  PlannedIncome,
  AutoBooking,
  MonthClose,
} from '@/src/types';
import { DEFAULT_SETTINGS } from '@/src/utils/constants';
import { generateId, getCurrentMonth, reconcileFixedExpensesForMonth, reconcileIncomesForMonth } from '@/src/utils/helpers';
import { buildDemoState } from '@/src/utils/demoData';

const STORAGE_KEY_PREFIX = 'finanzplanner_data';

function getStorageKey(userId?: string | null, email?: string | null): string {
  if (userId) return `${STORAGE_KEY_PREFIX}:${userId}`;
  if (email) return `${STORAGE_KEY_PREFIX}:${email.toLowerCase()}`;
  return STORAGE_KEY_PREFIX;
}

// Initial State
const initialState: FinanceState = {
  incomes: [],
  fixedExpenses: [],
  debts: [],
  expenses: [],
  savingsGoals: [],
  budgetLimits: [],
  accounts: [],
  transfers: [],
  bankConnections: [],
  syncSessions: [],
  freelanceProjects: [],
  workSessions: [],
  freelanceInvoices: [],
  invoiceProfile: {
    fullName: '',
    companyName: '',
    address: '',
    email: '',
    phone: '',
    taxId: '',
    iban: '',
    bic: '',
    invoicePrefix: 'RE',
    nextInvoiceNumber: 1,
    paymentTermDays: 14,
    place: '',
    useVat: false,
    defaultVatRate: 20,
    note: '',
  },
  netWorthHistory: [],
  notifications: [],
  accountRules: [],
  undoStack: [],
  activityLog: [],
  categoryRules: [],
  plannedIncomes: [],
  autoBookings: [],
  monthCloses: [],
  settings: DEFAULT_SETTINGS,
  selectedMonth: getCurrentMonth(),
  currentMonth: getCurrentMonth(),
};

const roundCurrencyValue = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

function updateAccountBalance(accounts: Account[], accountId: string | undefined, delta: number): Account[] {
  if (!accountId || delta === 0) return accounts;

  return accounts.map((account) =>
    account.id === accountId
      ? { ...account, balance: roundCurrencyValue(account.balance + delta) }
      : account
  );
}

function shouldTrackIncomeInAccount(income: Pick<Income, 'accountId' | 'isRecurring'>): boolean {
  return Boolean(income.accountId) && !income.isRecurring;
}

function hasIncomeAccountImpact(income: Pick<Income, 'accountId' | 'isRecurring' | 'affectsAccountBalance'>): boolean {
  return income.affectsAccountBalance ?? shouldTrackIncomeInAccount(income);
}

function hasExpenseAccountImpact(expense: Pick<Expense, 'accountId' | 'affectsAccountBalance'>): boolean {
  return expense.affectsAccountBalance ?? Boolean(expense.accountId);
}

function getIncomeMonthValue(income: Pick<Income, 'month' | 'date' | 'createdAt'>): string | null {
  if (income.month) return income.month;
  if (income.date?.length) return income.date.slice(0, 7);
  if (income.createdAt?.length) return income.createdAt.slice(0, 7);
  return null;
}

function isImportedIncome(income: Pick<Income, 'note' | 'isRecurring'>): boolean {
  return !income.isRecurring && Boolean((income.note || '').includes('Quelle:'));
}

function isImportedExpense(expense: Pick<Expense, 'tags'>): boolean {
  return Boolean(expense.tags?.includes('bankimport') || expense.tags?.includes('banksync'));
}

function withIncomeAccountTracking<T extends Pick<Income, 'accountId' | 'isRecurring'>>(income: T): T & { affectsAccountBalance: boolean } {
  return {
    ...income,
    affectsAccountBalance: shouldTrackIncomeInAccount(income),
  };
}

function withExpenseAccountTracking<T extends Pick<Expense, 'accountId'>>(expense: T): T & { affectsAccountBalance: boolean } {
  return {
    ...expense,
    affectsAccountBalance: Boolean(expense.accountId),
  };
}

function applyIncomeAccountImpact(accounts: Account[], income: Pick<Income, 'accountId' | 'amount' | 'affectsAccountBalance'>): Account[] {
  if (!hasIncomeAccountImpact(income)) return accounts;
  return updateAccountBalance(accounts, income.accountId, income.amount);
}

function revertIncomeAccountImpact(accounts: Account[], income: Pick<Income, 'accountId' | 'amount' | 'affectsAccountBalance'>): Account[] {
  if (!hasIncomeAccountImpact(income)) return accounts;
  return updateAccountBalance(accounts, income.accountId, -income.amount);
}

function applyExpenseAccountImpact(accounts: Account[], expense: Pick<Expense, 'accountId' | 'amount' | 'affectsAccountBalance'>): Account[] {
  if (!hasExpenseAccountImpact(expense)) return accounts;
  return updateAccountBalance(accounts, expense.accountId, -expense.amount);
}

function revertExpenseAccountImpact(accounts: Account[], expense: Pick<Expense, 'accountId' | 'amount' | 'affectsAccountBalance'>): Account[] {
  if (!hasExpenseAccountImpact(expense)) return accounts;
  return updateAccountBalance(accounts, expense.accountId, expense.amount);
}

function isFixedExpenseActiveForMonth(fixedExpense: FixedExpense, month: string): boolean {
  const createdMonth = fixedExpense.createdAt?.slice(0, 7);
  if (createdMonth && month < createdMonth) return false;
  return fixedExpense.isActive;
}

function getFixedExpenseImportMatchScore(candidate: Expense, importedExpense: Expense, fixedExpense?: FixedExpense): number {
  const amountDiff = Math.abs(candidate.amount - importedExpense.amount);
  const importedText = `${importedExpense.description} ${importedExpense.note || ''}`.toLowerCase();
  const candidateText = `${candidate.description} ${fixedExpense?.name || ''} ${fixedExpense?.note || ''}`.toLowerCase();
  const candidateTokens = candidateText.split(/\s+/).filter((token) => token.length >= 4);
  const hasKeywordOverlap = candidateTokens.some((token) => importedText.includes(token));

  let score = amountDiff;
  if (candidate.category !== importedExpense.category) score += 1;
  if (candidate.accountId && importedExpense.accountId && candidate.accountId !== importedExpense.accountId) score += 5;
  if (hasKeywordOverlap) score -= 2;
  return score;
}

function findMatchingAutoBookedFixedExpense(
  expenses: Expense[],
  fixedExpenses: FixedExpense[],
  importedExpense: Expense
): Expense | undefined {
  const tolerance = Math.max(5, importedExpense.amount * 0.03);

  return expenses
    .filter((expense) => expense.autoBookedType === 'fixedExpense' && expense.month === importedExpense.month)
    .filter((expense) => Math.abs(expense.amount - importedExpense.amount) <= tolerance)
    .sort((a, b) => {
      const fixedA = a.autoBookedFromId ? fixedExpenses.find((fixedExpense) => fixedExpense.id === a.autoBookedFromId) : undefined;
      const fixedB = b.autoBookedFromId ? fixedExpenses.find((fixedExpense) => fixedExpense.id === b.autoBookedFromId) : undefined;
      return getFixedExpenseImportMatchScore(a, importedExpense, fixedA) - getFixedExpenseImportMatchScore(b, importedExpense, fixedB);
    })[0];
}

function isRecurringIncomeActiveForMonth(income: Income, month: string): boolean {
  if (!income.isRecurring) return false;

  const startMonth = income.startMonth || income.createdAt?.slice(0, 7);
  if (startMonth && month < startMonth) return false;
  if (income.effectiveFromMonth && month < income.effectiveFromMonth) return false;

  return true;
}

function syncRecurringIncomeAutoBookingsForMonth(
  incomes: Income[],
  autoBookings: AutoBooking[] | undefined,
  accounts: Account[],
  month: string,
  now: string,
  options: { requireAccountId?: boolean } = {}
): { autoBookings: AutoBooking[]; updatedAccounts: Account[]; changed: boolean } {
  const requireAccountId = options.requireAccountId ?? false;
  const nextBookings: AutoBooking[] = [];
  const processedSourceIds = new Set<string>();
  const matchedRecurringIds = reconcileIncomesForMonth(incomes, month).matchedRecurringIds;
  const eligibleIncomes = new Map(
    incomes
      .filter((income) => isRecurringIncomeActiveForMonth(income, month))
      .filter((income) => !matchedRecurringIds.has(income.id))
      .filter((income) => !requireAccountId || Boolean(income.accountId))
      .map((income) => [income.id, income])
  );

  let updatedAccounts = accounts;
  let changed = false;

  for (const booking of autoBookings || []) {
    if (booking.sourceType !== 'recurringIncome' || booking.month !== month) {
      nextBookings.push(booking);
      continue;
    }

    if (processedSourceIds.has(booking.sourceId)) {
      if (booking.accountId) {
        updatedAccounts = updateAccountBalance(updatedAccounts, booking.accountId, -booking.amount);
      }
      changed = true;
      continue;
    }

    processedSourceIds.add(booking.sourceId);

    const income = eligibleIncomes.get(booking.sourceId);
    if (!income) {
      if (requireAccountId && !booking.accountId) {
        nextBookings.push(booking);
        continue;
      }

      if (booking.accountId) {
        updatedAccounts = updateAccountBalance(updatedAccounts, booking.accountId, -booking.amount);
      }
      changed = true;
      continue;
    }

    eligibleIncomes.delete(booking.sourceId);

    if (booking.accountId === income.accountId && booking.amount === income.amount) {
      nextBookings.push(booking);
      continue;
    }

    if (booking.accountId) {
      updatedAccounts = updateAccountBalance(updatedAccounts, booking.accountId, -booking.amount);
    }
    if (income.accountId) {
      updatedAccounts = updateAccountBalance(updatedAccounts, income.accountId, income.amount);
    }

    nextBookings.push({
      ...booking,
      bookedIncomeId: income.id,
      accountId: income.accountId,
      amount: income.amount,
    });
    changed = true;
  }

  for (const income of eligibleIncomes.values()) {
    nextBookings.push({
      id: generateId(),
      month,
      sourceType: 'recurringIncome',
      sourceId: income.id,
      bookedIncomeId: income.id,
      amount: income.amount,
      accountId: income.accountId,
      createdAt: now,
    });

    if (income.accountId) {
      updatedAccounts = updateAccountBalance(updatedAccounts, income.accountId, income.amount);
    }

    changed = true;
  }

  return {
    autoBookings: nextBookings,
    updatedAccounts,
    changed,
  };
}

function syncRecurringIncomeAutoBookingsAfterIncomeMutation(
  baseState: Pick<FinanceState, 'selectedMonth' | 'incomes' | 'autoBookings' | 'accounts'>,
  now: string,
  income?: Pick<Income, 'month' | 'date' | 'createdAt' | 'note' | 'isRecurring'>
): Pick<FinanceState, 'autoBookings' | 'accounts'> | null {
  let workingAutoBookings = baseState.autoBookings;
  let workingAccounts = baseState.accounts;
  let changed = false;

  const liveMonth = getCurrentMonth();
  const incomeMonth = income && isImportedIncome(income) ? getIncomeMonthValue(income) : null;
  const shouldSyncImportedMonth = incomeMonth && !(incomeMonth === liveMonth && baseState.selectedMonth === liveMonth);

  if (shouldSyncImportedMonth) {
    const syncedMonth = syncRecurringIncomeAutoBookingsForMonth(
      baseState.incomes,
      workingAutoBookings,
      workingAccounts,
      incomeMonth,
      now
    );

    workingAutoBookings = syncedMonth.autoBookings;
    workingAccounts = syncedMonth.updatedAccounts;
    changed = changed || syncedMonth.changed;
  }

  const syncedCurrentMonth = syncCurrentMonthRecurringIncomeAutoBookings(
    {
      ...baseState,
      autoBookings: workingAutoBookings,
      accounts: workingAccounts,
    },
    now
  );

  if (syncedCurrentMonth) {
    workingAutoBookings = syncedCurrentMonth.autoBookings;
    workingAccounts = syncedCurrentMonth.accounts;
    changed = true;
  }

  if (!changed) {
    return null;
  }

  return {
    autoBookings: workingAutoBookings,
    accounts: workingAccounts,
  };
}

function syncCurrentMonthRecurringIncomeAutoBookings(
  baseState: Pick<FinanceState, 'selectedMonth' | 'incomes' | 'autoBookings' | 'accounts'>,
  now: string
): Pick<FinanceState, 'autoBookings' | 'accounts'> | null {
  const liveMonth = getCurrentMonth();
  if (baseState.selectedMonth !== liveMonth) {
    return null;
  }

  const synced = syncRecurringIncomeAutoBookingsForMonth(
    baseState.incomes,
    baseState.autoBookings,
    baseState.accounts,
    liveMonth,
    now,
    { requireAccountId: true }
  );

  if (!synced.changed) {
    return null;
  }

  return {
    autoBookings: synced.autoBookings,
    accounts: synced.updatedAccounts,
  };
}

// Action Types (same as before)
type Action =
  | { type: 'SET_STATE'; payload: FinanceState }
  | { type: 'SET_SELECTED_MONTH'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'ADD_INCOME'; payload: Omit<Income, 'id' | 'createdAt'> }
  | { type: 'UPDATE_INCOME'; payload: Income }
  | { type: 'DELETE_INCOME'; payload: string }
  | { type: 'ADD_FIXED_EXPENSE'; payload: Omit<FixedExpense, 'id' | 'createdAt'> }
  | { type: 'UPDATE_FIXED_EXPENSE'; payload: FixedExpense }
  | { type: 'DELETE_FIXED_EXPENSE'; payload: string }
  | { type: 'ADD_DEBT'; payload: Omit<Debt, 'id' | 'createdAt'> }
  | { type: 'UPDATE_DEBT'; payload: Debt }
  | { type: 'DELETE_DEBT'; payload: string }
  | { type: 'MAKE_DEBT_PAYMENT'; payload: { id: string; amount: number; accountId?: string; date?: string; note?: string } }
  | { type: 'ADD_EXPENSE'; payload: Omit<Expense, 'id' | 'createdAt'> }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_SAVINGS_GOAL'; payload: Omit<SavingsGoal, 'id' | 'createdAt'> }
  | { type: 'UPDATE_SAVINGS_GOAL'; payload: SavingsGoal }
  | { type: 'DELETE_SAVINGS_GOAL'; payload: string }
  | { type: 'ADD_TO_SAVINGS_GOAL'; payload: { id: string; amount: number } }
  | { type: 'ADD_BUDGET_LIMIT'; payload: Omit<BudgetLimit, 'id'> }
  | { type: 'UPDATE_BUDGET_LIMIT'; payload: BudgetLimit }
  | { type: 'DELETE_BUDGET_LIMIT'; payload: string }
  | { type: 'ADD_ACCOUNT'; payload: Omit<Account, 'id' | 'createdAt'> }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; payload: string }
  | { type: 'ADD_TRANSFER'; payload: Omit<Transfer, 'id' | 'createdAt'> }
  | { type: 'DELETE_TRANSFER'; payload: string }
  | { type: 'ADD_BANK_CONNECTION'; payload: Omit<BankConnection, 'id' | 'createdAt'> }
  | { type: 'UPDATE_BANK_CONNECTION'; payload: BankConnection }
  | { type: 'DELETE_BANK_CONNECTION'; payload: string }
  | { type: 'ADD_SYNC_SESSION'; payload: SyncSession }
  | { type: 'ADD_FREELANCE_PROJECT'; payload: Omit<FreelanceProject, 'id' | 'createdAt'> }
  | { type: 'UPDATE_FREELANCE_PROJECT'; payload: FreelanceProject }
  | { type: 'DELETE_FREELANCE_PROJECT'; payload: string }
  | { type: 'ADD_WORK_SESSION'; payload: Omit<WorkSession, 'id' | 'createdAt'> }
  | { type: 'UPDATE_WORK_SESSION'; payload: WorkSession }
  | { type: 'DELETE_WORK_SESSION'; payload: string }
  | { type: 'CREATE_FREELANCE_INVOICE'; payload: Omit<FreelanceInvoice, 'id' | 'createdAt'> }
  | { type: 'UPDATE_FREELANCE_INVOICE'; payload: FreelanceInvoice }
  | { type: 'DELETE_FREELANCE_INVOICE'; payload: string }
  | { type: 'UPDATE_INVOICE_PROFILE'; payload: Partial<InvoiceProfile> }
  // Net worth history
  | { type: 'ADD_NET_WORTH_SNAPSHOT'; payload: NetWorthSnapshot }
  // Notifications
  | { type: 'ADD_NOTIFICATION'; payload: Omit<AppNotification, 'id' | 'createdAt'> }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL_NOTIFICATIONS' }
  // Account rules
  | { type: 'ADD_ACCOUNT_RULE'; payload: Omit<AccountRule, 'id'> }
  | { type: 'UPDATE_ACCOUNT_RULE'; payload: AccountRule }
  | { type: 'DELETE_ACCOUNT_RULE'; payload: string }
  // Undo
  | { type: 'PUSH_UNDO'; payload: UndoEntry }
  | { type: 'POP_UNDO' }
  // Batch delete expenses
  | { type: 'DELETE_EXPENSES_BATCH'; payload: string[] }
  // Batch update expenses category
  | { type: 'UPDATE_EXPENSES_CATEGORY'; payload: { ids: string[]; category: string } }
  // Activity log
  | { type: 'ADD_ACTIVITY_LOG'; payload: Omit<ActivityLogEntry, 'id' | 'createdAt'> }
  | { type: 'CLEAR_ACTIVITY_LOG' }
  // Category rules
  | { type: 'ADD_CATEGORY_RULE'; payload: Omit<CategoryRule, 'id' | 'createdAt'> }
  | { type: 'UPDATE_CATEGORY_RULE'; payload: CategoryRule }
  | { type: 'DELETE_CATEGORY_RULE'; payload: string }
  // Planned incomes (future forecasting)
  | { type: 'ADD_PLANNED_INCOME'; payload: Omit<PlannedIncome, 'id' | 'createdAt'> }
  | { type: 'UPDATE_PLANNED_INCOME'; payload: PlannedIncome }
  | { type: 'DELETE_PLANNED_INCOME'; payload: string }
  // Auto-booking engine
  | { type: 'RUN_MONTH_AUTO_BOOKING'; payload: string } // month string "2026-04"
  | { type: 'UNDO_AUTO_BOOKING'; payload: { month: string; sourceId: string } }
  // Month-end wizard
  | { type: 'COMPLETE_MONTH_CLOSE'; payload: Omit<MonthClose, 'id'> }
  | { type: 'DELETE_MONTH_CLOSE'; payload: string }
  // Data management
  | { type: 'IMPORT_DATA'; payload: Partial<FinanceState> }
  | { type: 'RESET_DATA' }
  | { type: 'RESET_ALL' };

// Reducer (identical logic to the original)
function financeReducer(state: FinanceState, action: Action): FinanceState {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'SET_STATE': {
      const nextState = {
        ...state,
        ...action.payload,
        accountRules: action.payload.accountRules || state.accountRules || [],
        undoStack: state.undoStack || [],
        activityLog: action.payload.activityLog || state.activityLog || [],
        categoryRules: action.payload.categoryRules || state.categoryRules || [],
        plannedIncomes: action.payload.plannedIncomes || state.plannedIncomes || [],
        autoBookings: action.payload.autoBookings || state.autoBookings || [],
        monthCloses: action.payload.monthCloses || state.monthCloses || [],
        currentMonth: action.payload.currentMonth || action.payload.selectedMonth || state.currentMonth,
        settings: {
          ...DEFAULT_SETTINGS,
          ...action.payload.settings,
          ai: { ...DEFAULT_SETTINGS.ai, ...action.payload.settings?.ai },
          googleDrive: { ...DEFAULT_SETTINGS.googleDrive, ...action.payload.settings?.googleDrive },
          localFolder: { ...DEFAULT_SETTINGS.localFolder, ...action.payload.settings?.localFolder },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...action.payload.settings?.notifications },
        },
      };
      const syncedCurrentMonth = syncCurrentMonthRecurringIncomeAutoBookings(nextState, now);
      return syncedCurrentMonth ? { ...nextState, ...syncedCurrentMonth } : nextState;
    }

    case 'SET_SELECTED_MONTH': {
      const nextState = { ...state, selectedMonth: action.payload, currentMonth: action.payload };
      const syncedCurrentMonth = syncCurrentMonthRecurringIncomeAutoBookings(nextState, now);
      return syncedCurrentMonth ? { ...nextState, ...syncedCurrentMonth } : nextState;
    }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
          ai: action.payload.ai ? { ...state.settings.ai, ...action.payload.ai } : state.settings.ai,
          googleDrive: action.payload.googleDrive ? { ...state.settings.googleDrive, ...action.payload.googleDrive } : state.settings.googleDrive,
          localFolder: action.payload.localFolder ? { ...state.settings.localFolder, ...action.payload.localFolder } : state.settings.localFolder,
          notifications: action.payload.notifications ? { ...state.settings.notifications, ...action.payload.notifications } : state.settings.notifications,
        },
      };

    case 'ADD_INCOME': {
      const income = withIncomeAccountTracking({
        ...action.payload,
        id: generateId(),
        createdAt: now,
        startMonth: action.payload.startMonth || (action.payload.isRecurring ? state.selectedMonth : undefined),
      });
      const nextState = {
        ...state,
        incomes: [...state.incomes, income],
        accounts: applyIncomeAccountImpact(state.accounts, income),
      };
      const syncedRecurringBookings = syncRecurringIncomeAutoBookingsAfterIncomeMutation(nextState, now, income);
      return syncedRecurringBookings ? { ...nextState, ...syncedRecurringBookings } : nextState;
    }
    case 'UPDATE_INCOME': {
      const existingIncome = state.incomes.find((income) => income.id === action.payload.id);
      if (!existingIncome) return state;

      const updatedIncome = withIncomeAccountTracking(action.payload);
      let updatedAccounts = state.accounts;
      if (hasIncomeAccountImpact(existingIncome)) {
        updatedAccounts = revertIncomeAccountImpact(updatedAccounts, existingIncome);
      }
      if (hasIncomeAccountImpact(updatedIncome)) {
        updatedAccounts = applyIncomeAccountImpact(updatedAccounts, updatedIncome);
      }

      const nextState = {
        ...state,
        accounts: updatedAccounts,
        incomes: state.incomes.map((income) => (income.id === action.payload.id ? updatedIncome : income)),
      };
      const syncedRecurringBookings = syncRecurringIncomeAutoBookingsAfterIncomeMutation(nextState, now, updatedIncome);
      return syncedRecurringBookings ? { ...nextState, ...syncedRecurringBookings } : nextState;
    }
    case 'DELETE_INCOME': {
      const incomeToDelete = state.incomes.find((income) => income.id === action.payload);
      const nextState = {
        ...state,
        incomes: state.incomes.filter((income) => income.id !== action.payload),
        accounts: incomeToDelete ? revertIncomeAccountImpact(state.accounts, incomeToDelete) : state.accounts,
      };
      const syncedRecurringBookings = syncRecurringIncomeAutoBookingsAfterIncomeMutation(nextState, now, incomeToDelete);
      return syncedRecurringBookings ? { ...nextState, ...syncedRecurringBookings } : nextState;
    }

    case 'ADD_FIXED_EXPENSE':
      return { ...state, fixedExpenses: [...state.fixedExpenses, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_FIXED_EXPENSE':
      return { ...state, fixedExpenses: state.fixedExpenses.map(f => f.id === action.payload.id ? action.payload : f) };
    case 'DELETE_FIXED_EXPENSE':
      return { ...state, fixedExpenses: state.fixedExpenses.filter(f => f.id !== action.payload) };

    case 'ADD_DEBT':
      return { ...state, debts: [...state.debts, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_DEBT':
      return { ...state, debts: state.debts.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DEBT':
      return { ...state, debts: state.debts.filter(d => d.id !== action.payload) };
    case 'MAKE_DEBT_PAYMENT': {
      const debt = state.debts.find((item) => item.id === action.payload.id);
      if (!debt) return state;

      const actualAmount = Math.min(Math.max(0, action.payload.amount), debt.remainingAmount);
      if (actualAmount <= 0) return state;

      const paymentDate = action.payload.date || now.slice(0, 10);
      const paymentExpense = withExpenseAccountTracking({
        id: generateId(),
        description: `${debt.name} Tilgung`,
        amount: actualAmount,
        category: 'other',
        date: paymentDate,
        month: paymentDate.slice(0, 7),
        note: action.payload.note || 'Manuelle Schuldentilgung',
        accountId: action.payload.accountId,
        linkedDebtId: debt.id,
        tags: ['debt-payment'],
        createdAt: now,
      });

      return {
        ...state,
        debts: state.debts.map((item) =>
          item.id === action.payload.id
            ? { ...item, remainingAmount: Math.max(0, item.remainingAmount - actualAmount) }
            : item
        ),
        expenses: [...state.expenses, paymentExpense],
        accounts: applyExpenseAccountImpact(state.accounts, paymentExpense),
      };
    }

    case 'ADD_EXPENSE': {
      const expense = withExpenseAccountTracking({ ...action.payload, id: generateId(), createdAt: now });

      if (isImportedExpense(expense)) {
        const matchingAutoBookedExpense = findMatchingAutoBookedFixedExpense(state.expenses, state.fixedExpenses, expense);

        if (matchingAutoBookedExpense) {
          const mergedExpense = withExpenseAccountTracking({
            ...matchingAutoBookedExpense,
            ...expense,
            id: matchingAutoBookedExpense.id,
            createdAt: matchingAutoBookedExpense.createdAt,
            autoBookedFromId: matchingAutoBookedExpense.autoBookedFromId,
            autoBookedType: matchingAutoBookedExpense.autoBookedType,
            linkedDebtId: matchingAutoBookedExpense.linkedDebtId || expense.linkedDebtId,
          });

          let updatedAccounts = state.accounts;
          if (hasExpenseAccountImpact(matchingAutoBookedExpense)) {
            updatedAccounts = revertExpenseAccountImpact(updatedAccounts, matchingAutoBookedExpense);
          }
          if (hasExpenseAccountImpact(mergedExpense)) {
            updatedAccounts = applyExpenseAccountImpact(updatedAccounts, mergedExpense);
          }

          return {
            ...state,
            accounts: updatedAccounts,
            expenses: state.expenses.map((existingExpense) =>
              existingExpense.id === matchingAutoBookedExpense.id ? mergedExpense : existingExpense
            ),
            autoBookings: (state.autoBookings || []).map((booking) =>
              booking.bookedExpenseId === matchingAutoBookedExpense.id
                ? {
                    ...booking,
                    bookedExpenseId: undefined,
                    accountId: mergedExpense.accountId,
                    amount: mergedExpense.amount,
                  }
                : booking
            ),
          };
        }
      }

      return {
        ...state,
        expenses: [...state.expenses, expense],
        accounts: applyExpenseAccountImpact(state.accounts, expense),
      };
    }
    case 'UPDATE_EXPENSE': {
      const existingExpense = state.expenses.find((expense) => expense.id === action.payload.id);
      if (!existingExpense) return state;

      const updatedExpense = withExpenseAccountTracking(action.payload);
      let updatedAccounts = state.accounts;
      if (hasExpenseAccountImpact(existingExpense)) {
        updatedAccounts = revertExpenseAccountImpact(updatedAccounts, existingExpense);
      }
      if (hasExpenseAccountImpact(updatedExpense)) {
        updatedAccounts = applyExpenseAccountImpact(updatedAccounts, updatedExpense);
      }

      return {
        ...state,
        accounts: updatedAccounts,
        expenses: state.expenses.map((expense) => (expense.id === action.payload.id ? updatedExpense : expense)),
      };
    }
    case 'DELETE_EXPENSE': {
      const expenseToDelete = state.expenses.find((expense) => expense.id === action.payload);
      return {
        ...state,
        expenses: state.expenses.filter((expense) => expense.id !== action.payload),
        accounts: expenseToDelete ? revertExpenseAccountImpact(state.accounts, expenseToDelete) : state.accounts,
      };
    }

    case 'ADD_SAVINGS_GOAL':
      return { ...state, savingsGoals: [...state.savingsGoals, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_SAVINGS_GOAL':
      return { ...state, savingsGoals: state.savingsGoals.map(g => g.id === action.payload.id ? action.payload : g) };
    case 'DELETE_SAVINGS_GOAL':
      return { ...state, savingsGoals: state.savingsGoals.filter(g => g.id !== action.payload) };
    case 'ADD_TO_SAVINGS_GOAL':
      return {
        ...state,
        savingsGoals: state.savingsGoals.map(g =>
          g.id === action.payload.id
            ? { ...g, currentAmount: g.currentAmount + action.payload.amount, isCompleted: g.currentAmount + action.payload.amount >= g.targetAmount }
            : g
        ),
      };

    case 'ADD_BUDGET_LIMIT':
      return { ...state, budgetLimits: [...state.budgetLimits, { ...action.payload, id: generateId() }] };
    case 'UPDATE_BUDGET_LIMIT':
      return { ...state, budgetLimits: state.budgetLimits.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BUDGET_LIMIT':
      return { ...state, budgetLimits: state.budgetLimits.filter(b => b.id !== action.payload) };

    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_ACCOUNT':
      return { ...state, accounts: state.accounts.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'DELETE_ACCOUNT':
      return { ...state, accounts: state.accounts.filter(a => a.id !== action.payload) };

    case 'ADD_TRANSFER': {
      const transfer = { ...action.payload, id: generateId(), createdAt: now };
      return {
        ...state,
        transfers: [...state.transfers, transfer],
        accounts: state.accounts.map(a => {
          if (a.id === action.payload.fromAccountId) return { ...a, balance: a.balance - action.payload.amount };
          if (a.id === action.payload.toAccountId) return { ...a, balance: a.balance + action.payload.amount };
          return a;
        }),
      };
    }
    case 'DELETE_TRANSFER': {
      const transferToDelete = state.transfers.find(t => t.id === action.payload);
      if (!transferToDelete) return state;
      return {
        ...state,
        transfers: state.transfers.filter(t => t.id !== action.payload),
        accounts: state.accounts.map(a => {
          if (a.id === transferToDelete.fromAccountId) return { ...a, balance: a.balance + transferToDelete.amount };
          if (a.id === transferToDelete.toAccountId) return { ...a, balance: a.balance - transferToDelete.amount };
          return a;
        }),
      };
    }

    case 'ADD_BANK_CONNECTION':
      return { ...state, bankConnections: [...state.bankConnections, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_BANK_CONNECTION':
      return { ...state, bankConnections: state.bankConnections.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_BANK_CONNECTION':
      return {
        ...state,
        bankConnections: state.bankConnections.filter(c => c.id !== action.payload),
        syncSessions: state.syncSessions.filter(s => s.connectionId !== action.payload),
      };
    case 'ADD_SYNC_SESSION':
      return {
        ...state,
        syncSessions: [action.payload, ...state.syncSessions].slice(0, 100),
        bankConnections: state.bankConnections.map(c =>
          c.id === action.payload.connectionId
            ? { ...c, lastSyncAt: action.payload.syncedAt, lastSyncCount: action.payload.newCount }
            : c
        ),
      };

    case 'ADD_FREELANCE_PROJECT':
      return { ...state, freelanceProjects: [...state.freelanceProjects, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_FREELANCE_PROJECT':
      return { ...state, freelanceProjects: state.freelanceProjects.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_FREELANCE_PROJECT':
      return {
        ...state,
        freelanceProjects: state.freelanceProjects.filter(p => p.id !== action.payload),
        workSessions: state.workSessions.filter(s => s.projectId !== action.payload),
        freelanceInvoices: state.freelanceInvoices.filter(i => i.projectId !== action.payload),
      };
    case 'ADD_WORK_SESSION':
      return { ...state, workSessions: [...state.workSessions, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_WORK_SESSION':
      return { ...state, workSessions: state.workSessions.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_WORK_SESSION':
      return { ...state, workSessions: state.workSessions.filter(s => s.id !== action.payload) };
    case 'CREATE_FREELANCE_INVOICE': {
      const invoice = { ...action.payload, id: generateId(), createdAt: now };
      return {
        ...state,
        freelanceInvoices: [invoice, ...state.freelanceInvoices],
        workSessions: state.workSessions.map(s =>
          invoice.sessionIds.includes(s.id) ? { ...s, invoiceId: invoice.id } : s
        ),
        invoiceProfile: { ...state.invoiceProfile, nextInvoiceNumber: state.invoiceProfile.nextInvoiceNumber + 1 },
      };
    }
    case 'UPDATE_FREELANCE_INVOICE':
      return { ...state, freelanceInvoices: state.freelanceInvoices.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_FREELANCE_INVOICE':
      return {
        ...state,
        freelanceInvoices: state.freelanceInvoices.filter(i => i.id !== action.payload),
        workSessions: state.workSessions.map(s => s.invoiceId === action.payload ? { ...s, invoiceId: undefined } : s),
      };
    case 'UPDATE_INVOICE_PROFILE':
      return { ...state, invoiceProfile: { ...state.invoiceProfile, ...action.payload } };

    case 'ADD_NET_WORTH_SNAPSHOT': {
      const existing = state.netWorthHistory.findIndex(s => s.month === action.payload.month);
      const history = existing >= 0
        ? state.netWorthHistory.map((s, i) => i === existing ? action.payload : s)
        : [...state.netWorthHistory, action.payload];
      return { ...state, netWorthHistory: history.sort((a, b) => a.month.localeCompare(b.month)).slice(-36) };
    }

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [{ ...action.payload, id: generateId(), createdAt: now }, ...state.notifications].slice(0, 50),
      };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n),
      };
    case 'DISMISS_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'CLEAR_ALL_NOTIFICATIONS':
      return { ...state, notifications: [] };

    case 'ADD_ACCOUNT_RULE':
      return { ...state, accountRules: [...(state.accountRules || []), { ...action.payload, id: generateId() }] };
    case 'UPDATE_ACCOUNT_RULE':
      return { ...state, accountRules: (state.accountRules || []).map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_ACCOUNT_RULE':
      return { ...state, accountRules: (state.accountRules || []).filter(r => r.id !== action.payload) };

    case 'PUSH_UNDO':
      return { ...state, undoStack: [...(state.undoStack || []).slice(-4), action.payload] };
    case 'POP_UNDO': {
      const stack = state.undoStack || [];
      if (stack.length === 0) return state;
      const last = stack[stack.length - 1];
      return { ...state, ...last.patch, undoStack: stack.slice(0, -1) };
    }

    case 'DELETE_EXPENSES_BATCH': {
      const expensesToDelete = state.expenses.filter((expense) => action.payload.includes(expense.id));
      const updatedAccounts = expensesToDelete.reduce(
        (accounts, expense) => revertExpenseAccountImpact(accounts, expense),
        state.accounts
      );
      return {
        ...state,
        accounts: updatedAccounts,
        expenses: state.expenses.filter((expense) => !action.payload.includes(expense.id)),
      };
    }
    case 'UPDATE_EXPENSES_CATEGORY':
      return {
        ...state,
        expenses: state.expenses.map(e =>
          action.payload.ids.includes(e.id) ? { ...e, category: action.payload.category } : e
        ),
      };

    case 'ADD_ACTIVITY_LOG':
      return {
        ...state,
        activityLog: [{ ...action.payload, id: generateId(), createdAt: now }, ...(state.activityLog || [])].slice(0, 200),
      };
    case 'CLEAR_ACTIVITY_LOG':
      return { ...state, activityLog: [] };

    case 'ADD_CATEGORY_RULE':
      return { ...state, categoryRules: [...(state.categoryRules || []), { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_CATEGORY_RULE':
      return { ...state, categoryRules: (state.categoryRules || []).map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_CATEGORY_RULE':
      return { ...state, categoryRules: (state.categoryRules || []).filter(r => r.id !== action.payload) };

    case 'ADD_PLANNED_INCOME':
      return { ...state, plannedIncomes: [...(state.plannedIncomes || []), { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_PLANNED_INCOME':
      return { ...state, plannedIncomes: (state.plannedIncomes || []).map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PLANNED_INCOME':
      return { ...state, plannedIncomes: (state.plannedIncomes || []).filter(p => p.id !== action.payload) };

    // ==========================================
    // AUTO-BOOKING ENGINE
    // ==========================================
    case 'RUN_MONTH_AUTO_BOOKING': {
      const month = action.payload;
      const existingBookings = state.autoBookings || [];
      const newExpenses: Expense[] = [];
      let updatedDebts = [...state.debts];
      let updatedAccounts = state.accounts;
      let nextBookings = [...existingBookings];
      const fixedReconciliation = reconcileFixedExpensesForMonth(state.fixedExpenses, state.expenses, month);
      const importedExpensesById = new Map(
        state.expenses
          .filter((expense) => expense.month === month && isImportedExpense(expense))
          .map((expense) => [expense.id, expense])
      );
      const matchedImportedExpenseIdsByFixedExpenseId = new Map(
        fixedReconciliation.entries
          .filter((entry) => entry.matchedImportedExpenseId)
          .map((entry) => [entry.fixedExpenseId, entry.matchedImportedExpenseId as string])
      );

      // 1. Auto-book active fixed expenses
      for (const fe of state.fixedExpenses.filter((fixedExpense) => isFixedExpenseActiveForMonth(fixedExpense, month))) {
        const alreadyBooked = existingBookings.some(ab => ab.sourceId === fe.id && ab.month === month && ab.sourceType === 'fixedExpense');
        if (alreadyBooked) continue;

        const matchedImportedExpenseId = matchedImportedExpenseIdsByFixedExpenseId.get(fe.id);
        const matchedImportedExpense = matchedImportedExpenseId ? importedExpensesById.get(matchedImportedExpenseId) : undefined;
        let bookedExpenseId: string | undefined;
        const bookingAmount = matchedImportedExpense?.amount ?? fe.amount;

        if (!matchedImportedExpense) {
          bookedExpenseId = generateId();
          // Use actual last day of month for months shorter than dueDay
          const [yr, mo] = month.split('-').map(Number);
          const lastDay = new Date(yr, mo, 0).getDate();
          const day = Math.min(fe.dueDay, lastDay);
          const expense = withExpenseAccountTracking({
            id: bookedExpenseId,
            description: `${fe.name}${fe.linkedDebtId ? ' (Kreditrate)' : ''}`,
            amount: fe.amount,
            category: fe.category as any,
            date: `${month}-${String(day).padStart(2, '0')}`,
            month,
            createdAt: now,
            accountId: fe.accountId,
            linkedDebtId: fe.linkedDebtId,
            autoBookedFromId: fe.id,
            autoBookedType: 'fixedExpense',
          });
          newExpenses.push(expense);
          updatedAccounts = applyExpenseAccountImpact(updatedAccounts, expense);
        }

        const booking: AutoBooking = {
          id: generateId(),
          month,
          sourceType: 'fixedExpense',
          sourceId: fe.id,
          bookedExpenseId,
          amount: bookingAmount,
          accountId: matchedImportedExpense?.accountId || fe.accountId,
          debtPaymentApplied: false,
          createdAt: now,
        };

        // If linked to a debt, reduce debt balance
        if (fe.linkedDebtId) {
          updatedDebts = updatedDebts.map(d =>
            d.id === fe.linkedDebtId
              ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - bookingAmount) }
              : d
          );
          booking.debtPaymentApplied = true;
          booking.linkedDebtId = fe.linkedDebtId;
        }

        nextBookings.push(booking);
      }

      // 2. Auto-book recurring incomes without duplicating imported salary transactions.
      const syncedRecurringIncomeBookings = syncRecurringIncomeAutoBookingsForMonth(
        state.incomes,
        nextBookings,
        updatedAccounts,
        month,
        now
      );
      nextBookings = syncedRecurringIncomeBookings.autoBookings;
      updatedAccounts = syncedRecurringIncomeBookings.updatedAccounts;

      if (nextBookings.length === existingBookings.length && newExpenses.length === 0) return state;

      return {
        ...state,
        accounts: updatedAccounts,
        expenses: [...state.expenses, ...newExpenses],
        debts: updatedDebts,
        autoBookings: nextBookings,
      };
    }

    case 'UNDO_AUTO_BOOKING': {
      const { month: undoMonth, sourceId } = action.payload;
      const booking = (state.autoBookings || []).find(ab => ab.sourceId === sourceId && ab.month === undoMonth);
      if (!booking) return state;

      let updatedDebts2 = state.debts;
      let updatedAccounts = state.accounts;
      // Reverse debt payment if applicable
      if (booking.debtPaymentApplied && booking.linkedDebtId) {
        updatedDebts2 = state.debts.map(d =>
          d.id === booking.linkedDebtId
            ? { ...d, remainingAmount: d.remainingAmount + booking.amount }
            : d
        );
      }

      if (booking.bookedExpenseId) {
        const bookedExpense = state.expenses.find((expense) => expense.id === booking.bookedExpenseId);
        if (bookedExpense) {
          updatedAccounts = revertExpenseAccountImpact(updatedAccounts, bookedExpense);
        } else if (booking.accountId) {
          updatedAccounts = updateAccountBalance(updatedAccounts, booking.accountId, booking.amount);
        }
      } else if (booking.sourceType === 'recurringIncome' && booking.accountId) {
        updatedAccounts = updateAccountBalance(updatedAccounts, booking.accountId, -booking.amount);
      }

      return {
        ...state,
        accounts: updatedAccounts,
        expenses: booking.bookedExpenseId ? state.expenses.filter(e => e.id !== booking.bookedExpenseId) : state.expenses,
        debts: updatedDebts2,
        autoBookings: (state.autoBookings || []).filter(ab => ab.id !== booking.id),
      };
    }

    // ==========================================
    // MONTH-END WIZARD
    // ==========================================
    case 'COMPLETE_MONTH_CLOSE': {
      const closeEntry: MonthClose = { ...action.payload, id: generateId() };
      // Remove any existing close for the same month (re-closing replaces old entry)
      const filteredCloses = (state.monthCloses || []).filter(mc => mc.month !== closeEntry.month);
      // Apply savings allocations
      let updatedGoals = state.savingsGoals;
      if (closeEntry.savingsAllocations.length > 0) {
        updatedGoals = state.savingsGoals.map(g => {
          const alloc = closeEntry.savingsAllocations.find(a => a.goalId === g.id);
          if (!alloc) return g;
          const newAmount = g.currentAmount + alloc.amount;
          return {
            ...g,
            currentAmount: newAmount,
            isCompleted: newAmount >= g.targetAmount,
            depositHistory: [...(g.depositHistory || []), { month: closeEntry.month, amount: alloc.amount, date: now }],
          };
        });
      }
      // Apply budget rollovers to next month
      let updatedBudgets = [...state.budgetLimits];
      if (closeEntry.budgetRollovers.length > 0) {
        const [y, m] = closeEntry.month.split('-').map(Number);
        const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
        closeEntry.budgetRollovers.forEach((rollover) => {
          if (rollover.rolloverAmount <= 0) return;

          const sourceBudget = updatedBudgets.find((budget) => budget.id === rollover.budgetId);
          if (!sourceBudget || !sourceBudget.enableRollover) return;

          const nextBudgetIndex = updatedBudgets.findIndex(
            (budget) => budget.category === sourceBudget.category && budget.month === nextMonth
          );

          if (nextBudgetIndex >= 0) {
            updatedBudgets[nextBudgetIndex] = {
              ...updatedBudgets[nextBudgetIndex],
              rolloverAmount: rollover.rolloverAmount,
            };
            return;
          }

          updatedBudgets.push({
            ...sourceBudget,
            id: generateId(),
            month: nextMonth,
            isRecurring: false,
            rolloverAmount: rollover.rolloverAmount,
          });
        });
      }

      return {
        ...state,
        savingsGoals: updatedGoals,
        budgetLimits: updatedBudgets,
        monthCloses: [...filteredCloses, closeEntry],
      };
    }

    case 'DELETE_MONTH_CLOSE':
      return { ...state, monthCloses: (state.monthCloses || []).filter(mc => mc.id !== action.payload) };

    case 'IMPORT_DATA': {
      const nextState = {
        ...state,
        ...action.payload,
        settings: {
          ...DEFAULT_SETTINGS,
          ...action.payload.settings,
          ai: { ...DEFAULT_SETTINGS.ai, ...action.payload.settings?.ai },
          googleDrive: { ...DEFAULT_SETTINGS.googleDrive, ...action.payload.settings?.googleDrive },
          localFolder: { ...DEFAULT_SETTINGS.localFolder, ...action.payload.settings?.localFolder },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...action.payload.settings?.notifications },
        },
        currentMonth: action.payload.currentMonth || action.payload.selectedMonth || state.currentMonth,
      };
      const syncedCurrentMonth = syncCurrentMonthRecurringIncomeAutoBookings(nextState, now);
      return syncedCurrentMonth ? { ...nextState, ...syncedCurrentMonth } : nextState;
    }
    case 'RESET_DATA':
    case 'RESET_ALL':
      return initialState;

    default:
      return state;
  }
}

// Context
interface FinanceContextType {
  state: FinanceState;
  dispatch: React.Dispatch<Action>;
  isLoading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Provider
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(financeReducer, initialState);
  const [isLoading, setIsLoading] = useState(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  const { data: session, status } = useSession();
  const sessionUser = session?.user as { id?: string; email?: string } | undefined;
  const storageKey = getStorageKey(sessionUser?.id, sessionUser?.email);

  // Load state from API on mount
  useEffect(() => {
    if (status === 'loading') return;

    initialLoadDone.current = false;
    setIsLoading(true);

    async function loadState() {
      try {
        const res = await fetch('/api/finance');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            dispatch({ type: 'SET_STATE', payload: data });
          }
        } else {
          console.warn('[Finance] API load failed:', res.status);
          // Fallback: try localStorage
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            dispatch({ type: 'SET_STATE', payload: JSON.parse(saved) });
          }
        }
      } catch (err) {
        console.warn('[Finance] API load error:', err);
        // Fallback: try localStorage
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            dispatch({ type: 'SET_STATE', payload: JSON.parse(saved) });
          }
        } catch {
          // Use default state
        }
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    }
    loadState();
  }, [status, storageKey]);

  // Sync state to API + localStorage on changes (debounced)
  useEffect(() => {
    if (!initialLoadDone.current || status === 'loading') return;

    // Always save to localStorage as cache
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore
    }

    // Debounced API sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/finance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
        if (!res.ok) {
          console.error('[Finance] Save failed:', res.status, await res.text());
        }
      } catch (err) {
        console.error('[Finance] Save error:', err);
      }
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state, status, storageKey]);

  return (
    <FinanceContext.Provider value={{ state, dispatch, isLoading }}>
      {children}
    </FinanceContext.Provider>
  );
}

// Hook
export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}

// ============================================================
// DEMO Provider — uses same FinanceContext, no API calls
// ============================================================
function demoReducer(state: FinanceState, action: Action): FinanceState {
  if (action.type === 'SET_SELECTED_MONTH') {
    return { ...state, selectedMonth: action.payload as string, currentMonth: action.payload as string };
  }
  // Demo mode: read-only — ignore all mutating actions
  return state;
}

export function DemoFinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, buildDemoState());

  return (
    <FinanceContext.Provider value={{ state, dispatch: dispatch as React.Dispatch<Action>, isLoading: false }}>
      {children}
    </FinanceContext.Provider>
  );
}
