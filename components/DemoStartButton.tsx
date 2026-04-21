'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export function DemoStartButton({ className, children }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/demo/start', { method: 'POST' });
      if (!res.ok) throw new Error('server');
      const { email, password } = await res.json();
      await signIn('credentials', { email, password, callbackUrl: '/dashboard' });
    } catch {
      setError('Demo konnte nicht gestartet werden. Bitte versuche es erneut.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleDemo}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Demo wird vorbereitet…
          </span>
        ) : (
          children ?? 'Demo starten'
        )}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
