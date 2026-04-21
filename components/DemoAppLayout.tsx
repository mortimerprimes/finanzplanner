'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, TrendingUp, Receipt, CreditCard, PiggyBank,
  Wallet, Landmark, Settings, BarChart3, Menu, X,
  ChevronLeft, ChevronRight, Sun, Moon, Monitor, Target, CalendarDays,
  CalendarRange, FileBarChart, Shield, Flag, Image, Zap, Clock,
  ChevronDown, AlertTriangle, LogIn, ArrowRight
} from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { useFinance } from '@/lib/finance-context';
import { getMonthDisplayName, getMonthPickerRange, shiftMonth } from '@/src/utils/helpers';
import { Modal } from '@/src/components/ui';

interface NavItem { href: string; label: string; icon: typeof LayoutDashboard; }
interface NavGroup { label: string; items: NavItem[]; }

const BASE = '/demo';

const navGroups: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [
      { href: `${BASE}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
      { href: `${BASE}/analytics`, label: 'Analysen', icon: BarChart3 },
      { href: `${BASE}/cashflow`, label: 'Cashflow', icon: CalendarRange },
      { href: `${BASE}/annual-report`, label: 'Jahresbericht', icon: FileBarChart },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { href: `${BASE}/income`, label: 'Einnahmen', icon: TrendingUp },
      { href: `${BASE}/fixed-expenses`, label: 'Fixkosten', icon: Receipt },
      { href: `${BASE}/debts`, label: 'Schulden', icon: CreditCard },
      { href: `${BASE}/expenses`, label: 'Ausgaben', icon: Wallet },
      { href: `${BASE}/budget`, label: 'Budgets', icon: Target },
    ],
  },
  {
    label: 'Vermögen',
    items: [
      { href: `${BASE}/savings`, label: 'Sparziele', icon: PiggyBank },
      { href: `${BASE}/finance-goals`, label: 'Finanzziele', icon: Flag },
      { href: `${BASE}/accounts`, label: 'Konten', icon: Landmark },
    ],
  },
  {
    label: 'Berichte & Tools',
    items: [
      { href: `${BASE}/finance-score`, label: 'Finanz-Score', icon: Shield },
      { href: `${BASE}/freelance`, label: 'Freelance', icon: Zap },
      { href: `${BASE}/receipts`, label: 'Belege', icon: Image },
      { href: `${BASE}/bank-sync`, label: 'Bank-Sync', icon: CalendarDays },
    ],
  },
  {
    label: 'Verlauf & Einstellungen',
    items: [
      { href: `${BASE}/activity-log`, label: 'Aktivitätslog', icon: Clock },
      { href: `${BASE}/category-rules`, label: 'Kategorie-Regeln', icon: Settings },
      { href: `${BASE}/settings`, label: 'Einstellungen', icon: Settings },
    ],
  },
];

export function DemoAppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { state, dispatch } = useFinance();
  const pathname = usePathname();
  const router = useRouter();

  const allNavItems = navGroups.flatMap(g => g.items);
  const currentNavItem = allNavItems.find(item => pathname === item.href);
  const sidebarW = sidebarOpen ? 260 : 72;

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handlePrevMonth = () => {
    const [year, month] = state.selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    dispatch({ type: 'SET_SELECTED_MONTH', payload: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  };

  const handleNextMonth = () => {
    const [year, month] = state.selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    dispatch({ type: 'SET_SELECTED_MONTH', payload: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  };

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const idx = themes.indexOf(theme);
    setTheme(themes[(idx + 1) % themes.length]);
  };

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const monthOptions = getMonthPickerRange(state.selectedMonth, 8, 7);

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

        {/* Demo Badge */}
        {sidebarOpen && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Demo-Modus</span>
          </div>
        )}

        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navGroups.map((group) => {
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
          <Link
            href="/login"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 font-medium ${!sidebarOpen && 'justify-center'}`}
          >
            <LogIn size={20} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">Jetzt registrieren</span>}
          </Link>
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
        <h1 className="text-base font-bold text-gray-900 dark:text-white">💰 Demo</h1>
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400"
        >
          <ThemeIcon size={20} />
        </button>
      </div>

      {mobileMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40 animate-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="lg:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 animate-fade-in overflow-y-auto">
            <nav className="py-3 px-3 space-y-0.5">
              {navGroups.map((group) => (
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
              <div className="pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium transition-all"
                >
                  <LogIn size={18} />
                  <span className="text-sm font-medium">Jetzt registrieren</span>
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Demo Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 flex items-center justify-between flex-shrink-0 mt-14 lg:mt-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={15} />
            <span>Demo-Modus — Beispieldaten von Max Mustermann. Änderungen werden nicht gespeichert.</span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Kostenlos starten <ArrowRight size={13} />
          </Link>
        </div>

        <header className="flex min-h-14 flex-shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {currentNavItem?.label || 'Dashboard'}
          </h2>

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
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-6xl 2xl:max-w-[1320px]">
            {children}
          </div>
        </main>
      </div>

      <Modal isOpen={monthPickerOpen} onClose={() => setMonthPickerOpen(false)} title="Monat auswählen">
        <div className="space-y-5">
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
        </div>
      </Modal>
    </div>
  );
}
