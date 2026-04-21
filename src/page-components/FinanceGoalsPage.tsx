'use client';

import { useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { formatCurrency as fmtCurrency } from '@/src/utils/helpers';
import { Flag, CheckCircle2, Clock, TrendingUp, CreditCard, PiggyBank, Shield, Target } from 'lucide-react';

interface Goal {
  id: string;
  type: 'savings' | 'debt-free' | 'emergency';
  label: string;
  current: number;
  target: number;
  progress: number;
  deadline?: string;
  eta?: string;
  icon: typeof Flag;
  color: string;
  isCompleted: boolean;
}

export function FinanceGoalsPage() {
  const { state } = useFinance();
  const { settings } = state;
  const formatCurrency = (v: number) => fmtCurrency(v, settings);

  const goals = useMemo(() => {
    const result: Goal[] = [];

    // Savings goals
    for (const g of state.savingsGoals) {
      const progress = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);
      const monthlyRate = g.monthlyContribution || 0;
      const monthsLeft = monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : undefined;
      const etaDate = monthsLeft != null ? new Date(new Date().setMonth(new Date().getMonth() + monthsLeft)) : undefined;

      result.push({
        id: `savings-${g.id}`,
        type: g.goalCategory === 'emergency' ? 'emergency' : 'savings',
        label: g.name,
        current: g.currentAmount,
        target: g.targetAmount,
        progress,
        deadline: g.deadline,
        eta: etaDate ? etaDate.toISOString().slice(0, 7) : undefined,
        icon: g.goalCategory === 'emergency' ? Shield : PiggyBank,
        color: g.goalCategory === 'emergency' ? '#3b82f6' : g.color || '#10b981',
        isCompleted: g.isCompleted,
      });
    }

    // Debt-free goals
    for (const d of state.debts) {
      if (d.remainingAmount <= 0) continue;
      const progress = d.totalAmount > 0 ? Math.min(100, ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100) : 0;
      const monthsLeft = d.monthlyPayment > 0 ? Math.ceil(d.remainingAmount / d.monthlyPayment) : undefined;
      const etaDate = monthsLeft != null ? new Date(new Date().setMonth(new Date().getMonth() + monthsLeft)) : undefined;

      result.push({
        id: `debt-${d.id}`,
        type: 'debt-free',
        label: `${d.name} abbezahlen`,
        current: d.totalAmount - d.remainingAmount,
        target: d.totalAmount,
        progress,
        eta: etaDate ? etaDate.toISOString().slice(0, 7) : undefined,
        icon: CreditCard,
        color: '#ef4444',
        isCompleted: d.remainingAmount <= 0,
      });
    }

    return result.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return b.progress - a.progress;
    });
  }, [state.savingsGoals, state.debts]);

  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.isCompleted).length;
  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  const formatMonth = (month?: string) => {
    if (!month) return '—';
    try {
      const [y, m] = month.split('-');
      return new Date(Number(y), Number(m) - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    } catch { return month; }
  };

  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoalsList = goals.filter(g => g.isCompleted);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Flag size={28} className="text-emerald-500" />
          Finanz-Ziele
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Alle deine Ziele auf einen Blick</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4 text-center">
          <Target size={24} className="mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalGoals}</p>
          <p className="text-xs text-slate-500 dark:text-gray-400">Ziele gesamt</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4 text-center">
          <CheckCircle2 size={24} className="mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedGoals}</p>
          <p className="text-xs text-slate-500 dark:text-gray-400">Erreicht</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4 text-center">
          <TrendingUp size={24} className="mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgProgress}%</p>
          <p className="text-xs text-slate-500 dark:text-gray-400">Ø Fortschritt</p>
        </div>
      </div>

      {/* Timeline */}
      {totalGoals === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-gray-500">
          <Flag size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Noch keine Ziele</p>
          <p className="text-sm mt-1">Erstelle Sparziele oder Schulden, um deinen Fortschritt zu verfolgen</p>
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-3">Aktive Ziele ({activeGoals.length})</h2>
              <div className="space-y-3">
                {activeGoals.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <div key={goal.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: goal.color + '15', color: goal.color }}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{goal.label}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              goal.type === 'debt-free' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                              goal.type === 'emergency' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                              'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            }`}>
                              {goal.type === 'debt-free' ? 'Schulden' : goal.type === 'emergency' ? 'Notgroschen' : 'Sparen'}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-3 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${goal.progress}%`, backgroundColor: goal.color }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white w-10 text-right">{Math.round(goal.progress)}%</span>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                            <span>{formatCurrency(goal.current)} / {formatCurrency(goal.target)}</span>
                            <div className="flex items-center gap-3">
                              {goal.deadline && (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  Deadline: {formatMonth(goal.deadline.slice(0, 7))}
                                </span>
                              )}
                              {goal.eta && (
                                <span className="flex items-center gap-1">
                                  <TrendingUp size={12} />
                                  ETA: {formatMonth(goal.eta)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {completedGoalsList.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-3">Erreichte Ziele ({completedGoalsList.length})</h2>
              <div className="space-y-2">
                {completedGoalsList.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <div key={goal.id} className="bg-green-50 dark:bg-green-950/10 rounded-2xl border border-green-200 dark:border-green-900/30 p-3 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400">
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{goal.label}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">{formatCurrency(goal.target)} erreicht</p>
                      </div>
                      <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
