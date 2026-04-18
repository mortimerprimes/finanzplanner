import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEntities, setEntities, getObject, setObject } from '@/lib/kv';

const VALID_ENTITIES = [
  'incomes', 'fixedExpenses', 'expenses', 'debts', 'savingsGoals',
  'budgetLimits', 'accounts', 'transfers', 'bankConnections',
  'syncSessions', 'freelanceProjects', 'workSessions', 'freelanceInvoices',
];

const VALID_OBJECTS = ['invoiceProfile', 'settings'];

type EntityKey = 'incomes' | 'fixedExpenses' | 'expenses' | 'debts' | 'savingsGoals' | 'budgetLimits' | 'accounts' | 'transfers' | 'bankConnections' | 'syncSessions' | 'freelanceProjects' | 'workSessions' | 'freelanceInvoices';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entity } = await params;

  if (VALID_ENTITIES.includes(entity)) {
    const data = await getEntities(session.user.id, entity as EntityKey);
    return NextResponse.json(data);
  }

  if (VALID_OBJECTS.includes(entity)) {
    const data = await getObject(session.user.id, entity, {});
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entity } = await params;
  const data = await request.json();

  if (VALID_ENTITIES.includes(entity)) {
    await setEntities(session.user.id, entity as EntityKey, data);
    return NextResponse.json({ ok: true });
  }

  if (VALID_OBJECTS.includes(entity)) {
    await setObject(session.user.id, entity, data);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
}
