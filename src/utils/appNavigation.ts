import {
  BarChart3,
  CalendarRange,
  Clock,
  CreditCard,
  Crown,
  FileBarChart,
  Flag,
  Image,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  Shield,
  Target,
  TrendingUp,
  UserCircle,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Settings as AppSettings } from '../types';

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  hiddenInGuided?: boolean;
  hiddenForProfiles?: AppSettings['userExperience']['profile'][];
  matchPrefixes?: string[];
}

export interface AppNavGroup {
  label: string;
  items: AppNavItem[];
  defaultCollapsed?: boolean;
}

export interface MobileNavLinkItem {
  type: 'link';
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
}

export interface MobileNavActionItem {
  type: 'action';
  label: string;
  icon: LucideIcon;
}

export type MobileNavItem = MobileNavLinkItem | MobileNavActionItem;

type FilterOptions = {
  hiddenItems?: Set<string>;
  isAdmin?: boolean;
  ignoreHidden?: boolean;
};

type ExperienceOptions = {
  hiddenMenuItems?: string[];
  mode: AppSettings['userExperience']['mode'];
  profile: AppSettings['userExperience']['profile'];
};

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    label: 'Alltag',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/expenses', label: 'Ausgaben', icon: Wallet },
      { href: '/budget', label: 'Budgets', icon: Target },
      { href: '/accounts', label: 'Konten', icon: Landmark },
    ],
  },
  {
    label: 'Planen',
    items: [
      { href: '/income', label: 'Einnahmen', icon: TrendingUp },
      { href: '/fixed-expenses', label: 'Fixkosten', icon: Receipt },
      { href: '/savings', label: 'Sparziele', icon: PiggyBank },
      { href: '/debts', label: 'Schulden', icon: CreditCard },
    ],
  },
  {
    label: 'Mehr entdecken',
    defaultCollapsed: true,
    items: [
      { href: '/analytics', label: 'Analysen', icon: BarChart3 },
      { href: '/cashflow', label: 'Cashflow', icon: CalendarRange },
      { href: '/monthly-report', label: 'Monatsbericht', icon: FileBarChart },
      { href: '/annual-report', label: 'Jahresbericht', icon: FileBarChart, hiddenInGuided: true },
      { href: '/finance-score', label: 'Finanz-Score', icon: Shield, hiddenInGuided: true },
      { href: '/finance-goals', label: 'Finanz-Ziele', icon: Flag, hiddenInGuided: true },
      { href: '/bank-sync', label: 'Bank Sync', icon: RefreshCw },
      { href: '/receipts', label: 'Belege', icon: Image, matchPrefixes: ['/receipts'] },
      { href: '/category-rules', label: 'Regeln', icon: Zap, hiddenInGuided: true },
      { href: '/activity-log', label: 'Aktivitäten', icon: Clock, hiddenInGuided: true },
      { href: '/freelance', label: 'Freelance', icon: Zap, hiddenForProfiles: ['personal'] },
    ],
  },
];

export const APP_FOOTER_NAV_ITEMS: AppNavItem[] = [
  { href: '/settings', label: 'Einstellungen', icon: Settings },
  { href: '/profile', label: 'Profil', icon: UserCircle },
  { href: '/admin', label: 'Admin', icon: Crown, adminOnly: true },
];

export const APP_MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    type: 'link',
    href: '/dashboard',
    label: 'Start',
    icon: LayoutDashboard,
    matchPrefixes: ['/dashboard', '/analytics', '/cashflow'],
  },
  {
    type: 'link',
    href: '/expenses',
    label: 'Ausgaben',
    icon: Wallet,
    matchPrefixes: ['/expenses', '/receipts', '/category-rules'],
  },
  {
    type: 'action',
    label: 'Erfassen',
    icon: Plus,
  },
  {
    type: 'link',
    href: '/budget',
    label: 'Planen',
    icon: Target,
    matchPrefixes: ['/budget', '/income', '/fixed-expenses', '/savings', '/debts'],
  },
];

const DEMO_BASE = '/demo';

export const DEMO_NAV_GROUPS: AppNavGroup[] = [
  {
    label: 'Alltag',
    items: [
      { href: `${DEMO_BASE}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
      { href: `${DEMO_BASE}/expenses`, label: 'Ausgaben', icon: Wallet },
      { href: `${DEMO_BASE}/budget`, label: 'Budgets', icon: Target },
      { href: `${DEMO_BASE}/accounts`, label: 'Konten', icon: Landmark },
    ],
  },
  {
    label: 'Planen',
    items: [
      { href: `${DEMO_BASE}/income`, label: 'Einnahmen', icon: TrendingUp },
      { href: `${DEMO_BASE}/fixed-expenses`, label: 'Fixkosten', icon: Receipt },
      { href: `${DEMO_BASE}/savings`, label: 'Sparziele', icon: PiggyBank },
      { href: `${DEMO_BASE}/debts`, label: 'Schulden', icon: CreditCard },
    ],
  },
  {
    label: 'Mehr entdecken',
    defaultCollapsed: true,
    items: [
      { href: `${DEMO_BASE}/analytics`, label: 'Analysen', icon: BarChart3 },
      { href: `${DEMO_BASE}/cashflow`, label: 'Cashflow', icon: CalendarRange },
      { href: `${DEMO_BASE}/annual-report`, label: 'Jahresbericht', icon: FileBarChart },
      { href: `${DEMO_BASE}/finance-score`, label: 'Finanz-Score', icon: Shield },
      { href: `${DEMO_BASE}/finance-goals`, label: 'Finanzziele', icon: Flag },
      { href: `${DEMO_BASE}/bank-sync`, label: 'Bank-Sync', icon: RefreshCw },
      { href: `${DEMO_BASE}/receipts`, label: 'Belege', icon: Image },
      { href: `${DEMO_BASE}/category-rules`, label: 'Kategorie-Regeln', icon: Zap },
      { href: `${DEMO_BASE}/activity-log`, label: 'Aktivitätslog', icon: Clock },
      { href: `${DEMO_BASE}/freelance`, label: 'Freelance', icon: Zap },
    ],
  },
];

export const DEMO_FOOTER_NAV_ITEMS: AppNavItem[] = [
  { href: `${DEMO_BASE}/settings`, label: 'Einstellungen', icon: Settings },
];

export function getDefaultCollapsedLabels(groups: AppNavGroup[]): Set<string> {
  return new Set(groups.filter((group) => group.defaultCollapsed).map((group) => group.label));
}

export function buildExperienceHiddenItemSet({ hiddenMenuItems = [], mode, profile }: ExperienceOptions): Set<string> {
  const items = new Set(hiddenMenuItems);

  APP_NAV_GROUPS.forEach((group) => {
    group.items.forEach((item) => {
      if (mode === 'guided' && item.hiddenInGuided) {
        items.add(item.href);
      }
      if (item.hiddenForProfiles?.includes(profile)) {
        items.add(item.href);
      }
    });
  });

  return items;
}

export function filterNavGroups(groups: AppNavGroup[], options: FilterOptions = {}): AppNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, options),
    }))
    .filter((group) => group.items.length > 0);
}

export function filterNavItems(items: AppNavItem[], options: FilterOptions = {}): AppNavItem[] {
  const { hiddenItems, isAdmin = false, ignoreHidden = false } = options;

  return items.filter((item) => {
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    if (!ignoreHidden && hiddenItems?.has(item.href)) {
      return false;
    }
    return true;
  });
}

export function isNavItemActive(pathname: string, item: Pick<AppNavItem, 'href' | 'matchPrefixes'>): boolean {
  const prefixes = item.matchPrefixes && item.matchPrefixes.length > 0
    ? item.matchPrefixes
    : [item.href];

  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
