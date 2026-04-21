import { NextResponse } from 'next/server';
import { requireAdmin, getRateLimits, clearRateLimit, clearAllRateLimits, getSystemKeyStats } from '@/lib/admin';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [rateLimits, systemKeys] = await Promise.all([
      getRateLimits(),
      getSystemKeyStats(),
    ]);

    return NextResponse.json({ rateLimits, systemKeys });
  } catch (err) {
    console.error('[API/admin/system] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (email) {
      // Clear specific rate limit
      await clearRateLimit(email);
      return NextResponse.json({ ok: true, message: `Rate limit für ${email} gelöscht` });
    } else {
      // Clear all rate limits
      const cleared = await clearAllRateLimits();
      return NextResponse.json({ ok: true, message: `${cleared} Rate Limits gelöscht`, cleared });
    }
  } catch (err) {
    console.error('[API/admin/system] DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
