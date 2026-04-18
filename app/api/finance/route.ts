import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFullState, saveFullState } from '@/lib/kv';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = await getFullState(session.user.id);
  return NextResponse.json(state);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = await request.json();
  await saveFullState(session.user.id, state);
  return NextResponse.json({ ok: true });
}
