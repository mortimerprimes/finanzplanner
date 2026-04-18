import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFullState, saveFullState } from '@/lib/kv';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = await getFullState(session.user.id);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API/finance] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = await request.json();
    await saveFullState(session.user.id, state);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API/finance] PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
