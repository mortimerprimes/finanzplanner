import { useState, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, BrainCircuit, Sparkles, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFinance } from '@/lib/finance-context';
import { useTheme } from '../hooks/useTheme';
import { Card, EmptyState, Icon, ProgressBar } from '../components/ui';
import { NetWorthHistory } from './NetWorthHistory';
import {
  calculateDebtPayoffMonths,
  calculateMonthSummary,
  calculateNetWorth,
  formatCurrency,
  getExpenseCategoryInfo,
  getProgressColor,
  getPreviousMonths,
  getShortMonthName,
  shiftMonth,
} from '../utils/helpers';

export function AnalyticsPage() {
  const { state } = useFinance();
  const { resolvedTheme } = useTheme();
  const { selectedMonth, incomes, fixedExpenses, debts, expenses, settings, budgetLimits, savingsGoals, accounts } = state;
  const [extraSavings, setExtraSavings] = useState(150);
  const [extraDebtPayment, setExtraDebtPayment] = useState(100);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>(() => debts.map((debt) => debt.id));

  const months = getPreviousMonths(settings.analyticsMonths, selectedMonth);
  const trendData = months.map((month) => {
    const summary = calculateMonthSummary(month, incomes, fixedExpenses, debts, expenses);
    const totalSpent = summary.totalFixedExpenses + summary.totalDebtPayments + summary.totalVariableExpenses;
    const surplusRate = summary.totalIncome > 0 ? (summary.remaining / summary.totalIncome) * 100 : 0;

    return {
      month,
      label: getShortMonthName(month),
      income: summary.totalIncome,
      fixed: summary.totalFixedExpenses,
      debt: summary.totalDebtPayments,
      variable: summary.totalVariableExpenses,
      spent: totalSpent,
      remaining: summary.remaining,
      surplusRate,
    };
  });

  const current = trendData[trendData.length - 1];
  const previous = trendData[trendData.length - 2];

  if (!current || trendData.every((item) => item.income === 0 && item.spent === 0)) {
    return (
      <Card>
        <EmptyState
          icon="ChartNoAxesCombined"
          title="Noch nicht genug Daten für Analysen"
          description="Sobald du Einnahmen und Ausgaben erfasst hast, erscheinen hier Trends, Vergleiche, Top-Ausgaben und Prognosen."
        />
      </Card>
    );
  }

  const currentSummary = calculateMonthSummary(selectedMonth, incomes, fixedExpenses, debts, expenses);
  const currentBudgetUsage = currentSummary.totalIncome > 0
    ? ((currentSummary.totalFixedExpenses + currentSummary.totalDebtPayments + currentSummary.totalVariableExpenses) / currentSummary.totalIncome) * 100
    : 0;

  const topCategories = Object.entries(currentSummary.expensesByCategory)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => {
      const info = getExpenseCategoryInfo(key, settings);
      return { key, name: info.labelDe, color: info.color, value };
    })
    .sort((a, b) => b.value - a.value);

  const topExpenses = expenses
    .filter((expense) => expense.month === selectedMonth)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const worstBudgetCategories = budgetLimits
    .map((limit) => {
      const spent = expenses
        .filter((expense) => expense.month === selectedMonth && expense.category === limit.category)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const percentage = limit.monthlyLimit > 0 ? (spent / limit.monthlyLimit) * 100 : 0;
      return { limit, spent, percentage, overrun: spent - limit.monthlyLimit };
    })
    .filter((item) => item.percentage >= settings.budgetWarningThreshold)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  const yearlyOverview = getPreviousMonths(12, selectedMonth).map((month) => {
    const summary = calculateMonthSummary(month, incomes, fixedExpenses, debts, expenses);
    return {
      label: getShortMonthName(month),
      remaining: summary.remaining,
      variable: summary.totalVariableExpenses,
    };
  });

  const averageRemaining = trendData.reduce((sum, item) => sum + item.remaining, 0) / Math.max(trendData.length, 1);
  const averageSurplusRate = trendData.reduce((sum, item) => sum + item.surplusRate, 0) / Math.max(trendData.length, 1);
  const deltaRemaining = previous ? current.remaining - previous.remaining : 0;
  const debtBurden = current.income ? (current.debt / current.income) * 100 : 0;
  const fixedCostRatio = current.income ? (current.fixed / current.income) * 100 : 0;
  const totalGoalTarget = savingsGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalGoalCurrent = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const savingsCompletion = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;
  const netWorth = calculateNetWorth(accounts, debts);
  const avgVariable = trendData.reduce((sum, item) => sum + item.variable, 0) / Math.max(trendData.length, 1);
  const forecastData = [1, 2, 3].map((offset) => {
    const forecastMonth = shiftMonth(selectedMonth, offset);
    const projectedIncome = current.income;
    const projectedSpent = current.fixed + current.debt + avgVariable;
    return {
      month: getShortMonthName(forecastMonth),
      income: projectedIncome,
      spent: projectedSpent,
      remaining: projectedIncome - projectedSpent,
    };
  });

  const adjustedRemaining = current.remaining - extraSavings - extraDebtPayment;
  const selectedDebts = debts.filter((debt) => selectedDebtIds.includes(debt.id));
  const selectedRemainingDebt = selectedDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const selectedMonthlyDebt = selectedDebts.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
  const fasterDebtMonths = selectedRemainingDebt > 0
    ? Math.ceil(selectedRemainingDebt / Math.max(selectedMonthlyDebt + extraDebtPayment, 1))
    : 0;
  const baselineDebtMonths = debts.length > 0
    ? Math.max(...debts.map((debt) => calculateDebtPayoffMonths(debt)))
    : 0;
  const selectedBaselineMonths = selectedDebts.length > 0
    ? Math.max(...selectedDebts.map((debt) => calculateDebtPayoffMonths(debt)))
    : 0;

  const debtSimulationRows = selectedDebts.map((debt) => {
    const share = selectedRemainingDebt > 0 ? debt.remainingAmount / selectedRemainingDebt : 0;
    const addedPayment = extraDebtPayment * share;
    const newMonthlyPayment = debt.monthlyPayment + addedPayment;
    const baselineMonths = calculateDebtPayoffMonths(debt);
    const fasterMonths = debt.remainingAmount > 0
      ? Math.ceil(debt.remainingAmount / Math.max(newMonthlyPayment, 1))
      : 0;

    return {
      debt,
      newMonthlyPayment,
      baselineMonths,
      fasterMonths,
      savedMonths: Math.max(0, baselineMonths - fasterMonths),
    };
  }).sort((a, b) => b.savedMonths - a.savedMonths);

  const toggleDebt = (debtId: string) => {
    setSelectedDebtIds((currentIds) => (
      currentIds.includes(debtId)
        ? currentIds.filter((id) => id !== debtId)
        : [...currentIds, debtId]
    ));
  };

  // Expense heatmap (last 90 days)
  const heatmapData = useMemo(() => {
    const today = new Date();
    const days: { date: string; amount: number; dayOfWeek: number; week: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayExpenses = expenses.filter(e => e.date === dateStr).reduce((s, e) => s + e.amount, 0);
      days.push({ date: dateStr, amount: dayExpenses, dayOfWeek: d.getDay(), week: Math.floor((89 - i) / 7) });
    }
    return days;
  }, [expenses]);
  const heatmapMax = Math.max(...heatmapData.map(d => d.amount), 1);

  // Category trend (last 6 months)
  const categoryTrendData = useMemo(() => {
    const months6 = getPreviousMonths(6, selectedMonth);
    const allCats = [...new Set(expenses.filter(e => months6.includes(e.month)).map(e => e.category))];
    return { months: months6.map(m => ({
      label: getShortMonthName(m),
      ...Object.fromEntries(allCats.map(cat => [cat, expenses.filter(e => e.month === m && e.category === cat).reduce((s, e) => s + e.amount, 0)]))
    })), categories: allCats };
  }, [expenses, selectedMonth]);

  const insights = [
    {
      title: 'Liquiditätslage',
      text: current.remaining >= 0
        ? `Du liegst aktuell ${formatCurrency(current.remaining, settings)} im Plus.`
        : `Aktuell fehlt dir ${formatCurrency(Math.abs(current.remaining), settings)} bis zur schwarzen Null.`,
      tone: current.remaining >= 0 ? 'emerald' : 'red',
      icon: current.remaining >= 0 ? 'ShieldCheck' : 'AlertTriangle',
    },
    {
      title: 'Fixkostenquote',
      text: `${fixedCostRatio.toFixed(0)}% deines Einkommens gehen in feste Verpflichtungen.`,
      tone: fixedCostRatio > 55 ? 'amber' : 'blue',
      icon: 'Receipt',
    },
    {
      title: 'Jahresblick',
      text: `Im 12-Monats-Schnitt bleiben dir ${formatCurrency(averageRemaining, settings)} pro Monat übrig.`,
      tone: 'violet',
      icon: 'CalendarRange',
    },
  ];

  const chartStroke = resolvedTheme === 'dark' ? '#374151' : '#cbd5e1';
  const chartTick = resolvedTheme === 'dark' ? '#9ca3af' : '#64748b';
  const tooltipStyle = {
    backgroundColor: resolvedTheme === 'dark' ? '#111827' : '#ffffff',
    borderColor: resolvedTheme === 'dark' ? '#374151' : '#e2e8f0',
    color: resolvedTheme === 'dark' ? '#f9fafb' : '#0f172a',
    borderRadius: '14px',
  };
  const tooltipFormatter = (value: number | string | readonly (number | string)[] | undefined) => {
    const normalized = Array.isArray(value) ? value[0] : value;
    return formatCurrency(Number(normalized ?? 0), settings);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Finanzanalyse</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">Vergleiche, Jahresbild, Top-Ausgaben und Was-wäre-wenn-Simulationen</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
          <Sparkles size={16} className="text-violet-500" />
          <span className="font-medium text-gray-900 dark:text-white">Analysefenster: {settings.analyticsMonths} Monate</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Netto-Spielraum</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(current.remaining, settings)}</p>
            </div>
            <div className={`rounded-2xl p-3 ${deltaRemaining >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              {deltaRemaining >= 0 ? <ArrowUpRight size={20} className="text-emerald-500" /> : <ArrowDownRight size={20} className="text-red-500" />}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">Gegenüber dem Vormonat: {deltaRemaining >= 0 ? '+' : ''}{formatCurrency(deltaRemaining, settings)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Durchschnittlich frei übrig</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{averageSurplusRate.toFixed(0)}%</p>
          <div className="mt-3">
            <ProgressBar value={Math.max(0, averageSurplusRate)} max={40} color={getProgressColor(Math.max(0, averageSurplusRate) * 2.5)} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Schuldenbelastung</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{debtBurden.toFixed(0)}%</p>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">Anteil der Monatsraten am Einkommen</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Sparziel-Fortschritt</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{savingsCompletion.toFixed(0)}%</p>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">{formatCurrency(totalGoalCurrent, settings)} von {formatCurrency(totalGoalTarget, settings)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Nettovermögen</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(netWorth, settings)}</p>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">{accounts.length} Konten minus offene Schulden</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Cashflow-Trend</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500">Einnahmen, Gesamtausgaben und Restbudget im Zeitverlauf</p>
            </div>
            <TrendingUp size={18} className="text-blue-500" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} opacity={0.25} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: chartTick, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: chartTick, fontSize: 12 }} />
                <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
                <Area type="monotone" dataKey="income" stroke="#10b981" fill="#10b98122" strokeWidth={2} />
                <Area type="monotone" dataKey="spent" stroke="#ef4444" fill="#ef444422" strokeWidth={2} />
                <Area type="monotone" dataKey="remaining" stroke="#3b82f6" fill="#3b82f622" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Top-Kategorien</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500">Größte variable Ausgaben im aktuellen Monat</p>
            </div>
            <BrainCircuit size={18} className="text-violet-500" />
          </div>
          {topCategories.length > 0 ? (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topCategories.slice(0, 5)} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {topCategories.slice(0, 5).map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {topCategories.slice(0, 5).map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="truncate text-sm text-gray-700 dark:text-gray-300">{entry.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.value, settings)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400 dark:text-gray-600">Noch keine Kategoriedaten</div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Jahresübersicht</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500">Verlauf von Restbudget und variablen Ausgaben über 12 Monate</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyOverview}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} opacity={0.25} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: chartTick, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: chartTick, fontSize: 12 }} />
                <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
                <Bar dataKey="remaining" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="variable" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Smart Insights</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500">Hinweise wie in Premium-Planer-Apps</p>
          </div>
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.title}
                className={`rounded-2xl border p-4 ${
                  insight.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20' :
                  insight.tone === 'red' ? 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20' :
                  insight.tone === 'amber' ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20' :
                  'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white/70 p-2 dark:bg-gray-900/50">
                    <Icon name={insight.icon} size={16} className="text-slate-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{insight.title}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{insight.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Top-Ausgaben</h3>
          <div className="space-y-2">
            {topExpenses.length > 0 ? topExpenses.map((expense) => {
              const info = getExpenseCategoryInfo(expense.category, settings);
              return (
                <div key={expense.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{expense.description}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">{info.labelDe}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(expense.amount, settings)}</span>
                  </div>
                </div>
              );
            }) : <p className="text-sm text-slate-400 dark:text-gray-600">Noch keine Buchungen</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Schwächste Budgetkategorien</h3>
          <div className="space-y-3">
            {worstBudgetCategories.length > 0 ? worstBudgetCategories.map((item) => {
              const info = getExpenseCategoryInfo(item.limit.category, settings);
              return (
                <div key={item.limit.id} className="rounded-xl border border-slate-200 p-3 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon name={info.icon} size={15} color={info.color} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{info.labelDe}</span>
                    </div>
                    <span className={`text-sm font-semibold ${item.percentage >= 100 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                    {formatCurrency(item.spent, settings)} von {formatCurrency(item.limit.monthlyLimit, settings)}
                  </p>
                </div>
              );
            }) : <p className="text-sm text-slate-400 dark:text-gray-600">Keine Warnkategorien im aktuellen Monat.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Was-wäre-wenn-Rechner</h3>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
                <span>Ziel-Schulden auswählen</span>
                <span>{selectedDebts.length} ausgewählt</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {debts.length > 0 ? debts.map((debt) => {
                  const isActive = selectedDebtIds.includes(debt.id);
                  return (
                    <button
                      key={debt.id}
                      onClick={() => toggleDebt(debt.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'border-violet-500 bg-violet-500 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300'
                      }`}
                    >
                      {debt.name}
                    </button>
                  );
                }) : (
                  <p className="text-sm text-slate-400 dark:text-gray-600">Noch keine Schulden vorhanden.</p>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
                <span>Zusätzlich sparen</span>
                <span>{formatCurrency(extraSavings, settings)}</span>
              </div>
              <input type="range" min="0" max="500" step="25" value={extraSavings} onChange={(event) => setExtraSavings(parseInt(event.target.value, 10))} className="w-full accent-blue-600" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
                <span>Schnellere Schuldenzahlung</span>
                <span>{formatCurrency(extraDebtPayment, settings)}</span>
              </div>
              <input type="range" min="0" max="500" step="25" value={extraDebtPayment} onChange={(event) => setExtraDebtPayment(parseInt(event.target.value, 10))} className="w-full accent-violet-600" />
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs text-slate-500 dark:text-gray-500">Neuer Restbetrag pro Monat</p>
              <p className={`mt-1 text-2xl font-bold ${adjustedRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(adjustedRemaining, settings)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                {selectedDebts.length > 0
                  ? `Ausgewählte Schulden ca. in ${fasterDebtMonths || 0} Monaten statt ${selectedBaselineMonths || 0}.`
                  : `Gesamte Schuldenfreiheit ca. in ${baselineDebtMonths || 0} Monaten.`}
              </p>
            </div>
            {selectedDebts.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Effekt auf ausgewählte Schulden</p>
                  <span className="text-xs text-slate-500 dark:text-gray-500">
                    +{formatCurrency(extraDebtPayment, settings)} verteilt
                  </span>
                </div>
                {debtSimulationRows.map((item) => (
                  <div key={item.debt.id} className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-gray-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.debt.name}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">
                          Neue Rate {formatCurrency(item.newMonthlyPayment, settings)} · Rest {formatCurrency(item.debt.remainingAmount, settings)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                        {item.savedMonths} Monate schneller
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                      Vorher {item.baselineMonths} Monate · Nachher {item.fasterMonths} Monate
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Budgetauslastung aktuell</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{currentBudgetUsage.toFixed(0)}%</p>
          <div className="mt-3">
            <ProgressBar value={currentBudgetUsage} max={100} color={getProgressColor(currentBudgetUsage)} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Größte Kategorie</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{topCategories[0]?.name || '—'}</p>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">{topCategories[0] ? formatCurrency(topCategories[0].value, settings) : 'Noch keine Daten'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Analysemodus</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{settings.storageMode === 'cloud-export' ? 'Sync-ready' : 'Private'}</p>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">Backupziel: {settings.backupProvider === 'device' ? 'Gerät' : settings.backupProvider === 'local-folder' ? 'Lokaler Ordner' : settings.backupProvider}</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">3-Monats-Prognose</h3>
          <p className="text-xs text-slate-500 dark:text-gray-500">Vorausschau auf Liquidität mit aktuellem Einkommen und durchschnittlichen variablen Ausgaben</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {forecastData.map((item) => (
            <div key={item.month} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
              <p className="text-xs text-slate-500 dark:text-gray-500">{item.month}</p>
              <p className={`mt-1 text-xl font-bold ${item.remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(item.remaining, settings)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                Einnahmen {formatCurrency(item.income, settings)} · Bedarf {formatCurrency(item.spent, settings)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Net Worth History */}
      <NetWorthHistory />

      {/* Expense Heatmap */}
      <Card className="p-5">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Ausgaben-Heatmap (90 Tage)</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-0.5" style={{ minWidth: '650px' }}>
            {Array.from({ length: 13 }, (_, week) => (
              <div key={week} className="flex flex-col gap-0.5">
                {Array.from({ length: 7 }, (_, day) => {
                  const idx = week * 7 + day;
                  const cell = heatmapData[idx];
                  if (!cell) return <div key={day} className="h-3.5 w-3.5" />;
                  const intensity = cell.amount / heatmapMax;
                  const bg = cell.amount === 0
                    ? 'bg-slate-100 dark:bg-gray-800'
                    : intensity < 0.25 ? 'bg-red-100 dark:bg-red-950/30'
                    : intensity < 0.5 ? 'bg-red-200 dark:bg-red-900/40'
                    : intensity < 0.75 ? 'bg-red-300 dark:bg-red-800/50'
                    : 'bg-red-500 dark:bg-red-600';
                  return (
                    <div
                      key={day}
                      className={`h-3.5 w-3.5 rounded-sm ${bg} transition-colors`}
                      title={`${cell.date}: ${formatCurrency(cell.amount, settings)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
            <span>Wenig</span>
            <div className="flex gap-0.5">
              <div className="h-3 w-3 rounded-sm bg-slate-100 dark:bg-gray-800" />
              <div className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950/30" />
              <div className="h-3 w-3 rounded-sm bg-red-200 dark:bg-red-900/40" />
              <div className="h-3 w-3 rounded-sm bg-red-300 dark:bg-red-800/50" />
              <div className="h-3 w-3 rounded-sm bg-red-500 dark:bg-red-600" />
            </div>
            <span>Viel</span>
          </div>
        </div>
      </Card>

      {/* Category Trends */}
      {categoryTrendData.categories.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Kategorie-Trends (6 Monate)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryTrendData.months}>
                <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e2e8f0'} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: resolvedTheme === 'dark' ? '#9ca3af' : '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: resolvedTheme === 'dark' ? '#9ca3af' : '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff', border: 'none', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: unknown) => formatCurrency(Number(value), settings)}
                />
                {categoryTrendData.categories.slice(0, 8).map((cat, i) => {
                  const info = getExpenseCategoryInfo(cat, settings);
                  return <Bar key={cat} dataKey={cat} stackId="a" fill={info.color} name={info.labelDe} radius={i === categoryTrendData.categories.length - 1 ? [4, 4, 0, 0] : undefined} />;
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
