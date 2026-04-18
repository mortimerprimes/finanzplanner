/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
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
  LocalFolderSettings,
} from '../types';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { generateId, getCurrentMonth, saveToLocalStorage, loadFromLocalStorage } from '../utils/helpers';
import { createGoogleDriveBackupPayload, performGoogleDriveBackup, performGoogleDriveLiveSync, shouldRunGoogleDriveAutoBackup } from '../services/googleDriveBackup';
import { performLocalFolderBackup, performLocalFolderLiveSync } from '../services/localFolderBackup';

const STORAGE_KEY = 'finanzplanner_data';
const GOOGLE_DRIVE_BACKUP_ERROR_LOG_KEY = 'finanzplanner_google_drive_backup_errors';

function logGoogleDriveAutoBackupError(error: unknown, frequency: Settings['backupFrequency']) {
  const nextEntry = {
    timestamp: new Date().toISOString(),
    frequency,
    message: error instanceof Error ? error.message : String(error),
  };

  try {
    const existingLogs = localStorage.getItem(GOOGLE_DRIVE_BACKUP_ERROR_LOG_KEY);
    const parsedLogs = existingLogs ? JSON.parse(existingLogs) as typeof nextEntry[] : [];
    localStorage.setItem(
      GOOGLE_DRIVE_BACKUP_ERROR_LOG_KEY,
      JSON.stringify([...parsedLogs, nextEntry].slice(-10))
    );
  } catch {
    // Ignore logging issues so local backups keep working.
  }
}

function logLocalFolderAutoBackupError(error: unknown, frequency: Settings['backupFrequency']) {
  const nextEntry = {
    timestamp: new Date().toISOString(),
    frequency,
    message: error instanceof Error ? error.message : String(error),
  };

  try {
    const existingLogs = localStorage.getItem('finanzplanner_local_folder_backup_errors');
    const parsedLogs = existingLogs ? JSON.parse(existingLogs) as typeof nextEntry[] : [];
    localStorage.setItem(
      'finanzplanner_local_folder_backup_errors',
      JSON.stringify([...parsedLogs, nextEntry].slice(-10))
    );
  } catch {
    // Ignore logging issues so local backups keep working.
  }
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
  settings: DEFAULT_SETTINGS,
  selectedMonth: getCurrentMonth(),
  currentMonth: getCurrentMonth(),
};

function hydrateInitialState(baseState: FinanceState): FinanceState {
  const savedData = loadFromLocalStorage<FinanceState | null>(STORAGE_KEY, null);
  if (!savedData) {
    return baseState;
  }

  const selectedMonth = savedData.selectedMonth || savedData.currentMonth || getCurrentMonth();

  return {
    ...baseState,
    ...savedData,
    bankConnections: savedData.bankConnections || [],
    syncSessions: savedData.syncSessions || [],
    freelanceProjects: savedData.freelanceProjects || [],
    workSessions: savedData.workSessions || [],
    freelanceInvoices: savedData.freelanceInvoices || [],
    invoiceProfile: {
      ...baseState.invoiceProfile,
      ...(savedData.invoiceProfile || {}),
    },
    selectedMonth,
    currentMonth: savedData.currentMonth || selectedMonth,
      settings: {
        ...DEFAULT_SETTINGS,
        ...savedData.settings,
        ai: {
          ...DEFAULT_SETTINGS.ai,
          ...savedData.settings?.ai,
        },
        googleDrive: {
          ...DEFAULT_SETTINGS.googleDrive,
          ...savedData.settings?.googleDrive,
        },
        localFolder: {
          ...DEFAULT_SETTINGS.localFolder,
          ...savedData.settings?.localFolder,
        },
        notifications: {
          ...DEFAULT_SETTINGS.notifications,
          ...savedData.settings?.notifications,
      },
    },
  };
}

// Action Types
type Action =
  | { type: 'SET_STATE'; payload: FinanceState }
  | { type: 'SET_SELECTED_MONTH'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  // Income actions
  | { type: 'ADD_INCOME'; payload: Omit<Income, 'id' | 'createdAt'> }
  | { type: 'UPDATE_INCOME'; payload: Income }
  | { type: 'DELETE_INCOME'; payload: string }
  // Fixed Expense actions
  | { type: 'ADD_FIXED_EXPENSE'; payload: Omit<FixedExpense, 'id' | 'createdAt'> }
  | { type: 'UPDATE_FIXED_EXPENSE'; payload: FixedExpense }
  | { type: 'DELETE_FIXED_EXPENSE'; payload: string }
  // Debt actions
  | { type: 'ADD_DEBT'; payload: Omit<Debt, 'id' | 'createdAt'> }
  | { type: 'UPDATE_DEBT'; payload: Debt }
  | { type: 'DELETE_DEBT'; payload: string }
  | { type: 'MAKE_DEBT_PAYMENT'; payload: { id: string; amount: number } }
  // Expense actions
  | { type: 'ADD_EXPENSE'; payload: Omit<Expense, 'id' | 'createdAt'> }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  // Savings Goal actions
  | { type: 'ADD_SAVINGS_GOAL'; payload: Omit<SavingsGoal, 'id' | 'createdAt'> }
  | { type: 'UPDATE_SAVINGS_GOAL'; payload: SavingsGoal }
  | { type: 'DELETE_SAVINGS_GOAL'; payload: string }
  | { type: 'ADD_TO_SAVINGS_GOAL'; payload: { id: string; amount: number } }
  // Budget Limit actions
  | { type: 'ADD_BUDGET_LIMIT'; payload: Omit<BudgetLimit, 'id'> }
  | { type: 'UPDATE_BUDGET_LIMIT'; payload: BudgetLimit }
  | { type: 'DELETE_BUDGET_LIMIT'; payload: string }
  // Account actions
  | { type: 'ADD_ACCOUNT'; payload: Omit<Account, 'id' | 'createdAt'> }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; payload: string }
  // Transfer actions
  | { type: 'ADD_TRANSFER'; payload: Omit<Transfer, 'id' | 'createdAt'> }
  | { type: 'DELETE_TRANSFER'; payload: string }
  // Bank Sync actions
  | { type: 'ADD_BANK_CONNECTION'; payload: Omit<BankConnection, 'id' | 'createdAt'> }
  | { type: 'UPDATE_BANK_CONNECTION'; payload: BankConnection }
  | { type: 'DELETE_BANK_CONNECTION'; payload: string }
  | { type: 'ADD_SYNC_SESSION'; payload: SyncSession }
  // Freelance actions
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
  // Data management
  | { type: 'IMPORT_DATA'; payload: Partial<FinanceState> }
  | { type: 'RESET_DATA' }
  | { type: 'RESET_ALL' };

// Reducer
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
          ai: {
            ...DEFAULT_SETTINGS.ai,
            ...action.payload.settings?.ai,
          },
          googleDrive: {
            ...DEFAULT_SETTINGS.googleDrive,
            ...action.payload.settings?.googleDrive,
          },
          localFolder: {
            ...DEFAULT_SETTINGS.localFolder,
            ...action.payload.settings?.localFolder,
          },
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...action.payload.settings?.notifications,
          },
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
          ai: action.payload.ai
            ? { ...state.settings.ai, ...action.payload.ai }
            : state.settings.ai,
          googleDrive: action.payload.googleDrive
            ? { ...state.settings.googleDrive, ...action.payload.googleDrive }
            : state.settings.googleDrive,
          localFolder: action.payload.localFolder
            ? { ...state.settings.localFolder, ...action.payload.localFolder }
            : state.settings.localFolder,
          notifications: action.payload.notifications
            ? { ...state.settings.notifications, ...action.payload.notifications }
            : state.settings.notifications,
        },
      };
      
    // Income
    case 'ADD_INCOME':
      return {
        ...state,
        incomes: [...state.incomes, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_INCOME':
      return {
        ...state,
        incomes: state.incomes.map(i => i.id === action.payload.id ? action.payload : i),
      };
    case 'DELETE_INCOME':
      return {
        ...state,
        incomes: state.incomes.filter(i => i.id !== action.payload),
      };
      
    // Fixed Expenses
    case 'ADD_FIXED_EXPENSE':
      return {
        ...state,
        fixedExpenses: [...state.fixedExpenses, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_FIXED_EXPENSE':
      return {
        ...state,
        fixedExpenses: state.fixedExpenses.map(f => f.id === action.payload.id ? action.payload : f),
      };
    case 'DELETE_FIXED_EXPENSE':
      return {
        ...state,
        fixedExpenses: state.fixedExpenses.filter(f => f.id !== action.payload),
      };
      
    // Debts
    case 'ADD_DEBT':
      return {
        ...state,
        debts: [...state.debts, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_DEBT':
      return {
        ...state,
        debts: state.debts.map(d => d.id === action.payload.id ? action.payload : d),
      };
    case 'DELETE_DEBT':
      return {
        ...state,
        debts: state.debts.filter(d => d.id !== action.payload),
      };
    case 'MAKE_DEBT_PAYMENT':
      return {
        ...state,
        debts: state.debts.map(d => 
          d.id === action.payload.id 
            ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - action.payload.amount) }
            : d
        ),
      };
      
    // Expenses
    case 'ADD_EXPENSE':
      return {
        ...state,
        expenses: [...state.expenses, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e),
      };
    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter(e => e.id !== action.payload),
      };
      
    // Savings Goals
    case 'ADD_SAVINGS_GOAL':
      return {
        ...state,
        savingsGoals: [...state.savingsGoals, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_SAVINGS_GOAL':
      return {
        ...state,
        savingsGoals: state.savingsGoals.map(g => g.id === action.payload.id ? action.payload : g),
      };
    case 'DELETE_SAVINGS_GOAL':
      return {
        ...state,
        savingsGoals: state.savingsGoals.filter(g => g.id !== action.payload),
      };
    case 'ADD_TO_SAVINGS_GOAL':
      return {
        ...state,
        savingsGoals: state.savingsGoals.map(g => 
          g.id === action.payload.id 
            ? { 
                ...g, 
                currentAmount: g.currentAmount + action.payload.amount,
                isCompleted: g.currentAmount + action.payload.amount >= g.targetAmount
              }
            : g
        ),
      };
      
    // Budget Limits
    case 'ADD_BUDGET_LIMIT':
      return {
        ...state,
        budgetLimits: [...state.budgetLimits, { ...action.payload, id: generateId() }],
      };
    case 'UPDATE_BUDGET_LIMIT':
      return {
        ...state,
        budgetLimits: state.budgetLimits.map(b => b.id === action.payload.id ? action.payload : b),
      };
    case 'DELETE_BUDGET_LIMIT':
      return {
        ...state,
        budgetLimits: state.budgetLimits.filter(b => b.id !== action.payload),
      };
      
    // Accounts
    case 'ADD_ACCOUNT':
      return {
        ...state,
        accounts: [...state.accounts, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map(a => a.id === action.payload.id ? action.payload : a),
      };
    case 'DELETE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter(a => a.id !== action.payload),
      };
      
    // Transfers
    case 'ADD_TRANSFER': {
      const transfer = { ...action.payload, id: generateId(), createdAt: now };
      return {
        ...state,
        transfers: [...state.transfers, transfer],
        accounts: state.accounts.map(a => {
          if (a.id === action.payload.fromAccountId) {
            return { ...a, balance: a.balance - action.payload.amount };
          }
          if (a.id === action.payload.toAccountId) {
            return { ...a, balance: a.balance + action.payload.amount };
          }
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
          if (a.id === transferToDelete.fromAccountId) {
            return { ...a, balance: a.balance + transferToDelete.amount };
          }
          if (a.id === transferToDelete.toAccountId) {
            return { ...a, balance: a.balance - transferToDelete.amount };
          }
          return a;
        }),
      };
    }
      
    // Bank Sync
    case 'ADD_BANK_CONNECTION':
      return {
        ...state,
        bankConnections: [
          ...state.bankConnections,
          { ...action.payload, id: generateId(), createdAt: now },
        ],
      };
    case 'UPDATE_BANK_CONNECTION':
      return {
        ...state,
        bankConnections: state.bankConnections.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'DELETE_BANK_CONNECTION':
      return {
        ...state,
        bankConnections: state.bankConnections.filter((c) => c.id !== action.payload),
        syncSessions: state.syncSessions.filter((s) => s.connectionId !== action.payload),
      };
    case 'ADD_SYNC_SESSION':
      return {
        ...state,
        syncSessions: [action.payload, ...state.syncSessions].slice(0, 100),
        bankConnections: state.bankConnections.map((c) =>
          c.id === action.payload.connectionId
            ? { ...c, lastSyncAt: action.payload.syncedAt, lastSyncCount: action.payload.newCount }
            : c
        ),
      };

    // Freelance
    case 'ADD_FREELANCE_PROJECT':
      return {
        ...state,
        freelanceProjects: [...state.freelanceProjects, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_FREELANCE_PROJECT':
      return {
        ...state,
        freelanceProjects: state.freelanceProjects.map((project) => project.id === action.payload.id ? action.payload : project),
      };
    case 'DELETE_FREELANCE_PROJECT':
      return {
        ...state,
        freelanceProjects: state.freelanceProjects.filter((project) => project.id !== action.payload),
        workSessions: state.workSessions.filter((session) => session.projectId !== action.payload),
        freelanceInvoices: state.freelanceInvoices.filter((invoice) => invoice.projectId !== action.payload),
      };
    case 'ADD_WORK_SESSION':
      return {
        ...state,
        workSessions: [...state.workSessions, { ...action.payload, id: generateId(), createdAt: now }],
      };
    case 'UPDATE_WORK_SESSION':
      return {
        ...state,
        workSessions: state.workSessions.map((session) => session.id === action.payload.id ? action.payload : session),
      };
    case 'DELETE_WORK_SESSION':
      return {
        ...state,
        workSessions: state.workSessions.filter((session) => session.id !== action.payload),
      };
    case 'CREATE_FREELANCE_INVOICE': {
      const invoice = { ...action.payload, id: generateId(), createdAt: now };
      const updatedProfile = {
        ...state.invoiceProfile,
        nextInvoiceNumber: state.invoiceProfile.nextInvoiceNumber + 1,
      };
      return {
        ...state,
        freelanceInvoices: [invoice, ...state.freelanceInvoices],
        workSessions: state.workSessions.map((session) =>
          invoice.sessionIds.includes(session.id)
            ? { ...session, invoiceId: invoice.id }
            : session
        ),
        invoiceProfile: updatedProfile,
      };
    }
    case 'UPDATE_FREELANCE_INVOICE':
      return {
        ...state,
        freelanceInvoices: state.freelanceInvoices.map((invoice) => invoice.id === action.payload.id ? action.payload : invoice),
      };
    case 'DELETE_FREELANCE_INVOICE':
      return {
        ...state,
        freelanceInvoices: state.freelanceInvoices.filter((invoice) => invoice.id !== action.payload),
        workSessions: state.workSessions.map((session) =>
          session.invoiceId === action.payload
            ? { ...session, invoiceId: undefined }
            : session
        ),
      };
    case 'UPDATE_INVOICE_PROFILE':
      return {
        ...state,
        invoiceProfile: {
          ...state.invoiceProfile,
          ...action.payload,
        },
      };

    // Data Management
    case 'IMPORT_DATA':
      return {
        ...state,
        ...action.payload,
        settings: {
          ...DEFAULT_SETTINGS,
          ...action.payload.settings,
          ai: {
            ...DEFAULT_SETTINGS.ai,
            ...action.payload.settings?.ai,
          },
          googleDrive: {
            ...DEFAULT_SETTINGS.googleDrive,
            ...action.payload.settings?.googleDrive,
          },
          localFolder: {
            ...DEFAULT_SETTINGS.localFolder,
            ...action.payload.settings?.localFolder,
          },
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...action.payload.settings?.notifications,
          },
        },
        currentMonth: action.payload.currentMonth || action.payload.selectedMonth || state.currentMonth,
      };
    case 'RESET_DATA':
      return initialState;
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
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Provider
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(financeReducer, initialState, hydrateInitialState);
  const lastAutoBackupPayloadRef = useRef('');
  
  // Save to localStorage on state change
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEY, state);
  }, [state]);

  useEffect(() => {
    const { backupProvider, backupFrequency, googleDrive, localFolder } = state.settings;
    const canRunGoogleDriveSync = backupFrequency === 'live'
      ? Boolean(googleDrive.folderId && googleDrive.liveSyncFileId)
      : Boolean(googleDrive.folderId);
    const canRunLocalFolderSync = Boolean(localFolder.directoryName);
    if (
      backupFrequency === 'manual'
      || (
        backupProvider === 'google-drive'
          ? (!googleDrive.clientId.trim() || !canRunGoogleDriveSync || !shouldRunGoogleDriveAutoBackup(backupFrequency, googleDrive.lastBackupAt))
          : backupProvider === 'local-folder'
            ? (!canRunLocalFolderSync || !shouldRunGoogleDriveAutoBackup(backupFrequency, localFolder.lastBackupAt))
            : true
      )
    ) {
      return;
    }

    const backupPayload = createGoogleDriveBackupPayload(state);
    if (backupPayload === lastAutoBackupPayloadRef.current) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (backupProvider === 'google-drive') {
        const syncRequest = backupFrequency === 'live'
          ? performGoogleDriveLiveSync(state, {
              clientId: googleDrive.clientId,
              folderId: googleDrive.folderId || undefined,
              fileId: googleDrive.liveSyncFileId || undefined,
              interactive: false,
            })
          : performGoogleDriveBackup(state, {
              clientId: googleDrive.clientId,
              folderId: googleDrive.folderId || undefined,
              interactive: false,
            });

        void syncRequest
          .then((result) => {
            if (cancelled) return;
            lastAutoBackupPayloadRef.current = backupPayload;
            dispatch({
              type: 'UPDATE_SETTINGS',
              payload: {
                googleDrive: {
                  clientId: state.settings.googleDrive.clientId,
                  folderId: result.folderId,
                  ...(backupFrequency === 'live'
                    ? {
                        liveSyncFileId: result.fileId,
                        liveSyncFileName: result.fileName,
                        lastLiveSyncAt: result.timestamp,
                      }
                    : {
                        lastBackupAt: result.timestamp,
                        lastBackupFileId: result.fileId,
                        lastBackupFileName: result.fileName,
                      }),
                },
              },
            });
          })
          .catch((error) => {
            logGoogleDriveAutoBackupError(error, backupFrequency);
          });

        return;
      }

      const syncRequest = backupFrequency === 'live'
        ? performLocalFolderLiveSync(state, false)
        : performLocalFolderBackup(state, false);

      void syncRequest
        .then((result) => {
          if (cancelled) return;
          lastAutoBackupPayloadRef.current = backupPayload;
          dispatch({
            type: 'UPDATE_SETTINGS',
            payload: {
              localFolder: {
                directoryName: result.directoryName || state.settings.localFolder.directoryName,
                ...(backupFrequency === 'live'
                  ? {
                      liveSyncFileName: result.fileName,
                      lastLiveSyncAt: result.timestamp,
                    }
                  : {
                      lastBackupAt: result.timestamp,
                      lastBackupFileName: result.fileName,
                    }),
              } satisfies Partial<LocalFolderSettings>,
            },
          });
        })
        .catch((error) => {
          logLocalFolderAutoBackupError(error, backupFrequency);
        });
    }, backupFrequency === 'live' ? 2500 : 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [state]);
  
  return (
    <FinanceContext.Provider value={{ state, dispatch }}>
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
