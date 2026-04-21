import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { buildDemoState } from '@/src/utils/demoData';
import type { FinanceState } from '@/src/types';

const DEMO_TTL = 60 * 60 * 24; // 24 hours

export async function POST() {
  try {
    const timestamp = Date.now();
    const email = `demo-${timestamp}@demo.internal`;
    const password = Math.random().toString(36).slice(2, 10);
    const userId = `demo-${timestamp}`;

    const hash = await bcrypt.hash(password, 10);

    // Create temporary user with 24h TTL
    await kv.set(
      `auth:user:${email}`,
      {
        id: userId,
        email,
        name: 'Max Mustermann (Demo)',
        password: hash,
        role: 'user',
        isDemo: true,
        createdAt: new Date().toISOString(),
      },
      { ex: DEMO_TTL }
    );

    // Seed demo data
    const state = buildDemoState();

    const entityKeys = [
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
    ] as const satisfies readonly (keyof FinanceState)[];

    await Promise.all([
      ...entityKeys.map((key) =>
        kv.set(`user:${userId}:${key}`, state[key] ?? [], { ex: DEMO_TTL })
      ),
      kv.set(`user:${userId}:invoiceProfile`, state.invoiceProfile, { ex: DEMO_TTL }),
      kv.set(`user:${userId}:settings`, state.settings, { ex: DEMO_TTL }),
      kv.set(`user:${userId}:selectedMonth`, state.selectedMonth, { ex: DEMO_TTL }),
      kv.set(`user:${userId}:netWorthHistory`, state.netWorthHistory ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:notifications`, state.notifications ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:accountRules`, (state as any).accountRules ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:activityLog`, (state as any).activityLog ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:categoryRules`, (state as any).categoryRules ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:plannedIncomes`, (state as any).plannedIncomes ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:autoBookings`, (state as any).autoBookings ?? [], { ex: DEMO_TTL }),
      kv.set(`user:${userId}:monthCloses`, (state as any).monthCloses ?? [], { ex: DEMO_TTL }),
    ]);

    return NextResponse.json({ email, password });
  } catch (err) {
    console.error('[demo/start]', err);
    return NextResponse.json({ error: 'Fehler beim Erstellen des Demo-Accounts' }, { status: 500 });
  }
}
