import { useEffect, useRef } from 'react';
import { useFinance } from '@/lib/finance-context';
import { AppNotification } from '@/src/types';
import {
  calculateMonthSummary,
  calculateNetWorth,
  formatCurrency,
  getActiveBudgetLimits,
  getBudgetLimitValue,
  getMonthDisplayName,
  getExpenseCategoryInfo,
  getCurrentMonth,
  shiftMonth,
} from '../utils/helpers';

const MONTHLY_REPORT_NOTIFICATION_KEY = 'finanzplanner_monthly_report_ready';

/**
 * Generates in-app notifications based on budget warnings, bill reminders,
 * savings milestones, and other financial events. Runs once on mount and
 * whenever the selected month or relevant data changes.
 */
export function useNotificationEngine() {
  const { state, dispatch } = useFinance();
  const lastRunRef = useRef<string>('');

  useEffect(() => {
    const { settings, incomes, fixedExpenses, debts, expenses, savingsGoals, budgetLimits, accounts, notifications, workSessions } = state;
    const month = getCurrentMonth();

    // Deduplicate: only run once per data snapshot (simple fingerprint)
    const fingerprint = `${month}-${expenses.length}-${savingsGoals.length}-${debts.length}-${notifications.length}`;
    if (lastRunRef.current === fingerprint) return;
    lastRunRef.current = fingerprint;

    const today = new Date();
    const dayOfMonth = today.getDate();
    const existingTitles = new Set(notifications.filter(n => n.createdAt > new Date(today.getFullYear(), today.getMonth(), 1).toISOString()).map(n => n.title));

    const addNotification = (
      type: AppNotification['type'],
      title: string,
      message: string,
      icon?: string,
      color?: string,
      href?: string
    ) => {
      if (existingTitles.has(title)) return;
      existingTitles.add(title);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: { type, title, message, icon, color, href, read: false },
      });
    };

    const showBrowserNotification = (title: string, message: string, href?: string) => {
      if (typeof window === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }

      const notification = new Notification(title, {
        body: message,
        icon: '/icons/icon-192.svg',
      });

      if (href) {
        notification.onclick = () => {
          window.focus();
          window.location.href = href;
          notification.close();
        };
      }
    };

    // ── Budget-Warnungen ──
    if (settings.notifications.budgetWarnings) {
      const monthLimits = getActiveBudgetLimits(budgetLimits, month);
      for (const limit of monthLimits) {
        const spent = expenses
          .filter(e => e.month === month && e.category === limit.category)
          .reduce((sum, e) => sum + e.amount, 0);
        const effectiveLimit = getBudgetLimitValue(limit);
        const pct = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
        const info = getExpenseCategoryInfo(limit.category, settings);

        if (pct >= 100) {
          addNotification(
            'budget-warning',
            `Budget ${info.labelDe} überschritten`,
            `Du hast ${formatCurrency(spent, settings)} ausgegeben – ${formatCurrency(spent - effectiveLimit, settings)} über dem Limit von ${formatCurrency(effectiveLimit, settings)}.`,
            'AlertTriangle',
            '#ef4444'
          );
        } else if (pct >= settings.budgetWarningThreshold) {
          addNotification(
            'budget-warning',
            `Budget ${info.labelDe} bei ${Math.round(pct)}%`,
            `Noch ${formatCurrency(effectiveLimit - spent, settings)} übrig von ${formatCurrency(effectiveLimit, settings)}.`,
            'TrendingUp',
            '#f59e0b'
          );
        }
      }
    }

    // ── Rechnungs-Erinnerungen (3 Tage vor Fälligkeit) ──
    if (settings.notifications.billReminders) {
      for (const fe of fixedExpenses.filter(f => f.isActive)) {
        const dueDay = fe.dueDay;
        const daysUntilDue = dueDay - dayOfMonth;

        if (daysUntilDue >= 0 && daysUntilDue <= 3) {
          const when = daysUntilDue === 0 ? 'heute' : daysUntilDue === 1 ? 'morgen' : `in ${daysUntilDue} Tagen`;
          addNotification(
            'bill-reminder',
            `${fe.name} fällig ${when}`,
            `${formatCurrency(fe.amount, settings)} am ${dueDay}. des Monats.`,
            'CalendarClock',
            '#6366f1'
          );
        }
      }

      // Debt payments reminder (if day <= 3 and month start)
      for (const debt of debts.filter(d => d.remainingAmount > 0)) {
        if (dayOfMonth <= 3) {
          addNotification(
            'bill-reminder',
            `Schuldenrate ${debt.name}`,
            `${formatCurrency(debt.monthlyPayment, settings)} Rate diesen Monat fällig. Restschuld: ${formatCurrency(debt.remainingAmount, settings)}.`,
            'CreditCard',
            '#8b5cf6'
          );
        }
      }
    }

    // ── Sparziel-Impulse ──
    if (settings.notifications.savingsGoals) {
      for (const goal of savingsGoals.filter(g => !g.isCompleted)) {
        const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

        // Milestone notifications at 25%, 50%, 75%, 90%
        const milestones = [90, 75, 50, 25];
        for (const milestone of milestones) {
          if (pct >= milestone && pct < milestone + 10) {
            addNotification(
              'savings-milestone',
              `${goal.name}: ${milestone}% erreicht!`,
              `${formatCurrency(goal.currentAmount, settings)} von ${formatCurrency(goal.targetAmount, settings)} gespart. Weiter so!`,
              'PiggyBank',
              '#10b981'
            );
            break;
          }
        }

        // Deadline warning
        if (goal.deadline) {
          const deadlineDate = new Date(goal.deadline);
          const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 0 && daysLeft <= 30 && pct < 90) {
            addNotification(
              'savings-milestone',
              `${goal.name}: Deadline in ${daysLeft} Tagen`,
              `Noch ${formatCurrency(goal.targetAmount - goal.currentAmount, settings)} bis zum Ziel. Deadline: ${goal.deadline}.`,
              'Clock',
              '#f59e0b'
            );
          }
        }
      }

      // Completed goals
      for (const goal of savingsGoals.filter(g => g.isCompleted)) {
        addNotification(
          'savings-milestone',
          `🎉 ${goal.name} erreicht!`,
          `Sparziel von ${formatCurrency(goal.targetAmount, settings)} vollständig erreicht!`,
          'PartyPopper',
          '#10b981'
        );
      }
    }

    // ── Allgemeine Hinweise ──
    const summary = calculateMonthSummary(month, incomes, fixedExpenses, debts, expenses);
    if (summary.remaining < 0) {
      addNotification(
        'general',
        'Monat im Minus',
        `Du bist diesen Monat ${formatCurrency(Math.abs(summary.remaining), settings)} im Minus. Prüfe variable Ausgaben.`,
        'AlertOctagon',
        '#ef4444'
      );
    }

    if (settings.notifications.monthlyReport) {
      const readyMonth = shiftMonth(month, -1);
      const reportSummary = calculateMonthSummary(readyMonth, incomes, fixedExpenses, debts, expenses);
      const hasReportData = (
        reportSummary.totalIncome > 0
        || reportSummary.totalFixedExpenses > 0
        || reportSummary.totalDebtPayments > 0
        || reportSummary.totalVariableExpenses > 0
        || workSessions.some((session) => session.date.slice(0, 7) === readyMonth)
      );
      const lastNotifiedMonth = localStorage.getItem(MONTHLY_REPORT_NOTIFICATION_KEY);
      const title = `Monatsbericht ${getMonthDisplayName(readyMonth)} ist fertig`;

      if (hasReportData && lastNotifiedMonth !== readyMonth) {
        const message = `Vergleiche ${getMonthDisplayName(readyMonth)} mit ${getMonthDisplayName(shiftMonth(readyMonth, -1))} inklusive Kategorien, Vermögen, Schulden und Arbeitszeit.`;
        addNotification(
          'monthly-report',
          title,
          message,
          'FileBarChart',
          '#0f766e',
          '/monthly-report'
        );
        showBrowserNotification(title, message, '/monthly-report');
        localStorage.setItem(MONTHLY_REPORT_NOTIFICATION_KEY, readyMonth);
      }
    }

    // Net worth snapshot (record once per month)
    const netWorth = calculateNetWorth(accounts, debts);
    const alreadyRecorded = state.netWorthHistory.some(s => s.month === month);
    if (!alreadyRecorded && (accounts.length > 0 || debts.length > 0)) {
      dispatch({
        type: 'ADD_NET_WORTH_SNAPSHOT',
        payload: {
          month,
          netWorth,
          totalAssets: accounts.reduce((sum, a) => sum + a.balance, 0),
          totalDebts: debts.reduce((sum, d) => sum + d.remainingAmount, 0),
          recordedAt: new Date().toISOString(),
        },
      });
    }
  }, [state.expenses.length, state.savingsGoals, state.debts, state.budgetLimits, state.fixedExpenses, state.settings.notifications, dispatch, state]);
}
