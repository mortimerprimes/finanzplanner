import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useFinance } from '@/lib/finance-context';
import { useTheme } from '../hooks/useTheme';
import { Button, Card, EmptyState, Icon, Input, Modal, ProgressBar, Select, StatCard } from '../components/ui';
import { MonthEndWizard } from '../components/MonthEndWizard';
import {
  calculatePlannedFreelanceIncomeForMonth,
  calculateMonthSummary,
  calculateNetWorth,
  calculateSavingsProgress,
  formatCurrency,
  getActiveBudgetLimits,
  getBudgetLimitValue,
  getExpenseCategoryInfo,
  getExpenseCategoryMap,
  getProgressColor,
  shiftMonth,
  getShortMonthName,
} from '../utils/helpers';
import type { Expense, ExpenseCategory } from '../types';

export function Dashboard() {
  const { state, dispatch } = useFinance();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const { selectedMonth, incomes, fixedExpenses, debts, expenses, savingsGoals, settings, accounts, budgetLimits, workSessions, freelanceProjects, freelanceInvoices } = state;
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  const isMonthClosed = (state.monthCloses || []).some(mc => mc.month === selectedMonth);

  const summary = calculateMonthSummary(selectedMonth, incomes, fixedExpenses, debts, expenses);
  const plannedFreelanceIncome = calculatePlannedFreelanceIncomeForMonth(
    selectedMonth,
    workSessions,
    freelanceProjects,
    freelanceInvoices
  );
  const totalSpent = summary.totalFixedExpenses + summary.totalDebtPayments + summary.totalVariableExpenses;
  const monthNetFlow = summary.totalIncome - totalSpent;
  const spentRatioOfIncome = summary.totalIncome > 0
    ? (totalSpent / summary.totalIncome) * 100
    : totalSpent > 0 ? 100 : 0;
  const netWorth = calculateNetWorth(accounts, debts);
  const totalAccountBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const liquidAccounts = accounts.filter(
    (account) => account.type === 'checking' || account.type === 'savings' || account.type === 'cash'
  );
  const nonInvestmentAccounts = accounts.filter((account) => account.type !== 'investment');
  const liquidBalance = accounts
    .filter((account) => account.type === 'checking' || account.type === 'savings' || account.type === 'cash')
    .reduce((sum, account) => sum + account.balance, 0);
  const mainAccount =
    liquidAccounts.find((account) => account.isDefault)
    || nonInvestmentAccounts.find((account) => account.isDefault)
    || [...liquidAccounts].sort((a, b) => b.balance - a.balance)[0]
    || [...nonInvestmentAccounts].sort((a, b) => b.balance - a.balance)[0]
    || accounts.find((account) => account.isDefault)
    || [...accounts].sort((a, b) => b.balance - a.balance)[0]
    || null;
  const headlineBalance = mainAccount
    ? mainAccount.balance
    : (liquidAccounts.length > 0 ? liquidBalance : totalAccountBalance);
  const headlineLabel = mainAccount
    ? 'Kontostand Hauptkonto'
    : (liquidAccounts.length > 0 ? 'Liquider Kontostand' : 'Gesamtkontostand');
  const positiveAccountBase = Math.max(
    1,
    accounts.filter((account) => account.balance > 0).reduce((sum, account) => sum + account.balance, 0)
  );
  const topAccounts = [...accounts].sort((a, b) => b.balance - a.balance).slice(0, 4);
  const accountTypeLabels: Record<string, string> = {
    checking: 'Girokonto',
    savings: 'Sparkonto',
    cash: 'Bargeld',
    credit: 'Kreditkarte',
    investment: 'Depot',
  };
  const activeSavingsGoals = savingsGoals.filter((goal) => !goal.isCompleted).slice(0, 3);
  const recentExpenses = [...expenses]
    .filter((expense) => expense.month === selectedMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const monthBudgetLimits = getActiveBudgetLimits(budgetLimits, selectedMonth);
  const totalBudgetLimit = monthBudgetLimits.reduce((sum, limit) => sum + getBudgetLimitValue(limit), 0);
  const totalBudgetSpent = monthBudgetLimits.reduce((sum, limit) => {
    const spent = expenses
      .filter((expense) => expense.month === selectedMonth && expense.category === limit.category)
      .reduce((acc, expense) => acc + expense.amount, 0);
    return sum + spent;
  }, 0);
  const budgetRemaining = totalBudgetLimit - totalBudgetSpent;
  const reservedBudget = Math.max(0, budgetRemaining);
  const freeAvailable = summary.remaining - reservedBudget;
  const budgetUsage = totalBudgetLimit > 0
    ? (totalBudgetSpent / totalBudgetLimit) * 100
    : (summary.totalIncome > 0 ? (totalSpent / summary.totalIncome) * 100 : 0);
  const budgetLimitsByCategory = monthBudgetLimits.reduce<Record<string, number>>((acc, limit) => {
    const key = limit.category;
    acc[key] = (acc[key] || 0) + getBudgetLimitValue(limit);
    return acc;
  }, {});
  const budgetCategoryCards = Object.entries(budgetLimitsByCategory)
    .map(([category, limitAmount]) => {
      const spent = expenses
        .filter((expense) => expense.month === selectedMonth && expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const percentage = limitAmount > 0 ? (spent / limitAmount) * 100 : 0;
      return {
        category,
        limitAmount,
        spent,
        percentage,
        remaining: Math.max(0, limitAmount - spent),
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
  const categoryOptions = Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({ value, label: info.labelDe }));
  const accountOptions = [{ value: '', label: 'Ohne Konto' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];
  const widgetOptions = [
    { id: 'summary', label: 'Übersicht' },
    { id: 'budget', label: 'Budget' },
    { id: 'expense-overview', label: 'Ausgabenstruktur' },
    { id: 'recent-expenses', label: 'Letzte Ausgaben' },
    { id: 'savings', label: 'Sparziele' },
    { id: 'quick-stats', label: 'Kennzahlen' },
    { id: 'month-comparison', label: 'Monatsvergleich' },
    { id: 'forecast', label: 'Prognose' },
  ];

  const budgetRisks = budgetCategoryCards
    .filter((item) => item.percentage >= settings.budgetWarningThreshold)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 4);

  const pieData = Object.entries(summary.expensesByCategory)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => {
      const info = getExpenseCategoryInfo(key, settings);
      return {
        key,
        name: info.labelDe,
        value,
        color: info.color,
      };
    });

  const tooltipStyle = {
    backgroundColor: resolvedTheme === 'dark' ? '#111827' : '#ffffff',
    borderColor: resolvedTheme === 'dark' ? '#374151' : '#e2e8f0',
    color: resolvedTheme === 'dark' ? '#f9fafb' : '#0f172a',
    borderRadius: '14px',
  };
  const primaryRisk = budgetRisks[0];
  const topExpenseCategory = pieData.length > 0
    ? [...pieData].sort((a, b) => b.value - a.value)[0]
    : null;
  const nextFocus = summary.remaining < 0
    ? 'Du bist diesen Monat im Minus. Priorität: variable Ausgaben und Schuldenrate prüfen.'
    : primaryRisk
      ? `Achte auf ${getExpenseCategoryInfo(primaryRisk.category, settings).labelDe} – dort liegt das größte Limit-Risiko.`
      : 'Dein Monat ist stabil. Nutze Überschüsse für Sparziele oder schnellere Tilgung.';

  const widgetSections: Record<string, ReactNode> = {
    summary: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Aktueller Kontostand"
          value={formatCurrency(totalAccountBalance, settings)}
          subtitle={mainAccount ? `Hauptkonto: ${mainAccount.name}` : 'Noch keine Konten'}
          icon="Landmark"
          iconColor="#2563eb"
          iconBg="bg-blue-50 dark:bg-blue-950/40"
          onClick={() => router.push('/accounts')}
        />
        <StatCard
          title="Liquide Mittel"
          value={formatCurrency(liquidBalance, settings)}
          subtitle="Giro, Sparen und Bargeld"
          icon="Wallet"
          iconColor="#0f766e"
          iconBg="bg-teal-50 dark:bg-teal-950/40"
          onClick={() => router.push('/accounts')}
        />
        <StatCard
          title="Einnahmen im Monat"
          value={formatCurrency(summary.totalIncome, settings)}
          subtitle={plannedFreelanceIncome.total > 0 ? `+ ${formatCurrency(plannedFreelanceIncome.total, settings)} geplant` : 'Alle Einnahmen im Blick'}
          icon="TrendingUp"
          iconColor="#10b981"
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          onClick={() => router.push('/income')}
        />
        <StatCard
          title="Ausgaben im Monat"
          value={formatCurrency(totalSpent, settings)}
          subtitle={`${formatCurrency(summary.totalVariableExpenses, settings)} variable Ausgaben`}
          icon="Receipt"
          iconColor="#f59e0b"
          iconBg="bg-amber-50 dark:bg-amber-950/40"
          onClick={() => router.push('/expenses')}
        />
        <StatCard
          title="Frei verfügbar"
          value={formatCurrency(freeAvailable, settings)}
          subtitle={`Nach ${formatCurrency(reservedBudget, settings)} Budget-Reserve`}
          icon="Wallet"
          iconColor={freeAvailable >= 0 ? '#10b981' : '#ef4444'}
          iconBg={freeAvailable >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40'}
          onClick={() => router.push('/budget')}
        />
        <StatCard
          title="Nettovermögen"
          value={formatCurrency(netWorth, settings)}
          subtitle={accounts.length ? `${accounts.length} Konten aktiv` : 'Noch keine Konten'}
          icon="PiggyBank"
          iconColor="#6366f1"
          iconBg="bg-indigo-50 dark:bg-indigo-950/40"
          onClick={() => router.push('/accounts')}
        />
      </div>
    ),
    budget: (
      <Card className="p-5">
        <button onClick={() => router.push('/budget')} className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
          Monatsbudget
          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-gray-500">
              {totalBudgetLimit > 0 ? 'Budget verbraucht' : 'Gesamtausgaben vs. Einnahmen'}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {totalBudgetLimit > 0
                ? `${formatCurrency(totalBudgetSpent, settings)} / ${formatCurrency(totalBudgetLimit, settings)}`
                : `${formatCurrency(totalSpent, settings)} / ${formatCurrency(summary.totalIncome, settings)}`}
            </span>
          </div>
          <ProgressBar value={budgetUsage} max={100} color={getProgressColor(budgetUsage)} size="lg" />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            {[
              { label: 'Budget gesetzt', value: totalBudgetLimit, color: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200' },
              { label: 'Davon verbraucht', value: totalBudgetSpent, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300' },
              { label: 'Restbudget', value: reservedBudget, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300' },
              { label: 'Frei verfügbar', value: freeAvailable, color: freeAvailable >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-3 text-center ${item.color}`}>
                <p className="text-[11px] font-medium">{item.label}</p>
                <p className="mt-1 text-base font-bold">{formatCurrency(item.value, settings)}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    ),
    'expense-overview': (
      <Card className="p-5">
        <button onClick={() => router.push('/expenses')} className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
          Ausgaben nach Kategorie
          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {pieData.length > 0 ? (
          <>
            <div className="h-44 sm:h-52 lg:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string | readonly (number | string)[] | undefined) => formatCurrency(Number(Array.isArray(value) ? value[0] : value || 0), settings)}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: tooltipStyle.color }}
                    labelStyle={{ color: tooltipStyle.color }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pieData.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="flex-1 truncate text-xs text-slate-600 dark:text-gray-400">{entry.name}</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.value, settings)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-44 items-center justify-center text-sm text-slate-400 dark:text-gray-600 sm:h-52 lg:h-56">Keine Ausgaben in diesem Monat</div>
        )}
      </Card>
    ),
    'recent-expenses': (
      <Card className="p-5">
        <button onClick={() => router.push('/expenses')} className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
          Letzte Ausgaben
          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {recentExpenses.length > 0 ? (
          <div className="space-y-3">
            {recentExpenses.map((expense) => {
              const info = getExpenseCategoryInfo(expense.category, settings);
              const account = accounts.find((item) => item.id === expense.accountId);
              return (
                <div key={expense.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${info.color}15` }}>
                      <Icon name={info.icon} size={16} color={info.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{expense.description}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">{info.labelDe}{account ? ` · ${account.name}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">-{formatCurrency(expense.amount, settings)}</p>
                    <button
                      onClick={() => {
                        setEditingExpense(expense);
                        setDescription(expense.description);
                        setAmount(String(expense.amount));
                        setCategory(expense.category);
                        setDate(expense.date);
                        setAccountId(expense.accountId || '');
                        setNote(expense.note || '');
                      }}
                      className="rounded-lg p-1.5 transition-colors hover:bg-slate-200 dark:hover:bg-gray-700"
                    >
                      <Icon name="Pencil" size={14} className="text-slate-500" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Ausgabe löschen?')) {
                          dispatch({ type: 'DELETE_EXPENSE', payload: expense.id });
                        }
                      }}
                      className="rounded-lg p-1.5 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                    >
                      <Icon name="Trash2" size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="ShoppingBag"
            title="Noch keine Ausgaben"
            description="Sobald du Ausgaben erfasst, erscheint hier dein letzter Verlauf."
            helpText="Erfasse zuerst 2 bis 3 typische Ausgaben. Danach werden Verlauf, Budgetwarnungen und Kategorien sofort verständlicher."
            action={{
              label: 'Erste Ausgabe erfassen',
              onClick: () => window.dispatchEvent(new CustomEvent('open-quick-capture', { detail: { type: 'expense' } })),
            }}
          />
        )}
      </Card>
    ),
    savings: (
      <Card className="p-5">
        <button onClick={() => router.push('/savings')} className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
          Sparziele
          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {activeSavingsGoals.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {activeSavingsGoals.map((goal) => {
              const progress = calculateSavingsProgress(goal.currentAmount, goal.targetAmount);
              return (
                <div key={goal.id} className="rounded-xl border border-slate-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${goal.color}15` }}>
                      <Icon name={goal.icon} size={18} color={goal.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{goal.name}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        {formatCurrency(goal.currentAmount, settings)} / {formatCurrency(goal.targetAmount, settings)}
                      </p>
                    </div>
                  </div>
                  <ProgressBar value={progress} max={100} color={goal.color} size="md" />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="PiggyBank"
            title="Noch keine Sparziele"
            description="Lege Sparziele an, damit dein Dashboard auch Fortschritt und Meilensteine zeigt."
            helpText="Schon ein kleines Ziel wie Notgroschen oder Urlaub macht deine Überschüsse greifbarer und hilft beim Priorisieren."
            action={{ label: 'Sparziele öffnen', onClick: () => router.push('/savings') }}
            secondaryAction={{ label: 'Setup-Assistent', onClick: () => window.dispatchEvent(new CustomEvent('open-onboarding')) }}
          />
        )}
      </Card>
    ),
    'quick-stats': (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Einnahmequellen', value: incomes.filter((income) => income.isRecurring).length, href: '/income' },
          { label: 'Fixkosten', value: fixedExpenses.filter((expense) => expense.isActive).length, href: '/fixed-expenses' },
          { label: 'Offene Schulden', value: debts.filter((debt) => debt.remainingAmount > 0).length, href: '/debts' },
          { label: 'Konten', value: accounts.length, href: '/accounts' },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800" onClick={() => router.push(item.href)}>
            <p className="text-xs font-medium text-slate-500 dark:text-gray-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
          </Card>
        ))}
      </div>
    ),
    'month-comparison': (() => {
      const prevMonth = shiftMonth(selectedMonth, -1);
      const prevSummary = calculateMonthSummary(prevMonth, incomes, fixedExpenses, debts, expenses);
      const curTotal = summary.totalFixedExpenses + summary.totalDebtPayments + summary.totalVariableExpenses;
      const prevTotal = prevSummary.totalFixedExpenses + prevSummary.totalDebtPayments + prevSummary.totalVariableExpenses;
      const changePct = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : 0;
      const less = curTotal < prevTotal;

      const categoryMap = getExpenseCategoryMap(settings);
      const allCats = new Set([...Object.keys(summary.expensesByCategory), ...Object.keys(prevSummary.expensesByCategory)]);
      const catComparison = Array.from(allCats)
        .map(cat => ({
          cat,
          cur: summary.expensesByCategory[cat] || 0,
          prev: prevSummary.expensesByCategory[cat] || 0,
          diff: (summary.expensesByCategory[cat] || 0) - (prevSummary.expensesByCategory[cat] || 0),
        }))
        .filter(c => c.cur > 0 || c.prev > 0)
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 6);

      return (
        <Card className="p-5">
          <button onClick={() => router.push('/analytics')} className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
            Monatsvergleich
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              less
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            }`}>
              {less ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
              {Math.abs(changePct).toFixed(1)}% {less ? 'weniger' : 'mehr'} als {getShortMonthName(prevMonth)}
            </div>
            <div className="text-sm text-slate-500 dark:text-gray-500">
              {formatCurrency(curTotal, settings)} vs. {formatCurrency(prevTotal, settings)}
            </div>
          </div>
          {catComparison.length > 0 && (
            <div className="space-y-2">
              {catComparison.map(c => {
                const info = categoryMap[c.cat] || { labelDe: c.cat, color: '#94a3b8', icon: 'Circle' };
                const isLess = c.diff < 0;
                return (
                  <div key={c.cat} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2">
                      <Icon name={info.icon} size={14} color={info.color} />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{info.labelDe}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-gray-500">{formatCurrency(c.cur, settings)}</span>
                      <span className={`text-xs font-semibold ${isLess ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isLess ? '' : '+'}{formatCurrency(c.diff, settings)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      );
    })(),
    forecast: (() => {
      const today = new Date();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - dayOfMonth;
      const monthExpenses = expenses.filter(e => e.month === selectedMonth);
      const spentSoFar = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const dailyRate = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;
      const projectedTotal = spentSoFar + dailyRate * daysRemaining;
      const projectedRemaining = summary.totalIncome - summary.totalFixedExpenses - summary.totalDebtPayments - projectedTotal;
      const savingsRate = summary.totalIncome > 0 ? (projectedRemaining / summary.totalIncome) * 100 : 0;

      return (
        <Card className="p-5">
          <button onClick={() => router.push('/analytics')} className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
            Monatsend-Prognose
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Bei aktuellem Tempo ({formatCurrency(dailyRate, settings)}/Tag) wirst du Ende Monat
            </p>
            <p className={`mt-2 text-2xl font-bold ${projectedRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(projectedRemaining, settings)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">übrig haben (Sparquote: {savingsRate.toFixed(1)}%)</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Bisher ausgegeben', value: formatCurrency(spentSoFar, settings), tone: 'text-gray-900 dark:text-white' },
              { label: 'Täglicher Schnitt', value: formatCurrency(dailyRate, settings), tone: 'text-blue-600 dark:text-blue-400' },
              { label: 'Hochrechnung', value: formatCurrency(projectedTotal, settings), tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Verbleibende Tage', value: String(daysRemaining), tone: 'text-gray-900 dark:text-white' },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
                <p className="text-[10px] font-medium text-slate-500 dark:text-gray-500">{item.label}</p>
                <p className={`mt-1 text-sm font-bold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
              <span>Ausgabentempo</span>
              <span>Tag {dayOfMonth} / {daysInMonth}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-gray-800">
              <div
                className={`h-full rounded-full transition-all ${projectedRemaining >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, (dayOfMonth / daysInMonth) * 100)}%` }}
              />
            </div>
          </div>
        </Card>
      );
    })(),
  };

  const activeWidgets = settings.dashboardWidgets.filter((widgetId) => widgetSections[widgetId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 text-white shadow-2xl shadow-slate-900/20">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.95fr] lg:p-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
                <Icon name="Sparkles" size={14} className="text-cyan-300" />
                Heute im Blick · {selectedMonth}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                {accounts.length > 0 ? `${accounts.length} Konten aktiv` : 'Konten einrichten'}
              </span>
              <button
                onClick={() => setShowWizard(true)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur transition-colors ${isMonthClosed ? 'bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25' : 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'}`}
              >
                <Icon name={isMonthClosed ? 'CheckCircle2' : 'ClipboardCheck'} size={14} />
                {isMonthClosed ? 'Abgeschlossen' : 'Monatsabschluss'}
              </button>
            </div>

            <div>
              <p className="text-sm text-slate-300">{headlineLabel}</p>
              <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {formatCurrency(headlineBalance, settings)}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-cyan-100">
                  <Icon name="Wallet" size={16} className="shrink-0 text-cyan-200" />
                  <span className="truncate">
                    Liquide Mittel: <span className="font-semibold text-white">{formatCurrency(liquidBalance, settings)}</span>
                  </span>
                </div>
                {mainAccount && (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-3 py-2 text-slate-100">
                    <Icon name="Landmark" size={16} className="shrink-0 text-white/80" />
                    <span className="truncate">
                      Hauptkonto: <span className="font-semibold text-white">{mainAccount.name}</span>
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-3 max-w-xl text-sm text-slate-300">
                {accounts.length > 0
                  ? `${formatCurrency(freeAvailable, settings)} sind in diesem Monat frei verfügbar. ${accounts.length > 1 ? `Über alle Konten hinweg liegst du aktuell bei ${formatCurrency(totalAccountBalance, settings)}.` : ''} ${totalBudgetLimit > 0 ? `${formatCurrency(reservedBudget, settings)} bleiben dabei als Budget-Reserve eingeplant.` : 'Setze Budgets, damit deine Reserve noch genauer geplant wird.'}`
                  : 'Lege Konten an, damit dein Dashboard Kontostand, Liquidität und Nettovermögen automatisch zusammenfasst.'}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Monatsfluss</p>
                  <p className="mt-1 text-lg font-semibold text-white">Einnahmen und Ausgaben auf einen Blick</p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${monthNetFlow >= 0 ? 'bg-emerald-400/15 text-emerald-100' : 'bg-red-400/15 text-red-100'}`}>
                  <Icon name={monthNetFlow >= 0 ? 'TrendingUp' : 'AlertTriangle'} size={14} />
                  {monthNetFlow >= 0 ? 'Aktuell im Plus' : 'Aktuell im Minus'}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  {
                    label: 'Einnahmen',
                    value: formatCurrency(summary.totalIncome, settings),
                    sublabel: plannedFreelanceIncome.total > 0 ? `+ ${formatCurrency(plannedFreelanceIncome.total, settings)} geplant` : 'Bereits verbucht',
                    href: '/income',
                    icon: 'TrendingUp',
                    tone: 'border-emerald-400/20 bg-emerald-400/10',
                    iconTone: 'text-emerald-200',
                  },
                  {
                    label: 'Ausgaben',
                    value: formatCurrency(totalSpent, settings),
                    sublabel: `${formatCurrency(summary.totalFixedExpenses, settings)} fix · ${formatCurrency(summary.totalVariableExpenses, settings)} variabel${summary.totalDebtPayments > 0 ? ` · ${formatCurrency(summary.totalDebtPayments, settings)} Raten` : ''}`,
                    href: '/expenses',
                    icon: 'Receipt',
                    tone: 'border-amber-400/20 bg-amber-400/10',
                    iconTone: 'text-amber-200',
                  },
                  {
                    label: 'Saldo',
                    value: formatCurrency(monthNetFlow, settings),
                    sublabel: monthNetFlow >= 0 ? 'Einnahmen minus Ausgaben' : 'Mehr ausgegeben als eingenommen',
                    href: '/analytics',
                    icon: 'Scale',
                    tone: monthNetFlow >= 0 ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-red-400/20 bg-red-400/10',
                    iconTone: monthNetFlow >= 0 ? 'text-cyan-200' : 'text-red-200',
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className={`rounded-2xl border p-4 text-left transition-all hover:border-white/30 hover:bg-white/12 ${item.tone}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-white/70">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-2.5">
                        <Icon name={item.icon} size={16} className={item.iconTone} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-white/65">{item.sublabel}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>Ausgabenquote</span>
                  <span>
                    {summary.totalIncome > 0
                      ? `${spentRatioOfIncome.toFixed(0)}% deiner Einnahmen bereits ausgegeben`
                      : totalSpent > 0
                        ? 'Ausgaben vorhanden, aber noch keine Einnahmen erfasst'
                        : 'Noch keine Einnahmen oder Ausgaben in diesem Monat'}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={Math.min(spentRatioOfIncome, 100)}
                    max={100}
                    color={getProgressColor(Math.min(spentRatioOfIncome, 100))}
                    size="md"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Diesen Monat rein', value: formatCurrency(summary.totalIncome, settings), tone: 'bg-white/8 text-white', href: '/income', sublabel: 'Alle Einnahmen im aktuellen Monat' },
                {
                  label: 'Bisher ausgegeben',
                  value: formatCurrency(totalSpent, settings),
                  tone: 'bg-slate-50/10 text-slate-50',
                  sublabel: `${formatCurrency(summary.totalVariableExpenses, settings)} variabel`,
                  href: '/expenses',
                },
                {
                  label: 'Restbudget',
                  value: formatCurrency(budgetRemaining, settings),
                  tone: budgetRemaining >= 0 ? 'bg-amber-400/15 text-amber-50' : 'bg-red-400/15 text-red-100',
                  sublabel: totalBudgetLimit > 0 ? 'Noch in deinen Budget-Töpfen verfügbar' : 'Noch keine Budget-Töpfe gesetzt',
                  href: '/budget',
                },
                {
                  label: 'Frei verfügbar',
                  value: formatCurrency(freeAvailable, settings),
                  tone: freeAvailable >= 0 ? 'bg-emerald-400/15 text-emerald-100' : 'bg-red-400/15 text-red-100',
                  sublabel: plannedFreelanceIncome.total > 0
                    ? `+ ${formatCurrency(plannedFreelanceIncome.total, settings)} Freelance geplant`
                    : 'Nach Budget-Reserve',
                  href: '/budget',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className={`rounded-2xl border border-white/10 px-4 py-4 backdrop-blur cursor-pointer transition-all hover:border-white/30 hover:bg-white/12 ${item.tone}`}
                >
                  <p className="text-xs font-medium text-white/70">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold">{item.value}</p>
                  {'sublabel' in item && item.sublabel ? (
                    <p className="mt-1 text-xs text-white/65">{item.sublabel}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-300">Monatslage</p>
                  <p className="mt-1 text-2xl font-bold">{freeAvailable >= 0 ? 'Im Plan' : 'Nachsteuern'}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {totalBudgetLimit > 0
                      ? `${formatCurrency(totalBudgetSpent, settings)} von ${formatCurrency(totalBudgetLimit, settings)} Budget genutzt`
                      : `${formatCurrency(totalSpent, settings)} Ausgaben im Monat bisher`}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <Icon name={freeAvailable >= 0 ? 'BadgeCheck' : 'AlertTriangle'} size={18} className="text-cyan-300" />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Einnahmen', value: formatCurrency(summary.totalIncome, settings) },
                  { label: 'Ausgaben gesamt', value: formatCurrency(totalSpent, settings) },
                  { label: 'Frei verfügbar', value: formatCurrency(freeAvailable, settings), tone: freeAvailable >= 0 ? 'text-emerald-200' : 'text-red-200' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white/8 px-3 py-3">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <span className={`text-sm font-semibold text-white ${item.tone || ''}`}>{item.value}</span>
                  </div>
                ))}
                <ProgressBar value={budgetUsage} max={100} color={summary.remaining >= 0 ? '#38bdf8' : '#fb7185'} size="lg" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
              <p className="text-xs font-medium text-slate-300">Nächster Fokus</p>
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl bg-white/8 px-3 py-3">
                  <p className="text-sm font-semibold text-white">Worauf du achten solltest</p>
                  <p className="mt-1 text-xs text-slate-300">{nextFocus}</p>
                </div>
                <div className="rounded-2xl bg-white/8 px-3 py-3">
                  <p className="text-sm font-semibold text-white">Schneller Überblick</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {topExpenseCategory
                      ? `Größter Ausgabenblock aktuell: ${topExpenseCategory.name} mit ${formatCurrency(topExpenseCategory.value, settings)}.`
                      : activeSavingsGoals.length > 0
                        ? `${activeSavingsGoals.length} aktive Sparziele warten auf deinen nächsten Schritt.`
                        : 'Noch keine Ausgaben oder Sparziele vorhanden. Sobald Daten da sind, zeigt dir das Dashboard hier die Prioritäten.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={() => router.push('/accounts')} className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
            Konten auf einen Blick
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <span className="text-sm text-slate-500 dark:text-gray-500">
            {accounts.length > 0 ? `${accounts.length} Konten` : 'Noch keine Konten'}
          </span>
        </div>

        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/40">
                <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Aktueller Kontostand</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAccountBalance, settings)}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Summe aller Konten inklusive Kredit- und Depotstände</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/40">
                <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Liquide Mittel</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(liquidBalance, settings)}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Direkt verfügbares Geld ohne Depotwerte</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800 sm:col-span-2 xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Hauptkonto</p>
                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{mainAccount?.name || 'Kein Standardkonto gesetzt'}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{mainAccount ? accountTypeLabels[mainAccount.type] || mainAccount.type : 'Lege in den Konten ein Standardkonto fest.'}</p>
                  </div>
                  {mainAccount && (
                    <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ backgroundColor: `${mainAccount.color}18`, color: mainAccount.color }}>
                      {formatCurrency(mainAccount.balance, settings)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {topAccounts.map((account) => {
                const share = account.balance > 0 ? (account.balance / positiveAccountBase) * 100 : 0;
                return (
                  <div key={account.id} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{account.name}</p>
                          {account.isDefault && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              Standard
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{accountTypeLabels[account.type] || account.type}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${account.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(account.balance, settings)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-500">
                          {account.balance > 0 ? `${share.toFixed(0)}% vom Guthaben` : 'Belastung auf diesem Konto'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={share} max={100} color={account.color} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState icon="Landmark" title="Noch keine Konten angelegt" description="Sobald du deine Konten erfasst, zeigt dir das Dashboard hier den aktuellen Kontostand und die Verteilung." />
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => router.push('/budget')} className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
            Budget-Überblick
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <span className={`text-sm font-semibold ${budgetRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {budgetRemaining >= 0 ? 'Im Rahmen' : 'Über Budget'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs text-slate-500 dark:text-gray-500">Budget gesamt</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalBudgetLimit, settings)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs text-slate-500 dark:text-gray-500">Bisher ausgegeben</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalBudgetSpent, settings)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs text-slate-500 dark:text-gray-500">Restbudget</p>
            <p className={`mt-1 text-lg font-bold ${budgetRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(budgetRemaining, settings)}
            </p>
          </div>
        </div>
        {budgetCategoryCards.length > 0 && (
          <div className="mt-4 space-y-3">
            {budgetCategoryCards.slice(0, 6).map((item) => {
              const info = getExpenseCategoryInfo(item.category, settings);
              const isOver = item.percentage >= 100;
              const isWarning = item.percentage >= settings.budgetWarningThreshold && !isOver;
              return (
                <div key={item.category} className="rounded-2xl border border-slate-200 p-3 dark:border-gray-800">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="rounded-lg p-2" style={{ backgroundColor: `${info.color}15` }}>
                        <Icon name={info.icon} size={14} color={info.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{info.labelDe}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">
                          {formatCurrency(item.spent, settings)} von {formatCurrency(item.limitAmount, settings)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${isOver ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.min(item.percentage, 100)}
                    max={100}
                    color={isOver ? '#ef4444' : isWarning ? '#f59e0b' : info.color}
                    size="md"
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Dashboard-Bausteine</h3>
        <div className="flex flex-wrap gap-2">
          {widgetOptions.map((option) => {
            const active = settings.dashboardWidgets.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => {
                  const next = active
                    ? settings.dashboardWidgets.filter((widgetId) => widgetId !== option.id)
                    : [...settings.dashboardWidgets, option.id];
                  dispatch({ type: 'UPDATE_SETTINGS', payload: { dashboardWidgets: next } });
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeWidgets.length > 0 ? activeWidgets.map((widgetId) => (
        <div key={widgetId}>{widgetSections[widgetId]}</div>
      )) : (
        <Card>
          <EmptyState icon="LayoutDashboard" title="Dashboard leer" description="Aktiviere im Bereich Einstellungen wieder Dashboard-Widgets." />
        </Card>
      )}

      <Modal isOpen={Boolean(editingExpense)} onClose={() => setEditingExpense(null)} title="Ausgabe bearbeiten">
        <div className="space-y-4">
          <Input label="Beschreibung" value={description} onChange={setDescription} />
          <Input label="Betrag" type="number" value={amount} onChange={setAmount} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Kategorie" value={category} onChange={(value) => setCategory(value as ExpenseCategory)} options={categoryOptions} />
            <Select label="Konto" value={accountId} onChange={setAccountId} options={accountOptions} />
          </div>
          <Input label="Datum" type="date" value={date} onChange={setDate} />
          <Input label="Notiz" value={note} onChange={setNote} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditingExpense(null)} className="flex-1">Abbrechen</Button>
            <Button
              onClick={() => {
                if (!editingExpense || !description || !amount || !date) return;
                dispatch({
                  type: 'UPDATE_EXPENSE',
                  payload: {
                    ...editingExpense,
                    description,
                    amount: Number(amount),
                    category,
                    date,
                    month: date.slice(0, 7),
                    accountId: accountId || undefined,
                    note: note || undefined,
                  },
                });
                setEditingExpense(null);
              }}
              className="flex-1"
            >
              Speichern
            </Button>
          </div>
        </div>
      </Modal>

      <MonthEndWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />
    </div>
  );
}
