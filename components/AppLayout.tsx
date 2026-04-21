'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, TrendingUp, Receipt, CreditCard, PiggyBank,
  Wallet, Landmark, RefreshCw, Settings, BarChart3, Menu, X,
  ChevronLeft, ChevronRight, Sun, Moon, Monitor, Target, CalendarDays, LogOut, UserCircle,
  CalendarRange, FileBarChart, Crown, Clock, Shield, Flag, Image, Zap, ChevronDown
} from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { useFinance } from '@/lib/finance-context';
import { getMonthDisplayName, getMonthPickerRange, shiftMonth } from '@/src/utils/helpers';
import { Modal } from '@/src/components/ui';
import { QuickCaptureFab } from '@/src/components/QuickCaptureFab';
import { NotificationBell } from '@/components/NotificationBell';
import { useNotificationEngine } from '@/src/hooks/useNotifications';
import { GlobalSearch } from '@/src/components/GlobalSearch';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/src/hooks/useKeyboardShortcuts';
import { useSession } from 'next-auth/react';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analysen', icon: BarChart3 },
      { href: '/cashflow', label: 'Cashflow', icon: CalendarRange },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { href: '/income', label: 'Einnahmen', icon: TrendingUp },
      { href: '/fixed-expenses', label: 'Fixkosten', icon: Receipt },
      { href: '/debts', label: 'Schulden', icon: CreditCard },
      { href: '/expenses', label: 'Ausgaben', icon: Wallet },
      { href: '/budget', label: 'Budgets', icon: Target },
    ],
  },
  {
    label: 'Vermögen',
    items: [
      { href: '/savings', label: 'Sparziele', icon: PiggyBank },
      { href: '/accounts', label: 'Konten', icon: Landmark },
      { href: '/freelance', label: 'Freelance', icon: CalendarDays },
    ],
  },
  {
    label: 'Berichte',
    items: [
      { href: '/annual-report', label: 'Jahresbericht', icon: FileBarChart },
      { href: '/finance-score', label: 'Finanz-Score', icon: Shield },
      { href: '/finance-goals', label: 'Finanz-Ziele', icon: Flag },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/bank-sync', label: 'Bank Sync', icon: RefreshCw },
      { href: '/receipts', label: 'Belege', icon: Image },
      { href: '/category-rules', label: 'Regeln', icon: Zap },
      { href: '/activity-log', label: 'Aktivitäten', icon: Clock },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Einstellungen', icon: Settings },
      { href: '/admin', label: 'Admin', icon: Crown, adminOnly: true },
      { href: '/profile', label: 'Profil', icon: UserCircle },
    ],
  },
];

// Flat list for backward compat (page title lookup etc.)
const allNavItems = navGroups.flatMap(g => g.items);

const mobileTabItems: NavItem[] = [
  { href: '/dashboard', label: 'Start', icon: LayoutDashboard },
  { href: '/expenses', label: 'Ausgaben', icon: Wallet },
  { href: '/budget', label: 'Budgets', icon: Target },
  { href: '/accounts', label: 'Konten', icon: Landmark },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { state, dispatch } = useFinance();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const hiddenMenuItems = state.settings.hiddenMenuItems || [];

  // Filter nav groups based on admin role and hidden items
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        if (hiddenMenuItems.includes(item.href)) return false;
        return true;
      }),
    }))
    .filter(group => group.items.length > 0);

  const currentNavItem = allNavItems.find(item => pathname === item.href);
  const isMobileMoreActive = mobileMenuOpen || !mobileTabItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Run notification engine
  useNotificationEngine();
  // Keyboard shortcuts
  useKeyboardShortcuts();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setShortcutsOpen(true);
    window.addEventListener('show-shortcuts', handler);
    return () => window.removeEventListener('show-shortcuts', handler);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMonthPickerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('mobile-menu-open', mobileMenuOpen);
    return () => document.body.classList.remove('mobile-menu-open');
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (state.settings.theme && state.settings.theme !== theme) {
      setTheme(state.settings.theme);
    }
  }, [setTheme, state.settings.theme, theme]);

  const handlePrevMonth = () => {
    const [year, month] = state.selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    dispatch({
      type: 'SET_SELECTED_MONTH',
      payload: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    });
  };

  const handleNextMonth = () => {
    const [year, month] = state.selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    dispatch({
      type: 'SET_SELECTED_MONTH',
      payload: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    });
  };

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const idx = themes.indexOf(theme);
    const nextTheme = themes[(idx + 1) % themes.length];
    setTheme(nextTheme);
    dispatch({ type: 'UPDATE_SETTINGS', payload: { theme: nextTheme } });
  };

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const sidebarW = sidebarOpen ? 260 : 72;
  const monthOptions = getMonthPickerRange(state.selectedMonth, 8, 7);
  const isSettingsPage = pathname === '/settings';

  const handleSelectMonth = (month: string) => {
    dispatch({ type: 'SET_SELECTED_MONTH', payload: month });
    setMonthPickerOpen(false);
  };

  return (
    <div className="app-shell flex h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden">
      {/* SIDEBAR (Desktop) */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 transition-[width] duration-300 ease-in-out h-screen overflow-hidden"
        style={{ width: sidebarW }}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-gray-800 flex-shrink-0">
          {sidebarOpen && (
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 whitespace-nowrap">
              <span className="text-2xl">💰</span>
              Finanzplanner
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400 transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {visibleGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label);
            const hasActiveItem = group.items.some(item => pathname === item.href);
            return (
              <div key={group.label}>
                {sidebarOpen && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-1.5 mt-2 mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 transition-colors"
                  >
                    {group.label}
                    <ChevronDown size={12} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                )}
                {(!isCollapsed || !sidebarOpen) && group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        w-full flex items-center gap-3 rounded-xl transition-all duration-200
                        ${sidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'}
                        ${isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                          : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'}
                      `}
                    >
                      <ItemIcon size={18} className="flex-shrink-0" />
                      {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
                    </Link>
                  );
                })}
                {isCollapsed && sidebarOpen && hasActiveItem && group.items.filter(item => pathname === item.href).map(item => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    >
                      <ItemIcon size={18} className="flex-shrink-0" />
                      <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-gray-800 flex-shrink-0 space-y-1">
          <button
            onClick={cycleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200 ${!sidebarOpen && 'justify-center'}`}
          >
            <ThemeIcon size={20} className="flex-shrink-0" />
            {sidebarOpen && (
              <span className="text-sm font-medium whitespace-nowrap">
                {theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'}
              </span>
            )}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 ${!sidebarOpen && 'justify-center'}`}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">Abmelden</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-50 flex h-[calc(3.5rem+var(--safe-area-top))] items-center justify-between border-b border-slate-200 bg-white/95 px-4 pt-[var(--safe-area-top)] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-white">💰 Finanzplanner</h1>
        <div className="flex items-center gap-1">
          <GlobalSearch
            buttonClassName="inline-flex rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            iconOnly
          />
          <NotificationBell />
          <button
            onClick={cycleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400"
          >
          <ThemeIcon size={20} />
        </button>
        </div>
      </div>

      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40 animate-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 top-[calc(3.5rem+var(--safe-area-top))] z-40 w-[85vw] max-w-xs overflow-y-auto border-r border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900 animate-fade-in">
            <nav className="space-y-0.5 px-3 pb-[calc(1rem+var(--safe-area-bottom))] pt-3">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 py-1.5 mt-2 mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-gray-600">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                          isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <ItemIcon size={18} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-xl text-slate-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-all"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">Abmelden</span>
              </button>
            </nav>
          </div>
        </>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="mt-[calc(3.5rem+var(--safe-area-top))] flex min-h-16 flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900 lg:mt-0 lg:gap-3 lg:px-6 lg:py-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {currentNavItem?.label || 'Dashboard'}
          </h2>

          {!isSettingsPage && (
            <div className="ml-auto flex w-full items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-gray-800 sm:w-auto flex-shrink-0">
              <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                <ChevronLeft size={18} className="text-slate-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setMonthPickerOpen(true)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-white dark:text-white dark:hover:bg-gray-700 sm:min-w-[160px] sm:flex-none"
              >
                <CalendarDays size={15} className="text-slate-500 dark:text-gray-400" />
                {getMonthDisplayName(state.selectedMonth)}
              </button>
              <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                <ChevronRight size={18} className="text-slate-600 dark:text-gray-400" />
              </button>
            </div>
          )}
          <div className={`${isSettingsPage ? 'ml-auto' : ''} flex flex-shrink-0 items-center gap-2 hidden lg:flex`}>
            <GlobalSearch />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(5.5rem+var(--safe-area-bottom))] md:p-5 lg:p-6 lg:pb-6">
          <div className="mx-auto w-full max-w-6xl 2xl:max-w-[1320px]">
            {children}
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[var(--safe-area-bottom)] pt-2 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95">
        <div className="grid grid-cols-5 gap-1">
          {mobileTabItems.map((item) => {
            const ItemIcon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <ItemIcon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen((value) => !value)}
            className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition-all ${
              isMobileMoreActive
                ? 'bg-slate-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            <span>Mehr</span>
          </button>
        </div>
      </nav>

      <Modal isOpen={monthPickerOpen} onClose={() => setMonthPickerOpen(false)} title="Monat auswählen">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Direkt springen</label>
              <input
                type="month"
                value={state.selectedMonth}
                onChange={(e) => handleSelectMonth(e.target.value)}
                className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <button
              onClick={() => handleSelectMonth(new Date().toISOString().slice(0, 7))}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-slate-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              Diesen Monat
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {monthOptions.map((month) => {
              const isActive = month === state.selectedMonth;
              return (
                <button
                  key={month}
                  onClick={() => handleSelectMonth(month)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'border-slate-200 bg-white text-gray-900 hover:border-slate-300 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                >
                  <p className="text-xs opacity-80">Monat</p>
                  <p className="mt-1 text-sm font-semibold">{getMonthDisplayName(month)}</p>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleSelectMonth(shiftMonth(state.selectedMonth, -12))}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:text-white dark:hover:bg-gray-800"
            >
              -12 Monate
            </button>
            <button
              onClick={() => handleSelectMonth(shiftMonth(state.selectedMonth, 12))}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:text-white dark:hover:bg-gray-800"
            >
              +12 Monate
            </button>
          </div>
        </div>
      </Modal>

      {!isSettingsPage && <QuickCaptureFab />}
      <KeyboardShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
