import type { BudgetLimit, Expense, Settings } from '../types';
import { getBudgetLimitForMonth, getBudgetLimitValue, getExpenseCategoryInfo } from './helpers';

export const EXPENSE_BUDGET_FEEDBACK_EVENT = 'finanzplanner-expense-budget-feedback';

export type ExpenseBudgetFeedbackInput = Pick<Expense, 'description' | 'amount' | 'category' | 'date' | 'month'>;

export interface ExpenseBudgetFeedbackDetail {
  expense: ExpenseBudgetFeedbackInput;
}

export interface ExpenseBudgetFeedback {
  description: string;
  amount: number;
  category: Expense['category'];
  categoryLabel: string;
  categoryIcon: string;
  categoryColor: string;
  month: string;
  spent: number;
  limit: number;
  remaining: number;
  percentage: number;
  isOver: boolean;
}

export function emitExpenseBudgetFeedback(expense: ExpenseBudgetFeedbackInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ExpenseBudgetFeedbackDetail>(EXPENSE_BUDGET_FEEDBACK_EVENT, {
      detail: { expense },
    })
  );
}

export function calculateExpenseBudgetFeedback(
  expense: ExpenseBudgetFeedbackInput,
  expenses: Pick<Expense, 'amount' | 'category' | 'month'>[],
  budgetLimits: BudgetLimit[],
  settings: Settings,
): ExpenseBudgetFeedback | null {
  const budget = getBudgetLimitForMonth(budgetLimits, expense.category, expense.month);
  if (!budget) {
    return null;
  }

  const limit = getBudgetLimitValue(budget);
  if (limit <= 0) {
    return null;
  }

  const spentBefore = expenses
    .filter((item) => item.month === expense.month && item.category === expense.category)
    .reduce((sum, item) => sum + item.amount, 0);

  const spent = spentBefore + expense.amount;
  const info = getExpenseCategoryInfo(expense.category, settings);

  return {
    description: expense.description,
    amount: expense.amount,
    category: expense.category,
    categoryLabel: info.labelDe,
    categoryIcon: info.icon,
    categoryColor: info.color,
    month: expense.month,
    spent,
    limit,
    remaining: limit - spent,
    percentage: limit > 0 ? (spent / limit) * 100 : 0,
    isOver: spent > limit,
  };
}