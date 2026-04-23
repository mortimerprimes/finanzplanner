'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Menu, X,
  ChevronLeft, ChevronRight, Sun, Moon, Monitor, CalendarDays, LogOut, ChevronDown
} from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { useFinance } from '@/lib/finance-context';
import { getMonthDisplayName, getMonthPickerRange, shiftMonth } from '@/src/utils/helpers';
import {
  APP_FOOTER_NAV_ITEMS,
  APP_MOBILE_NAV_ITEMS,
  APP_NAV_GROUPS,
  buildExperienceHiddenItemSet,
  filterNavGroups,
  filterNavItems,
  getDefaultCollapsedLabels,
  isNavItemActive,
} from '@/src/utils/appNavigation';
import { Button, Modal } from '@/src/components/ui';
import { QuickCaptureFab } from '@/src/components/QuickCaptureFab';
import { NotificationBell } from '@/components/NotificationBell';
import { useNotificationEngine } from '@/src/hooks/useNotifications';
import { GlobalSearch } from '@/src/components/GlobalSearch';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/src/hooks/useKeyboardShortcuts';
import { useSession } from 'next-auth/react';
import { BudgetFeedbackToast } from '@/src/components/BudgetFeedbackToast';
import { OnboardingWizard } from '@/src/components/OnboardingWizard';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => getDefaultCollapsedLabels(APP_NAV_GROUPS));
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { state, dispatch, isLoading } = useFinance();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const hiddenMenuItems = state.settings.hiddenMenuItems || [];
  const experienceMode = state.settings.userExperience.mode;
  const experienceProfile = state.settings.userExperience.profile;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsHintOpen, setShortcutsHintOpen] = useState(false);

  const effectiveHiddenMenuItems = buildExperienceHiddenItemSet({
    hiddenMenuItems,
    mode: experienceMode,
    profile: experienceProfile,
  });

  const setupChecklist = [
    { label: 'Konto', done: state.accounts.length > 0 },
    { label: 'Einnahme', done: state.incomes.length > 0 },
    { label: 'Planung', done: state.fixedExpenses.length > 0 || state.expenses.length > 0 },
  ];
  const hasSetupData = setupChecklist.every((item) => item.done);
  const needsSetupBanner = !state.settings.userExperience.initialSetupCompleted && !isLoading;

  const visibleGroups = filterNavGroups(APP_NAV_GROUPS, {
    hiddenItems: effectiveHiddenMenuItems,
    isAdmin,
  });
  const footerNavItems = filterNavItems(APP_FOOTER_NAV_ITEMS, { isAdmin, ignoreHidden: true });
  const allNavItems = [...APP_NAV_GROUPS.flatMap((group) => group.items), ...APP_FOOTER_NAV_ITEMS];
  const currentNavItem = allNavItems.find((item) => isNavItemActive(pathname, item));
  const isMobileMoreActive = mobileMenuOpen || !APP_MOBILE_NAV_ITEMS.some((item) => item.type === 'link' && isNavItemActive(pathname, item));

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

  useEffect(() => {
    const handler = () => setShortcutsOpen(true);
    window.addEventListener('show-shortcuts', handler);
    return () => window.removeEventListener('show-shortcuts', handler);
  }, []);

  useEffect(() => {
    const handler = () => setOnboardingOpen(true);
    window.addEventListener('open-onboarding', handler);
    return () => window.removeEventListener('open-onboarding', handler);
  }, []);

  useEffect(() => {
    if (!isLoading && hasSetupData && !state.settings.userExperience.initialSetupCompleted) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          userExperience: {
            ...state.settings.userExperience,
            initialSetupCompleted: true,
          },
        },
      });
    }
  }, [dispatch, hasSetupData, isLoading, state.settings.userExperience]);

  useEffect(() => {
    if (
      !isLoading
      && !state.settings.userExperience.onboardingCompleted
      && state.accounts.length === 0
      && state.incomes.length === 0
      && state.fixedExpenses.length === 0
      && state.expenses.length === 0
    ) {
      setOnboardingOpen(true);
    }
  }, [
    isLoading,
    state.accounts.length,
    state.expenses.length,
    state.fixedExpenses.length,
    state.incomes.length,
    state.settings.userExperience.onboardingCompleted,
  ]);

  useEffect(() => {
    if (
      !isLoading
      && state.settings.userExperience.onboardingCompleted
      && !state.settings.userExperience.shortcutsHintSeen
      && !onboardingOpen
    ) {
      setShortcutsHintOpen(true);
    }
  }, [
    isLoading,
    onboardingOpen,
    state.settings.userExperience.onboardingCompleted,
    state.settings.userExperience.shortcutsHintSeen,
  ]);

  useEffect(() => {
    if (!shortcutsOpen || state.settings.userExperience.shortcutsHintSeen) return;

    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        userExperience: {
          ...state.settings.userExperience,
          shortcutsHintSeen: true,
        },
      },
    });
    setShortcutsHintOpen(false);
  }, [dispatch, shortcutsOpen, state.settings.userExperience]);

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

  const dismissShortcutsHint = () => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        userExperience: {
          ...state.settings.userExperience,
          shortcutsHintSeen: true,
        },
      },
    });
    setShortcutsHintOpen(false);
  };

  const handleSelectMonth = (month: string) => {
    dispatch({ type: 'SET_SELECTED_MONTH', payload: month });
    setMonthPickerOpen(false);
  };

  const handleOpenQuickCapture = () => {
    if (state.settings.quickEntry) {
      window.dispatchEvent(new CustomEvent('open-quick-capture', { detail: { type: 'expense' } }));
      return;
    }

    router.push('/expenses');
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
            const hasActiveItem = group.items.some((item) => isNavItemActive(pathname, item));
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
                  const isActive = isNavItemActive(pathname, item);
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
                {isCollapsed && sidebarOpen && hasActiveItem && group.items.filter((item) => isNavItemActive(pathname, item)).map((item) => {
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
          {footerNavItems.map((item) => {
            const ItemIcon = item.icon;
            const isActive = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${!sidebarOpen && 'justify-center'} ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ItemIcon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
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
                    const isActive = isNavItemActive(pathname, item);
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
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-gray-800">
                {footerNavItems.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = isNavItemActive(pathname, item);
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
            {needsSetupBanner && !isSettingsPage && (
              <div className="mb-4 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 shadow-sm dark:border-blue-900/40 dark:from-blue-950/30 dark:via-gray-900 dark:to-cyan-950/20 sm:rounded-3xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">Einfacher Start</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Modus: {experienceMode === 'guided' ? 'Gefuehrt' : experienceMode === 'standard' ? 'Standard' : 'Power'}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Dein Setup ist noch nicht komplett.</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
                      Richte Konto, Einnahme und eine erste Planung ein. Danach werden Dashboard, Suche und Forecasts deutlich hilfreicher.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {setupChecklist.map((item) => (
                        <span
                          key={item.label}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            item.done
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {item.done ? '✓ ' : ''}{item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:items-center">
                    <Button onClick={() => setOnboardingOpen(true)} className="w-full sm:w-auto">Setup oeffnen</Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShortcutsOpen(true);
                        dismissShortcutsHint();
                      }}
                      className="w-full sm:w-auto"
                    >
                      Kurzbefehle ansehen
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[var(--safe-area-bottom)] pt-2 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95">
        <div className="grid grid-cols-5 gap-1">
          {APP_MOBILE_NAV_ITEMS.map((item) => {
            const ItemIcon = item.icon;

            if (item.type === 'action') {
              return (
                <button
                  key={item.label}
                  onClick={handleOpenQuickCapture}
                  className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium text-slate-700 transition-all dark:text-white"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                    <ItemIcon size={18} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            }

            const isActive = isNavItemActive(pathname, item);
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

      {!isSettingsPage && <QuickCaptureFab desktopOnly />}
      {!isSettingsPage && <BudgetFeedbackToast />}
      {shortcutsHintOpen && (
        <div className="fixed inset-x-4 bottom-[calc(6.75rem+var(--safe-area-bottom))] z-[90] mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:left-auto sm:right-6 sm:mx-0 sm:w-[360px] sm:bottom-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Schneller arbeiten</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-gray-400">
                Nutze <span className="font-semibold text-gray-900 dark:text-white">Cmd/Ctrl+K</span> fuer die Befehls-Palette und <span className="font-semibold text-gray-900 dark:text-white">?</span> fuer alle Kurzbefehle.
              </p>
            </div>
            <button
              onClick={dismissShortcutsHint}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:text-gray-500 dark:hover:bg-gray-800"
              aria-label="Hinweis schliessen"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-command-palette'));
                dismissShortcutsHint();
              }}
              className="w-full sm:flex-1"
            >
              Palette oeffnen
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShortcutsOpen(true);
                dismissShortcutsHint();
              }}
              className="w-full sm:flex-1"
            >
              Alle Kurzbefehle
            </Button>
          </div>
        </div>
      )}
      <OnboardingWizard isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      <KeyboardShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
