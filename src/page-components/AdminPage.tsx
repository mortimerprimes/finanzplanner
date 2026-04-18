'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, ShieldOff, Lock, Unlock, Trash2, KeyRound,
  RefreshCw, Search, ChevronDown, ChevronUp, AlertTriangle,
  Database, UserX, Crown, Copy, Check, Eye, EyeOff, X,
} from 'lucide-react';

interface DataSummary {
  key: string;
  label: string;
  count: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isLocked: boolean;
  createdAt: string;
  dataSummary: DataSummary[];
  totalEntries: number;
}

interface Stats {
  totalUsers: number;
  adminCount: number;
  lockedCount: number;
  activeRateLimits: number;
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: string; label: string } | null>(null);
  const [newPassword, setNewPassword] = useState<{ userId: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/stats'),
      ]);

      if (usersRes.status === 403 || statsRes.status === 403) {
        notify('Kein Admin-Zugriff', 'error');
        setLoading(false);
        return;
      }

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      setUsers(usersData.users || []);
      setStats(statsData);
    } catch {
      notify('Fehler beim Laden', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (userId: string, action: string, payload: Record<string, unknown> = {}) => {
    setActionLoading(`${userId}:${action}`);
    setConfirmAction(null);

    try {
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const url = `/api/admin/users/${userId}`;
      const body = action === 'delete' ? undefined : JSON.stringify({ action, ...payload });

      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        notify(data.error || 'Fehler', 'error');
      } else {
        if (action === 'resetPassword' && data.newPassword) {
          setNewPassword({ userId, password: data.newPassword });
        }
        notify(data.message || 'Erfolgreich', 'success');
        fetchData();
      }
    } catch {
      notify('Netzwerkfehler', 'error');
    }

    setActionLoading(null);
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  };

  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500 dark:text-gray-400">Lade Admin-Daten...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Crown size={28} className="text-amber-500" />
            Admin-Zentrale
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Benutzerverwaltung & System-Übersicht</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Benutzer', value: stats.totalUsers, icon: Users, color: 'blue' },
            { label: 'Admins', value: stats.adminCount, icon: Shield, color: 'amber' },
            { label: 'Gesperrt', value: stats.lockedCount, icon: Lock, color: 'red' },
            { label: 'Rate Limits', value: stats.activeRateLimits, icon: AlertTriangle, color: 'orange' },
          ].map((card) => {
            const Icon = card.icon;
            const colorMap: Record<string, string> = {
              blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
              amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
              red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
              orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
            };
            return (
              <div key={card.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${colorMap[card.color]}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">{card.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Benutzer suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
        />
      </div>

      {/* User List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-gray-500">
            <UserX size={40} className="mx-auto mb-3 opacity-50" />
            <p>Keine Benutzer gefunden</p>
          </div>
        ) : (
          filteredUsers
            .sort((a, b) => {
              if (a.role === 'admin' && b.role !== 'admin') return -1;
              if (b.role === 'admin' && a.role !== 'admin') return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .map((user) => {
              const isExpanded = expandedUser === user.id;
              const isActionLoading = (action: string) => actionLoading === `${user.id}:${action}`;

              return (
                <div
                  key={user.id}
                  className={`bg-white dark:bg-gray-900 rounded-2xl border transition-all ${
                    user.isLocked
                      ? 'border-red-200 dark:border-red-900/50'
                      : 'border-slate-200 dark:border-gray-800'
                  }`}
                >
                  {/* User Row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      user.role === 'admin'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        : user.isLocked
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                    }`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                        {user.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 uppercase tracking-wide">
                            <Shield size={10} /> Admin
                          </span>
                        )}
                        {user.isLocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 uppercase tracking-wide">
                            <Lock size={10} /> Gesperrt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>

                    {/* Meta */}
                    <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Database size={12} />
                        {user.totalEntries} Einträge
                      </span>
                      <span>{formatDate(user.createdAt)}</span>
                    </div>

                    {/* Expand */}
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-gray-800 p-4 space-y-4 animate-fade-in">
                      {/* Data Summary */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">Daten-Übersicht</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {user.dataSummary.map((d) => (
                            <div key={d.key} className="bg-slate-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-center">
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{d.count}</p>
                              <p className="text-[10px] text-slate-500 dark:text-gray-400">{d.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">ID</p>
                          <p className="text-gray-900 dark:text-white font-mono text-xs truncate" title={user.id}>{user.id.slice(0, 8)}...</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">Registriert</p>
                          <p className="text-gray-900 dark:text-white">{formatDate(user.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">Rolle</p>
                          <p className="text-gray-900 dark:text-white capitalize">{user.role}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">Status</p>
                          <p className={user.isLocked ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400'}>
                            {user.isLocked ? 'Gesperrt' : 'Aktiv'}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                        {/* Toggle Role */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(user.id, 'setRole', { role: user.role === 'admin' ? 'user' : 'admin' }); }}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 transition-colors disabled:opacity-50"
                        >
                          {isActionLoading('setRole') ? <RefreshCw size={14} className="animate-spin" /> : user.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          {user.role === 'admin' ? 'Zum User' : 'Zum Admin'}
                        </button>

                        {/* Toggle Lock */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(user.id, 'setLocked', { isLocked: !user.isLocked }); }}
                          disabled={!!actionLoading}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 ${
                            user.isLocked
                              ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                        >
                          {isActionLoading('setLocked') ? <RefreshCw size={14} className="animate-spin" /> : user.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                          {user.isLocked ? 'Entsperren' : 'Sperren'}
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmAction({ userId: user.id, action: 'resetPassword', label: `Passwort von ${user.name} zurücksetzen?` }); }}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors disabled:opacity-50"
                        >
                          {isActionLoading('resetPassword') ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
                          Passwort zurücksetzen
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmAction({ userId: user.id, action: 'delete', label: `${user.name} (${user.email}) unwiderruflich löschen?` }); }}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors disabled:opacity-50"
                        >
                          {isActionLoading('delete') ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Löschen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-overlay">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 max-w-sm w-full shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bestätigung</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-gray-300 mb-6">{confirmAction.label}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleAction(confirmAction.userId, confirmAction.action)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Password Display */}
      {newPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-overlay">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 max-w-sm w-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <KeyRound size={20} className="text-blue-500" />
                Neues Passwort
              </h3>
              <button onClick={() => { setNewPassword(null); setShowPassword(false); setCopied(false); }} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
              Dieses Passwort wird nur einmal angezeigt. Bitte sicher notieren!
            </p>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 rounded-xl px-4 py-3">
              <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white">
                {showPassword ? newPassword.password : '••••••••••••'}
              </code>
              <button onClick={() => setShowPassword(!showPassword)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700">
                {showPassword ? <EyeOff size={16} className="text-slate-500" /> : <Eye size={16} className="text-slate-500" />}
              </button>
              <button onClick={() => copyPassword(newPassword.password)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700">
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-500" />}
              </button>
            </div>
            <button
              onClick={() => { setNewPassword(null); setShowPassword(false); setCopied(false); }}
              className="mt-4 w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium animate-fade-in ${
          notification.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {notification.text}
        </div>
      )}
    </div>
  );
}
