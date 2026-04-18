'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { User, Mail, Lock, Save, Trash2, LogOut, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = "block min-h-11 w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all";

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
      }
    } catch {
      setMessage({ type: 'error', text: 'Profil konnte nicht geladen werden' });
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    // Validate
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      setSaving(false);
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Neues Passwort muss mindestens 8 Zeichen lang sein' });
      setSaving(false);
      return;
    }

    const changes: Record<string, string> = {};
    if (name !== profile?.name) changes.name = name;
    if (email !== profile?.email) changes.email = email;
    if (newPassword) changes.newPassword = newPassword;
    if (currentPassword) changes.currentPassword = currentPassword;

    if ((changes.email || changes.newPassword) && !currentPassword) {
      setMessage({ type: 'error', text: 'Aktuelles Passwort wird für Email- oder Passwort-Änderungen benötigt' });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Fehler beim Speichern' });
      } else {
        setMessage({ type: 'success', text: 'Profil wurde aktualisiert' });
        setProfile(data);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Update the NextAuth session
        await updateSession({ name: data.name, email: data.email });
      }
    } catch {
      setMessage({ type: 'error', text: 'Netzwerkfehler' });
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage({ type: 'error', text: 'Passwort erforderlich zum Löschen' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Fehler beim Löschen' });
      } else {
        await signOut({ callbackUrl: '/login' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Netzwerkfehler' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            Verwalte dein Konto und deine Sicherheitseinstellungen
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          <LogOut size={16} /> Abmelden
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Persönliche Daten</h2>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Dein Name" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com" className={inputClass} />
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">Aktuelles Passwort nötig bei Änderung</p>
          </div>

          {profile?.createdAt && (
            <p className="text-xs text-slate-400 dark:text-gray-600">
              Konto erstellt: {new Date(profile.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Password Change */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Passwort ändern</h2>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Aktuelles Passwort</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Neues Passwort</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type={showNewPw ? 'text' : 'password'} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 Zeichen" minLength={8} className={inputClass} />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Passwort bestätigen</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Passwort wiederholen" className={inputClass} />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwörter stimmen nicht überein</p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
          <Save size={16} />
          {saving ? 'Wird gespeichert...' : 'Änderungen speichern'}
        </button>
      </form>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle size={20} /> Gefahrenzone
        </h2>
        <p className="text-sm text-slate-600 dark:text-gray-400">
          Das Löschen deines Kontos entfernt alle deine Daten unwiderruflich.
        </p>

        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <Trash2 size={16} /> Konto löschen
          </button>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Bist du sicher? Gib dein Passwort ein:</p>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Passwort bestätigen"
                className="block min-h-11 w-full rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-red-300 dark:placeholder-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleDeleteAccount} disabled={saving || !deletePassword}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                <Trash2 size={16} /> Endgültig löschen
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
