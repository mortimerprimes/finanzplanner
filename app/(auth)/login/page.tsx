'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Mail, Lock, Code2, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { DemoStartButton } from '@/components/DemoStartButton';

type View = 'login' | 'reset-request' | 'reset-code' | 'reset-password' | 'reset-done';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('login');
  const router = useRouter();

  const inputClass = "block min-h-11 w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all";
  const btnPrimary = "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Parse custom error messages
      if (result.error.includes('too_many_attempts')) {
        const seconds = result.error.split(':')[1];
        const minutes = Math.ceil(parseInt(seconds || '1800') / 60);
        setError(`Zu viele Versuche. Bitte in ${minutes} Minuten erneut versuchen.`);
      } else if (result.error.includes('no_account_found')) {
        setError('Kein Konto mit dieser Email gefunden. Bitte zuerst registrieren.');
      } else if (result.error.includes('account_locked')) {
        setError('Dein Konto wurde gesperrt. Kontaktiere den Admin.');
      } else {
        setError('Ungültige Anmeldedaten');
      }
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Fehler beim Zurücksetzen');
      } else {
        // Show the code (since no email service configured)
        if (data.code) {
          setDisplayCode(data.code);
        }
        setView('reset-code');
      }
    } catch {
      setError('Netzwerkfehler');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email, code: resetCode, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Fehler beim Zurücksetzen');
      } else {
        setView('reset-done');
      }
    } catch {
      setError('Netzwerkfehler');
    }
    setLoading(false);
  };

  const resetToLogin = () => {
    setView('login');
    setError('');
    setResetCode('');
    setNewPassword('');
    setDisplayCode('');
  };

  // --- Password Reset Views ---
  if (view !== 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-3xl mb-4">
              🔑
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Passwort zurücksetzen</h1>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 space-y-6">
            {view === 'reset-request' && (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-gray-400">
                  Gib deine Email ein, um einen Reset-Code zu erhalten.
                </p>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com" required className={inputClass} />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
                <button type="submit" disabled={loading} className={btnPrimary}>
                  <KeyRound size={16} />
                  {loading ? 'Wird gesendet...' : 'Reset-Code anfordern'}
                </button>
              </form>
            )}

            {view === 'reset-code' && (
              <form onSubmit={(e) => { e.preventDefault(); if (resetCode.length === 6) setView('reset-password'); else setError('Bitte 6-stelligen Code eingeben'); }} className="space-y-4">
                {displayCode && (
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">Dein Reset-Code:</p>
                    <p className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400 mt-1 tracking-widest">{displayCode}</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Gültig für 1 Stunde</p>
                  </div>
                )}
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-stelliger Code" required maxLength={6} className={inputClass} />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
                <button type="submit" className={btnPrimary}>Weiter</button>
              </form>
            )}

            {view === 'reset-password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-gray-400">Wähle ein neues Passwort (min. 8 Zeichen).</p>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Neues Passwort" required minLength={8} className={inputClass} />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
                <button type="submit" disabled={loading || newPassword.length < 8} className={btnPrimary}>
                  <Lock size={16} />
                  {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
                </button>
              </form>
            )}

            {view === 'reset-done' && (
              <div className="text-center space-y-4">
                <CheckCircle2 size={48} className="mx-auto text-green-500" />
                <p className="text-sm text-slate-600 dark:text-gray-400">Dein Passwort wurde erfolgreich geändert.</p>
                <button onClick={resetToLogin} className={btnPrimary}>
                  <LogIn size={16} /> Zur Anmeldung
                </button>
              </div>
            )}

            {view !== 'reset-done' && (
              <button onClick={resetToLogin} className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
                <ArrowLeft size={14} /> Zurück zur Anmeldung
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Login View ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-3xl mb-4">
            💰
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finanzplanner</h1>
          <p className="text-slate-500 dark:text-gray-500 mt-1">Dein persönlicher Finanz-Assistent</p>
        </div>

        {/* Demo CTA */}
        <DemoStartButton className="w-full mb-4 flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/25">
          Demo ausprobieren — echte App mit Beispieldaten
        </DemoStartButton>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 space-y-6">
          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium text-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Code2 size={18} />
              Mit GitHub anmelden
            </button>
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium text-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
            >
              <User size={18} />
              Mit Google anmelden
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-500">
                oder mit Email
              </span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Passwort
                </label>
                <button
                  type="button"
                  onClick={() => { setError(''); setView('reset-request'); }}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Passwort vergessen?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={btnPrimary}
            >
              <LogIn size={16} />
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>

          <p className="text-sm text-center text-slate-500 dark:text-gray-500">
            Noch kein Konto?{' '}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Jetzt registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
