// ============================================
// FINANZPLANNER - TYPE DEFINITIONS
// ============================================

// Einnahmen (Income)
export type IncomeType = 'salary' | 'sidejob' | 'freelance' | 'rental' | 'investment' | 'other';

export type BankImportMatchType = 'fixedExpense' | 'recurringIncome';

export interface BankImportMatch {
  type: BankImportMatchType;
  targetId: string;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  type: IncomeType;
  isRecurring: boolean;
  date?: string;
  month?: string;
  note?: string;
  accountId?: string;
  affectsAccountBalance?: boolean;
  createdAt: string;
  bankImportMatch?: BankImportMatch;
  /** Month from which this recurring income is effective (YYYY-MM). Recurring incomes before this month are excluded. */
  startMonth?: string;
  /** For future planning: month from which this income will take effect */
  effectiveFromMonth?: string;
}

// Planned future income for forecasting
export interface PlannedIncome {
  id: string;
  name: string;
  amount: number;
  type: IncomeType;
  startMonth: string; // "2026-10" - when this income begins
  isRecurring: boolean;
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
  autoBookEnabled?: boolean;
  note?: string;
  accountId?: string;
  createdAt: string;
  /** Optional link to a debt — auto-booking this expense also reduces the debt */
  linkedDebtId?: string;
}

// Schulden (Debts)
export type DebtType = 'loan' | 'credit_card' | 'mortgage' | 'personal' | 'student' | 'other';
export type DebtStrategy = 'avalanche' | 'snowball';

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

// Amortization schedule entry
export interface AmortizationEntry {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  remaining: number;
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
  linkedDebtId?: string;
  affectsAccountBalance?: boolean;
  isRecurring?: boolean;
  month: string; // "2026-04"
  tags?: string[];
  note?: string;
  attachment?: ExpenseAttachment;
  createdAt: string;
  bankImportMatch?: BankImportMatch;
  // Split transaction support
  splits?: ExpenseSplit[];
  // Planned (future) expense, not yet booked
  isPlanned?: boolean;
  // Auto-booking: links back to the source fixed expense or recurring income
  autoBookedFromId?: string;
  autoBookedType?: 'fixedExpense' | 'recurringIncome';
}

// Split transaction: one expense → multiple categories
export interface ExpenseSplit {
  category: ExpenseCategory;
  amount: number;
  description?: string;
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
  // Enhancement: goal image
  imageUrl?: string;
  // Enhancement: deposit history for streaks
  depositHistory?: SavingsDeposit[];
  priority?: number; // for auto-distribution ordering
}

export interface SavingsDeposit {
  month: string; // "2026-04"
  amount: number;
  date: string;
}

// Budget Limits
export interface BudgetLimit {
  id: string;
  category: ExpenseCategory;
  amount: number;
  monthlyLimit: number;
  month: string;
  isRecurring: boolean;
  // Enhancement: rollover unused budget
  enableRollover?: boolean;
  rolloverAmount?: number;
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
  // Enhancement: credit card billing
  billingCycleDay?: number; // day of month billing cycle starts
  paymentDueDay?: number; // day of month payment is due
}

// Auto-assign rules for accounts
export interface AccountRule {
  id: string;
  keyword: string; // match expense description
  accountId: string;
  category?: ExpenseCategory; // optionally also assign category
  matchType?: 'contains' | 'startsWith' | 'exact';
  isActive?: boolean;
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
    monthlyReport: boolean;
  };
  // Freelance earning limit (yearly tax threshold)
  freelanceYearlyLimit?: number;
  freelanceYearlyLimitYear?: string; // e.g. "2026" - which year the limit applies to
  // Email report
  reportEmail?: string;
  emailReportFrequency?: 'none' | 'weekly' | 'monthly';
  // Sidebar menu visibility - hrefs of hidden menu items
  hiddenMenuItems?: string[];
  userExperience: {
    onboardingCompleted: boolean;
    initialSetupCompleted: boolean;
    shortcutsHintSeen: boolean;
    mode: 'guided' | 'standard' | 'power';
    profile: 'personal' | 'freelance' | 'complete';
  };
}

// Bank Sync
export type BankType = 'elba' | 'generic' | 'gocardless' | 'tradeRepublic';

export type BankConnectionProvider = 'manual-elba' | 'gocardless' | 'trade-republic-webhook';

export type BankConnectionSyncMode = 'manual-file' | 'provider-pull' | 'provider-push';

export type BankConnectionSyncTarget = 'balance' | 'transactions';

export type BankConnectionStatus = 'draft' | 'pending' | 'active' | 'needsReauth' | 'error';

export interface BankConnection {
  id: string;
  name: string;
  bankType: BankType;
  provider?: BankConnectionProvider;
  syncMode?: BankConnectionSyncMode;
  providerStatus?: BankConnectionStatus;
  accountId?: string;
  institutionId?: string;
  institutionName?: string;
  remoteAccountId?: string;
  remoteAccountIds?: string[];
  autoSyncEnabled?: boolean;
  syncTargets?: BankConnectionSyncTarget[];
  syncFrequency?: 'manual' | 'hourly' | 'daily';
  requisitionId?: string;
  callbackReference?: string;
  lastBalance?: number;
  lastBalanceCurrency?: string;
  lastBalanceAt?: string;
  lastSyncError?: string;
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
  source?: BankConnectionSyncMode;
  status?: 'success' | 'warning' | 'error';
  message?: string;
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

// Auto-Booking: tracks which recurring items have been booked for which month
export interface AutoBooking {
  id: string;
  month: string; // "2026-04"
  sourceType: 'fixedExpense' | 'recurringIncome';
  sourceId: string;
  bookedExpenseId?: string;
  bookedIncomeId?: string;
  accountId?: string;
  preserveBookedExpenseOnUndo?: boolean;
  debtPaymentApplied?: boolean;
  linkedDebtId?: string;
  amount: number;
  createdAt: string;
}

// Month-End Close: tracks wizard completion per month
export interface MonthClose {
  id: string;
  month: string;
  completedAt: string;
  autoBookingConfirmed: boolean;
  savingsAllocated: boolean;
  budgetRolloverConfirmed: boolean;
  savingsAllocations: { goalId: string; amount: number }[];
  budgetRollovers: { budgetId: string; rolloverAmount: number }[];
  summary: {
    totalIncome: number;
    totalFixedExpenses: number;
    totalVariableExpenses: number;
    totalDebtPayments: number;
    totalSaved: number;
    remaining: number;
  };
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
  accountRules: AccountRule[];
  transfers: Transfer[];
  bankConnections: BankConnection[];
  syncSessions: SyncSession[];
  freelanceProjects: FreelanceProject[];
  workSessions: WorkSession[];
  freelanceInvoices: FreelanceInvoice[];
  invoiceProfile: InvoiceProfile;
  netWorthHistory: NetWorthSnapshot[];
  notifications: AppNotification[];
  settings: Settings;
  selectedMonth: string;
  currentMonth: string;
  // Planned future incomes for forecasting
  plannedIncomes: PlannedIncome[];
  // UX: undo history
  undoStack: UndoEntry[];
  // Activity log
  activityLog: ActivityLogEntry[];
  // Category auto-rules
  categoryRules: CategoryRule[];
  // Auto-booking tracking
  autoBookings: AutoBooking[];
  // Month-end wizard tracking
  monthCloses: MonthClose[];
}

// Nettovermögens-Historie
export interface NetWorthSnapshot {
  month: string; // "2026-04"
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
  recordedAt: string;
}

// In-App Benachrichtigungen
export type NotificationType = 'budget-warning' | 'bill-reminder' | 'savings-milestone' | 'debt-info' | 'monthly-report' | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  icon?: string;
  color?: string;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

// Category Info für UI
export interface CategoryInfo {
  id: string;
  label: string;
  labelDe: string;
  icon: string;
  color: string;
}

// Undo/Redo support
export interface UndoEntry {
  label: string;
  timestamp: number;
  patch: Partial<FinanceState>;
}

// Activity Log
export type ActivityAction = 'create' | 'update' | 'delete' | 'import' | 'payment' | 'transfer';
export type ActivityEntity = 'income' | 'fixedExpense' | 'expense' | 'debt' | 'savingsGoal' | 'budgetLimit' | 'account' | 'transfer' | 'freelanceProject' | 'workSession' | 'freelanceInvoice' | 'settings' | 'bankSync' | 'other';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  label: string;
  details?: string;
  amount?: number;
  createdAt: string;
}

// Category Rules (auto-categorization)
export interface CategoryRule {
  id: string;
  keyword: string; // e.g. "REWE", "Amazon"
  category: ExpenseCategory;
  matchType: 'contains' | 'startsWith' | 'exact';
  isActive: boolean;
  createdAt: string;
}
