'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, ArrowRight, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';

type Step = 'email' | 'details' | 'success';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const inputClass =
    'block min-h-11 w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all';
  const btnPrimary =
    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm';

  const passwordStrength = (pw: string) => {
    if (pw.length === 0) return null;
    if (pw.length < 8) return { label: 'Zu kurz', color: 'bg-red-400', width: '25%' };
    if (pw.length < 10 && !/[^a-zA-Z0-9]/.test(pw)) return { label: 'Schwach', color: 'bg-orange-400', width: '50%' };
    if (pw.length >= 12 && /[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: 'Stark', color: 'bg-green-500', width: '100%' };
    return { label: 'Mittel', color: 'bg-yellow-400', width: '75%' };
  };

  const strength = passwordStrength(password);

  // Step 1: Check email availability
  const handleEmailStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'check-email', email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Fehler');
      } else {
        setStep('details');
      }
    } catch {
      setError('Netzwerkfehler');
    }
    setLoading(false);
  };

  // Step 2: Create account
  const handleDetailsStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'create', email, name, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Fehler bei der Registrierung');
      } else {
        setStep('success');
        // Auto sign in after short delay
        setTimeout(async () => {
          await signIn('credentials', { email, password, callbackUrl: '/dashboard' });
        }, 1500);
      }
    } catch {
      setError('Netzwerkfehler');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-3xl mb-4">
            💰
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Konto erstellen</h1>
          <p className="text-slate-500 dark:text-gray-500 mt-1">Kostenlos und ohne Kreditkarte</p>
        </div>

        {/* Step Indicator */}
        {step !== 'success' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {(['email', 'details'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s
                      ? 'bg-blue-600 text-white'
                      : step === 'details' && i === 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400'
                  }`}
                >
                  {step === 'details' && i === 0 ? '✓' : i + 1}
                </div>
                {i === 0 && (
                  <div className={`w-12 h-0.5 ${step === 'details' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6">

          {/* ── Step 1: Email ── */}
          {step === 'email' && (
            <form onSubmit={handleEmailStep} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Schritt 1 von 2</h2>
                <p className="text-sm text-slate-500 dark:text-gray-500">Gib deine Email-Adresse ein.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
              <button type="submit" disabled={loading || !email} className={btnPrimary}>
                {loading ? 'Prüfe Email...' : (
                  <><span>Weiter</span><ArrowRight size={16} /></>
                )}
              </button>
              <p className="text-center text-sm text-slate-500 dark:text-gray-500">
                Bereits registriert?{' '}
                <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Anmelden
                </Link>
              </p>
            </form>
          )}

          {/* ── Step 2: Name + Password ── */}
          {step === 'details' && (
            <form onSubmit={handleDetailsStep} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Schritt 2 von 2</h2>
                <p className="text-sm text-slate-500 dark:text-gray-500">
                  Konto für <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Dein Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Max Mustermann"
                    required
                    minLength={2}
                    autoFocus
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Passwort</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                    required
                    minLength={8}
                    className={inputClass + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {strength && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">{strength.label}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Passwort bestätigen</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    required
                    className={`${inputClass} ${confirmPassword && confirmPassword !== password ? 'border-red-400 focus:border-red-400 focus:ring-red-400/40' : ''}`}
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500 mt-1">Passwörter stimmen nicht überein</p>
                )}
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
              <button
                type="submit"
                disabled={loading || !name || password.length < 8 || password !== confirmPassword}
                className={btnPrimary}
              >
                {loading ? 'Konto wird erstellt...' : 'Konto erstellen'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); }}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <ArrowLeft size={14} /> Zurück
              </button>
            </form>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 size={52} className="mx-auto text-emerald-500" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Willkommen, {name}!</h2>
                <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">Dein Konto wurde erstellt. Du wirst eingeloggt…</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-gray-500">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Weiterleitung…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
