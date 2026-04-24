import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createTradeRepublicWebhookConnection } from '@/lib/bank-sync';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    connectionName?: string;
    accountId?: string;
  };

  if (!body.connectionName?.trim() || !body.accountId) {
    return NextResponse.json({ error: 'Verbindungsname und Zielkonto sind erforderlich.' }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await createTradeRepublicWebhookConnection(session.user.id, {
      connectionName: body.connectionName,
      accountId: body.accountId,
      webhookBaseUrl: `${origin}/api/bank-sync/trade-republic`,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trade-Republic-Webhook konnte nicht eingerichtet werden.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}