import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchGoCardlessInstitutions } from '@/lib/bank-sync';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const country = url.searchParams.get('country') || 'DE';
  const query = url.searchParams.get('query') || '';

  if (!query.trim()) {
    return NextResponse.json({ institutions: [] });
  }

  try {
    const institutions = await searchGoCardlessInstitutions(country, query);
    return NextResponse.json({ institutions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institutionssuche fehlgeschlagen.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}