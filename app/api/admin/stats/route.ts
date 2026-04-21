import { NextResponse } from 'next/server';
import { requireAdmin, listAllUsers, getDailyRegistrations, getTotalDataEntries, getSystemKeyStats } from '@/lib/admin';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [users, dailyRegistrations, totalDataEntries, systemKeys] = await Promise.all([
      listAllUsers(),
      getDailyRegistrations(30),
      getTotalDataEntries(),
      getSystemKeyStats(),
    ]);

    const adminCount = users.filter(u => u.role === 'admin').length;
    const lockedCount = users.filter(u => u.isLocked).length;
    const sortedByDate = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Week-over-week growth
    const thisWeek = dailyRegistrations.slice(-7).reduce((s, d) => s + d.count, 0);
    const lastWeek = dailyRegistrations.slice(-14, -7).reduce((s, d) => s + d.count, 0);

    return NextResponse.json({
      totalUsers: users.length,
      adminCount,
      lockedCount,
      activeRateLimits: systemKeys.rateLimitKeys,
      totalDataEntries,
      dailyRegistrations,
      thisWeekRegistrations: thisWeek,
      lastWeekRegistrations: lastWeek,
      newestUser: sortedByDate[0] ?? null,
      recentUsers: sortedByDate.slice(0, 5),
      systemKeys,
    });
  } catch (err) {
    console.error('[API/admin/stats] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
