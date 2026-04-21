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

// ---- Analytics ----

export async function getDailyRegistrations(days = 30): Promise<{ date: string; count: number }[]> {
  const users = await listAllUsers();
  const now = new Date();
  const result: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = users.filter(u => u.createdAt?.startsWith(dateStr)).length;
    result.push({ date: dateStr, count });
  }
  return result;
}

export async function getTotalDataEntries(): Promise<number> {
  const users = await listAllUsers();
  const summaries = await Promise.all(users.map(u => getUserDataSummary(u.id)));
  return summaries.flat().reduce((sum, d) => sum + d.count, 0);
}

// ---- Rate Limit Management ----

export interface RateLimitEntry {
  key: string;
  email: string;
  count: number;
  lockedUntil?: number;
  firstAttempt?: number;
}

export async function getRateLimits(): Promise<RateLimitEntry[]> {
  const keys: string[] = await kv.keys('ratelimit:login:*');
  if (keys.length === 0) return [];
  const entries = await Promise.all(
    keys.map(async (key) => {
      const data = await kv.get<{ count: number; firstAttempt: number; lockedUntil?: number }>(key);
      const email = key.replace('ratelimit:login:', '');
      return {
        key,
        email,
        count: data?.count ?? 0,
        lockedUntil: data?.lockedUntil,
        firstAttempt: data?.firstAttempt,
      };
    })
  );
  return entries.sort((a, b) => (b.lockedUntil ?? 0) - (a.lockedUntil ?? 0));
}

export async function clearRateLimit(email: string): Promise<void> {
  await kv.del(`ratelimit:login:${email.toLowerCase()}`);
}

export async function clearAllRateLimits(): Promise<number> {
  const keys: string[] = await kv.keys('ratelimit:login:*');
  if (keys.length > 0) await Promise.all(keys.map(k => kv.del(k)));
  return keys.length;
}

// ---- System Stats ----

export interface SystemKeyStats {
  totalKeys: number;
  userDataKeys: number;
  authKeys: number;
  rateLimitKeys: number;
  statsKeys: number;
  otherKeys: number;
}

export async function getSystemKeyStats(): Promise<SystemKeyStats> {
  const allKeys: string[] = await kv.keys('*');
  const userDataKeys = allKeys.filter(k => k.startsWith('user:')).length;
  const authKeys = allKeys.filter(k => k.startsWith('auth:')).length;
  const rateLimitKeys = allKeys.filter(k => k.startsWith('ratelimit:')).length;
  const statsKeys = allKeys.filter(k => k.startsWith('stats:')).length;
  const otherKeys = allKeys.length - userDataKeys - authKeys - rateLimitKeys - statsKeys;
  return { totalKeys: allKeys.length, userDataKeys, authKeys, rateLimitKeys, statsKeys, otherKeys };
}
