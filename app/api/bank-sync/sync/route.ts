import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { syncBankConnectionsForUser } from '@/lib/bank-sync';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { connectionId?: string };

  try {
    const result = await syncBankConnectionsForUser(session.user.id, body.connectionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synchronisierung fehlgeschlagen.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}