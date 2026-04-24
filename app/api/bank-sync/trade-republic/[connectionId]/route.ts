import { NextResponse } from 'next/server';
import { ingestTradeRepublicBalance } from '@/lib/bank-sync';

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const body = await request.json() as {
    balance?: number;
    currency?: string;
    capturedAt?: string;
    note?: string;
  };

  if (!Number.isFinite(body.balance)) {
    return NextResponse.json({ error: 'Ein numerischer balance-Wert ist erforderlich.' }, { status: 400 });
  }

  try {
    const result = await ingestTradeRepublicBalance(connectionId, getBearerToken(request), {
      balance: Number(body.balance),
      currency: body.currency,
      capturedAt: body.capturedAt,
      note: body.note,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trade-Republic-Webhook fehlgeschlagen.';
    const status = /token|authorization/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}