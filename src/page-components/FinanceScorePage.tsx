'use client';

import { useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import {
  calculateMonthSummary,
  formatCurrency as fmtCurrency,
  getPreviousMonths,
  calculateDebtPayoffMonths,
  getActiveBudgetLimits,
  getBudgetLimitValue,
  reconcileIncomesForMonth,
} from '@/src/utils/helpers';
import {
  Shield, TrendingUp, PiggyBank, CreditCard, Target, AlertTriangle,
  CheckCircle2, XCircle, Minus, ChevronRight, Wallet, Receipt, BarChart3,
} from 'lucide-react';

interface ScoreCategory {
  label: string;
  score: number;
  weight: number;
  icon: typeof Shield;
  color: string;
  tips: string[];
  detail: string;
}

export function FinanceScorePage() {
  const { state } = useFinance();
  const { settings } = state;

  const formatCurrency = (v: number) => fmtCurrency(v, settings);

  const scoreData = useMemo(() => {
    const month = state.selectedMonth;
    const summary = calculateMonthSummary(month, state.incomes, state.fixedExpenses, state.debts, state.expenses);

    // Look at last 3 months for more stable average
    const prevMonths = getPreviousMonths(3, month);
    const avgSummaries = prevMonths.map(m => calculateMonthSummary(m, state.incomes, state.fixedExpenses, state.debts, state.expenses));
    const avgIncome = avgSummaries.reduce((s, m) => s + m.totalIncome, 0) / Math.max(avgSummaries.length, 1);
    const avgSpending = avgSummaries.reduce((s, m) => s + m.totalFixedExpenses + m.totalDebtPayments + m.totalVariableExpenses, 0) / Math.max(avgSummaries.length, 1);

    // ===== 1. SPARQUOTE (25%) =====
    const totalIncome = summary.totalIncome;
    const totalSpending = summary.totalFixedExpenses + summary.totalDebtPayments + summary.totalVariableExpenses;
    const savingsRate = totalIncome > 0 ? Math.max(0, (totalIncome - totalSpending) / totalIncome) * 100 : 0;

    let savingsScore: number;
    const savingsTips: string[] = [];
    if (savingsRate >= 25) savingsScore = 100;
    else if (savingsRate >= 20) savingsScore = 90;
    else if (savingsRate >= 15) savingsScore = 80;
    else if (savingsRate >= 10) savingsScore = 65;
    else if (savingsRate >= 5) savingsScore = 45;
    else if (savingsRate > 0) savingsScore = 25;
    else savingsScore = totalSpending > totalIncome ? 0 : 10;
    if (savingsRate < 10) savingsTips.push(`Aktuell ${savingsRate.toFixed(1)}% — versuche mindestens 10%`);
    if (savingsRate >= 10 && savingsRate < 20) savingsTips.push(`${savingsRate.toFixed(1)}% ist gut, 20% wäre ideal`);
    if (savingsRate >= 20) savingsTips.push(`${savingsRate.toFixed(1)}% — hervorragend!`);
    const savingsDetail = `${formatCurrency(Math.max(0, totalIncome - totalSpending))} von ${formatCurrency(totalIncome)} übrig`;

    // ===== 2. FIXKOSTENQUOTE (20%) =====
    const fixedRatio = totalIncome > 0 ? ((summary.totalFixedExpenses + summary.totalDebtPayments) / totalIncome) * 100 : 0;
    let fixedScore: number;
    const fixedTips: string[] = [];
    if (fixedRatio <= 40) fixedScore = 100;
    else if (fixedRatio <= 50) fixedScore = 80;
    else if (fixedRatio <= 60) fixedScore = 60;
    else if (fixedRatio <= 75) fixedScore = 35;
    else fixedScore = Math.max(0, 100 - fixedRatio);
    fixedTips.push(`${fixedRatio.toFixed(0)}% deines Einkommens sind fest gebunden`);
    if (fixedRatio > 50) fixedTips.push('Fixkosten unter 50% halten für mehr Flexibilität');
    const fixedDetail = `${formatCurrency(summary.totalFixedExpenses + summary.totalDebtPayments)} Fixkosten + Raten`;

    // ===== 3. SCHULDENQUOTE (20%) =====
    const totalDebt = state.debts.reduce((s, d) => s + d.remainingAmount, 0);
    const annualIncome = totalIncome * 12;
    const debtRatio = annualIncome > 0 ? totalDebt / annualIncome : 0;
    const maxPayoff = state.debts.length > 0 ? Math.max(...state.debts.map(d => calculateDebtPayoffMonths(d))) : 0;

    let debtScore: number;
    const debtTips: string[] = [];
    if (totalDebt === 0) { debtScore = 100; debtTips.push('Keine Schulden — perfekt!'); }
    else if (debtRatio <= 0.15) { debtScore = 85; debtTips.push(`${(debtRatio * 100).toFixed(0)}% des Jahreseinkommens — gut beherrschbar`); }
    else if (debtRatio <= 0.3) { debtScore = 65; debtTips.push(`${(debtRatio * 100).toFixed(0)}% — im Rahmen, aber Abbau priorisieren`); }
    else if (debtRatio <= 0.5) { debtScore = 40; debtTips.push(`${(debtRatio * 100).toFixed(0)}% — deutlich hoch, schnellerer Abbau empfohlen`); }
    else { debtScore = Math.max(5, 30 - Math.round((debtRatio - 0.5) * 60)); debtTips.push(`${(debtRatio * 100).toFixed(0)}% — kritisch hoch`); }
    if (maxPayoff > 0) debtTips.push(`Schuldenfrei in ca. ${maxPayoff} Monaten`);
    const debtDetail = totalDebt > 0 ? `${formatCurrency(totalDebt)} Restschuld` : 'Schuldenfrei';

    // ===== 4. NOTGROSCHEN (15%) =====
    const monthlyNeeds = summary.totalFixedExpenses + summary.totalDebtPayments + (summary.totalVariableExpenses * 0.7);
    const emergencyTarget = monthlyNeeds * 3;
    const emergencyGoals = state.savingsGoals.filter(g => g.goalCategory === 'emergency');
    const emergencySaved = emergencyGoals.reduce((s, g) => s + g.currentAmount, 0);
    // Also count savings in all accounts as potential emergency fund
    const totalAccountBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
    const effectiveEmergency = emergencyGoals.length > 0 ? emergencySaved : Math.min(totalAccountBalance * 0.3, emergencyTarget);
    const emergencyRatio = emergencyTarget > 0 ? Math.min(1, effectiveEmergency / emergencyTarget) : (effectiveEmergency > 0 ? 1 : 0);

    let emergencyScore = Math.round(emergencyRatio * 100);
    const emergencyTips: string[] = [];
    if (emergencyGoals.length === 0 && totalAccountBalance > 0) {
      emergencyTips.push('Erstelle ein Sparziel mit Kategorie "Notgroschen" für besseres Tracking');
      emergencyTips.push(`Geschätzt ${formatCurrency(effectiveEmergency)} von ${formatCurrency(emergencyTarget)} (3 Monate Bedarf)`);
    } else if (emergencyGoals.length > 0) {
      emergencyTips.push(`${formatCurrency(emergencySaved)} von ${formatCurrency(emergencyTarget)} (3 Monate Bedarf)`);
    } else {
      emergencyTips.push('Kein Notgroschen erkannt — starte ein Sparziel!');
    }
    const emergencyDetail = `${(emergencyRatio * 100).toFixed(0)}% des 3-Monats-Bedarfs`;

    // ===== 5. BUDGET-DISZIPLIN (10%) =====
    const budgets = getActiveBudgetLimits(state.budgetLimits, month);
    let budgetScore = 100;
    const budgetTips: string[] = [];
    if (budgets.length === 0) {
      budgetScore = 40;
      budgetTips.push('Keine Budgets definiert — erstelle welche für mehr Kontrolle');
    } else {
      let overCount = 0;
      let totalUsage = 0;
      for (const b of budgets) {
        const spent = state.expenses.filter(e => e.month === month && e.category === b.category).reduce((s, e) => s + e.amount, 0);
        const effectiveLimit = getBudgetLimitValue(b);
        if (spent > effectiveLimit) overCount++;
        totalUsage += effectiveLimit > 0 ? (spent / effectiveLimit) : 0;
      }
      const avgUsage = (totalUsage / budgets.length) * 100;
      if (overCount === 0) { budgetScore = Math.max(70, 100 - Math.round(avgUsage * 0.3)); }
      else { budgetScore = Math.max(10, Math.round((1 - overCount / budgets.length) * 80)); }
      if (overCount > 0) budgetTips.push(`${overCount} von ${budgets.length} Budgets überschritten`);
      else budgetTips.push(`Alle ${budgets.length} Budgets eingehalten (Ø ${avgUsage.toFixed(0)}% genutzt)`);
    }
    const budgetDetail = `${budgets.length} Budget${budgets.length !== 1 ? 's' : ''} aktiv`;

    // ===== 6. SPARZIEL-FORTSCHRITT (10%) =====
    const activeGoals = state.savingsGoals.filter(g => !g.isCompleted);
    const completedGoals = state.savingsGoals.filter(g => g.isCompleted);
    let goalsScore: number;
    const goalsTips: string[] = [];
    if (state.savingsGoals.length === 0) {
      goalsScore = 30;
      goalsTips.push('Setze dir finanzielle Ziele um fokussiert zu sparen');
    } else {
      const avgProgress = activeGoals.length > 0
        ? activeGoals.reduce((s, g) => s + Math.min(1, g.currentAmount / Math.max(g.targetAmount, 1)), 0) / activeGoals.length
        : 1;
      goalsScore = Math.round((completedGoals.length / state.savingsGoals.length * 0.4 + avgProgress * 0.6) * 100);
      goalsTips.push(`${completedGoals.length} erreicht, ${activeGoals.length} aktiv`);
      if (activeGoals.length > 0) {
        const avgPct = (avgProgress * 100).toFixed(0);
        goalsTips.push(`Ø Fortschritt: ${avgPct}%`);
      }
    }
    const goalsDetail = `${state.savingsGoals.length} Sparziel${state.savingsGoals.length !== 1 ? 'e' : ''}`;

    const categories: ScoreCategory[] = [
      { label: 'Sparquote', score: savingsScore, weight: 25, icon: TrendingUp, color: '#10b981', tips: savingsTips, detail: savingsDetail },
      { label: 'Fixkostenquote', score: fixedScore, weight: 20, icon: Receipt, color: '#f59e0b', tips: fixedTips, detail: fixedDetail },
      { label: 'Schuldenquote', score: debtScore, weight: 20, icon: CreditCard, color: '#ef4444', tips: debtTips, detail: debtDetail },
      { label: 'Notgroschen', score: emergencyScore, weight: 15, icon: Shield, color: '#3b82f6', tips: emergencyTips, detail: emergencyDetail },
      { label: 'Budget-Disziplin', score: budgetScore, weight: 10, icon: Target, color: '#f97316', tips: budgetTips, detail: budgetDetail },
      { label: 'Sparziele', score: goalsScore, weight: 10, icon: PiggyBank, color: '#8b5cf6', tips: goalsTips, detail: goalsDetail },
    ];

    const totalScore = Math.round(categories.reduce((s, c) => s + (c.score * c.weight / 100), 0));

    // Generate actionable improvement items
    const improvements: { priority: number; text: string; impact: string }[] = [];
    if (savingsRate < 10) improvements.push({ priority: 1, text: 'Sparquote auf mindestens 10% steigern', impact: `+${formatCurrency((totalIncome * 0.1) - Math.max(0, totalIncome - totalSpending))}/Monat mehr sparen` });
    if (fixedRatio > 50) improvements.push({ priority: 2, text: 'Fixkosten reduzieren (Verträge prüfen, wechseln)', impact: `${fixedRatio.toFixed(0)}% → unter 50% bringen` });
    if (totalDebt > 0 && debtRatio > 0.3) improvements.push({ priority: 1, text: 'Schuldenabbau beschleunigen', impact: `${formatCurrency(totalDebt)} Restschuld abbauen` });
    if (emergencyRatio < 0.5) improvements.push({ priority: 2, text: `Notgroschen aufbauen: ${formatCurrency(emergencyTarget)} Ziel`, impact: `${formatCurrency(emergencyTarget - effectiveEmergency)} fehlen noch` });
    if (budgets.length < 3) improvements.push({ priority: 3, text: 'Mehr Budgets definieren für bessere Kontrolle', impact: 'Weniger überraschende Ausgaben' });

    return { categories, totalScore, savingsRate, fixedRatio, totalDebt, emergencyRatio, improvements, totalIncome, totalSpending };
  }, [state]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Ausgezeichnet';
    if (score >= 75) return 'Sehr gut';
    if (score >= 60) return 'Gut';
    if (score >= 40) return 'Verbesserungsbedarf';
    return 'Kritisch';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 70) return <CheckCircle2 size={16} className="text-green-500" />;
    if (score >= 40) return <Minus size={16} className="text-yellow-500" />;
    return <XCircle size={16} className="text-red-500" />;
  };

  const ScoreRing = ({ score, size = 180 }: { score: number; size?: number }) => {
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={10} className="text-slate-200 dark:text-gray-800" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield size={28} className="text-blue-500" />
          Finanz-Gesundheitscheck
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Basierend auf deinen echten Daten: {formatCurrency(scoreData.totalIncome)} Einkommen, {formatCurrency(scoreData.totalSpending)} Ausgaben</p>
      </div>

      {/* Main Score */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-8 text-center">
        <div className="relative inline-flex items-center justify-center">
          <ScoreRing score={scoreData.totalScore} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-5xl font-black ${getScoreColor(scoreData.totalScore)}`}>
              {scoreData.totalScore}
            </span>
            <span className="text-xs text-slate-400 dark:text-gray-500 mt-1">von 100</span>
          </div>
        </div>
        <p className={`text-lg font-bold mt-4 ${getScoreColor(scoreData.totalScore)}`}>
          {getScoreLabel(scoreData.totalScore)}
        </p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
          Sparquote {scoreData.savingsRate.toFixed(1)}% · Fixkostenquote {scoreData.fixedRatio.toFixed(0)}%
          {scoreData.totalDebt > 0 ? ` · ${formatCurrency(scoreData.totalDebt)} Schulden` : ''}
        </p>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        {scoreData.categories.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <div key={cat.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: cat.color + '15', color: cat.color }}>
                  <CatIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{cat.label}</span>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500 ml-2">{cat.detail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getScoreIcon(cat.score)}
                      <span className={`text-sm font-bold ${getScoreColor(cat.score)}`}>{cat.score}</span>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500">({cat.weight}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${cat.score}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              </div>
              {cat.tips.length > 0 && (
                <div className="mt-3 pl-12 space-y-1">
                  {cat.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-slate-500 dark:text-gray-400 flex items-start gap-1.5">
                      <ChevronRight size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      {tip}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actionable Improvements */}
      {scoreData.improvements.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Konkrete Verbesserungsvorschläge</h3>
          </div>
          <div className="space-y-2">
            {scoreData.improvements
              .sort((a, b) => a.priority - b.priority)
              .map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-white/60 dark:bg-gray-900/30 p-3">
                  <span className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    item.priority === 1 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' :
                    item.priority === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                  }`}>{item.priority}</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{item.text}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{item.impact}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {scoreData.totalScore >= 80 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 text-center">
          <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Deine Finanzen sind in sehr gutem Zustand!</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Weiter so — du bist auf einem hervorragenden Weg.</p>
        </div>
      )}
    </div>
  );
}
