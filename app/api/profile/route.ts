import { auth } from '@/lib/auth';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { type StoredUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/profile — Get current user profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const userKey = `auth:user:${session.user.email}`;
  const user = await kv.get<StoredUser>(userKey);

  if (!user) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
  }

  // Never return password
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  });
}

// PUT /api/profile — Update profile (name, email, password)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, email: newEmail, currentPassword, newPassword } = body;

    const currentEmail = session.user.email;
    const userKey = `auth:user:${currentEmail}`;
    const user = await kv.get<StoredUser>(userKey);

    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const updates: Partial<StoredUser> = {};

    // Update name
    if (name && name.trim() !== user.name) {
      if (name.trim().length < 2 || name.trim().length > 50) {
        return NextResponse.json({ error: 'Name muss 2-50 Zeichen lang sein' }, { status: 400 });
      }
      updates.name = name.trim();
    }

    // Update email
    if (newEmail && newEmail.toLowerCase().trim() !== currentEmail) {
      const sanitizedEmail = newEmail.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
        return NextResponse.json({ error: 'Ungültige Email-Adresse' }, { status: 400 });
      }

      // Check if email is already taken
      const existingUser = await kv.get(`auth:user:${sanitizedEmail}`);
      if (existingUser) {
        return NextResponse.json({ error: 'Diese Email wird bereits verwendet' }, { status: 409 });
      }

      // Require current password for email change
      if (!currentPassword) {
        return NextResponse.json({ error: 'Aktuelles Passwort erforderlich für Email-Änderung' }, { status: 400 });
      }

      let passwordValid = false;
      if (user.password.startsWith('$2')) {
        passwordValid = await bcrypt.compare(currentPassword, user.password);
      } else {
        passwordValid = user.password === currentPassword;
      }

      if (!passwordValid) {
        return NextResponse.json({ error: 'Falsches Passwort' }, { status: 403 });
      }

      updates.email = sanitizedEmail;
    }

    // Update password
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 });
      }

      // Require current password
      if (!currentPassword) {
        return NextResponse.json({ error: 'Aktuelles Passwort erforderlich für Passwort-Änderung' }, { status: 400 });
      }

      let passwordValid = false;
      if (user.password.startsWith('$2')) {
        passwordValid = await bcrypt.compare(currentPassword, user.password);
      } else {
        passwordValid = user.password === currentPassword;
      }

      if (!passwordValid) {
        return NextResponse.json({ error: 'Falsches Passwort' }, { status: 403 });
      }

      updates.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'Keine Änderungen' });
    }

    const updatedUser = { ...user, ...updates };

    // If email changed, we need to move the user to a new key
    if (updates.email) {
      const newUserKey = `auth:user:${updates.email}`;
      await kv.set(newUserKey, updatedUser);
      await kv.del(userKey);

      // Migrate finance data to new user ID is not needed since we use user.id, not email
    } else {
      await kv.set(userKey, updatedUser);
    }

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      createdAt: updatedUser.createdAt,
    });
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

// DELETE /api/profile — Delete account
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 });
    }

    const userKey = `auth:user:${session.user.email}`;
    const user = await kv.get<StoredUser>(userKey);

    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    let passwordValid = false;
    if (user.password.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      passwordValid = user.password === password;
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 403 });
    }

    // Delete user data
    await kv.del(userKey);

    // Delete finance data
    const entities = [
      'incomes', 'fixedExpenses', 'expenses', 'debts', 'savingsGoals',
      'budgetLimits', 'accounts', 'transfers', 'bankConnections',
      'syncSessions', 'freelanceProjects', 'workSessions', 'freelanceInvoices'
    ];
    for (const entity of entities) {
      await kv.del(`user:${user.id}:${entity}`);
    }
    await kv.del(`user:${user.id}:settings`);
    await kv.decr('auth:user_count');

    return NextResponse.json({ message: 'Konto wurde gelöscht' });
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}
