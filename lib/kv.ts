import { kv } from '@vercel/kv';
import type { FinanceState, Income, FixedExpense, Expense, Debt, SavingsGoal, BudgetLimit, Account, AccountRule, Transfer, BankConnection, SyncSession, FreelanceProject, WorkSession, FreelanceInvoice, NetWorthSnapshot, AppNotification } from '@/src/types';
import { DEFAULT_SETTINGS } from '@/src/utils/constants';
import { getCurrentMonth } from '@/src/utils/helpers';

// Entity types that map to KV keys
const ENTITY_KEYS = [
  'incomes',
  'fixedExpenses',
  'expenses',
  'debts',
  'savingsGoals',
  'budgetLimits',
  'accounts',
  'transfers',
  'bankConnections',
  'syncSessions',
  'freelanceProjects',
  'workSessions',
  'freelanceInvoices',
] as const;

type EntityKey = (typeof ENTITY_KEYS)[number];

function userKey(userId: string, entity: string): string {
  return `user:${userId}:${entity}`;
}

export async function getEntities<T>(userId: string, entity: EntityKey): Promise<T[]> {
  const data = await kv.get<T[]>(userKey(userId, entity));
  return data || [];
}

export async function setEntities<T>(userId: string, entity: EntityKey, data: T[]): Promise<void> {
  await kv.set(userKey(userId, entity), data);
}

export async function getObject<T>(userId: string, key: string, defaultValue: T): Promise<T> {
  const data = await kv.get<T>(userKey(userId, key));
  return data ? { ...defaultValue, ...data } : defaultValue;
}

export async function setObject<T>(userId: string, key: string, data: T): Promise<void> {
  await kv.set(userKey(userId, key), data);
}

const defaultInvoiceProfile = {
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
};

export async function getFullState(userId: string): Promise<FinanceState> {
  // Load all entities in parallel
  const [
    incomes,
    fixedExpenses,
    expenses,
    debts,
    savingsGoals,
    budgetLimits,
    accounts,
    transfers,
    bankConnections,
    syncSessions,
    freelanceProjects,
    workSessions,
    freelanceInvoices,
    invoiceProfile,
    settings,
    selectedMonth,
    netWorthHistory,
    notifications,
    accountRules,
  ] = await Promise.all([
    getEntities<Income>(userId, 'incomes'),
    getEntities<FixedExpense>(userId, 'fixedExpenses'),
    getEntities<Expense>(userId, 'expenses'),
    getEntities<Debt>(userId, 'debts'),
    getEntities<SavingsGoal>(userId, 'savingsGoals'),
    getEntities<BudgetLimit>(userId, 'budgetLimits'),
    getEntities<Account>(userId, 'accounts'),
    getEntities<Transfer>(userId, 'transfers'),
    getEntities<BankConnection>(userId, 'bankConnections'),
    getEntities<SyncSession>(userId, 'syncSessions'),
    getEntities<FreelanceProject>(userId, 'freelanceProjects'),
    getEntities<WorkSession>(userId, 'workSessions'),
    getEntities<FreelanceInvoice>(userId, 'freelanceInvoices'),
    getObject(userId, 'invoiceProfile', defaultInvoiceProfile),
    getObject(userId, 'settings', DEFAULT_SETTINGS),
    kv.get<string>(userKey(userId, 'selectedMonth')),
    kv.get<NetWorthSnapshot[]>(userKey(userId, 'netWorthHistory')),
    kv.get<AppNotification[]>(userKey(userId, 'notifications')),
    kv.get<AccountRule[]>(userKey(userId, 'accountRules')),
  ]);

  const month = selectedMonth || getCurrentMonth();

  return {
    incomes,
    fixedExpenses,
    expenses,
    debts,
    savingsGoals,
    budgetLimits,
    accounts,
    transfers,
    bankConnections,
    syncSessions,
    freelanceProjects,
    workSessions,
    freelanceInvoices,
    invoiceProfile,
    settings: { ...DEFAULT_SETTINGS, ...settings } as any,
    selectedMonth: month,
    currentMonth: month,
    netWorthHistory: netWorthHistory || [],
    notifications: notifications || [],
    accountRules: accountRules || [],
    undoStack: [],
  };
}

export async function saveFullState(userId: string, state: FinanceState): Promise<void> {
  await Promise.all([
    setEntities(userId, 'incomes', state.incomes),
    setEntities(userId, 'fixedExpenses', state.fixedExpenses),
    setEntities(userId, 'expenses', state.expenses),
    setEntities(userId, 'debts', state.debts),
    setEntities(userId, 'savingsGoals', state.savingsGoals),
    setEntities(userId, 'budgetLimits', state.budgetLimits),
    setEntities(userId, 'accounts', state.accounts),
    setEntities(userId, 'transfers', state.transfers),
    setEntities(userId, 'bankConnections', state.bankConnections),
    setEntities(userId, 'syncSessions', state.syncSessions),
    setEntities(userId, 'freelanceProjects', state.freelanceProjects),
    setEntities(userId, 'workSessions', state.workSessions),
    setEntities(userId, 'freelanceInvoices', state.freelanceInvoices),
    setObject(userId, 'invoiceProfile', state.invoiceProfile),
    setObject(userId, 'settings', state.settings),
    kv.set(userKey(userId, 'selectedMonth'), state.selectedMonth),
    kv.set(userKey(userId, 'netWorthHistory'), state.netWorthHistory),
    kv.set(userKey(userId, 'notifications'), state.notifications),
    kv.set(userKey(userId, 'accountRules'), state.accountRules || []),
  ]);
}
