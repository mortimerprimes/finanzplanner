'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, TrendingUp, Receipt, CreditCard, PiggyBank,
  Wallet, Landmark, RefreshCw, Settings, BarChart3, Menu, X,
  ChevronLeft, ChevronRight, Sun, Moon, Monitor, Target, CalendarDays, LogOut
} from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { useFinance } from '@/lib/finance-context';
import { getMonthDisplayName, getMonthPickerRange, shiftMonth } from '@/src/utils/helpers';
import { Modal } from '@/src/components/ui';
import { QuickCaptureFab } from '@/src/components/QuickCaptureFab';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Einnahmen', icon: TrendingUp },
  { href: '/fixed-expenses', label: 'Fixkosten', icon: Receipt },
  { href: '/debts', label: 'Schulden', icon: CreditCard },
  { href: '/expenses', label: 'Ausgaben', icon: Wallet },
  { href: '/budget', label: 'Budgets', icon: Target },
  { href: '/savings', label: 'Sparziele', icon: PiggyBank },
  { href: '/accounts', label: 'Konten', icon: Landmark },
  { href: '/bank-sync', label: 'Bank Sync', icon: RefreshCw },
  { href: '/freelance', label: 'Freelance', icon: CalendarDays },
  { href: '/analytics', label: 'Analysen', icon: BarChart3 },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { state, dispatch } = useFinance();
  const pathname = usePathname();

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
    setTheme(themes[(idx + 1) % themes.length]);
  };

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const sidebarW = sidebarOpen ? 260 : 72;
  const monthOptions = getMonthPickerRange(state.selectedMonth, 8, 7);
  const isSettingsPage = pathname === '/settings';

  const currentNavItem = navItems.find(item => pathname === item.href);

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

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  w-full flex items-center gap-3 rounded-xl transition-all duration-200
                  ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'}
                `}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
              </Link>
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-white">💰 Finanzplanner</h1>
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400"
        >
          <ThemeIcon size={20} />
        </button>
      </div>

      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40 animate-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="lg:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 animate-fade-in">
            <nav className="py-4 px-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-all"
              >
                <LogOut size={20} />
                <span className="text-sm font-medium">Abmelden</span>
              </button>
            </nav>
          </div>
        </>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="mt-14 flex min-h-16 flex-shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:mt-0 lg:px-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {currentNavItem?.label || 'Dashboard'}
          </h2>

          {!isSettingsPage && (
            <div className="ml-auto flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-gray-800 flex-shrink-0">
              <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                <ChevronLeft size={18} className="text-slate-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setMonthPickerOpen(true)}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-white dark:text-white dark:hover:bg-gray-700"
              >
                <CalendarDays size={15} className="text-slate-500 dark:text-gray-400" />
                {getMonthDisplayName(state.selectedMonth)}
              </button>
              <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                <ChevronRight size={18} className="text-slate-600 dark:text-gray-400" />
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-6xl 2xl:max-w-[1320px]">
            {children}
          </div>
        </main>
      </div>

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
    </div>
  );
}
