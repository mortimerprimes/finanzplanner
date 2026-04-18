import { auth, type StoredUser } from '@/lib/auth';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

// ---- Auth guard ----

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if ((session.user as { role?: string }).role !== 'admin') return null;
  return session;
}

// ---- User listing ----

export type SafeUser = Omit<StoredUser, 'password'> & { role: string; isLocked: boolean };

export async function listAllUsers(): Promise<SafeUser[]> {
  const keys: string[] = await kv.keys('auth:user:*');
  const users = await Promise.all(
    keys.map(async (key) => {
      const user = await kv.get<StoredUser & { role?: string; isLocked?: boolean }>(key);
      if (!user || !user.id) return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...rest } = user;
      return {
        ...rest,
        role: user.role || 'user',
        isLocked: user.isLocked || false,
      } as SafeUser;
    })
  );
  return users.filter(Boolean) as SafeUser[];
}

// ---- User data summary ----

export interface DataSummary {
  key: string;
  label: string;
  count: number;
}

export async function getUserDataSummary(userId: string): Promise<DataSummary[]> {
  const entities = [
    { key: 'incomes', label: 'Einnahmen' },
    { key: 'fixedExpenses', label: 'Fixkosten' },
    { key: 'expenses', label: 'Ausgaben' },
    { key: 'debts', label: 'Schulden' },
    { key: 'savingsGoals', label: 'Sparziele' },
    { key: 'budgetLimits', label: 'Budgets' },
    { key: 'accounts', label: 'Konten' },
    { key: 'transfers', label: 'Transfers' },
    { key: 'freelanceProjects', label: 'Projekte' },
    { key: 'workSessions', label: 'Arbeitszeiten' },
    { key: 'freelanceInvoices', label: 'Rechnungen' },
  ];
  const results = await Promise.all(
    entities.map(async ({ key, label }) => {
      const data = await kv.get<unknown[]>(`user:${userId}:${key}`);
      return { key, label, count: Array.isArray(data) ? data.length : 0 };
    })
  );
  return results;
}

// ---- Modify user ----

export async function setUserRole(email: string, role: 'user' | 'admin'): Promise<boolean> {
  const key = `auth:user:${email.toLowerCase()}`;
  const user = await kv.get<StoredUser>(key);
  if (!user) return false;
  await kv.set(key, { ...user, role });
  return true;
}

export async function setUserLocked(email: string, isLocked: boolean): Promise<boolean> {
  const key = `auth:user:${email.toLowerCase()}`;
  const user = await kv.get<StoredUser>(key);
  if (!user) return false;
  await kv.set(key, { ...user, isLocked });
  return true;
}

export async function resetUserPassword(email: string): Promise<string | null> {
  const key = `auth:user:${email.toLowerCase()}`;
  const user = await kv.get<StoredUser>(key);
  if (!user) return null;
  // Generate random password (12 chars)
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
  let newPassword = '';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (const byte of array) {
    newPassword += chars[byte % chars.length];
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await kv.set(key, { ...user, password: hash });
  return newPassword;
}

export async function deleteUserCompletely(userId: string, email: string): Promise<void> {
  const dataKeys = [
    'incomes', 'fixedExpenses', 'expenses', 'debts',
    'savingsGoals', 'budgetLimits', 'accounts', 'transfers',
    'bankConnections', 'syncSessions', 'freelanceProjects',
    'workSessions', 'freelanceInvoices', 'invoiceProfile',
    'settings', 'selectedMonth', 'netWorthHistory', 'notifications',
    'accountRules',
  ];
  await Promise.all([
    ...dataKeys.map(k => kv.del(`user:${userId}:${k}`)),
    kv.del(`auth:user:${email.toLowerCase()}`),
  ]);
  await kv.decr('auth:user_count');
}
