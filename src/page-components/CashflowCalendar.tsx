import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFinance } from '@/lib/finance-context';
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, MonthPicker, Select } from '../components/ui';
import { DEBT_TYPES, FIXED_EXPENSE_CATEGORIES, INCOME_TYPES } from '../utils/constants';
import {
  formatCurrency,
  formatDate,
  getExpenseCategoryMap,
  getExpenseCategoryInfo,
  getMonthDisplayName,
  parseTags,
  reconcileFixedExpensesForMonth,
  reconcileIncomesForMonth,
  shiftMonth,
} from '../utils/helpers';
import type { Debt, DebtType, Expense, ExpenseCategory, FixedExpense, FixedExpenseCategory, Income, IncomeType, Transfer } from '../types';

type LedgerStatus = 'booked' | 'planned';
type LedgerDirection = 'in' | 'out' | 'transfer';
type LedgerOrigin = 'income' | 'expense' | 'fixedExpense' | 'debt' | 'transfer';
type LedgerDeleteAction = 'DELETE_INCOME' | 'DELETE_EXPENSE' | 'DELETE_FIXED_EXPENSE' | 'DELETE_DEBT' | 'DELETE_TRANSFER';
type EditableEntityType = 'income' | 'expense' | 'fixedExpense' | 'debt' | 'transfer';

interface LedgerNoteMeta {
  displayNote?: string;
  importSource?: string;
  importAccount?: string;
}

interface LedgerEditFormState {
  entityType: EditableEntityType;
  sourceId: string;
  title: string;
  amount: string;
  date: string;
  note: string;
  accountId: string;
  category: string;
  dueDay: string;
  linkedDebtId: string;
  totalAmount: string;
  remainingAmount: string;
  monthlyPayment: string;
  interestRate: string;
  transferFromAccountId: string;
  transferToAccountId: string;
  effectiveFromMonth: string;
  tags: string;
  importSource: string;
  importAccount: string;
}

interface RawLedgerEntry {
  id: string;
  origin: LedgerOrigin;
  sourceId: string;
  date: string;
  title: string;
  amount: number;
  status: LedgerStatus;
  icon: string;
  color: string;
  sourceLabel: string;
  categoryLabel?: string;
  detail: string;
  note?: string;
  accountId?: string;
  accountName?: string;
  secondaryAccountId?: string;
  secondaryAccountName?: string;
  recurring?: boolean;
  imported?: boolean;
  tags?: string[];
  entityType: EditableEntityType;
  counterparty?: string;
  valueDate: string;
  displayNote?: string;
  importSource?: string;
  importAccount?: string;
  pageHref: string;
  pageLabel: string;
  deleteActionType?: LedgerDeleteAction;
  deleteActionLabel?: string;
}

interface LedgerEntry extends RawLedgerEntry {
  direction: LedgerDirection;
  signedAmount: number;
  runningBalanceAfter?: number;
}

const FALLBACK_INFO = {
  icon: 'Landmark',
  color: '#64748b',
  labelDe: 'Sonstiges',
};

const isBankImportedExpense = (note?: string, tags?: string[]) =>
  Boolean(tags?.includes('bankimport') || tags?.includes('banksync') || (note || '').includes('Quelle:'));

const isBankImportedIncome = (income: Pick<Income, 'note'>) => Boolean((income.note || '').includes('Quelle:'));

function parseLedgerNoteMeta(note?: string): LedgerNoteMeta {
  if (!note) return {};

  const parts = note.split(' · ').map((part) => part.trim()).filter(Boolean);
  const remaining: string[] = [];
  let importSource: string | undefined;
  let importAccount: string | undefined;

  parts.forEach((part) => {
    const normalized = part.toLowerCase();
    if (normalized.startsWith('quelle:')) {
      importSource = part.slice(part.indexOf(':') + 1).trim();
      return;
    }
    if (normalized.startsWith('importkonto:')) {
      importAccount = part.slice(part.indexOf(':') + 1).trim();
      return;
    }
    remaining.push(part);
  });

  return {
    displayNote: remaining.join(' · ') || undefined,
    importSource,
    importAccount,
  };
}

function composeLedgerNote(displayNote?: string, importAccount?: string, importSource?: string): string | undefined {
  return [
    displayNote?.trim(),
    importAccount ? `Importkonto: ${importAccount}` : '',
    importSource ? `Quelle: ${importSource}` : '',
  ].filter(Boolean).join(' · ') || undefined;
}

function roundStatementBalance(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampDateToMonth(month: string, preferredDay: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const maxDay = new Date(year, monthNumber, 0).getDate();
  const safeDay = Math.min(Math.max(preferredDay || 1, 1), maxDay);
  return `${month}-${String(safeDay).padStart(2, '0')}`;
}

function resolveIncomeDate(month: string, income: Pick<Income, 'date'>): string {
  const preferredDay = income.date ? Number(income.date.slice(8, 10)) : 1;
  return clampDateToMonth(month, preferredDay);
}

function isIncomeRelevantForMonth(income: Income, month: string): boolean {
  if (income.isRecurring) {
    const startMonth = income.startMonth || income.createdAt?.slice(0, 7);
    if (startMonth && month < startMonth) return false;
    if (income.effectiveFromMonth && month < income.effectiveFromMonth) return false;
    return true;
  }

  const incomeMonth = income.month || income.date?.slice(0, 7) || income.createdAt?.slice(0, 7);
  return incomeMonth === month;
}

function isFixedExpenseRelevantForMonth(fixedExpense: FixedExpense, month: string): boolean {
  const createdMonth = fixedExpense.createdAt?.slice(0, 7);
  if (createdMonth && month < createdMonth) return false;
  return fixedExpense.isActive;
}

function isDebtRelevantForMonth(debt: Debt, month: string): boolean {
  const startMonth = debt.startDate?.slice(0, 7);
  if (startMonth && month < startMonth) return false;
  return debt.remainingAmount > 0;
}

function getDirectionLabel(direction: LedgerDirection): string {
  if (direction === 'in') return 'Eingang';
  if (direction === 'out') return 'Ausgang';
  return 'Umbuchung';
}

function getStatusLabel(status: LedgerStatus): string {
  return status === 'booked' ? 'Gebucht' : 'Geplant';
}

function getAmountLabel(entry: LedgerEntry, settings: ReturnType<typeof useFinance>['state']['settings']): string {
  if (entry.direction === 'transfer' && entry.signedAmount === 0) {
    return formatCurrency(entry.amount, settings);
  }
  return `${entry.signedAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(entry.signedAmount), settings)}`;
}

function getDateLabel(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return 'Heute';
  return formatDate(date, 'EEEE, dd.MM.yyyy');
}

export function CashflowCalendar() {
  const router = useRouter();
  const { state, dispatch } = useFinance();
  const { settings, incomes, fixedExpenses, debts, expenses, transfers, selectedMonth, currentMonth, accounts } = state;
  const [viewMonth, setViewMonth] = useState(selectedMonth);
  const [accountFilter, setAccountFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | LedgerDirection>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | LedgerStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [editForm, setEditForm] = useState<LedgerEditFormState | null>(null);

  useEffect(() => {
    setViewMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (accountFilter !== 'all' && !accounts.some((account) => account.id === accountFilter)) {
      setAccountFilter('all');
    }
  }, [accountFilter, accounts]);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const fixedExpenseMap = useMemo(() => new Map(fixedExpenses.map((fixedExpense) => [fixedExpense.id, fixedExpense])), [fixedExpenses]);
  const debtMap = useMemo(() => new Map(debts.map((debt) => [debt.id, debt])), [debts]);
  const selectedAccount = accountFilter !== 'all' ? accountMap.get(accountFilter) || null : null;

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.month === viewMonth),
    [expenses, viewMonth]
  );
  const monthTransfers = useMemo(
    () => transfers.filter((transfer) => transfer.date.startsWith(viewMonth)),
    [transfers, viewMonth]
  );
  const monthIncomes = useMemo(
    () => incomes.filter((income) => isIncomeRelevantForMonth(income, viewMonth)),
    [incomes, viewMonth]
  );

  const incomeReconciliation = useMemo(
    () => reconcileIncomesForMonth(incomes, viewMonth),
    [incomes, viewMonth]
  );
  const fixedReconciliation = useMemo(
    () => reconcileFixedExpensesForMonth(fixedExpenses, expenses, viewMonth),
    [fixedExpenses, expenses, viewMonth]
  );

  const rawEntries = useMemo(() => {
    const entries: RawLedgerEntry[] = [];
    const matchedFixedExpenseByExpenseId = new Map<string, FixedExpense>();
    const autoBookedFixedExpenseByExpenseId = new Map<string, FixedExpense>();
    const representedFixedExpenseIds = new Set<string>();
    const coveredDebtIds = new Set<string>();

    fixedReconciliation.entries.forEach((entry) => {
      if (entry.matchedImportedExpenseId) {
        const fixedExpense = fixedExpenseMap.get(entry.fixedExpenseId);
        if (fixedExpense) {
          matchedFixedExpenseByExpenseId.set(entry.matchedImportedExpenseId, fixedExpense);
          representedFixedExpenseIds.add(fixedExpense.id);
          if (fixedExpense.linkedDebtId) {
            coveredDebtIds.add(fixedExpense.linkedDebtId);
          }
        }
      }
    });

    monthExpenses.forEach((expense) => {
      if (expense.autoBookedType === 'fixedExpense' && expense.autoBookedFromId) {
        const fixedExpense = fixedExpenseMap.get(expense.autoBookedFromId);
        if (fixedExpense) {
          autoBookedFixedExpenseByExpenseId.set(expense.id, fixedExpense);
          representedFixedExpenseIds.add(fixedExpense.id);
          if (fixedExpense.linkedDebtId) {
            coveredDebtIds.add(fixedExpense.linkedDebtId);
          }
        }
      }
      if (expense.linkedDebtId) {
        coveredDebtIds.add(expense.linkedDebtId);
      }
    });

    monthIncomes.forEach((income) => {
      if (income.isRecurring && incomeReconciliation.matchedRecurringIds.has(income.id)) {
        return;
      }

      const incomeInfo = INCOME_TYPES[income.type] || FALLBACK_INFO;
      const imported = isBankImportedIncome(income);
      const noteMeta = parseLedgerNoteMeta(income.note);
      const accountName = income.accountId ? accountMap.get(income.accountId)?.name : undefined;
      const postingDate = income.date?.startsWith(viewMonth) ? income.date : resolveIncomeDate(viewMonth, income);
      const status: LedgerStatus = imported || viewMonth <= currentMonth ? 'booked' : 'planned';

      entries.push({
        id: `income-${income.id}`,
        origin: 'income',
        sourceId: income.id,
        date: postingDate,
        title: income.name,
        amount: income.amount,
        status,
        icon: incomeInfo.icon,
        color: incomeInfo.color,
        sourceLabel: 'Einnahme',
        categoryLabel: incomeInfo.labelDe,
        detail: [incomeInfo.labelDe, accountName, imported ? 'Bankimport' : income.isRecurring ? 'Wiederkehrend' : 'Manuell']
          .filter(Boolean)
          .join(' • '),
        note: income.note,
        displayNote: noteMeta.displayNote,
        accountId: income.accountId,
        accountName,
        recurring: income.isRecurring,
        imported,
        entityType: 'income',
        counterparty: income.name,
        valueDate: postingDate,
        importSource: noteMeta.importSource,
        importAccount: noteMeta.importAccount,
        pageHref: '/income',
        pageLabel: 'Zu Einnahmen',
        deleteActionType: 'DELETE_INCOME',
        deleteActionLabel: 'Einnahme löschen',
      });
    });

    monthExpenses.forEach((expense) => {
      const matchedFixedExpense = matchedFixedExpenseByExpenseId.get(expense.id) || autoBookedFixedExpenseByExpenseId.get(expense.id);
      const linkedDebt = expense.linkedDebtId ? debtMap.get(expense.linkedDebtId) : undefined;
      const noteMeta = parseLedgerNoteMeta(expense.note);
      const expenseInfo = matchedFixedExpense
        ? FIXED_EXPENSE_CATEGORIES[matchedFixedExpense.category]
        : linkedDebt
          ? DEBT_TYPES[linkedDebt.type]
          : getExpenseCategoryInfo(expense.category, settings);
      const accountName = expense.accountId ? accountMap.get(expense.accountId)?.name : undefined;
      const sourceLabel = linkedDebt ? 'Kreditrate' : matchedFixedExpense ? 'Fixkosten' : 'Ausgabe';
      const categoryLabel = linkedDebt
        ? linkedDebt.name
        : matchedFixedExpense
          ? FIXED_EXPENSE_CATEGORIES[matchedFixedExpense.category]?.labelDe || FALLBACK_INFO.labelDe
          : getExpenseCategoryInfo(expense.category, settings).labelDe;

      entries.push({
        id: `expense-${expense.id}`,
        origin: linkedDebt ? 'debt' : 'expense',
        sourceId: expense.id,
        date: expense.date,
        title: expense.description,
        amount: expense.amount,
        status: expense.isPlanned ? 'planned' : 'booked',
        icon: expenseInfo.icon,
        color: expenseInfo.color,
        sourceLabel,
        categoryLabel,
        detail: [sourceLabel, categoryLabel, accountName].filter(Boolean).join(' • '),
        note: expense.note,
        displayNote: noteMeta.displayNote,
        accountId: expense.accountId,
        accountName,
        recurring: expense.isRecurring,
        imported: isBankImportedExpense(expense.note, expense.tags),
        tags: expense.tags,
        entityType: 'expense',
        counterparty: expense.description,
        valueDate: expense.date,
        importSource: noteMeta.importSource,
        importAccount: noteMeta.importAccount,
        pageHref: '/expenses',
        pageLabel: 'Zu Ausgaben',
        deleteActionType: 'DELETE_EXPENSE',
        deleteActionLabel: linkedDebt ? 'Rate löschen' : 'Buchung löschen',
      });
    });

    fixedExpenses.forEach((fixedExpense) => {
      if (!isFixedExpenseRelevantForMonth(fixedExpense, viewMonth) || representedFixedExpenseIds.has(fixedExpense.id)) {
        return;
      }

      const linkedDebt = fixedExpense.linkedDebtId ? debtMap.get(fixedExpense.linkedDebtId) : undefined;
      const noteMeta = parseLedgerNoteMeta(fixedExpense.note);
      const postingDate = clampDateToMonth(viewMonth, fixedExpense.dueDay);
      const fixedInfo = linkedDebt ? DEBT_TYPES[linkedDebt.type] : FIXED_EXPENSE_CATEGORIES[fixedExpense.category];
      const accountName = fixedExpense.accountId ? accountMap.get(fixedExpense.accountId)?.name : undefined;
      if (fixedExpense.linkedDebtId) {
        coveredDebtIds.add(fixedExpense.linkedDebtId);
      }

      entries.push({
        id: `fixed-${fixedExpense.id}`,
        origin: fixedExpense.linkedDebtId ? 'debt' : 'fixedExpense',
        sourceId: fixedExpense.id,
        date: postingDate,
        title: fixedExpense.name,
        amount: fixedExpense.amount,
        status: 'planned',
        icon: fixedInfo?.icon || FALLBACK_INFO.icon,
        color: fixedInfo?.color || FALLBACK_INFO.color,
        sourceLabel: fixedExpense.linkedDebtId ? 'Kreditrate' : 'Fixkosten',
        categoryLabel: fixedExpense.linkedDebtId
          ? linkedDebt?.name || 'Darlehen'
          : FIXED_EXPENSE_CATEGORIES[fixedExpense.category]?.labelDe || FALLBACK_INFO.labelDe,
        detail: [fixedExpense.linkedDebtId ? 'Offene Rate' : 'Vorgemerkt', accountName].filter(Boolean).join(' • '),
        note: fixedExpense.note,
        displayNote: noteMeta.displayNote,
        accountId: fixedExpense.accountId,
        accountName,
        recurring: true,
        entityType: 'fixedExpense',
        counterparty: fixedExpense.name,
        valueDate: postingDate,
        importSource: noteMeta.importSource,
        importAccount: noteMeta.importAccount,
        pageHref: '/fixed-expenses',
        pageLabel: 'Zu Fixkosten',
        deleteActionType: 'DELETE_FIXED_EXPENSE',
        deleteActionLabel: fixedExpense.linkedDebtId ? 'Rate löschen' : 'Fixkosten löschen',
      });
    });

    debts.forEach((debt) => {
      if (!isDebtRelevantForMonth(debt, viewMonth) || coveredDebtIds.has(debt.id)) {
        return;
      }

      const debtInfo = DEBT_TYPES[debt.type] || FALLBACK_INFO;
      const noteMeta = parseLedgerNoteMeta(debt.note);
      const postingDate = clampDateToMonth(viewMonth, Number(debt.startDate.slice(8, 10)) || 1);
      entries.push({
        id: `debt-${debt.id}`,
        origin: 'debt',
        sourceId: debt.id,
        date: postingDate,
        title: debt.name,
        amount: debt.monthlyPayment,
        status: 'planned',
        icon: debtInfo.icon,
        color: debtInfo.color,
        sourceLabel: 'Kreditrate',
        categoryLabel: debtInfo.labelDe,
        detail: [debtInfo.labelDe, 'Noch nicht gebucht'].join(' • '),
        note: debt.note,
        displayNote: noteMeta.displayNote,
        entityType: 'debt',
        counterparty: debt.name,
        valueDate: postingDate,
        importSource: noteMeta.importSource,
        importAccount: noteMeta.importAccount,
        pageHref: '/debts',
        pageLabel: 'Zu Schulden',
        deleteActionType: 'DELETE_DEBT',
        deleteActionLabel: 'Schuld löschen',
      });
    });

    monthTransfers.forEach((transfer) => {
      const fromAccount = accountMap.get(transfer.fromAccountId);
      const toAccount = accountMap.get(transfer.toAccountId);
      const noteMeta = parseLedgerNoteMeta(transfer.note);
      entries.push({
        id: `transfer-${transfer.id}`,
        origin: 'transfer',
        sourceId: transfer.id,
        date: transfer.date,
        title: transfer.note || 'Umbuchung',
        amount: transfer.amount,
        status: 'booked',
        icon: 'ArrowRightLeft',
        color: '#0f766e',
        sourceLabel: 'Umbuchung',
        detail: `${fromAccount?.name || 'Unbekannt'} → ${toAccount?.name || 'Unbekannt'}`,
        note: transfer.note,
        displayNote: noteMeta.displayNote,
        accountId: transfer.fromAccountId,
        accountName: fromAccount?.name,
        secondaryAccountId: transfer.toAccountId,
        secondaryAccountName: toAccount?.name,
        entityType: 'transfer',
        counterparty: `${fromAccount?.name || 'Unbekannt'} → ${toAccount?.name || 'Unbekannt'}`,
        valueDate: transfer.date,
        importSource: noteMeta.importSource,
        importAccount: noteMeta.importAccount,
        pageHref: '/accounts',
        pageLabel: 'Zu Konten',
        deleteActionType: 'DELETE_TRANSFER',
        deleteActionLabel: 'Umbuchung löschen',
      });
    });

    return entries.sort((left, right) => right.date.localeCompare(left.date));
  }, [
    accountMap,
    currentMonth,
    debtMap,
    debts,
    expenses,
    fixedExpenseMap,
    fixedExpenses,
    fixedReconciliation.entries,
    incomeReconciliation.matchedRecurringIds,
    monthExpenses,
    monthIncomes,
    monthTransfers,
    settings,
    viewMonth,
  ]);

  const ledgerEntries = useMemo(() => {
    const filteredEntries = rawEntries
      .filter((entry) => {
        if (accountFilter === 'all') {
          return true;
        }

        if (entry.origin === 'transfer') {
          return entry.accountId === accountFilter || entry.secondaryAccountId === accountFilter;
        }

        return entry.accountId === accountFilter;
      })
      .map<LedgerEntry>((entry) => {
        if (entry.origin === 'transfer') {
          if (accountFilter !== 'all') {
            if (entry.accountId === accountFilter) {
              return {
                ...entry,
                direction: 'out',
                signedAmount: -entry.amount,
                counterparty: entry.secondaryAccountName || entry.counterparty,
              };
            }
            return {
              ...entry,
              direction: 'in',
              signedAmount: entry.amount,
              counterparty: entry.accountName || entry.counterparty,
            };
          }

          return { ...entry, direction: 'transfer', signedAmount: 0 };
        }

        const direction: LedgerDirection = entry.origin === 'income' ? 'in' : 'out';
        return {
          ...entry,
          direction,
          signedAmount: direction === 'in' ? entry.amount : -entry.amount,
        };
      })
      .filter((entry) => directionFilter === 'all' || entry.direction === directionFilter)
      .filter((entry) => statusFilter === 'all' || entry.status === statusFilter)
      .filter((entry) => {
        if (!search.trim()) return true;
        const haystack = [
          entry.title,
          entry.detail,
          entry.note,
          entry.accountName,
          entry.secondaryAccountName,
          entry.sourceLabel,
          entry.categoryLabel,
          ...(entry.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
      .sort((left, right) => right.date.localeCompare(left.date));

    if (!selectedAccount) {
      return filteredEntries;
    }

    let rollingBalance = selectedAccount.balance;
    return filteredEntries.map((entry) => {
      if (entry.status !== 'booked') {
        return entry;
      }

      const entryWithBalance: LedgerEntry = {
        ...entry,
        runningBalanceAfter: roundStatementBalance(rollingBalance),
      };
      rollingBalance = roundStatementBalance(rollingBalance - entry.signedAmount);
      return entryWithBalance;
    });
  }, [accountFilter, directionFilter, rawEntries, search, selectedAccount, statusFilter]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, LedgerEntry[]>();
    ledgerEntries.forEach((entry) => {
      const existing = groups.get(entry.date);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(entry.date, [entry]);
      }
    });

    return Array.from(groups.entries()).map(([date, entries]) => ({
      date,
      entries,
      incoming: entries.filter((entry) => entry.signedAmount > 0).reduce((sum, entry) => sum + entry.signedAmount, 0),
      outgoing: entries.filter((entry) => entry.signedAmount < 0).reduce((sum, entry) => sum + Math.abs(entry.signedAmount), 0),
      transferVolume: entries
        .filter((entry) => entry.direction === 'transfer' && entry.signedAmount === 0)
        .reduce((sum, entry) => sum + entry.amount, 0),
    }));
  }, [ledgerEntries]);

  const summary = useMemo(() => {
    return ledgerEntries.reduce(
      (acc, entry) => {
        if (entry.signedAmount > 0) acc.incoming += entry.signedAmount;
        if (entry.signedAmount < 0) acc.outgoing += Math.abs(entry.signedAmount);
        if (entry.origin === 'transfer') acc.transfers += entry.amount;
        if (entry.status === 'planned') acc.plannedCount += 1;
        if (entry.status === 'booked') acc.bookedCount += 1;
        acc.count += 1;
        return acc;
      },
      { incoming: 0, outgoing: 0, transfers: 0, plannedCount: 0, bookedCount: 0, count: 0 }
    );
  }, [ledgerEntries]);

  const accountOptions = useMemo(
    () => [{ value: 'all', label: 'Alle Konten' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))],
    [accounts]
  );
  const bookingAccountOptions = useMemo(
    () => [{ value: '', label: 'Ohne Konto' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))],
    [accounts]
  );
  const expenseCategoryOptions = useMemo(
    () => Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({ value, label: info.labelDe })),
    [settings]
  );
  const fixedExpenseCategoryOptions = useMemo(
    () => Object.entries(FIXED_EXPENSE_CATEGORIES).map(([value, info]) => ({ value, label: info.labelDe })),
    []
  );
  const incomeTypeOptions = useMemo(
    () => Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe })),
    []
  );
  const debtTypeOptions = useMemo(
    () => Object.entries(DEBT_TYPES).map(([value, info]) => ({ value, label: info.labelDe })),
    []
  );
  const linkedDebtOptions = useMemo(
    () => [{ value: '', label: 'Kein Kredit verknüpft' }, ...debts.map((debt) => ({ value: debt.id, label: debt.name }))],
    [debts]
  );
  const flowOptions = [
    { value: 'all', label: 'Alle Bewegungen' },
    { value: 'in', label: 'Nur Eingänge' },
    { value: 'out', label: 'Nur Ausgänge' },
    { value: 'transfer', label: 'Nur Umbuchungen' },
  ];
  const statusOptions = [
    { value: 'all', label: 'Gebucht + geplant' },
    { value: 'booked', label: 'Nur gebucht' },
    { value: 'planned', label: 'Nur geplant' },
  ];

  const headerContext = accountFilter === 'all'
    ? 'Alle Bewegungen im gewählten Monat'
    : `Gefiltert auf ${accounts.find((account) => account.id === accountFilter)?.name || 'ein Konto'}`;

  const updateEditForm = (patch: Partial<LedgerEditFormState>) => {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  };

  const handleStartEditingSelectedEntry = () => {
    if (!selectedEntry) return;

    switch (selectedEntry.entityType) {
      case 'income': {
        const income = incomes.find((entry) => entry.id === selectedEntry.sourceId);
        if (!income) return;
        setEditForm({
          entityType: 'income',
          sourceId: income.id,
          title: income.name,
          amount: income.amount.toString(),
          date: income.date || selectedEntry.date,
          note: selectedEntry.displayNote || '',
          accountId: income.accountId || '',
          category: income.type,
          dueDay: '1',
          linkedDebtId: '',
          totalAmount: '',
          remainingAmount: '',
          monthlyPayment: '',
          interestRate: '',
          transferFromAccountId: '',
          transferToAccountId: '',
          effectiveFromMonth: income.effectiveFromMonth || '',
          tags: '',
          importSource: selectedEntry.importSource || '',
          importAccount: selectedEntry.importAccount || '',
        });
        break;
      }
      case 'expense': {
        const expense = expenses.find((entry) => entry.id === selectedEntry.sourceId);
        if (!expense) return;
        setEditForm({
          entityType: 'expense',
          sourceId: expense.id,
          title: expense.description,
          amount: expense.amount.toString(),
          date: expense.date,
          note: selectedEntry.displayNote || '',
          accountId: expense.accountId || '',
          category: expense.category,
          dueDay: '1',
          linkedDebtId: expense.linkedDebtId || '',
          totalAmount: '',
          remainingAmount: '',
          monthlyPayment: '',
          interestRate: '',
          transferFromAccountId: '',
          transferToAccountId: '',
          effectiveFromMonth: '',
          tags: (expense.tags || []).join(', '),
          importSource: selectedEntry.importSource || '',
          importAccount: selectedEntry.importAccount || '',
        });
        break;
      }
      case 'fixedExpense': {
        const fixedExpense = fixedExpenses.find((entry) => entry.id === selectedEntry.sourceId);
        if (!fixedExpense) return;
        setEditForm({
          entityType: 'fixedExpense',
          sourceId: fixedExpense.id,
          title: fixedExpense.name,
          amount: fixedExpense.amount.toString(),
          date: selectedEntry.date,
          note: selectedEntry.displayNote || '',
          accountId: fixedExpense.accountId || '',
          category: fixedExpense.category,
          dueDay: fixedExpense.dueDay.toString(),
          linkedDebtId: fixedExpense.linkedDebtId || '',
          totalAmount: '',
          remainingAmount: '',
          monthlyPayment: '',
          interestRate: '',
          transferFromAccountId: '',
          transferToAccountId: '',
          effectiveFromMonth: '',
          tags: '',
          importSource: selectedEntry.importSource || '',
          importAccount: selectedEntry.importAccount || '',
        });
        break;
      }
      case 'debt': {
        const debt = debts.find((entry) => entry.id === selectedEntry.sourceId);
        if (!debt) return;
        setEditForm({
          entityType: 'debt',
          sourceId: debt.id,
          title: debt.name,
          amount: debt.monthlyPayment.toString(),
          date: debt.startDate.slice(0, 10),
          note: selectedEntry.displayNote || '',
          accountId: '',
          category: debt.type,
          dueDay: '1',
          linkedDebtId: '',
          totalAmount: debt.totalAmount.toString(),
          remainingAmount: debt.remainingAmount.toString(),
          monthlyPayment: debt.monthlyPayment.toString(),
          interestRate: debt.interestRate.toString(),
          transferFromAccountId: '',
          transferToAccountId: '',
          effectiveFromMonth: '',
          tags: '',
          importSource: selectedEntry.importSource || '',
          importAccount: selectedEntry.importAccount || '',
        });
        break;
      }
      case 'transfer': {
        const transfer = transfers.find((entry) => entry.id === selectedEntry.sourceId);
        if (!transfer) return;
        setEditForm({
          entityType: 'transfer',
          sourceId: transfer.id,
          title: transfer.note || 'Umbuchung',
          amount: transfer.amount.toString(),
          date: transfer.date,
          note: selectedEntry.displayNote || transfer.note || '',
          accountId: '',
          category: '',
          dueDay: '1',
          linkedDebtId: '',
          totalAmount: '',
          remainingAmount: '',
          monthlyPayment: '',
          interestRate: '',
          transferFromAccountId: transfer.fromAccountId,
          transferToAccountId: transfer.toAccountId,
          effectiveFromMonth: '',
          tags: '',
          importSource: selectedEntry.importSource || '',
          importAccount: selectedEntry.importAccount || '',
        });
        break;
      }
      default:
        return;
    }

    setSelectedEntry(null);
  };

  const handleSaveEditedEntry = () => {
    if (!editForm || !editForm.title || !editForm.amount) return;

    switch (editForm.entityType) {
      case 'income': {
        const income = incomes.find((entry) => entry.id === editForm.sourceId);
        if (!income) return;
        const nextDate = editForm.date || clampDateToMonth(selectedMonth, 1);
        dispatch({
          type: 'UPDATE_INCOME',
          payload: {
            ...income,
            name: editForm.title,
            amount: parseFloat(editForm.amount),
            type: editForm.category as IncomeType,
            date: nextDate,
            month: nextDate.slice(0, 7),
            note: composeLedgerNote(editForm.note, editForm.importAccount, editForm.importSource),
            accountId: editForm.accountId || undefined,
            effectiveFromMonth: editForm.effectiveFromMonth || undefined,
          },
        });
        break;
      }
      case 'expense': {
        const expense = expenses.find((entry) => entry.id === editForm.sourceId);
        if (!expense || !editForm.date) return;
        dispatch({
          type: 'UPDATE_EXPENSE',
          payload: {
            ...expense,
            description: editForm.title,
            amount: parseFloat(editForm.amount),
            category: editForm.category as ExpenseCategory,
            date: editForm.date,
            month: editForm.date.slice(0, 7),
            note: composeLedgerNote(editForm.note, editForm.importAccount, editForm.importSource),
            accountId: editForm.accountId || undefined,
            tags: parseTags(editForm.tags),
          },
        });
        break;
      }
      case 'fixedExpense': {
        const fixedExpense = fixedExpenses.find((entry) => entry.id === editForm.sourceId);
        if (!fixedExpense) return;
        dispatch({
          type: 'UPDATE_FIXED_EXPENSE',
          payload: {
            ...fixedExpense,
            name: editForm.title,
            amount: parseFloat(editForm.amount),
            category: editForm.category as FixedExpenseCategory,
            dueDay: parseInt(editForm.dueDay || '1'),
            note: composeLedgerNote(editForm.note, editForm.importAccount, editForm.importSource),
            accountId: editForm.accountId || undefined,
            linkedDebtId: editForm.linkedDebtId || undefined,
          },
        });
        break;
      }
      case 'debt': {
        const debt = debts.find((entry) => entry.id === editForm.sourceId);
        if (!debt || !editForm.totalAmount || !editForm.remainingAmount || !editForm.monthlyPayment) return;
        dispatch({
          type: 'UPDATE_DEBT',
          payload: {
            ...debt,
            name: editForm.title,
            totalAmount: parseFloat(editForm.totalAmount),
            remainingAmount: parseFloat(editForm.remainingAmount),
            monthlyPayment: parseFloat(editForm.monthlyPayment),
            interestRate: parseFloat(editForm.interestRate || '0'),
            type: editForm.category as DebtType,
            startDate: editForm.date || debt.startDate,
            note: composeLedgerNote(editForm.note, editForm.importAccount, editForm.importSource),
          },
        });
        break;
      }
      case 'transfer': {
        const transfer = transfers.find((entry) => entry.id === editForm.sourceId);
        if (!transfer || !editForm.transferFromAccountId || !editForm.transferToAccountId || !editForm.date) return;
        if (editForm.transferFromAccountId === editForm.transferToAccountId) return;
        dispatch({
          type: 'UPDATE_TRANSFER',
          payload: {
            ...transfer,
            fromAccountId: editForm.transferFromAccountId,
            toAccountId: editForm.transferToAccountId,
            amount: parseFloat(editForm.amount),
            date: editForm.date,
            note: composeLedgerNote(editForm.note, editForm.importAccount, editForm.importSource),
          },
        });
        break;
      }
      default:
        return;
    }

    setEditForm(null);
  };

  const handleOpenSelectedEntrySource = () => {
    if (!selectedEntry) return;
    setSelectedEntry(null);
    router.push(selectedEntry.pageHref);
  };

  const handleDeleteSelectedEntry = () => {
    if (!selectedEntry?.deleteActionType) return;

    const shouldDelete = confirm(`"${selectedEntry.title}" wirklich löschen?`);
    if (!shouldDelete) return;

    switch (selectedEntry.deleteActionType) {
      case 'DELETE_INCOME':
        dispatch({ type: 'DELETE_INCOME', payload: selectedEntry.sourceId });
        break;
      case 'DELETE_EXPENSE':
        dispatch({ type: 'DELETE_EXPENSE', payload: selectedEntry.sourceId });
        break;
      case 'DELETE_FIXED_EXPENSE':
        dispatch({ type: 'DELETE_FIXED_EXPENSE', payload: selectedEntry.sourceId });
        break;
      case 'DELETE_DEBT':
        dispatch({ type: 'DELETE_DEBT', payload: selectedEntry.sourceId });
        break;
      case 'DELETE_TRANSFER':
        dispatch({ type: 'DELETE_TRANSFER', payload: selectedEntry.sourceId });
        break;
      default:
        return;
    }

    setSelectedEntry(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(255,251,235,1)_52%,rgba(248,250,252,1)_100%)] p-5 dark:border-gray-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1)_0%,rgba(17,24,39,1)_52%,rgba(15,23,42,1)_100%)] sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">Cashflow Ledger</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Buchungen wie in einer Banking-App</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    {headerContext}. Mit Datum, Richtung, Konto und anklickbaren Details pro Buchung.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
                    className="rounded-xl border border-slate-200 bg-white/80 p-2 transition-colors hover:bg-white dark:border-gray-700 dark:bg-gray-900/70 dark:hover:bg-gray-900"
                    aria-label="Vorheriger Monat"
                  >
                    <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 dark:border-gray-700 dark:bg-gray-900/70">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Auszug</p>
                    <p className="text-base font-semibold text-slate-950 dark:text-white">{getMonthDisplayName(viewMonth)}</p>
                  </div>
                  <button
                    onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}
                    className="rounded-xl border border-slate-200 bg-white/80 p-2 transition-colors hover:bg-white dark:border-gray-700 dark:bg-gray-900/70 dark:hover:bg-gray-900"
                    aria-label="Nächster Monat"
                  >
                    <ChevronRight size={18} className="text-slate-600 dark:text-slate-300" />
                  </button>
                  {viewMonth !== currentMonth && (
                    <button
                      onClick={() => setViewMonth(currentMonth)}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                    >
                      Aktueller Monat
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-emerald-200/70 bg-white/85 p-4 backdrop-blur dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Eingänge</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-200">{formatCurrency(summary.incoming, settings)}</p>
                  <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Alle positiven Buchungen im Filter</p>
                </div>
                <div className="rounded-2xl border border-rose-200/70 bg-white/85 p-4 backdrop-blur dark:border-rose-900/40 dark:bg-rose-950/20">
                  <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Ausgänge</p>
                  <p className="mt-2 text-xl font-bold text-rose-700 dark:text-rose-200">{formatCurrency(summary.outgoing, settings)}</p>
                  <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">Belastungen und offene Raten</p>
                </div>
                <div className={`rounded-2xl border bg-white/85 p-4 backdrop-blur ${summary.incoming - summary.outgoing >= 0 ? 'border-sky-200/70 dark:border-sky-900/40 dark:bg-sky-950/20' : 'border-amber-200/70 dark:border-amber-900/40 dark:bg-amber-950/20'}`}>
                  <p className={`text-xs font-medium ${summary.incoming - summary.outgoing >= 0 ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-300'}`}>Netto-Cashflow</p>
                  <p className={`mt-2 text-xl font-bold ${summary.incoming - summary.outgoing >= 0 ? 'text-sky-700 dark:text-sky-200' : 'text-amber-700 dark:text-amber-200'}`}>
                    {formatCurrency(summary.incoming - summary.outgoing, settings)}
                  </p>
                  <p className={`mt-1 text-xs ${summary.incoming - summary.outgoing >= 0 ? 'text-sky-700/80 dark:text-sky-300/80' : 'text-amber-700/80 dark:text-amber-300/80'}`}>Saldo aus sichtbaren Bewegungen</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/70">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Buchungen</p>
                  <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{summary.count}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{summary.bookedCount} gebucht, {summary.plannedCount} geplant</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr]">
              <Select label="Konto" value={accountFilter} onChange={setAccountFilter} options={accountOptions} />
              <Select label="Richtung" value={directionFilter} onChange={(value) => setDirectionFilter(value as 'all' | LedgerDirection)} options={flowOptions} />
              <Select label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as 'all' | LedgerStatus)} options={statusOptions} />
              <Input label="Suche" value={search} onChange={setSearch} placeholder="Buchungstext, Notiz, Konto ..." icon="Search" />
            </div>

            {selectedAccount && (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-cyan-200">
                Laufender Saldo aktiv für {selectedAccount.name}. Die rechte Spalte zeigt den gebuchten Kontostand nach jeder bereits verbuchten Buchung.
              </div>
            )}
          </div>
        </div>

        {ledgerEntries.length === 0 ? (
          <EmptyState
            icon="ListFilter"
            title="Keine Buchungen im aktuellen Filter"
            description="Passe Monat, Konto oder Suchbegriff an, damit die Umsatzliste wieder Treffer zeigt."
          />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-gray-800">
            {groupedEntries.map((group) => (
              <div key={group.date} className="px-4 py-4 sm:px-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-950 dark:text-white">{getDateLabel(group.date)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(group.date)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.incoming > 0 && <Badge color="#059669">+{formatCurrency(group.incoming, settings)}</Badge>}
                    {group.outgoing > 0 && <Badge color="#dc2626">-{formatCurrency(group.outgoing, settings)}</Badge>}
                    {group.transferVolume > 0 && <Badge color="#0f766e">Umbuchung {formatCurrency(group.transferVolume, settings)}</Badge>}
                  </div>
                </div>

                <div className="space-y-2">
                  {group.entries.map((entry) => {
                    const isPositive = entry.signedAmount > 0;
                    const isNeutralTransfer = entry.direction === 'transfer' && entry.signedAmount === 0;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4 text-left transition-all hover:border-slate-300 hover:bg-slate-50/70 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900/70"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${entry.color}18` }}>
                          <Icon name={entry.icon} size={20} color={entry.color} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{entry.title}</p>
                            <Badge color={entry.direction === 'in' ? '#059669' : entry.direction === 'out' ? '#dc2626' : '#0f766e'}>
                              {getDirectionLabel(entry.direction)}
                            </Badge>
                            <Badge color={entry.status === 'booked' ? '#2563eb' : '#d97706'}>{getStatusLabel(entry.status)}</Badge>
                            <Badge color="#64748b">Valuta {formatDate(entry.valueDate, 'dd.MM.')}</Badge>
                            {entry.imported && <Badge color="#475569">Import</Badge>}
                            {entry.recurring && <Badge color="#7c3aed">Wiederkehrend</Badge>}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            {[entry.counterparty && entry.counterparty !== entry.title ? `Gegenpartei: ${entry.counterparty}` : '', entry.detail].filter(Boolean).join(' • ')}
                          </p>
                          {(entry.displayNote || entry.importSource) && (
                            <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                              {entry.displayNote || `Quelle: ${entry.importSource}`}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-semibold ${isNeutralTransfer ? 'text-slate-700 dark:text-slate-200' : isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {getAmountLabel(entry, settings)}
                          </p>
                          {selectedAccount && entry.runningBalanceAfter !== undefined ? (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo {formatCurrency(entry.runningBalanceAfter, settings)}</p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400 transition-colors group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-400">Details öffnen</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Banking Snapshot</h3>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Was im Auszug gerade sichtbar ist</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.transfers > 0 && <Badge color="#0f766e">Umbuchungsvolumen {formatCurrency(summary.transfers, settings)}</Badge>}
            {summary.plannedCount > 0 && <Badge color="#d97706">{summary.plannedCount} noch offen</Badge>}
            {summary.bookedCount > 0 && <Badge color="#2563eb">{summary.bookedCount} bereits gebucht</Badge>}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/30">
                <ArrowDownLeft size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Eingänge klar erkennbar</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Positive Bewegungen werden wie im Bankfeed separat ausgewiesen.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-2 dark:bg-rose-950/30">
                <ArrowUpRight size={18} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Ausgänge mit Buchungstext</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ausgaben, Fixkosten und Raten erscheinen in einer gemeinsamen Umsatzlogik.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-50 p-2 dark:bg-cyan-950/30">
                <ArrowRightLeft size={18} className="text-cyan-700 dark:text-cyan-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Jede Zeile anklickbar</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Per Tap öffnet sich eine Detailkarte mit Konto, Status, Quelle und Notiz.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Modal isOpen={Boolean(selectedEntry)} onClose={() => setSelectedEntry(null)} title={selectedEntry?.title || 'Buchungsdetail'}>
        {selectedEntry && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_38%),linear-gradient(135deg,rgba(248,250,252,1)_0%,rgba(255,255,255,1)_55%,rgba(255,251,235,1)_100%)] p-5 dark:border-gray-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_32%),linear-gradient(135deg,rgba(15,23,42,1)_0%,rgba(17,24,39,1)_55%,rgba(15,23,42,1)_100%)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{selectedEntry.sourceLabel}</p>
                  <h4 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{getAmountLabel(selectedEntry, settings)}</h4>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${selectedEntry.color}18` }}>
                  <Icon name={selectedEntry.icon} size={24} color={selectedEntry.color} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge color={selectedEntry.direction === 'in' ? '#059669' : selectedEntry.direction === 'out' ? '#dc2626' : '#0f766e'}>
                  {getDirectionLabel(selectedEntry.direction)}
                </Badge>
                <Badge color={selectedEntry.status === 'booked' ? '#2563eb' : '#d97706'}>{getStatusLabel(selectedEntry.status)}</Badge>
                <Badge color="#64748b">Valuta {formatDate(selectedEntry.valueDate, 'dd.MM.yyyy')}</Badge>
                {selectedEntry.imported && <Badge color="#475569">Importiert</Badge>}
                {selectedEntry.recurring && <Badge color="#7c3aed">Wiederkehrend</Badge>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Buchungsdatum</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatDate(selectedEntry.date, 'dd.MM.yyyy')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Valuta</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatDate(selectedEntry.valueDate, 'dd.MM.yyyy')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Buchungsstatus</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{getStatusLabel(selectedEntry.status)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Kategorie</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedEntry.categoryLabel || selectedEntry.sourceLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Konto</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedEntry.accountName || 'Nicht zugewiesen'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Gegenpartei / Kontext</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedEntry.counterparty || selectedEntry.secondaryAccountName || selectedEntry.detail}</p>
              </div>
            </div>

            {(selectedEntry.displayNote || selectedEntry.note) && (
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Verwendungszweck / Notiz</p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{selectedEntry.displayNote || selectedEntry.note}</p>
              </div>
            )}

            {(selectedEntry.importSource || selectedEntry.importAccount) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedEntry.importAccount && (
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Importkonto</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedEntry.importAccount}</p>
                  </div>
                )}
                {selectedEntry.importSource && (
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Quelle</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedEntry.importSource}</p>
                  </div>
                )}
              </div>
            )}

            {selectedEntry.tags && selectedEntry.tags.length > 0 && (
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tags</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedEntry.tags.map((tag) => (
                    <Badge key={tag} color="#475569">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 dark:border-gray-800 sm:flex-row sm:justify-end">
              {selectedEntry.deleteActionType && (
                <Button variant="danger" onClick={handleDeleteSelectedEntry} icon="Trash2">
                  {selectedEntry.deleteActionLabel || 'Löschen'}
                </Button>
              )}
              <Button onClick={handleStartEditingSelectedEntry} icon="Pencil">
                Bearbeiten
              </Button>
              <Button variant="secondary" onClick={handleOpenSelectedEntrySource} icon="ArrowUpRight">
                {selectedEntry.pageLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(editForm)} onClose={() => setEditForm(null)} title="Buchung bearbeiten">
        {editForm && (
          <div className="space-y-4">
            {editForm.entityType === 'transfer' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select label="Von" value={editForm.transferFromAccountId} onChange={(value) => updateEditForm({ transferFromAccountId: value })} options={accounts.map((account) => ({ value: account.id, label: account.name }))} />
                  <Select label="Nach" value={editForm.transferToAccountId} onChange={(value) => updateEditForm({ transferToAccountId: value })} options={accounts.map((account) => ({ value: account.id, label: account.name }))} />
                </div>
                <Input label="Betrag" type="number" value={editForm.amount} onChange={(value) => updateEditForm({ amount: value })} placeholder="0.00" icon="Euro" />
                <Input label="Datum" type="date" value={editForm.date} onChange={(value) => updateEditForm({ date: value })} />
                <Input label="Notiz" value={editForm.note} onChange={(value) => updateEditForm({ note: value })} placeholder="Umbuchung oder Sparrate" />
              </>
            ) : (
              <>
                <Input label="Bezeichnung" value={editForm.title} onChange={(value) => updateEditForm({ title: value })} placeholder="Name oder Buchungstext" icon="Edit3" />
                <Input label="Betrag" type="number" value={editForm.amount} onChange={(value) => updateEditForm({ amount: value })} placeholder="0.00" icon="Euro" />

                {editForm.entityType === 'income' && (
                  <>
                    <Select label="Typ" value={editForm.category} onChange={(value) => updateEditForm({ category: value })} options={incomeTypeOptions} />
                    <Select label="Zielkonto" value={editForm.accountId} onChange={(value) => updateEditForm({ accountId: value })} options={bookingAccountOptions} />
                    <Input label="Datum" type="date" value={editForm.date} onChange={(value) => updateEditForm({ date: value })} />
                    <MonthPicker label="Wirksam ab (optional)" value={editForm.effectiveFromMonth} onChange={(value) => updateEditForm({ effectiveFromMonth: value })} allowEmpty />
                  </>
                )}

                {editForm.entityType === 'expense' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select label="Kategorie" value={editForm.category} onChange={(value) => updateEditForm({ category: value })} options={expenseCategoryOptions} />
                      <Select label="Konto" value={editForm.accountId} onChange={(value) => updateEditForm({ accountId: value })} options={bookingAccountOptions} />
                    </div>
                    <Input label="Datum" type="date" value={editForm.date} onChange={(value) => updateEditForm({ date: value })} />
                    <Input label="Tags" value={editForm.tags} onChange={(value) => updateEditForm({ tags: value })} placeholder="z.B. Auto, Arbeit" />
                  </>
                )}

                {editForm.entityType === 'fixedExpense' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select label="Kategorie" value={editForm.category} onChange={(value) => updateEditForm({ category: value })} options={fixedExpenseCategoryOptions} />
                      <Input label="Fälligkeitstag" type="number" value={editForm.dueDay} onChange={(value) => updateEditForm({ dueDay: value })} placeholder="1 bis 31" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select label="Belastetes Konto" value={editForm.accountId} onChange={(value) => updateEditForm({ accountId: value })} options={bookingAccountOptions} />
                      <Select label="Verknüpfter Kredit" value={editForm.linkedDebtId} onChange={(value) => updateEditForm({ linkedDebtId: value })} options={linkedDebtOptions} />
                    </div>
                  </>
                )}

                {editForm.entityType === 'debt' && (
                  <>
                    <Select label="Typ" value={editForm.category} onChange={(value) => updateEditForm({ category: value })} options={debtTypeOptions} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input label="Gesamtbetrag" type="number" value={editForm.totalAmount} onChange={(value) => updateEditForm({ totalAmount: value })} placeholder="0.00" icon="Euro" />
                      <Input label="Restbetrag" type="number" value={editForm.remainingAmount} onChange={(value) => updateEditForm({ remainingAmount: value })} placeholder="0.00" icon="Euro" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input label="Monatsrate" type="number" value={editForm.monthlyPayment} onChange={(value) => updateEditForm({ monthlyPayment: value })} placeholder="0.00" icon="Euro" />
                      <Input label="Zinssatz (%)" type="number" value={editForm.interestRate} onChange={(value) => updateEditForm({ interestRate: value })} placeholder="0" />
                    </div>
                    <Input label="Startdatum" type="date" value={editForm.date} onChange={(value) => updateEditForm({ date: value })} />
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Notiz / Verwendungszweck</label>
                  <textarea
                    value={editForm.note}
                    onChange={(event) => updateEditForm({ note: event.target.value })}
                    rows={3}
                    className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {(editForm.importAccount || editForm.importSource) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-slate-300">
                    {editForm.importAccount && <p>Importkonto: {editForm.importAccount}</p>}
                    {editForm.importSource && <p className="mt-1">Quelle: {editForm.importSource}</p>}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setEditForm(null)} className="flex-1">Abbrechen</Button>
              <Button onClick={handleSaveEditedEntry} className="flex-1">Speichern</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
