import { NextResponse } from 'next/server';
import { listAllUsers } from '@/lib/admin';
import { syncBankConnectionsForUser } from '@/lib/bank-sync';

function isAuthorized(request: Request): boolean {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = request.headers.get('x-bank-sync-secret')?.trim();
  const expected = process.env.BANK_SYNC_CRON_SECRET;
  if (!expected) {
    return false;
  }

  return bearer === expected || headerSecret === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await listAllUsers();
  const results = await Promise.all(users.map(async (user) => {
    const sync = await syncBankConnectionsForUser(user.id);
    return {
      userId: user.id,
      connectionResults: sync.results,
    };
  }));

  return NextResponse.json({
    ok: true,
    users: results.length,
    results,
  });
}