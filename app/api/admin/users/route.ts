import { NextResponse } from 'next/server';
import { requireAdmin, listAllUsers, getUserDataSummary } from '@/lib/admin';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await listAllUsers();

    // Fetch data summaries in parallel
    const usersWithData = await Promise.all(
      users.map(async (user) => {
        const dataSummary = await getUserDataSummary(user.id);
        const totalEntries = dataSummary.reduce((sum, d) => sum + d.count, 0);
        return { ...user, dataSummary, totalEntries };
      })
    );

    return NextResponse.json({ users: usersWithData });
  } catch (err) {
    console.error('[API/admin/users] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
