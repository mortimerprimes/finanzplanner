'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, ShieldOff, Lock, Unlock, Trash2, KeyRound,
  RefreshCw, Search, AlertTriangle, Database, Crown,
  Copy, Check, Eye, EyeOff, X, BarChart2, Settings2,
  TrendingUp, TrendingDown, Activity, ServerCrash, ShieldCheck,
  UserPlus, ChevronDown, ChevronUp, Minus, ArrowUpRight,
} from 'lucide-react';

// ---- Types ----

interface DataSummary { key: string; label: string; count: number; }
interface AdminUser {
  id: string; email: string; name: string; role: string;
  isLocked: boolean; createdAt: string;
  dataSummary: DataSummary[]; totalEntries: number;
}
interface DailyReg { date: string; count: number; }
interface SystemKeyStats {
  totalKeys: number; userDataKeys: number; authKeys: number;
  rateLimitKeys: number; statsKeys: number; otherKeys: number;
}
interface OverviewStats {
  totalUsers: number; adminCount: number; lockedCount: number;
  activeRateLimits: number; totalDataEntries: number;
  dailyRegistrations: DailyReg[];
  thisWeekRegistrations: number; lastWeekRegistrations: number;
  recentUsers: AdminUser[];
  systemKeys: SystemKeyStats;
}
interface RateLimitEntry { key: string; email: string; count: number; lockedUntil?: number; }

type Tab = 'overview' | 'users' | 'system';

// ---- Mini bar chart (SVG, no external lib) ----

function MiniBarChart({ data, height = 80 }: { data: DailyReg[]; height?: number }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const barW = 100 / data.length;
  const today = new Date().toISOString().split('T')[0];
  const showEvery = Math.ceil(data.length / 7);
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const barH = (d.count / max) * (height - 16);
        const x = i * barW;
        const y = height - 16 - barH;
        const isToday = d.date === today;
        return (
          <g key={d.date}>
            <rect x={x + barW * 0.1} y={y} width={barW * 0.8} height={barH || 1} rx={1.5}
              className={isToday ? 'fill-blue-500' : 'fill-blue-300 dark:fill-blue-700'}
              opacity={d.count === 0 ? 0.3 : 1} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize={5} className="fill-gray-500 dark:fill-gray-400">{d.count}</text>
            )}
            {i % showEvery === 0 && (
              <text x={x + barW / 2} y={height - 3} textAnchor="middle" fontSize={4.5} className="fill-gray-400">{d.date.slice(5)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Donut chart (SVG) ----

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  let cumAngle = -Math.PI / 2;
  const r = 40; const cx = 50; const cy = 50; const innerR = 25;
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32">
      {segments.map((seg) => {
        const angle = (seg.value / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(cumAngle); const y1 = cy + r * Math.sin(cumAngle);
        cumAngle += angle;
        const x2 = cx + r * Math.cos(cumAngle); const y2 = cy + r * Math.sin(cumAngle);
        const xi1 = cx + innerR * Math.cos(cumAngle); const yi1 = cy + innerR * Math.sin(cumAngle);
        const xi2 = cx + innerR * Math.cos(cumAngle - angle); const yi2 = cy + innerR * Math.sin(cumAngle - angle);
        const large = angle > Math.PI ? 1 : 0;
        if (seg.value === 0) return null;
        return (
          <path key={seg.label}
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`}
            fill={seg.color} />
        );
      })}
      <circle cx={cx} cy={cy} r={innerR - 1} className="fill-white dark:fill-gray-900" />
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize={9} fontWeight="bold" className="fill-gray-700 dark:fill-gray-200">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={5} className="fill-gray-400">Keys</text>
    </svg>
  );
}

// ---- Stat card ----

function StatCard({ label, value, icon: Icon, color, sub, trend }: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-5">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${colorMap[color]}`}><Icon size={20} /></div>
        {trend === 'up' && <TrendingUp size={14} className="text-green-500" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
        {trend === 'neutral' && <Minus size={14} className="text-slate-400" />}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-4 tabular-nums">{value}</p>
      <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ---- Main component ----

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitEntry[]>([]);
  const [systemKeys, setSystemKeys] = useState<SystemKeyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'admin' | 'locked' | 'active'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'registered' | 'entries'>('registered');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
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

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.status === 403) { notify('Kein Admin-Zugriff', 'error'); return; }
      setStats(await res.json());
    } catch { notify('Fehler beim Laden', 'error'); }
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403) { notify('Kein Admin-Zugriff', 'error'); return; }
      const data = await res.json();
      setUsers(data.users || []);
    } catch { notify('Fehler beim Laden', 'error'); }
    setLoading(false);
  }, []);

  const fetchSystem = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system');
      if (res.status === 403) { notify('Kein Admin-Zugriff', 'error'); return; }
      const data = await res.json();
      setRateLimits(data.rateLimits || []);
      setSystemKeys(data.systemKeys || null);
    } catch { notify('Fehler beim Laden', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'system') fetchSystem();
  }, [activeTab, fetchOverview, fetchUsers, fetchSystem]);

  const handleAction = async (userId: string, action: string, payload: Record<string, unknown> = {}) => {
    setActionLoading(`${userId}:${action}`);
    setConfirmAction(null);
    try {
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const url = `/api/admin/users/${userId}`;
      const body = action === 'delete' ? undefined : JSON.stringify({ action, ...payload });
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Fehler', 'error');
      } else {
        if (action === 'resetPassword' && data.newPassword) setNewPassword({ userId, password: data.newPassword });
        notify(data.message || 'Erfolgreich', 'success');
        fetchUsers();
      }
    } catch { notify('Netzwerkfehler', 'error'); }
    setActionLoading(null);
  };

  const handleClearRateLimit = async (email?: string) => {
    setActionLoading(`rl:${email ?? 'all'}`);
    try {
      const url = email ? `/api/admin/system?email=${encodeURIComponent(email)}` : '/api/admin/system';
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { notify(data.message, 'success'); fetchSystem(); }
      else notify(data.error || 'Fehler', 'error');
    } catch { notify('Netzwerkfehler', 'error'); }
    setActionLoading(null);
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return iso; }
  };
  const formatDateTime = (iso: string) => {
    try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };
  const formatLockout = (ts?: number) => {
    if (!ts) return null;
    const now = Math.floor(Date.now() / 1000);
    if (ts < now) return 'Abgelaufen';
    return `Noch ${Math.floor((ts - now) / 60)}min gesperrt`;
  };
  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw); setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const filteredUsers = users
    .filter(u => {
      const q = search.toLowerCase();
      if (q && !u.email.toLowerCase().includes(q) && !u.name.toLowerCase().includes(q)) return false;
      if (userFilter === 'admin') return u.role === 'admin';
      if (userFilter === 'locked') return u.isLocked;
      if (userFilter === 'active') return !u.isLocked;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'email') cmp = a.email.localeCompare(b.email);
      else if (sortBy === 'registered') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortBy === 'entries') cmp = a.totalEntries - b.totalEntries;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col
      ? sortDir === 'asc' ? <ChevronUp size={13} className="inline ml-0.5" /> : <ChevronDown size={13} className="inline ml-0.5" />
      : <ChevronDown size={13} className="inline ml-0.5 opacity-30" />;

  const weekGrowth: 'up' | 'down' | 'neutral' = stats
    ? stats.lastWeekRegistrations === 0
      ? stats.thisWeekRegistrations > 0 ? 'up' : 'neutral'
      : stats.thisWeekRegistrations >= stats.lastWeekRegistrations ? 'up' : 'down'
    : 'neutral';

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Übersicht', icon: BarChart2 },
    { id: 'users', label: 'Benutzer', icon: Users },
    { id: 'system', label: 'System', icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Crown size={28} className="text-amber-500" />Admin-Zentrale
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Vollständige Kontrolle über alle Nutzer & Systemdaten</p>
        </div>
        <button
          onClick={() => { if (activeTab === 'overview') fetchOverview(); else if (activeTab === 'users') fetchUsers(); else fetchSystem(); }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Aktualisieren
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="-mx-1 flex w-auto gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 px-1 pb-1 dark:bg-gray-800 sm:mx-0 sm:w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              <Icon size={15} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading && !stats ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw size={24} className="animate-spin text-blue-500" /><span className="ml-3 text-slate-500">Lade Statistiken...</span>
            </div>
          ) : stats ? (
            <>
              {/* 6 metric cards */}
              <div className="grid grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="Nutzer gesamt" value={stats.totalUsers} icon={Users} color="blue" />
                <StatCard label="Diese Woche" value={stats.thisWeekRegistrations} icon={UserPlus} color="green"
                  sub={`Letzte Woche: ${stats.lastWeekRegistrations}`} trend={weekGrowth} />
                <StatCard label="Admins" value={stats.adminCount} icon={Shield} color="amber" />
                <StatCard label="Gesperrt" value={stats.lockedCount} icon={Lock} color="red"
                  sub={stats.lockedCount > 0 ? 'Accounts blockiert' : 'Keine gesperrten'} />
                <StatCard label="Rate Limits" value={stats.activeRateLimits} icon={AlertTriangle} color="violet" sub="Aktive Login-Limits" />
                <StatCard label="Datensätze" value={stats.totalDataEntries.toLocaleString('de-DE')} icon={Database} color="slate" sub="Alle Nutzer zusammen" />
              </div>

              {/* Registration chart */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Registrierungen — letzte 30 Tage</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Neue Nutzer pro Tag (blau = heute)</p>
                  </div>
                  {weekGrowth === 'up' && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium text-xs bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full">
                      <TrendingUp size={12} /> +{stats.thisWeekRegistrations - stats.lastWeekRegistrations} ggü. Vorwoche
                    </span>
                  )}
                  {weekGrowth === 'down' && (
                    <span className="flex items-center gap-1 text-red-500 font-medium text-xs bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full">
                      <TrendingDown size={12} /> {stats.thisWeekRegistrations - stats.lastWeekRegistrations} ggü. Vorwoche
                    </span>
                  )}
                </div>
                <MiniBarChart data={stats.dailyRegistrations} height={110} />
              </div>

              {/* Bottom 2-col */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent users */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" />Neueste Registrierungen
                  </h3>
                  <div className="space-y-3">
                    {stats.recentUsers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Keine Nutzer</p>}
                    {stats.recentUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          u.role === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>{u.name.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-400">{formatDateTime(u.createdAt)}</p>
                          {u.role === 'admin' && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">ADMIN</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveTab('users')} className="mt-4 w-full text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1">
                    Alle Nutzer anzeigen <ArrowUpRight size={12} />
                  </button>
                </div>

                {/* System health */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ServerCrash size={16} className="text-violet-500" />System Health
                  </h3>
                  {stats.systemKeys && (
                    <>
                      <div className="mb-4 flex flex-col gap-6 sm:flex-row sm:items-center">
                        <DonutChart segments={[
                          { label: 'User Data', value: stats.systemKeys.userDataKeys, color: '#3b82f6' },
                          { label: 'Auth', value: stats.systemKeys.authKeys, color: '#f59e0b' },
                          { label: 'Rate Limits', value: stats.systemKeys.rateLimitKeys, color: '#ef4444' },
                          { label: 'Sonstiges', value: stats.systemKeys.otherKeys + stats.systemKeys.statsKeys, color: '#8b5cf6' },
                        ]} />
                        <div className="space-y-2 flex-1">
                          {[
                            { l: 'User Data', v: stats.systemKeys.userDataKeys, c: 'bg-blue-500' },
                            { l: 'Auth', v: stats.systemKeys.authKeys, c: 'bg-amber-500' },
                            { l: 'Rate Limits', v: stats.systemKeys.rateLimitKeys, c: 'bg-red-500' },
                            { l: 'Sonstiges', v: stats.systemKeys.otherKeys + stats.systemKeys.statsKeys, c: 'bg-violet-500' },
                          ].map(s => (
                            <div key={s.l} className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${s.c}`} />
                              <span className="text-xs text-slate-600 dark:text-gray-300">{s.l}</span>
                              <span className="ml-auto font-mono text-xs text-gray-900 dark:text-white">{s.v}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-100 dark:border-gray-800 pt-1 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">Gesamt</span>
                            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">{stats.systemKeys.totalKeys}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                        <ShieldCheck size={14} className="text-green-600 dark:text-green-400" />
                        <span className="text-xs text-green-700 dark:text-green-400 font-medium">System betriebsbereit</span>
                      </div>
                    </>
                  )}
                  <button onClick={() => setActiveTab('system')} className="mt-4 w-full text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center justify-center gap-1">
                    System verwalten <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Name oder E-Mail suchen..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 px-1 dark:bg-gray-800 sm:mx-0">
              {(['all', 'admin', 'locked', 'active'] as const).map(f => (
                <button key={f} onClick={() => setUserFilter(f)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${userFilter === f ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}>
                  {{ all: 'Alle', admin: 'Admins', locked: 'Gesperrt', active: 'Aktiv' }[f]}
                  <span className="ml-1 opacity-50 text-[10px]">
                    {f === 'all' ? users.length : f === 'admin' ? users.filter(u => u.role === 'admin').length : f === 'locked' ? users.filter(u => u.isLocked).length : users.filter(u => !u.isLocked).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={22} className="animate-spin text-blue-500" /><span className="ml-3 text-slate-500">Lade Benutzer...</span>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[2fr_2fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('name')} className="text-left hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Name <SortIcon col="name" /></button>
                <button onClick={() => toggleSort('email')} className="text-left hover:text-gray-700 dark:hover:text-gray-200 transition-colors">E-Mail <SortIcon col="email" /></button>
                <span className="text-center">Rolle</span>
                <button onClick={() => toggleSort('entries')} className="text-right hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Einträge <SortIcon col="entries" /></button>
                <button onClick={() => toggleSort('registered')} className="text-right hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Registriert <SortIcon col="registered" /></button>
                <span />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Keine Benutzer gefunden</div>
              ) : filteredUsers.map(user => {
                const isExpanded = expandedUser === user.id;
                const isAL = (a: string) => actionLoading === `${user.id}:${a}`;
                return (
                  <div key={user.id} className={`border-b border-slate-100 dark:border-gray-800 last:border-0 ${user.isLocked ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                    {/* Row */}
                    <div className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_2fr_auto_auto_auto_auto] gap-4 px-5 py-4 items-center cursor-pointer hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors"
                      onClick={() => setExpandedUser(isExpanded ? null : user.id)}>
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                          user.role === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : user.isLocked ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>{user.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate md:hidden">{user.email}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {user.isLocked && <span className="text-[10px] font-semibold text-red-500">GESPERRT</span>}
                            {user.role === 'admin' && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 md:hidden">ADMIN</span>}
                          </div>
                        </div>
                      </div>
                      {/* Email — hidden on mobile */}
                      <p className="hidden md:block text-sm text-slate-500 dark:text-gray-400 truncate">{user.email}</p>
                      {/* Role badge */}
                      <div className="hidden md:flex justify-center">
                        {user.role === 'admin'
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 uppercase"><Shield size={9} /> Admin</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400">User</span>
                        }
                      </div>
                      <p className="hidden md:block text-sm font-mono text-right text-gray-700 dark:text-gray-300">{user.totalEntries}</p>
                      <p className="hidden md:block text-xs text-right text-slate-500">{formatDate(user.createdAt)}</p>
                      <div className="flex justify-end">{isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}</div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/20">
                        {/* Data breakdown */}
                        <div className="pt-4">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Datenübersicht</h4>
                          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-11 gap-2">
                            {user.dataSummary.map(d => (
                              <div key={d.key} className="bg-white dark:bg-gray-900 rounded-xl px-2 py-2.5 text-center border border-slate-100 dark:border-gray-700">
                                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{d.count}</p>
                                <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{d.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Meta */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { k: 'ID', v: user.id.slice(0, 12) + '…', mono: true },
                            { k: 'Registriert', v: formatDateTime(user.createdAt) },
                            { k: 'Rolle', v: user.role },
                            { k: 'Status', v: user.isLocked ? '🔒 Gesperrt' : '✓ Aktiv' },
                          ].map(item => (
                            <div key={item.k} className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-slate-100 dark:border-gray-700">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{item.k}</p>
                              <p className={`text-xs font-medium truncate ${item.mono ? 'font-mono' : ''} ${item.k === 'Status' ? (user.isLocked ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-700 dark:text-gray-300'}`}>{item.v}</p>
                            </div>
                          ))}
                        </div>
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button onClick={e => { e.stopPropagation(); handleAction(user.id, 'setRole', { role: user.role === 'admin' ? 'user' : 'admin' }); }}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 transition-colors disabled:opacity-50">
                            {isAL('setRole') ? <RefreshCw size={13} className="animate-spin" /> : user.role === 'admin' ? <ShieldOff size={13} /> : <Shield size={13} />}
                            {user.role === 'admin' ? 'Zum User machen' : 'Zum Admin machen'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleAction(user.id, 'setLocked', { isLocked: !user.isLocked }); }}
                            disabled={!!actionLoading}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 border ${
                              user.isLocked ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-900/40'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 border-slate-200 dark:border-gray-700'}`}>
                            {isAL('setLocked') ? <RefreshCw size={13} className="animate-spin" /> : user.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                            {user.isLocked ? 'Entsperren' : 'Sperren'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmAction({ userId: user.id, action: 'resetPassword', label: `Passwort von ${user.name} zurücksetzen?` }); }}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 transition-colors disabled:opacity-50">
                            {isAL('resetPassword') ? <RefreshCw size={13} className="animate-spin" /> : <KeyRound size={13} />}
                            Passwort zurücksetzen
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmAction({ userId: user.id, action: 'delete', label: `${user.name} (${user.email}) und ALLE Daten unwiderruflich löschen?` }); }}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition-colors disabled:opacity-50">
                            {isAL('delete') ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            Nutzer löschen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== SYSTEM TAB ===== */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {loading && !systemKeys ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={22} className="animate-spin text-blue-500" /><span className="ml-3 text-slate-500">Lade Systemdaten...</span>
            </div>
          ) : (
            <>
              {/* KV storage overview */}
              {systemKeys && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <Database size={16} className="text-blue-500" />KV-Speicher Übersicht
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start gap-8">
                    <DonutChart segments={[
                      { label: 'User Data', value: systemKeys.userDataKeys, color: '#3b82f6' },
                      { label: 'Auth', value: systemKeys.authKeys, color: '#f59e0b' },
                      { label: 'Rate Limits', value: systemKeys.rateLimitKeys, color: '#ef4444' },
                      { label: 'Stats', value: systemKeys.statsKeys, color: '#10b981' },
                      { label: 'Sonstiges', value: systemKeys.otherKeys, color: '#8b5cf6' },
                    ]} />
                    <div className="flex-1 space-y-3 w-full">
                      {[
                        { label: 'Nutzerdaten', val: systemKeys.userDataKeys, color: 'bg-blue-500', desc: 'Einnahmen, Ausgaben, Ziele ...' },
                        { label: 'Auth-Daten', val: systemKeys.authKeys, color: 'bg-amber-500', desc: 'User-Profile, Sessions' },
                        { label: 'Rate Limits', val: systemKeys.rateLimitKeys, color: 'bg-red-500', desc: 'Login-Begrenzungen' },
                        { label: 'Statistiken', val: systemKeys.statsKeys, color: 'bg-emerald-500', desc: 'Registrierungen, Zähler' },
                        { label: 'Sonstiges', val: systemKeys.otherKeys, color: 'bg-violet-500', desc: 'Sonstige Keys' },
                      ].map(s => {
                        const pct = systemKeys.totalKeys > 0 ? Math.round((s.val / systemKeys.totalKeys) * 100) : 0;
                        return (
                          <div key={s.label}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span>
                                <span className="text-xs text-slate-400 hidden sm:inline">— {s.desc}</span>
                              </div>
                              <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{s.val} <span className="text-slate-400 font-normal text-xs">({pct}%)</span></span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Gesamt</span>
                        <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">{systemKeys.totalKeys} Keys</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate limits manager */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" />Rate Limits
                    {rateLimits.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">{rateLimits.length}</span>
                    )}
                  </h3>
                  {rateLimits.length > 0 && (
                    <button onClick={() => handleClearRateLimit()} disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition-colors disabled:opacity-50">
                      {actionLoading === 'rl:all' ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Alle löschen
                    </button>
                  )}
                </div>
                {rateLimits.length === 0 ? (
                  <div className="text-center py-10">
                    <ShieldCheck size={36} className="mx-auto text-green-400 mb-3" />
                    <p className="text-sm text-slate-400">Keine aktiven Rate Limits — alles sauber</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rateLimits.map(rl => {
                      const lockInfo = formatLockout(rl.lockedUntil);
                      const isLocked = rl.lockedUntil && rl.lockedUntil > Math.floor(Date.now() / 1000);
                      return (
                        <div key={rl.key} className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${
                          isLocked ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{rl.email}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-500">{rl.count} Fehlversuche</span>
                              {lockInfo && <span className={`text-xs font-medium ${isLocked ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{lockInfo}</span>}
                            </div>
                          </div>
                          <button onClick={() => handleClearRateLimit(rl.email)} disabled={!!actionLoading}
                            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 transition-colors disabled:opacity-50">
                            {actionLoading === `rl:${rl.email}` ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                            Aufheben
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== CONFIRM DIALOG ===== */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(var(--safe-area-bottom)+1.25rem)] shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 flex-shrink-0 mt-0.5"><AlertTriangle size={20} /></div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Bestätigung erforderlich</h3>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">{confirmAction.label}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">Abbrechen</button>
              <button onClick={() => handleAction(confirmAction.userId, confirmAction.action)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Bestätigen</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW PASSWORD MODAL ===== */}
      {newPassword && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(var(--safe-area-bottom)+1.25rem)] shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"><KeyRound size={20} /></div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Neues Passwort</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">Jetzt sicher notieren und dem Nutzer mitteilen:</p>
            <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-gray-800 rounded-xl mb-4">
              <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white">
                {showPassword ? newPassword.password : '•'.repeat(newPassword.password.length)}
              </code>
              <button onClick={() => setShowPassword(v => !v)} className="text-slate-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => copyPassword(newPassword.password)} className="text-slate-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <button onClick={() => { setNewPassword(null); setShowPassword(false); }} className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              Verstanden & schließen
            </button>
          </div>
        </div>
      )}

      {/* ===== TOAST ===== */}
      {notification && (
        <div className={`fixed inset-x-4 bottom-[calc(var(--mobile-bottom-nav-height)+1rem)] z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl sm:inset-x-auto sm:bottom-6 sm:right-6 ${
          notification.type === 'success' ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/40' : 'bg-white dark:bg-gray-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40'
        }`}>
          {notification.type === 'success' ? <Check size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500" />}
          {notification.text}
        </div>
      )}
    </div>
  );
}
