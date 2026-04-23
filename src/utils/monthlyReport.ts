import { format, getDaysInMonth, parseISO } from 'date-fns';
import type {
  Debt,
  Expense,
  FinanceState,
  FixedExpense,
  FreelanceProject,
  MonthSummary,
  NetWorthSnapshot,
  Settings,
  WorkSession,
} from '../types';
import {
  calculateFreelanceSessionNetAmount,
  calculateMonthSummary,
  calculateNetWorth,
  calculateWorkSessionHours,
  getCurrentMonth,
  getExpenseCategoryInfo,
  getShortMonthName,
  reconcileFixedExpensesForMonth,
  shiftMonth,
} from './helpers';

export interface MonthlyReportExpenseRow {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
}

export interface MonthlyReportFixedExpenseRow {
  id: string;
  name: string;
  amount: number;
  linkedDebt: boolean;
  matchedImportedExpense: boolean;
}

export interface MonthlyReportCategoryComparison {
  category: string;
  label: string;
  icon: string;
  color: string;
  current: number;
  previous: number;
  diff: number;
  percentChange: number | null;
  shareOfCurrent: number;
}

export interface MonthlyReportDailyPoint {
  day: string;
  current: number | null;
  previous: number | null;
  currentCumulative: number | null;
  previousCumulative: number | null;
}

export interface MonthlyReportTrendPoint {
  month: string;
  label: string;
  netWorth: number | null;
  assets: number | null;
  debts: number | null;
}

export interface MonthlyReportProjectSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  hours: number;
  revenue: number;
  sessions: number;
}

export interface MonthlyReportWorkSummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  revenue: number;
  sessionCount: number;
  billableSessionCount: number;
  workdayCount: number;
  averageHoursPerWorkday: number;
  projectBreakdown: MonthlyReportProjectSummary[];
}

export interface MonthlyReportData {
  currentMonth: string;
  latestCompletedMonth: string;
  reportMonth: string;
  previousMonth: string;
  adjustedFromSelection: boolean;
  summary: MonthSummary;
  previousSummary: MonthSummary;
  totalSpent: number;
  previousTotalSpent: number;
  savingsRate: number;
  previousSavingsRate: number;
  comparisonChartData: Array<{ label: string; current: number; previous: number }>;
  categoryComparison: MonthlyReportCategoryComparison[];
  topIncreaseCategories: MonthlyReportCategoryComparison[];
  topDecreaseCategories: MonthlyReportCategoryComparison[];
  expenseComposition: Array<{ key: string; name: string; value: number; color: string }>;
  topVariableExpenses: MonthlyReportExpenseRow[];
  fixedExpenses: MonthlyReportFixedExpenseRow[];
  dailySpendData: MonthlyReportDailyPoint[];
  workSummary: MonthlyReportWorkSummary;
  previousWorkSummary: MonthlyReportWorkSummary;
  workComparisonData: Array<{
    month: string;
    billableHours: number;
    nonBillableHours: number;
    revenue: number;
    sessions: number;
  }>;
  netWorthTrend: MonthlyReportTrendPoint[];
  debtSnapshot: Array<{
    id: string;
    name: string;
    remainingAmount: number;
    totalAmount: number;
    monthlyPayment: number;
    progressPercent: number;
  }>;
}

interface MonthExpenseBreakdown {
  variableExpenses: Expense[];
  variableByCategory: Record<string, number>;
  fixedExpenses: MonthlyReportFixedExpenseRow[];
}

const roundValue = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const calculatePercentChange = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
};

const buildSnapshotMap = (netWorthHistory: NetWorthSnapshot[]): Map<string, NetWorthSnapshot> => {
  const snapshotMap = new Map<string, NetWorthSnapshot>();
  netWorthHistory.forEach((snapshot) => {
    snapshotMap.set(snapshot.month, snapshot);
  });
  return snapshotMap;
};

const calculateMonthExpenseBreakdown = (
  month: string,
  expenses: Expense[],
  fixedExpenses: FixedExpense[],
  settings: Settings
): MonthExpenseBreakdown => {
  const monthExpenses = expenses.filter((expense) => expense.month === month);
  const fixedReconciliation = reconcileFixedExpensesForMonth(fixedExpenses, expenses, month);
  const excludedExpenseIds = new Set<string>([
    ...fixedReconciliation.matchedImportedExpenseIds,
    ...monthExpenses
      .filter((expense) => expense.autoBookedType === 'fixedExpense')
      .map((expense) => expense.id),
  ]);

  const debtExpenseIds = monthExpenses
    .filter((expense) => Boolean(expense.linkedDebtId) && !excludedExpenseIds.has(expense.id))
    .map((expense) => expense.id);
  debtExpenseIds.forEach((expenseId) => excludedExpenseIds.add(expenseId));

  const variableExpenses = monthExpenses
    .filter((expense) => !excludedExpenseIds.has(expense.id))
    .sort((left, right) => right.amount - left.amount);

  const variableByCategory = variableExpenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});

  const fixedExpenseRows = fixedReconciliation.entries
    .map((entry) => {
      const fixedExpense = fixedExpenses.find((item) => item.id === entry.fixedExpenseId);
      return {
        id: entry.fixedExpenseId,
        name: fixedExpense?.name || 'Fixkosten',
        amount: entry.effectiveAmount,
        linkedDebt: Boolean(entry.linkedDebtId),
        matchedImportedExpense: Boolean(entry.matchedImportedExpenseId),
      };
    })
    .sort((left, right) => right.amount - left.amount);

  return {
    variableExpenses,
    variableByCategory,
    fixedExpenses: fixedExpenseRows,
  };
};

const buildDailySpendData = (
  reportMonth: string,
  previousMonth: string,
  currentExpenses: Expense[],
  previousExpenses: Expense[]
): MonthlyReportDailyPoint[] => {
  const reportDayCount = getDaysInMonth(parseISO(`${reportMonth}-01`));
  const previousDayCount = getDaysInMonth(parseISO(`${previousMonth}-01`));
  const maxDayCount = Math.max(reportDayCount, previousDayCount);

  const currentExpensesByDay = currentExpenses.reduce<Map<number, number>>((totals, expense) => {
    const day = Number(expense.date.slice(8, 10));
    totals.set(day, (totals.get(day) || 0) + expense.amount);
    return totals;
  }, new Map<number, number>());

  const previousExpensesByDay = previousExpenses.reduce<Map<number, number>>((totals, expense) => {
    const day = Number(expense.date.slice(8, 10));
    totals.set(day, (totals.get(day) || 0) + expense.amount);
    return totals;
  }, new Map<number, number>());

  let currentCumulative = 0;
  let previousCumulative = 0;

  return Array.from({ length: maxDayCount }, (_, index) => {
    const day = index + 1;
    const currentValue = day <= reportDayCount ? currentExpensesByDay.get(day) || 0 : null;
    const previousValue = day <= previousDayCount ? previousExpensesByDay.get(day) || 0 : null;

    if (currentValue !== null) {
      currentCumulative += currentValue;
    }
    if (previousValue !== null) {
      previousCumulative += previousValue;
    }

    return {
      day: String(day).padStart(2, '0'),
      current: currentValue,
      previous: previousValue,
      currentCumulative: currentValue !== null ? roundValue(currentCumulative) : null,
      previousCumulative: previousValue !== null ? roundValue(previousCumulative) : null,
    };
  });
};

const buildWorkSummary = (
  month: string,
  workSessions: WorkSession[],
  freelanceProjects: FreelanceProject[]
): MonthlyReportWorkSummary => {
  const monthSessions = workSessions.filter((session) => session.date.slice(0, 7) === month);
  const billableSessions = monthSessions.filter((session) => session.billable);
  const totalHours = monthSessions.reduce((sum, session) => sum + calculateWorkSessionHours(session), 0);
  const billableHours = billableSessions.reduce((sum, session) => sum + calculateWorkSessionHours(session), 0);
  const uniqueWorkdays = new Set(monthSessions.map((session) => session.date)).size;

  const projectMap = new Map<string, MonthlyReportProjectSummary>();

  monthSessions.forEach((session) => {
    const hours = calculateWorkSessionHours(session);
    const project = freelanceProjects.find((item) => item.id === session.projectId);
    const projectName = project?.name || 'Projekt';
    const clientName = project?.clientName || 'Unbekannt';
    const revenue = calculateFreelanceSessionNetAmount(session, project);
    const existing = projectMap.get(session.projectId);

    if (existing) {
      existing.hours += hours;
      existing.revenue += revenue;
      existing.sessions += 1;
      return;
    }

    projectMap.set(session.projectId, {
      projectId: session.projectId,
      projectName,
      clientName,
      hours,
      revenue,
      sessions: 1,
    });
  });

  return {
    totalHours: roundValue(totalHours),
    billableHours: roundValue(billableHours),
    nonBillableHours: roundValue(Math.max(0, totalHours - billableHours)),
    revenue: roundValue(
      billableSessions.reduce((sum, session) => {
        const project = freelanceProjects.find((item) => item.id === session.projectId);
        return sum + calculateFreelanceSessionNetAmount(session, project);
      }, 0)
    ),
    sessionCount: monthSessions.length,
    billableSessionCount: billableSessions.length,
    workdayCount: uniqueWorkdays,
    averageHoursPerWorkday: uniqueWorkdays > 0 ? roundValue(totalHours / uniqueWorkdays) : 0,
    projectBreakdown: [...projectMap.values()]
      .sort((left, right) => right.revenue - left.revenue || right.hours - left.hours)
      .slice(0, 6),
  };
};

const buildCategoryComparison = (
  currentTotals: Record<string, number>,
  previousTotals: Record<string, number>,
  settings: Settings
): MonthlyReportCategoryComparison[] => {
  const allCategories = new Set<string>([
    ...Object.keys(currentTotals),
    ...Object.keys(previousTotals),
  ]);
  const currentTotal = Object.values(currentTotals).reduce((sum, value) => sum + value, 0);

  return [...allCategories]
    .map((category) => {
      const current = currentTotals[category] || 0;
      const previous = previousTotals[category] || 0;
      const info = getExpenseCategoryInfo(category, settings);

      return {
        category,
        label: info.labelDe,
        icon: info.icon,
        color: info.color,
        current,
        previous,
        diff: current - previous,
        percentChange: calculatePercentChange(current, previous),
        shareOfCurrent: currentTotal > 0 ? (current / currentTotal) * 100 : 0,
      };
    })
    .filter((entry) => entry.current > 0 || entry.previous > 0)
    .sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff));
};

const buildNetWorthTrend = (
  reportMonth: string,
  netWorthHistory: NetWorthSnapshot[],
  accounts: FinanceState['accounts'],
  debts: FinanceState['debts']
): MonthlyReportTrendPoint[] => {
  const snapshotMap = buildSnapshotMap(netWorthHistory);
  const currentMonth = getCurrentMonth();

  return Array.from({ length: 6 }, (_, index) => shiftMonth(reportMonth, index - 5)).map((month) => {
    const snapshot = snapshotMap.get(month);
    const liveSnapshot = month === currentMonth
      ? {
          netWorth: calculateNetWorth(accounts, debts),
          totalAssets: accounts.reduce((sum, account) => sum + account.balance, 0),
          totalDebts: debts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
        }
      : null;
    const values = snapshot || liveSnapshot;

    return {
      month,
      label: getShortMonthName(month),
      netWorth: values?.netWorth ?? null,
      assets: values?.totalAssets ?? null,
      debts: values?.totalDebts ?? null,
    };
  });
};

export const getLatestCompletedMonth = (referenceMonth = getCurrentMonth()): string => shiftMonth(referenceMonth, -1);

export const resolveMonthlyReportMonth = (requestedMonth?: string) => {
  const currentMonth = getCurrentMonth();
  const latestCompletedMonth = getLatestCompletedMonth(currentMonth);
  const shouldAdjust = !requestedMonth || requestedMonth >= currentMonth;
  const reportMonth = shouldAdjust ? latestCompletedMonth : requestedMonth;

  return {
    currentMonth,
    latestCompletedMonth,
    reportMonth,
    adjustedFromSelection: Boolean(requestedMonth) && requestedMonth !== reportMonth,
  };
};

export const buildMonthlyReportData = (
  state: Pick<
    FinanceState,
    'selectedMonth' | 'incomes' | 'fixedExpenses' | 'debts' | 'expenses' | 'settings' | 'workSessions' | 'freelanceProjects' | 'netWorthHistory' | 'accounts'
  >,
  requestedMonth?: string
): MonthlyReportData => {
  const resolvedMonth = resolveMonthlyReportMonth(requestedMonth || state.selectedMonth);
  const reportMonth = resolvedMonth.reportMonth;
  const previousMonth = shiftMonth(reportMonth, -1);

  const summary = calculateMonthSummary(reportMonth, state.incomes, state.fixedExpenses, state.debts, state.expenses);
  const previousSummary = calculateMonthSummary(previousMonth, state.incomes, state.fixedExpenses, state.debts, state.expenses);
  const currentBreakdown = calculateMonthExpenseBreakdown(reportMonth, state.expenses, state.fixedExpenses, state.settings);
  const previousBreakdown = calculateMonthExpenseBreakdown(previousMonth, state.expenses, state.fixedExpenses, state.settings);
  const workSummary = buildWorkSummary(reportMonth, state.workSessions, state.freelanceProjects);
  const previousWorkSummary = buildWorkSummary(previousMonth, state.workSessions, state.freelanceProjects);
  const categoryComparison = buildCategoryComparison(
    currentBreakdown.variableByCategory,
    previousBreakdown.variableByCategory,
    state.settings
  );

  const topVariableExpenses = currentBreakdown.variableExpenses.slice(0, 8).map((expense) => {
    const info = getExpenseCategoryInfo(expense.category, state.settings);
    return {
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      date: format(parseISO(expense.date), 'dd.MM.'),
      category: expense.category,
      categoryLabel: info.labelDe,
      categoryColor: info.color,
    };
  });

  const expenseComposition = Object.entries(currentBreakdown.variableByCategory)
    .map(([category, value]) => {
      const info = getExpenseCategoryInfo(category, state.settings);
      return {
        key: category,
        name: info.labelDe,
        value,
        color: info.color,
      };
    })
    .sort((left, right) => right.value - left.value);

  const totalSpent = summary.totalFixedExpenses + summary.totalDebtPayments + summary.totalVariableExpenses;
  const previousTotalSpent = previousSummary.totalFixedExpenses + previousSummary.totalDebtPayments + previousSummary.totalVariableExpenses;
  const savingsRate = summary.totalIncome > 0 ? (summary.remaining / summary.totalIncome) * 100 : 0;
  const previousSavingsRate = previousSummary.totalIncome > 0 ? (previousSummary.remaining / previousSummary.totalIncome) * 100 : 0;

  return {
    currentMonth: resolvedMonth.currentMonth,
    latestCompletedMonth: resolvedMonth.latestCompletedMonth,
    reportMonth,
    previousMonth,
    adjustedFromSelection: resolvedMonth.adjustedFromSelection,
    summary,
    previousSummary,
    totalSpent,
    previousTotalSpent,
    savingsRate,
    previousSavingsRate,
    comparisonChartData: [
      { label: 'Einnahmen', current: summary.totalIncome, previous: previousSummary.totalIncome },
      { label: 'Fixkosten', current: summary.totalFixedExpenses, previous: previousSummary.totalFixedExpenses },
      { label: 'Schulden', current: summary.totalDebtPayments, previous: previousSummary.totalDebtPayments },
      { label: 'Variabel', current: summary.totalVariableExpenses, previous: previousSummary.totalVariableExpenses },
      { label: 'Verfügbar', current: summary.remaining, previous: previousSummary.remaining },
    ],
    categoryComparison,
    topIncreaseCategories: categoryComparison.filter((entry) => entry.diff > 0).slice(0, 4),
    topDecreaseCategories: categoryComparison.filter((entry) => entry.diff < 0).slice(0, 4),
    expenseComposition,
    topVariableExpenses,
    fixedExpenses: currentBreakdown.fixedExpenses.filter((entry) => !entry.linkedDebt).slice(0, 8),
    dailySpendData: buildDailySpendData(
      reportMonth,
      previousMonth,
      currentBreakdown.variableExpenses,
      previousBreakdown.variableExpenses
    ),
    workSummary,
    previousWorkSummary,
    workComparisonData: [
      {
        month: getShortMonthName(previousMonth),
        billableHours: previousWorkSummary.billableHours,
        nonBillableHours: previousWorkSummary.nonBillableHours,
        revenue: previousWorkSummary.revenue,
        sessions: previousWorkSummary.sessionCount,
      },
      {
        month: getShortMonthName(reportMonth),
        billableHours: workSummary.billableHours,
        nonBillableHours: workSummary.nonBillableHours,
        revenue: workSummary.revenue,
        sessions: workSummary.sessionCount,
      },
    ],
    netWorthTrend: buildNetWorthTrend(reportMonth, state.netWorthHistory, state.accounts, state.debts),
    debtSnapshot: state.debts
      .filter((debt) => debt.remainingAmount > 0)
      .map((debt) => ({
        id: debt.id,
        name: debt.name,
        remainingAmount: debt.remainingAmount,
        totalAmount: debt.totalAmount,
        monthlyPayment: debt.monthlyPayment,
        progressPercent: debt.totalAmount > 0
          ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100
          : 0,
      }))
      .sort((left, right) => right.remainingAmount - left.remainingAmount),
  };
};