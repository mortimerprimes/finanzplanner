import type { FinanceState } from '../types';
import { DEFAULT_SETTINGS } from './constants';

// Generates a random ID (deterministic-ish for demo)
const id = (prefix: string, i: number | string) => `demo-${prefix}-${i}`;

// Helper to build month strings relative to current
function monthStr(offsetFromNow: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateInMonth(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

// ============================================================
// DEMO STATE — realistic 12-month dataset for Max Mustermann
// ============================================================
export function buildDemoState(): FinanceState {
  const now = new Date().toISOString();
  const currentMonth = monthStr(0);

  // ---- ACCOUNTS ----
  const accounts = [
    {
      id: id('acc', 1), name: 'Girokonto DKB', type: 'checking' as const,
      balance: 3420.55, color: '#3b82f6', icon: 'Wallet', isDefault: true,
      note: 'Hauptkonto', createdAt: now,
    },
    {
      id: id('acc', 2), name: 'Tagesgeld Flatex', type: 'savings' as const,
      balance: 8750.00, color: '#10b981', icon: 'PiggyBank', isDefault: false,
      note: 'Notgroschen', createdAt: now,
    },
    {
      id: id('acc', 3), name: 'Depot comdirect', type: 'investment' as const,
      balance: 14320.80, color: '#8b5cf6', icon: 'TrendingUp', isDefault: false,
      note: 'ETF-Sparplan', createdAt: now,
    },
    {
      id: id('acc', 4), name: 'Bargeld', type: 'cash' as const,
      balance: 180.00, color: '#f59e0b', icon: 'Banknote', isDefault: false,
      createdAt: now,
    },
  ];

  // ---- FIXED EXPENSES ----
  const fixedExpenses = [
    { id: id('fix', 1), name: 'Kaltmiete', amount: 980, category: 'housing' as const, dueDay: 1, isActive: true, createdAt: now },
    { id: id('fix', 2), name: 'Strom & Gas', amount: 85, category: 'utilities' as const, dueDay: 5, isActive: true, createdAt: now },
    { id: id('fix', 3), name: 'Internet', amount: 39.99, category: 'communication' as const, dueDay: 10, isActive: true, createdAt: now },
    { id: id('fix', 4), name: 'Handyvertrag', amount: 22, category: 'communication' as const, dueDay: 12, isActive: true, createdAt: now },
    { id: id('fix', 5), name: 'KFZ-Versicherung', amount: 74, category: 'insurance' as const, dueDay: 1, isActive: true, createdAt: now },
    { id: id('fix', 6), name: 'Haftpflichtversicherung', amount: 8.50, category: 'insurance' as const, dueDay: 15, isActive: true, createdAt: now },
    { id: id('fix', 7), name: 'Netflix', amount: 17.99, category: 'subscriptions' as const, dueDay: 8, isActive: true, createdAt: now },
    { id: id('fix', 8), name: 'Spotify', amount: 9.99, category: 'subscriptions' as const, dueDay: 8, isActive: true, createdAt: now },
    { id: id('fix', 9), name: 'GEZ Rundfunkbeitrag', amount: 18.36, category: 'other' as const, dueDay: 15, isActive: true, createdAt: now },
    { id: id('fix', 10), name: 'Fitnessstudio', amount: 29, category: 'other' as const, dueDay: 1, isActive: true, createdAt: now },
  ];

  // ---- DEBTS ----
  const debts = [
    {
      id: id('debt', 1), name: 'Autokredit VW Bank', totalAmount: 18000, remainingAmount: 11250,
      monthlyPayment: 320, interestRate: 4.9, type: 'loan' as const,
      startDate: monthStr(-18) + '-01', note: 'VW Golf 8 Finanzierung', createdAt: now,
    },
    {
      id: id('debt', 2), name: 'Bildungskredit KfW', totalAmount: 7500, remainingAmount: 3800,
      monthlyPayment: 130, interestRate: 0, type: 'student' as const,
      startDate: monthStr(-30) + '-01', note: 'Master-Studium', createdAt: now,
    },
  ];

  // ---- SAVINGS GOALS ----
  const savingsGoals = [
    {
      id: id('sav', 1), name: 'Notgroschen (3 Monatsgehälter)', targetAmount: 12000,
      currentAmount: 8750, monthlyContribution: 200, color: '#10b981', icon: 'Shield',
      isCompleted: false, note: '3 Netto-Monatsgehälter als Puffer', createdAt: now,
      priority: 1, goalCategory: 'emergency',
      depositHistory: Array.from({ length: 12 }, (_, i) => ({
        month: monthStr(-11 + i),
        amount: 200,
        date: dateInMonth(monthStr(-11 + i), 28),
      })),
    },
    {
      id: id('sav', 2), name: 'Urlaub Südostasien', targetAmount: 3500,
      currentAmount: 2100, monthlyContribution: 150, deadline: monthStr(9) + '-01',
      color: '#0ea5e9', icon: 'Plane',
      isCompleted: false, note: 'Thailand + Vietnam im Herbst', createdAt: now,
      priority: 2, goalCategory: 'travel',
      depositHistory: Array.from({ length: 12 }, (_, i) => ({
        month: monthStr(-11 + i),
        amount: 150,
        date: dateInMonth(monthStr(-11 + i), 28),
      })),
    },
    {
      id: id('sav', 3), name: 'Neue Waschmaschine', targetAmount: 800,
      currentAmount: 800, monthlyContribution: 0, color: '#f59e0b', icon: 'Home',
      isCompleted: true, note: 'Gekauft!', createdAt: now, priority: 3,
      depositHistory: [],
    },
    {
      id: id('sav', 4), name: 'ETF-Sparplan Puffer', targetAmount: 5000,
      currentAmount: 1200, monthlyContribution: 100, color: '#8b5cf6', icon: 'TrendingUp',
      isCompleted: false, note: 'Extra-Einzahlungen wenn möglich', createdAt: now, priority: 4,
      depositHistory: Array.from({ length: 6 }, (_, i) => ({
        month: monthStr(-5 + i),
        amount: 100,
        date: dateInMonth(monthStr(-5 + i), 28),
      })),
    },
  ];

  // ---- BUDGET LIMITS ----
  const budgetLimits = [
    { id: id('bud', 1), category: 'food', amount: 350, monthlyLimit: 350, month: currentMonth, isRecurring: true },
    { id: id('bud', 2), category: 'dining', amount: 120, monthlyLimit: 120, month: currentMonth, isRecurring: true },
    { id: id('bud', 3), category: 'transport', amount: 80, monthlyLimit: 80, month: currentMonth, isRecurring: true },
    { id: id('bud', 4), category: 'leisure', amount: 100, monthlyLimit: 100, month: currentMonth, isRecurring: true },
    { id: id('bud', 5), category: 'shopping', amount: 150, monthlyLimit: 150, month: currentMonth, isRecurring: true },
    { id: id('bud', 6), category: 'health', amount: 60, monthlyLimit: 60, month: currentMonth, isRecurring: true },
    { id: id('bud', 7), category: 'personal', amount: 60, monthlyLimit: 60, month: currentMonth, isRecurring: true },
  ];

  // ---- INCOMES (recurring monthly) ----
  const incomes = Array.from({ length: 13 }, (_, i) => ({
    id: id('inc', i),
    name: 'Netto-Gehalt Siemens AG',
    amount: 3250,
    type: 'salary' as const,
    isRecurring: true,
    month: monthStr(-12 + i),
    date: dateInMonth(monthStr(-12 + i), 28),
    note: 'Gehaltseingang monatlich',
    createdAt: now,
    startMonth: monthStr(-12),
  }));

  // Freelance income (sporadic)
  const freelanceIncomes = [
    { id: id('inc', 'f1'), name: 'Web-Projekt Müller GmbH', amount: 850, type: 'freelance' as const, isRecurring: false, month: monthStr(-10), date: dateInMonth(monthStr(-10), 15), createdAt: now },
    { id: id('inc', 'f2'), name: 'Beratung StartupXY', amount: 1200, type: 'freelance' as const, isRecurring: false, month: monthStr(-7), date: dateInMonth(monthStr(-7), 20), createdAt: now },
    { id: id('inc', 'f3'), name: 'Landingpage Design', amount: 400, type: 'freelance' as const, isRecurring: false, month: monthStr(-4), date: dateInMonth(monthStr(-4), 8), createdAt: now },
    { id: id('inc', 'f4'), name: 'App-Feature Entwicklung', amount: 950, type: 'freelance' as const, isRecurring: false, month: monthStr(-1), date: dateInMonth(monthStr(-1), 22), createdAt: now },
  ];

  // Side income (rental)
  const rentalIncomes = [
    { id: id('inc', 'r1'), name: 'Parken Untermiete', amount: 60, type: 'rental' as const, isRecurring: true, month: monthStr(-12), date: dateInMonth(monthStr(-12), 5), createdAt: now },
    { id: id('inc', 'r2'), name: 'Parken Untermiete', amount: 60, type: 'rental' as const, isRecurring: true, month: monthStr(-6), date: dateInMonth(monthStr(-6), 5), createdAt: now },
  ];

  // ---- EXPENSES (realistic, spread over 12 months) ----
  type ExpCat = 'food' | 'dining' | 'transport' | 'leisure' | 'travel' | 'shopping' | 'subscriptions' | 'health' | 'household' | 'personal' | 'gifts' | 'other';

  interface ExpTemplate {
    desc: string;
    amount: number;
    cat: ExpCat;
    day: number;
  }

  const monthlyExpenses: ExpTemplate[] = [
    { desc: 'REWE Wocheneinkauf', amount: 82, cat: 'food', day: 3 },
    { desc: 'REWE Wocheneinkauf', amount: 76, cat: 'food', day: 10 },
    { desc: 'Aldi', amount: 43, cat: 'food', day: 17 },
    { desc: 'REWE Wocheneinkauf', amount: 91, cat: 'food', day: 24 },
    { desc: 'Drogerie Rossmann', amount: 34, cat: 'food', day: 14 },
    { desc: 'Restaurant zum Hirschen', amount: 42, cat: 'dining', day: 6 },
    { desc: 'Lunch Kantine', amount: 28, cat: 'dining', day: 18 },
    { desc: 'Tank BP', amount: 58, cat: 'transport', day: 8 },
    { desc: 'MVV Monatskarte', amount: 57, cat: 'transport', day: 1 },
    { desc: 'Kino', amount: 22, cat: 'leisure', day: 12 },
    { desc: 'Bücher Amazon', amount: 31, cat: 'leisure', day: 20 },
    { desc: 'Apotheke', amount: 18, cat: 'health', day: 9 },
    { desc: 'H&M Online', amount: 64, cat: 'shopping', day: 16 },
    { desc: 'Haircut', amount: 28, cat: 'personal', day: 22 },
    { desc: 'Putzmittel dm', amount: 14, cat: 'household', day: 11 },
  ];

  const extraExpenses: { month: number; items: ExpTemplate[] }[] = [
    { month: -12, items: [{ desc: 'Weihnachtsgeschenke', amount: 280, cat: 'gifts', day: 18 }, { desc: 'Weihnachtsmarkt', amount: 65, cat: 'leisure', day: 20 }] },
    { month: -11, items: [{ desc: 'Neujahrsparty', amount: 45, cat: 'dining', day: 2 }, { desc: 'Winterjacke Sale', amount: 129, cat: 'shopping', day: 15 }] },
    { month: -10, items: [{ desc: 'Arztrechnung Zahnarzt', amount: 140, cat: 'health', day: 7 }, { desc: 'Valentinstag Dinner', amount: 78, cat: 'dining', day: 14 }] },
    { month: -9, items: [{ desc: 'Frühjahrsputz Materialen', amount: 55, cat: 'household', day: 5 }, { desc: 'Laufschuhe Nike', amount: 115, cat: 'shopping', day: 22 }] },
    { month: -8, items: [{ desc: 'Osterurlaub Vorauszahlung', amount: 350, cat: 'travel', day: 10 }, { desc: 'Amazon Prime', amount: 8.99, cat: 'subscriptions', day: 3 }] },
    { month: -7, items: [{ desc: 'Osterurlaub Reise', amount: 420, cat: 'travel', day: 8 }, { desc: 'Outdoor-Ausrüstung', amount: 87, cat: 'leisure', day: 19 }] },
    { month: -6, items: [{ desc: 'Auto Inspektion', amount: 195, cat: 'transport', day: 14 }, { desc: 'LinkedIn Premium', amount: 39.99, cat: 'subscriptions', day: 1 }] },
    { month: -5, items: [{ desc: 'Sommermode Zara', amount: 98, cat: 'shopping', day: 8 }, { desc: 'Konzertticket', amount: 65, cat: 'leisure', day: 25 }] },
    { month: -4, items: [{ desc: 'Fernseher Samsung (Teilzahlung)', amount: 249, cat: 'household', day: 3 }, { desc: 'Geburtstag Freund', amount: 50, cat: 'gifts', day: 17 }] },
    { month: -3, items: [{ desc: 'Südostasien Flug Deposit', amount: 380, cat: 'travel', day: 12 }, { desc: 'Impfung Reisemedizin', amount: 85, cat: 'health', day: 20 }] },
    { month: -2, items: [{ desc: 'Herbstjacke Outfitter', amount: 89, cat: 'shopping', day: 4 }, { desc: 'Weinabend mit Freunden', amount: 55, cat: 'dining', day: 22 }] },
    { month: -1, items: [{ desc: 'Winterreifen Reifencheck', amount: 68, cat: 'transport', day: 6 }, { desc: 'Adventsmarkt', amount: 38, cat: 'leisure', day: 28 }] },
    { month: 0, items: [{ desc: 'Gymshark Sale', amount: 76, cat: 'shopping', day: 5 }, { desc: 'Dentalhygiene', amount: 75, cat: 'health', day: 11 }] },
  ];

  const allExpenses = Array.from({ length: 13 }, (_, mi) => {
    const mOffset = -12 + mi;
    const month = monthStr(mOffset);
    const extra = extraExpenses.find(e => e.month === mOffset)?.items || [];
    const baseItems = monthlyExpenses.map((e, ei) => ({
      id: id(`exp-${mi}`, ei),
      description: e.desc,
      amount: e.amount + (Math.random() * 10 - 5) * 0.1,
      category: e.cat,
      date: dateInMonth(month, e.day),
      month,
      accountId: id('acc', 1),
      createdAt: now,
    }));
    const extraItems = extra.map((e, ei) => ({
      id: id(`expx-${mi}`, ei),
      description: e.desc,
      amount: e.amount,
      category: e.cat,
      date: dateInMonth(month, e.day),
      month,
      accountId: id('acc', 1),
      createdAt: now,
    }));
    return [...baseItems, ...extraItems];
  }).flat();

  // ---- NET WORTH HISTORY ----
  const netWorthHistory = Array.from({ length: 13 }, (_, i) => ({
    month: monthStr(-12 + i),
    netWorth: 14200 + i * 480 + (i > 7 ? 800 : 0),
    totalAssets: 26000 + i * 620,
    totalDebts: 15050 - i * 140,
    recordedAt: now,
  }));

  // ---- CATEGORY RULES ----
  const categoryRules = [
    { id: id('rule', 1), keyword: 'REWE', category: 'food' as const, matchType: 'contains' as const, isActive: true, createdAt: now },
    { id: id('rule', 2), keyword: 'Aldi', category: 'food' as const, matchType: 'contains' as const, isActive: true, createdAt: now },
    { id: id('rule', 3), keyword: 'Tank', category: 'transport' as const, matchType: 'contains' as const, isActive: true, createdAt: now },
    { id: id('rule', 4), keyword: 'Netflix', category: 'subscriptions' as const, matchType: 'contains' as const, isActive: true, createdAt: now },
    { id: id('rule', 5), keyword: 'Apotheke', category: 'health' as const, matchType: 'contains' as const, isActive: true, createdAt: now },
  ];

  // ---- ACTIVITY LOG ----
  const activityLog = [
    { id: id('act', 1), action: 'create' as const, entity: 'income' as const, label: 'Gehalt März hinzugefügt', amount: 3250, createdAt: now },
    { id: id('act', 2), action: 'create' as const, entity: 'expense' as const, label: 'REWE Einkauf erfasst', amount: 82, createdAt: now },
    { id: id('act', 3), action: 'payment' as const, entity: 'debt' as const, label: 'Autokredit Rate gezahlt', amount: 320, createdAt: now },
    { id: id('act', 4), action: 'create' as const, entity: 'savingsGoal' as const, label: 'Urlaubsziel aktualisiert', createdAt: now },
    { id: id('act', 5), action: 'import' as const, entity: 'bankSync' as const, label: 'Bank-Sync: 34 Transaktionen importiert', createdAt: now },
  ];

  return {
    incomes: [...incomes, ...freelanceIncomes, ...rentalIncomes] as any,
    fixedExpenses,
    debts,
    expenses: allExpenses as any,
    savingsGoals: savingsGoals as any,
    budgetLimits,
    accounts,
    accountRules: [],
    transfers: [],
    bankConnections: [],
    syncSessions: [],
    freelanceProjects: [],
    workSessions: [],
    freelanceInvoices: [],
    invoiceProfile: {
      fullName: 'Max Mustermann', companyName: 'Max Mustermann IT', address: 'Musterstraße 1, 80331 München',
      email: 'max@mustermann.de', phone: '+49 151 12345678', taxId: '123/456/78901',
      iban: 'DE89 3704 0044 0532 0130 00', bic: 'COBADEFFXXX',
      invoicePrefix: 'RE', nextInvoiceNumber: 12, paymentTermDays: 14,
      place: 'München', useVat: false, defaultVatRate: 19, note: '',
    },
    netWorthHistory,
    notifications: [],
    settings: {
      ...DEFAULT_SETTINGS,
      currency: 'EUR',
      currencySymbol: '€',
      locale: 'de-DE',
      theme: 'system',
      dashboardWidgets: ['summary', 'budget', 'expense-overview', 'recent-expenses', 'savings', 'quick-stats', 'month-comparison'],
    } as any,
    selectedMonth: currentMonth,
    currentMonth,
    plannedIncomes: [],
    undoStack: [],
    activityLog,
    categoryRules,
    autoBookings: [],
    monthCloses: [],
  };
}
