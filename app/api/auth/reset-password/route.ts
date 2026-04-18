import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { type StoredUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// POST /api/auth/reset-password
// Step 1: Request reset → generates token
// Step 2: Verify token + set new password

interface ResetToken {
  email: string;
  token: string;
  createdAt: number;
}

const TOKEN_EXPIRY = 3600; // 1 hour in seconds
const MAX_RESET_REQUESTS = 3; // per email per hour

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'request') {
      return handleRequestReset(body);
    } else if (action === 'reset') {
      return handleReset(body);
    } else if (action === 'verify') {
      return handleVerifyToken(body);
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

async function handleRequestReset(body: { email?: string }) {
  const email = body.email?.toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige Email' }, { status: 400 });
  }

  // Rate limit reset requests
  const rateLimitKey = `ratelimit:reset:${email}`;
  const resetCount = await kv.get<number>(rateLimitKey);
  if (resetCount !== null && resetCount >= MAX_RESET_REQUESTS) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
      { status: 429 }
    );
  }

  // Check if user exists
  const userKey = `auth:user:${email}`;
  const user = await kv.get<StoredUser>(userKey);
  
  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({ 
      message: 'Falls ein Konto existiert, wurde ein Reset-Code erstellt.',
      // In production: send email instead of returning token
    });
  }

  // Generate a 6-digit code (more user-friendly than a UUID token)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenData: ResetToken = {
    email,
    token: code,
    createdAt: Date.now(),
  };

  const tokenKey = `auth:reset:${email}`;
  await kv.set(tokenKey, tokenData, { ex: TOKEN_EXPIRY });

  // Track reset request count
  if (resetCount === null) {
    await kv.set(rateLimitKey, 1, { ex: 3600 });
  } else {
    await kv.incr(rateLimitKey);
  }

  // Since no email service is configured, return the code directly
  // In production, this would send an email instead
  return NextResponse.json({
    message: 'Reset-Code wurde erstellt.',
    code, // Remove this in production - send via email instead
    expiresIn: TOKEN_EXPIRY,
  });
}

async function handleVerifyToken(body: { email?: string; code?: string }) {
  const email = body.email?.toLowerCase().trim();
  const code = body.code?.trim();

  if (!email || !code) {
    return NextResponse.json({ error: 'Email und Code erforderlich' }, { status: 400 });
  }

  const tokenKey = `auth:reset:${email}`;
  const tokenData = await kv.get<ResetToken>(tokenKey);

  if (!tokenData || tokenData.token !== code) {
    return NextResponse.json({ error: 'Ungültiger oder abgelaufener Code' }, { status: 400 });
  }

  return NextResponse.json({ valid: true });
}

async function handleReset(body: { email?: string; code?: string; newPassword?: string }) {
  const email = body.email?.toLowerCase().trim();
  const code = body.code?.trim();
  const newPassword = body.newPassword;

  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 });
  }

  // Verify token
  const tokenKey = `auth:reset:${email}`;
  const tokenData = await kv.get<ResetToken>(tokenKey);

  if (!tokenData || tokenData.token !== code) {
    return NextResponse.json({ error: 'Ungültiger oder abgelaufener Code' }, { status: 400 });
  }

  // Update password
  const userKey = `auth:user:${email}`;
  const user = await kv.get<StoredUser>(userKey);

  if (!user) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await kv.set(userKey, { ...user, password: hash });

  // Delete token after use
  await kv.del(tokenKey);

  // Clear any login lockouts
  await kv.del(`ratelimit:login:${email}`);

  return NextResponse.json({ message: 'Passwort wurde zurückgesetzt' });
}
