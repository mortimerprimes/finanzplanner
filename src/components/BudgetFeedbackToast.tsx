'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Icon, ProgressBar } from './ui';
import { formatCurrency, getMonthDisplayName } from '../utils/helpers';
import {
  calculateExpenseBudgetFeedback,
  EXPENSE_BUDGET_FEEDBACK_EVENT,
  type ExpenseBudgetFeedback,
  type ExpenseBudgetFeedbackDetail,
} from '../utils/budgetFeedback';

const AUTO_CLOSE_MS = 5600;

export function BudgetFeedbackToast() {
  const { state } = useFinance();
  const stateRef = useRef(state);
  const timeoutRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<ExpenseBudgetFeedback | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state.settings.notifications.budgetWarnings) {
      return;
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setFeedback(null);
  }, [state.settings.notifications.budgetWarnings]);

  useEffect(() => {
    const handleBudgetFeedback = (event: Event) => {
      const detail = (event as CustomEvent<ExpenseBudgetFeedbackDetail>).detail;
      if (!detail?.expense) {
        return;
      }

      const currentState = stateRef.current;
      if (!currentState.settings.notifications.budgetWarnings) {
        return;
      }

      const nextFeedback = calculateExpenseBudgetFeedback(
        detail.expense,
        currentState.expenses,
        currentState.budgetLimits,
        currentState.settings,
      );

      if (!nextFeedback) {
        return;
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      setFeedback(nextFeedback);
      timeoutRef.current = window.setTimeout(() => {
        setFeedback(null);
        timeoutRef.current = null;
      }, AUTO_CLOSE_MS);
    };

    window.addEventListener(EXPENSE_BUDGET_FEEDBACK_EVENT, handleBudgetFeedback as EventListener);

    return () => {
      window.removeEventListener(EXPENSE_BUDGET_FEEDBACK_EVENT, handleBudgetFeedback as EventListener);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!feedback) {
    return null;
  }

  const warningThreshold = state.settings.budgetWarningThreshold;
  const remainingAbs = Math.abs(feedback.remaining);
  const progressColor = feedback.isOver
    ? '#ef4444'
    : feedback.percentage >= warningThreshold
      ? '#f59e0b'
      : '#10b981';
  const badgeClassName = feedback.isOver
    ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
    : feedback.percentage >= warningThreshold
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
  const title = feedback.isOver
    ? `${formatCurrency(remainingAbs, state.settings)} ueber Budget`
    : feedback.remaining === 0
      ? 'Budget voll ausgeschoepft'
      : `${formatCurrency(feedback.remaining, state.settings)} uebrig`;
  const message = feedback.isOver
    ? `Nach "${feedback.description}" liegst du in ${feedback.categoryLabel} jetzt ueber dem Budget.`
    : `Nach "${feedback.description}" bleiben dir in ${feedback.categoryLabel} noch ${formatCurrency(feedback.remaining, state.settings)}.`;

  return (
    <div className="fixed inset-x-4 top-[calc(4.75rem+var(--safe-area-top))] z-[95] mx-auto max-w-md animate-fade-in sm:left-auto sm:right-6 sm:mx-0 sm:w-[380px]">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 rounded-2xl p-2.5"
              style={{ backgroundColor: `${feedback.categoryColor}18` }}
            >
              <Icon name={feedback.categoryIcon} size={18} color={feedback.categoryColor} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{feedback.categoryLabel}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${badgeClassName}`}>
                      {feedback.isOver ? 'Budget drueber' : feedback.percentage >= warningThreshold ? 'Budget knapp' : 'Budget im Blick'}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-gray-400">{message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  aria-label="Budget-Hinweis schliessen"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-gray-800/60">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-gray-500">Budget</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(feedback.limit, state.settings)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-gray-800/60">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-gray-500">Ausgegeben</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(feedback.spent, state.settings)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-gray-800/60">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-gray-500">Monat</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{getMonthDisplayName(feedback.month)}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-gray-500">
                  <span>{Math.min(Math.round(feedback.percentage), 999)}% genutzt</span>
                  <span>
                    {feedback.isOver ? `${formatCurrency(remainingAbs, state.settings)} ueber Limit` : `${formatCurrency(feedback.remaining, state.settings)} Rest`}
                  </span>
                </div>
                <ProgressBar value={feedback.spent} max={feedback.limit} color={progressColor} size="md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}