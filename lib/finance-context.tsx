'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode, useState } from 'react';
import type {
  FinanceState,
  Income,
  FixedExpense,
  Debt,
  Expense,
  SavingsGoal,
  BudgetLimit,
  Account,
  Transfer,
  Settings,
  BankConnection,
  SyncSession,
  FreelanceProject,
  WorkSession,
  FreelanceInvoice,
  InvoiceProfile,
} from '@/src/types';
import { DEFAULT_SETTINGS } from '@/src/utils/constants';
import { generateId, getCurrentMonth } from '@/src/utils/helpers';

const STORAGE_KEY = 'finanzplanner_data';

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
  settings: DEFAULT_SETTINGS,
  selectedMonth: getCurrentMonth(),
  currentMonth: getCurrentMonth(),
};

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
  | { type: 'MAKE_DEBT_PAYMENT'; payload: { id: string; amount: number } }
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
  | { type: 'IMPORT_DATA'; payload: Partial<FinanceState> }
  | { type: 'RESET_DATA' }
  | { type: 'RESET_ALL' };

// Reducer (identical logic to the original)
function financeReducer(state: FinanceState, action: Action): FinanceState {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'SET_STATE':
      return {
        ...state,
        ...action.payload,
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

    case 'SET_SELECTED_MONTH':
      return { ...state, selectedMonth: action.payload, currentMonth: action.payload };

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

    case 'ADD_INCOME':
      return { ...state, incomes: [...state.incomes, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_INCOME':
      return { ...state, incomes: state.incomes.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_INCOME':
      return { ...state, incomes: state.incomes.filter(i => i.id !== action.payload) };

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
    case 'MAKE_DEBT_PAYMENT':
      return {
        ...state,
        debts: state.debts.map(d =>
          d.id === action.payload.id
            ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - action.payload.amount) }
            : d
        ),
      };

    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, { ...action.payload, id: generateId(), createdAt: now }] };
    case 'UPDATE_EXPENSE':
      return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };

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

    case 'IMPORT_DATA':
      return {
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

  // Load state from API on mount
  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch('/api/finance');
        if (res.ok) {
          const data = await res.json();
          // Only dispatch if we got actual data (not empty default)
          if (data && (data.incomes?.length || data.expenses?.length || data.settings)) {
            dispatch({ type: 'SET_STATE', payload: data });
          }
        }
      } catch {
        // Fallback: try localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
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
  }, []);

  // Sync state to API + localStorage on changes (debounced)
  useEffect(() => {
    if (!initialLoadDone.current) return;

    // Always save to localStorage as cache
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore
    }

    // Debounced API sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      fetch('/api/finance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      }).catch(() => {
        // Silently fail - localStorage is the fallback
      });
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state]);

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
