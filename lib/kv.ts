import { kv } from '@vercel/kv';
import type { FinanceState } from '@/src/types';
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
  ] = await Promise.all([
    getEntities(userId, 'incomes'),
    getEntities(userId, 'fixedExpenses'),
    getEntities(userId, 'expenses'),
    getEntities(userId, 'debts'),
    getEntities(userId, 'savingsGoals'),
    getEntities(userId, 'budgetLimits'),
    getEntities(userId, 'accounts'),
    getEntities(userId, 'transfers'),
    getEntities(userId, 'bankConnections'),
    getEntities(userId, 'syncSessions'),
    getEntities(userId, 'freelanceProjects'),
    getEntities(userId, 'workSessions'),
    getEntities(userId, 'freelanceInvoices'),
    getObject(userId, 'invoiceProfile', defaultInvoiceProfile),
    getObject(userId, 'settings', DEFAULT_SETTINGS),
    kv.get<string>(userKey(userId, 'selectedMonth')),
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
    settings: { ...DEFAULT_SETTINGS, ...settings },
    selectedMonth: month,
    currentMonth: month,
  } as FinanceState;
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
  ]);
}
