import { NextResponse } from 'next/server';
import {
  requireAdmin,
  setUserRole,
  setUserLocked,
  resetUserPassword,
  deleteUserCompletely,
  getUserDataSummary,
} from '@/lib/admin';
import { kv } from '@vercel/kv';
import type { StoredUser } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Find user email by ID (needed for KV operations)
async function findUserEmailById(userId: string): Promise<string | null> {
  const keys: string[] = await kv.keys('auth:user:*');
  for (const key of keys) {
    const user = await kv.get<StoredUser>(key);
    if (user?.id === userId) return user.email;
  }
  return null;
}

// GET /api/admin/users/[id] — get user details + data summary
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const email = await findUserEmailById(id);
    if (!email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = await kv.get<StoredUser>(`auth:user:${email}`);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dataSummary = await getUserDataSummary(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;

    return NextResponse.json({
      user: { ...safeUser, role: (user as StoredUser & { role?: string }).role || 'user' },
      dataSummary,
    });
  } catch (err) {
    console.error('[API/admin/users/id] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id] — update role, lock, or reset password
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const email = await findUserEmailById(id);
    if (!email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-demotion
    if (action === 'setRole' && email === session.user.email && body.role !== 'admin') {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 });
    }

    switch (action) {
      case 'setRole': {
        const role = body.role as 'user' | 'admin';
        if (!['user', 'admin'].includes(role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        await setUserRole(email, role);
        return NextResponse.json({ ok: true, message: `Rolle auf ${role} gesetzt` });
      }

      case 'setLocked': {
        const isLocked = !!body.isLocked;
        // Prevent self-lock
        if (email === session.user.email) {
          return NextResponse.json({ error: 'Cannot lock yourself' }, { status: 400 });
        }
        await setUserLocked(email, isLocked);
        return NextResponse.json({ ok: true, message: isLocked ? 'Benutzer gesperrt' : 'Benutzer entsperrt' });
      }

      case 'resetPassword': {
        const newPassword = await resetUserPassword(email);
        if (!newPassword) {
          return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
        }
        return NextResponse.json({ ok: true, newPassword, message: 'Passwort zurückgesetzt' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[API/admin/users/id] PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — delete user and all data
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const email = await findUserEmailById(id);
    if (!email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-deletion
    if (email === session.user.email) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    await deleteUserCompletely(id, email);
    return NextResponse.json({ ok: true, message: 'Benutzer und alle Daten gelöscht' });
  } catch (err) {
    console.error('[API/admin/users/id] DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
