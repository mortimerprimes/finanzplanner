import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

// --- Rate Limiting & Brute Force Protection ---

const RATE_LIMIT_WINDOW = 900; // 15 minutes in seconds
const MAX_LOGIN_ATTEMPTS = 5; // per email
const MAX_SIGNUPS_PER_IP = 3; // per IP per window
const LOCKOUT_DURATION = 1800; // 30 minutes in seconds

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

async function checkLoginRateLimit(email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `ratelimit:login:${email.toLowerCase()}`;
  const data = await kv.get<LoginAttempt>(key);
  const now = Math.floor(Date.now() / 1000);

  if (!data) return { allowed: true };

  // Check lockout
  if (data.lockedUntil && now < data.lockedUntil) {
    return { allowed: false, retryAfter: data.lockedUntil - now };
  }

  // Reset if window expired
  if (now - data.firstAttempt > RATE_LIMIT_WINDOW) return { allowed: true };

  // Check attempts
  if (data.count >= MAX_LOGIN_ATTEMPTS) {
    // Lock the account
    await kv.set(key, { ...data, lockedUntil: now + LOCKOUT_DURATION }, { ex: LOCKOUT_DURATION });
    return { allowed: false, retryAfter: LOCKOUT_DURATION };
  }

  return { allowed: true };
}

async function recordFailedLogin(email: string): Promise<void> {
  const key = `ratelimit:login:${email.toLowerCase()}`;
  const data = await kv.get<LoginAttempt>(key);
  const now = Math.floor(Date.now() / 1000);

  if (!data || now - data.firstAttempt > RATE_LIMIT_WINDOW) {
    await kv.set(key, { count: 1, firstAttempt: now }, { ex: RATE_LIMIT_WINDOW });
  } else {
    const newCount = data.count + 1;
    const ttl = RATE_LIMIT_WINDOW - (now - data.firstAttempt);
    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      await kv.set(key, { ...data, count: newCount, lockedUntil: now + LOCKOUT_DURATION }, { ex: LOCKOUT_DURATION });
    } else {
      await kv.set(key, { ...data, count: newCount }, { ex: ttl > 0 ? ttl : RATE_LIMIT_WINDOW });
    }
  }
}

async function clearLoginAttempts(email: string): Promise<void> {
  await kv.del(`ratelimit:login:${email.toLowerCase()}`);
}

async function checkSignupRateLimit(ip: string): Promise<boolean> {
  const key = `ratelimit:signup:${ip}`;
  const count = await kv.get<number>(key);
  if (count !== null && count >= MAX_SIGNUPS_PER_IP) return false;
  return true;
}

async function recordSignup(ip: string): Promise<void> {
  const key = `ratelimit:signup:${ip}`;
  const count = await kv.get<number>(key);
  if (count === null) {
    await kv.set(key, 1, { ex: RATE_LIMIT_WINDOW });
  } else {
    await kv.incr(key);
  }
}

// --- User Type ---

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  password: string; // bcrypt hash
  role?: 'user' | 'admin';
  isLocked?: boolean;
  createdAt: string;
}

// --- NextAuth Config ---

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

        // Check rate limit
        const rateLimit = await checkLoginRateLimit(email);
        if (!rateLimit.allowed) {
          throw new Error(`too_many_attempts:${rateLimit.retryAfter}`);
        }

        const userKey = `auth:user:${email}`;
        const existingUser = await kv.get<StoredUser>(userKey);

        if (existingUser) {
          // Check if account is locked
          if (existingUser.isLocked) {
            throw new Error('account_locked');
          }

          // Check password with bcrypt
          // Support migration from plaintext: if hash doesn't start with $2, it's plaintext
          let valid = false;
          if (existingUser.password.startsWith('$2')) {
            valid = await bcrypt.compare(password, existingUser.password);
          } else {
            // Legacy plaintext comparison + migrate to bcrypt
            valid = existingUser.password === password;
            if (valid) {
              const hash = await bcrypt.hash(password, 12);
              await kv.set(userKey, { ...existingUser, password: hash });
            }
          }

          if (valid) {
            await clearLoginAttempts(email);
            return {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              role: existingUser.role || 'user',
            };
          }

          await recordFailedLogin(email);
          return null;
        }

        // No user found — registration must go through the dedicated /register page
        throw new Error('no_account_found');
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as { role?: string }).role || 'user';
      }
      // Env-based admin override
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (token.email && adminEmails.includes(token.email.toLowerCase())) {
        token.role = 'admin';
      }
      // Allow updating session from client
      if (trigger === 'update' && session) {
        if (session.name) token.name = session.name;
        if (session.email) token.email = session.email;
        if (session.role) token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as { role: string }).role = (token.role as string) || 'user';
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
