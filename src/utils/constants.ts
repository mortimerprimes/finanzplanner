import { CategoryInfo, BuiltInExpenseCategory, FixedExpenseCategory, IncomeType, DebtType, AccountType } from '../types';

// Expense Categories
export const EXPENSE_CATEGORIES: Record<BuiltInExpenseCategory, CategoryInfo> = {
  food: { id: 'food', label: 'Groceries', labelDe: 'Lebensmittel & Drogerie', icon: 'ShoppingBasket', color: '#f97316' },
  dining: { id: 'dining', label: 'Dining Out', labelDe: 'Restaurants & Cafes', icon: 'UtensilsCrossed', color: '#fb7185' },
  transport: { id: 'transport', label: 'Mobility', labelDe: 'Mobilität & Tanken', icon: 'Car', color: '#3b82f6' },
  leisure: { id: 'leisure', label: 'Leisure', labelDe: 'Freizeit & Events', icon: 'PartyPopper', color: '#8b5cf6' },
  travel: { id: 'travel', label: 'Travel', labelDe: 'Reisen & Urlaub', icon: 'Plane', color: '#0ea5e9' },
  shopping: { id: 'shopping', label: 'Shopping', labelDe: 'Shopping & Kleidung', icon: 'ShoppingBag', color: '#ec4899' },
  subscriptions: { id: 'subscriptions', label: 'Subscriptions', labelDe: 'Abos & Apps', icon: 'Tv', color: '#6366f1' },
  family: { id: 'family', label: 'Family', labelDe: 'Kinder & Familie', icon: 'Users', color: '#14b8a6' },
  pets: { id: 'pets', label: 'Pets', labelDe: 'Haustiere', icon: 'PawPrint', color: '#f59e0b' },
  work: { id: 'work', label: 'Work', labelDe: 'Beruf & Büro', icon: 'Briefcase', color: '#64748b' },
  fees: { id: 'fees', label: 'Fees & Taxes', labelDe: 'Gebühren & Steuern', icon: 'ReceiptText', color: '#475569' },
  health: { id: 'health', label: 'Health', labelDe: 'Gesundheit & Apotheke', icon: 'Heart', color: '#ef4444' },
  education: { id: 'education', label: 'Education', labelDe: 'Bildung & Bücher', icon: 'GraduationCap', color: '#06b6d4' },
  gifts: { id: 'gifts', label: 'Gifts', labelDe: 'Geschenke & Spenden', icon: 'Gift', color: '#f43f5e' },
  household: { id: 'household', label: 'Home & Household', labelDe: 'Wohnen & Haushalt', icon: 'Home', color: '#84cc16' },
  personal: { id: 'personal', label: 'Lifestyle', labelDe: 'Lifestyle & Beauty', icon: 'User', color: '#a855f7' },
  other: { id: 'other', label: 'Other', labelDe: 'Sonstiges', icon: 'MoreHorizontal', color: '#6b7280' },
};

// Fixed Expense Categories
export const FIXED_EXPENSE_CATEGORIES: Record<FixedExpenseCategory, CategoryInfo> = {
  housing: { id: 'housing', label: 'Housing', labelDe: 'Wohnung & Miete', icon: 'Home', color: '#3b82f6' },
  utilities: { id: 'utilities', label: 'Utilities', labelDe: 'Strom & Gas', icon: 'Zap', color: '#f59e0b' },
  insurance: { id: 'insurance', label: 'Insurance', labelDe: 'Versicherungen', icon: 'Shield', color: '#10b981' },
  subscriptions: { id: 'subscriptions', label: 'Subscriptions', labelDe: 'Abonnements', icon: 'Tv', color: '#8b5cf6' },
  transport: { id: 'transport', label: 'Transport', labelDe: 'Transport', icon: 'Car', color: '#06b6d4' },
  communication: { id: 'communication', label: 'Communication', labelDe: 'Handy & Internet', icon: 'Smartphone', color: '#ec4899' },
  education: { id: 'education', label: 'Education', labelDe: 'Bildung', icon: 'GraduationCap', color: '#14b8a6' },
  other: { id: 'other', label: 'Other', labelDe: 'Sonstiges', icon: 'MoreHorizontal', color: '#6b7280' },
};

// Income Types
export const INCOME_TYPES: Record<IncomeType, CategoryInfo> = {
  salary: { id: 'salary', label: 'Salary', labelDe: 'Gehalt', icon: 'Briefcase', color: '#10b981' },
  sidejob: { id: 'sidejob', label: 'Side Job', labelDe: 'Nebenjob', icon: 'Hammer', color: '#f59e0b' },
  freelance: { id: 'freelance', label: 'Freelance', labelDe: 'Freiberuflich', icon: 'Laptop', color: '#8b5cf6' },
  rental: { id: 'rental', label: 'Rental Income', labelDe: 'Mieteinnahmen', icon: 'Building', color: '#3b82f6' },
  investment: { id: 'investment', label: 'Investment', labelDe: 'Investitionen', icon: 'TrendingUp', color: '#06b6d4' },
  other: { id: 'other', label: 'Other', labelDe: 'Sonstiges', icon: 'MoreHorizontal', color: '#6b7280' },
};

// Debt Types
export const DEBT_TYPES: Record<DebtType, CategoryInfo> = {
  loan: { id: 'loan', label: 'Loan', labelDe: 'Kredit', icon: 'Banknote', color: '#ef4444' },
  credit_card: { id: 'credit_card', label: 'Credit Card', labelDe: 'Kreditkarte', icon: 'CreditCard', color: '#f97316' },
  mortgage: { id: 'mortgage', label: 'Mortgage', labelDe: 'Hypothek', icon: 'Home', color: '#3b82f6' },
  personal: { id: 'personal', label: 'Personal Loan', labelDe: 'Privatkredit', icon: 'Users', color: '#8b5cf6' },
  student: { id: 'student', label: 'Student Loan', labelDe: 'Studienkredit', icon: 'GraduationCap', color: '#06b6d4' },
  other: { id: 'other', label: 'Other', labelDe: 'Sonstiges', icon: 'MoreHorizontal', color: '#6b7280' },
};

// Account Types
export const ACCOUNT_TYPES: Record<AccountType, CategoryInfo> = {
  checking: { id: 'checking', label: 'Checking', labelDe: 'Girokonto', icon: 'Wallet', color: '#3b82f6' },
  savings: { id: 'savings', label: 'Savings', labelDe: 'Sparkonto', icon: 'PiggyBank', color: '#10b981' },
  cash: { id: 'cash', label: 'Cash', labelDe: 'Bargeld', icon: 'Banknote', color: '#f59e0b' },
  credit: { id: 'credit', label: 'Credit', labelDe: 'Kreditkarte', icon: 'CreditCard', color: '#ef4444' },
  investment: { id: 'investment', label: 'Investment', labelDe: 'Depot', icon: 'TrendingUp', color: '#8b5cf6' },
};

// Default Settings
export const DEFAULT_SETTINGS = {
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'de-DE',
  dateFormat: 'dd.MM.yyyy',
  firstDayOfWeek: 1 as const,
  theme: 'system' as const,
  showCents: true,
  defaultView: 'dashboard' as const,
  budgetWarningThreshold: 80,
  monthStartDay: 1,
  analyticsMonths: 6 as const,
  storageMode: 'local' as const,
  backupProvider: 'local-folder' as const,
  backupFrequency: 'manual' as const,
  quickEntry: true,
  dashboardWidgets: ['summary', 'budget', 'expense-overview', 'recent-expenses', 'savings', 'quick-stats'],
  customExpenseCategories: [],
  lastUsedExpenseCategory: 'food',
  lastUsedAccountId: undefined,
  lastUsedExpenseTags: [],
  ai: {
    enabled: false,
    provider: 'disabled' as const,
    model: 'gemini-2.5-flash',
    apiKey: '',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    receiptAssistant: true,
    voiceAssistant: true,
    confirmBeforeSave: true,
  },
  googleDrive: {
    clientId: '',
    folderId: '',
    lastBackupAt: '',
    lastBackupFileId: '',
    lastBackupFileName: '',
    liveSyncFileId: '',
    liveSyncFileName: '',
    lastLiveSyncAt: '',
  },
  localFolder: {
    directoryName: '',
    lastBackupAt: '',
    lastBackupFileName: '',
    liveSyncFileName: '',
    lastLiveSyncAt: '',
  },
  notifications: {
    budgetWarnings: true,
    billReminders: true,
    savingsGoals: true,
  },
};

// Available Currencies
export const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
];

// Savings Goal Icons
export const SAVINGS_GOAL_ICONS = [
  'Car', 'Plane', 'Home', 'Smartphone', 'Laptop', 'Camera',
  'Palmtree', 'GraduationCap', 'Heart', 'Gift', 'Music', 'Gamepad',
  'Bike', 'Watch', 'Gem', 'Umbrella', 'Target', 'Star',
];

// Colors for UI
export const UI_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
];

export const DASHBOARD_WIDGET_OPTIONS = [
  { id: 'summary', label: 'Finanzübersicht' },
  { id: 'budget', label: 'Budgetstatus' },
  { id: 'expense-overview', label: 'Ausgabenstruktur' },
  { id: 'recent-expenses', label: 'Letzte Ausgaben' },
  { id: 'savings', label: 'Sparziele' },
  { id: 'quick-stats', label: 'Schnellstatistiken' },
];

export const AI_PROVIDER_OPTIONS = [
  { value: 'disabled', label: 'Deaktiviert' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai-compatible', label: 'OpenAI-kompatibel' },
];

export const AI_ENDPOINT_PRESETS = {
  gemini: [
    { label: 'Google Gemini API', value: 'https://generativelanguage.googleapis.com/v1beta/models' },
  ],
  openrouter: [
    { label: 'OpenRouter Chat API', value: 'https://openrouter.ai/api/v1/chat/completions' },
  ],
  'openai-compatible': [
    { label: 'OpenAI Chat Completions', value: 'https://api.openai.com/v1/chat/completions' },
    { label: 'Lokaler OpenAI-kompatibler Server', value: 'http://localhost:1234/v1/chat/completions' },
    { label: 'Ollama OpenAI-kompatibel', value: 'http://localhost:11434/v1/chat/completions' },
  ],
} as const;

export const AI_PROVIDER_DEFAULTS = {
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.5-flash',
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemini-2.5-flash-preview',
  },
  'openai-compatible': {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
  },
} as const;
