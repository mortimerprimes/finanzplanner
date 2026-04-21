import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import type { StoredUser } from '@/lib/auth';

const RATE_LIMIT_WINDOW = 900; // 15 minutes
const MAX_SIGNUPS_PER_IP = 3;

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { step, email, name, password, confirmPassword } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Ungültige Email-Adresse' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Ungültige Email-Adresse' }, { status: 400 });
    }

    // ── Step 1: Check if email is available ──────────────────────────
    if (step === 'check-email') {
      const existing = await kv.get(`auth:user:${normalizedEmail}`);
      if (existing) {
        return NextResponse.json({ error: 'Diese Email-Adresse ist bereits registriert' }, { status: 409 });
      }
      return NextResponse.json({ available: true });
    }

    // ── Step 2: Create account ────────────────────────────────────────
    if (step === 'create') {
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json({ error: 'Name muss mindestens 2 Zeichen haben' }, { status: 400 });
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 });
      }
      if (password !== confirmPassword) {
        return NextResponse.json({ error: 'Passwörter stimmen nicht überein' }, { status: 400 });
      }

      // IP-based signup rate limit
      const ip = getClientIp(request);
      const ipKey = `ratelimit:signup:${ip}`;
      const ipCount = await kv.get<number>(ipKey);
      if (ipCount !== null && ipCount >= MAX_SIGNUPS_PER_IP) {
        return NextResponse.json(
          { error: 'Zu viele Registrierungen von dieser IP-Adresse. Bitte warte 15 Minuten.' },
          { status: 429 }
        );
      }

      // Email-level cooldown
      const signupCooldownKey = `signup:cooldown:${normalizedEmail}`;
      if (await kv.get(signupCooldownKey)) {
        return NextResponse.json(
          { error: 'Bitte warte kurz, bevor du dich erneut registrierst.' },
          { status: 429 }
        );
      }

      // Check if email was already taken (race condition guard)
      const existing = await kv.get(`auth:user:${normalizedEmail}`);
      if (existing) {
        return NextResponse.json({ error: 'Diese Email-Adresse ist bereits registriert' }, { status: 409 });
      }

      // User count limit
      const userCount = await kv.get<number>('auth:user_count') ?? 0;
      const maxUsers = parseInt(process.env.MAX_USERS || '100');
      if (userCount >= maxUsers) {
        return NextResponse.json(
          { error: 'Die maximale Benutzeranzahl wurde erreicht.' },
          { status: 403 }
        );
      }

      // Create user
      const hash = await bcrypt.hash(password, 12);
      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: name.trim(),
        password: hash,
        role: 'user',
        createdAt: new Date().toISOString(),
      };

      await kv.set(`auth:user:${normalizedEmail}`, newUser);
      await kv.incr('auth:user_count');

      // Track daily registration for admin stats
      const today = new Date().toISOString().split('T')[0];
      await kv.incr(`stats:registrations:${today}`);

      // Set cooldown + IP rate limit
      await kv.set(signupCooldownKey, 1, { ex: 60 });
      if (ipCount === null) {
        await kv.set(ipKey, 1, { ex: RATE_LIMIT_WINDOW });
      } else {
        await kv.incr(ipKey);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannter Schritt' }, { status: 400 });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
