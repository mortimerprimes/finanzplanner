import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoCardlessConnection } from '@/lib/bank-sync';
import type { BankConnectionSyncTarget } from '@/src/types';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    connectionName?: string;
    accountId?: string;
    syncTargets?: BankConnectionSyncTarget[];
    institutionId?: string;
    institutionName?: string;
  };

  if (!body.institutionId || !body.institutionName?.trim()) {
    return NextResponse.json({ error: 'Institution ist erforderlich.' }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await createGoCardlessConnection(session.user.id, {
      connectionName: body.connectionName,
      accountId: body.accountId,
      syncTargets: body.syncTargets,
      institutionId: body.institutionId,
      institutionName: body.institutionName,
      redirectUrl: `${origin}/bank-sync?bankSyncStatus=authorized`,
    });

    return NextResponse.json({
      connection: result.connection,
      redirectUrl: result.redirectUrl,
      state: result.state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GoCardless-Verbindung konnte nicht erstellt werden.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}