// ============================================
// FINANZPLANNER - TYPE DEFINITIONS
// ============================================

// Einnahmen (Income)
export type IncomeType = 'salary' | 'sidejob' | 'freelance' | 'rental' | 'investment' | 'other';

export interface Income {
  id: string;
  name: string;
  amount: number;
  type: IncomeType;
  isRecurring: boolean;
  date?: string;
  month?: string;
  note?: string;
  createdAt: string;
}

// Fixkosten (Fixed Expenses)
export type FixedExpenseCategory = 
  | 'housing' 
  | 'utilities' 
  | 'insurance' 
  | 'subscriptions' 
  | 'transport' 
  | 'communication'
  | 'education'
  | 'other';

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: FixedExpenseCategory;
  dueDay: number; // 1-31
  isActive: boolean;
  note?: string;
  createdAt: string;
}

// Schulden (Debts)
export type DebtType = 'loan' | 'credit_card' | 'mortgage' | 'personal' | 'student' | 'other';

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate: number;
  type: DebtType;
  startDate: string;
  note?: string;
  createdAt: string;
}

// Variable Ausgaben (Variable Expenses)
export type BuiltInExpenseCategory =
  | 'food' 
  | 'dining'
  | 'transport' 
  | 'leisure' 
  | 'travel'
  | 'shopping' 
  | 'subscriptions'
  | 'family'
  | 'pets'
  | 'work'
  | 'fees'
  | 'health' 
  | 'education'
  | 'gifts'
  | 'household'
  | 'personal'
  | 'other';

export type ExpenseCategory = BuiltInExpenseCategory | (string & {});

export interface ExpenseAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface CustomCategory {
  id: string;
  label: string;
  labelDe: string;
  icon: string;
  color: string;
}

export type AIProvider = 'disabled' | 'gemini' | 'openai-compatible' | 'openrouter';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  apiKey: string;
  endpoint?: string;
  receiptAssistant: boolean;
  voiceAssistant: boolean;
  confirmBeforeSave: boolean;
}

export interface GoogleDriveSettings {
  clientId: string;
  folderId?: string;
  lastBackupAt?: string;
  lastBackupFileId?: string;
  lastBackupFileName?: string;
  liveSyncFileId?: string;
  liveSyncFileName?: string;
  lastLiveSyncAt?: string;
}

export interface LocalFolderSettings {
  directoryName?: string;
  lastBackupAt?: string;
  lastBackupFileName?: string;
  liveSyncFileName?: string;
  lastLiveSyncAt?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // ISO date string
  accountId?: string;
  isRecurring?: boolean;
  month: string; // "2026-04"
  tags?: string[];
  note?: string;
  attachment?: ExpenseAttachment;
  createdAt: string;
}

// Sparziele (Savings Goals)
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline?: string;
  color: string;
  icon: string;
  goalCategory?: string;
  isCompleted: boolean;
  note?: string;
  createdAt: string;
}

// Budget Limits
export interface BudgetLimit {
  id: string;
  category: ExpenseCategory;
  amount: number;
  monthlyLimit: number;
  month: string;
  isRecurring: boolean;
}

// Konten (Accounts)
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  icon: string;
  isDefault: boolean;
  note?: string;
  createdAt: string;
}

// Überweisung zwischen Konten
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

// Monatszusammenfassung
export interface MonthSummary {
  month: string;
  totalIncome: number;
  totalFixedExpenses: number;
  totalDebtPayments: number;
  totalVariableExpenses: number;
  totalSavings: number;
  remaining: number;
  expensesByCategory: Record<string, number>;
}

// Einstellungen
export interface Settings {
  currency: string;
  currencySymbol: string;
  locale: string;
  dateFormat: string;
  firstDayOfWeek: 0 | 1;
  theme: 'light' | 'dark' | 'system';
  showCents: boolean;
  defaultView: 'dashboard' | 'expenses' | 'budget' | 'savings' | 'analytics' | 'accounts' | 'banksync' | 'freelance';
  budgetWarningThreshold: number;
  monthStartDay: number;
  analyticsMonths: 6 | 12;
  storageMode: 'local' | 'hybrid' | 'cloud-export';
  backupProvider: 'device' | 'local-folder' | 'icloud' | 'google-drive' | 'dropbox' | 'onedrive';
  backupFrequency: 'manual' | 'live' | 'weekly' | 'monthly';
  quickEntry: boolean;
  dashboardWidgets: string[];
  customExpenseCategories: CustomCategory[];
  lastUsedExpenseCategory?: string;
  lastUsedAccountId?: string;
  lastUsedExpenseTags: string[];
  ai: AISettings;
  googleDrive: GoogleDriveSettings;
  localFolder: LocalFolderSettings;
  notifications: {
    budgetWarnings: boolean;
    billReminders: boolean;
    savingsGoals: boolean;
  };
}

// Bank Sync
export type BankType = 'elba' | 'generic';

export interface BankConnection {
  id: string;
  name: string;
  bankType: BankType;
  accountId?: string;
  lastSyncAt?: string;
  lastSyncCount?: number;
  createdAt: string;
}

export interface SyncSession {
  id: string;
  connectionId: string;
  syncedAt: string;
  fileName: string;
  transactionCount: number;
  newCount: number;
  skippedCount: number;
}

export interface FreelanceProject {
  id: string;
  name: string;
  clientName: string;
  clientAddress?: string;
  hourlyRate: number;
  travelFlatFee?: number;
  saturdaySurchargePercent?: number;
  vatRate: number;
  isActive: boolean;
  note?: string;
  createdAt: string;
}

export interface WorkSession {
  id: string;
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours?: number;
  breakMinutes: number;
  description: string;
  billable: boolean;
  applyTravelFlat?: boolean;
  customHourlyRate?: number;
  customSaturdaySurchargePercent?: number;
  extraFlatFee?: number;
  invoiceId?: string;
  createdAt: string;
}

export interface InvoiceProfile {
  fullName: string;
  companyName: string;
  address: string;
  email: string;
  phone: string;
  taxId: string;
  iban: string;
  bic: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermDays: number;
  place: string;
  useVat: boolean;
  defaultVatRate: number;
  note?: string;
}

export type FreelanceInvoiceStatus = 'issued' | 'paid' | 'cancelled';

export interface FreelanceInvoice {
  id: string;
  projectId: string;
  invoiceNumber: string;
  issueDate: string;
  serviceMonth: string;
  clientName: string;
  clientAddress?: string;
  sessionIds: string[];
  hours: number;
  hourlyRate: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  status: FreelanceInvoiceStatus;
  paidDate?: string;
  createdAt: string;
}

// App State
export interface FinanceState {
  incomes: Income[];
  fixedExpenses: FixedExpense[];
  debts: Debt[];
  expenses: Expense[];
  savingsGoals: SavingsGoal[];
  budgetLimits: BudgetLimit[];
  accounts: Account[];
  transfers: Transfer[];
  bankConnections: BankConnection[];
  syncSessions: SyncSession[];
  freelanceProjects: FreelanceProject[];
  workSessions: WorkSession[];
  freelanceInvoices: FreelanceInvoice[];
  invoiceProfile: InvoiceProfile;
  settings: Settings;
  selectedMonth: string;
  currentMonth: string;
}

// Category Info für UI
export interface CategoryInfo {
  id: string;
  label: string;
  labelDe: string;
  icon: string;
  color: string;
}
