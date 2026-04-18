import { NextResponse } from 'next/server';
import { requireAdmin, listAllUsers } from '@/lib/admin';
import { kv } from '@vercel/kv';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await listAllUsers();
    const userCount = await kv.get<number>('auth:user_count') ?? users.length;

    const adminCount = users.filter(u => u.role === 'admin').length;
    const lockedCount = users.filter(u => u.isLocked).length;

    // Check rate limits
    const rateLimitKeys: string[] = await kv.keys('ratelimit:login:*');

    return NextResponse.json({
      totalUsers: userCount,
      adminCount,
      lockedCount,
      activeRateLimits: rateLimitKeys.length,
      newestUser: users.length > 0
        ? users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null,
    });
  } catch (err) {
    console.error('[API/admin/stats] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
