import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { kv } from '@vercel/kv';

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

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Check if user exists in KV
        const userKey = `auth:user:${email}`;
        const existingUser = await kv.get<{
          id: string;
          email: string;
          name: string;
          password: string;
        }>(userKey);

        if (existingUser) {
          // Simple password check (in production use bcrypt)
          if (existingUser.password === password) {
            return {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
            };
          }
          return null;
        }

        // Auto-register new users
        const newUser = {
          id: crypto.randomUUID(),
          email,
          name: email.split('@')[0],
          password,
        };
        await kv.set(userKey, newUser);

        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
});
