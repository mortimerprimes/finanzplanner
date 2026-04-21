'use client';
import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Modal, Icon, Badge } from './ui';
import { formatCurrency, getMonthDisplayName, reconcileFixedExpensesForMonth, reconcileIncomesForMonth, getBudgetLimitValue } from '../utils/helpers';
import { CheckCircle2, ChevronRight, ChevronLeft, ArrowRightLeft, PiggyBank, BarChart3, Mail, Copy, Check, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'bookings' | 'debts' | 'budget' | 'savings' | 'summary';
const STEPS: WizardStep[] = ['bookings', 'debts', 'budget', 'savings', 'summary'];
const STEP_LABELS: Record<WizardStep, string> = {
  bookings: 'Buchungen',
  debts: 'Schulden',
  budget: 'Budget-Rollover',
  savings: 'Sparziele',
  summary: 'Zusammenfassung',
};

export function MonthEndWizard({ isOpen, onClose }: Props) {
  const { state, dispatch } = useFinance();
  const { fixedExpenses, debts, expenses, incomes, savingsGoals, budgetLimits, autoBookings, monthCloses, settings, selectedMonth } = state;
  const [step, setStep] = useState<WizardStep>('bookings');
  const [savingsInputs, setSavingsInputs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const isAlreadyClosed = (monthCloses || []).some(mc => mc.month === selectedMonth);
  const monthBookings = useMemo(() => (autoBookings || []).filter(ab => ab.month === selectedMonth), [autoBookings, selectedMonth]);
  const activeFixedExpenses = fixedExpenses.filter(e => e.isActive);
  const unbookedFixed = activeFixedExpenses.filter(fe => !monthBookings.some(ab => ab.sourceId === fe.id && ab.sourceType === 'fixedExpense'));

  // Income for this month
  const incomeRecon = reconcileIncomesForMonth(incomes, selectedMonth);
  const totalIncome = incomeRecon.totalEffective;

  // Fixed expense totals
  const fixedRecon = reconcileFixedExpensesForMonth(fixedExpenses, expenses, selectedMonth);
  const totalFixedExpenses = fixedRecon.totalEffective;

  // Variable expenses for the month
  const monthExpenses = expenses.filter(e => e.month === selectedMonth);
  const variableExpenses = monthExpenses.filter(e => !e.autoBookedFromId);
  const totalVariableExpenses = variableExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Debt payments from auto-bookings (these are included in fixedExpenses, shown separately for info only)
  const debtBookings = monthBookings.filter(ab => ab.debtPaymentApplied && ab.linkedDebtId);
  const totalDebtPayments = debtBookings.reduce((sum, ab) => sum + ab.amount, 0);

  // Budget rollover candidates (only budgets with rollover enabled)
  const monthBudgets = budgetLimits.filter(bl => (bl.isRecurring || bl.month === selectedMonth) && bl.enableRollover);
  const budgetRollovers = monthBudgets.map(bl => {
    const spent = monthExpenses.filter(e => e.category === bl.category).reduce((sum, e) => sum + e.amount, 0);
    const effectiveLimit = getBudgetLimitValue(bl);
    const remaining = Math.max(0, effectiveLimit - spent);
    return { budget: bl, spent, remaining };
  }).filter(br => br.remaining > 0);

  // Savings goals
  const activeGoals = savingsGoals.filter(g => !g.isCompleted);

  // Remaining money
  const totalSavingsInput = Object.values(savingsInputs).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  // Note: totalFixedExpenses already includes debt-linked expenses (they are booked as fixed expenses)
  const remaining = totalIncome - totalFixedExpenses - totalVariableExpenses - totalSavingsInput;

  const handleAutoBook = () => {
    dispatch({ type: 'RUN_MONTH_AUTO_BOOKING', payload: selectedMonth });
  };

  const handleComplete = () => {
    const savingsAllocations = Object.entries(savingsInputs)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([goalId, v]) => ({ goalId, amount: parseFloat(v) }));
    const budgetRolloverEntries = budgetRollovers.map(br => ({
      budgetId: br.budget.id,
      rolloverAmount: br.remaining,
    }));

    dispatch({
      type: 'COMPLETE_MONTH_CLOSE',
      payload: {
        month: selectedMonth,
        completedAt: new Date().toISOString(),
        autoBookingConfirmed: unbookedFixed.length === 0,
        savingsAllocated: savingsAllocations.length > 0,
        budgetRolloverConfirmed: true,
        savingsAllocations,
        budgetRollovers: budgetRolloverEntries,
        summary: {
          totalIncome,
          totalFixedExpenses,
          totalVariableExpenses,
          totalDebtPayments,
          totalSaved: totalSavingsInput,
          remaining: remaining,
        },
      },
    });
    onClose();
  };

  const generateSummaryText = () => {
    const lines = [
      `Monatsabschluss ${getMonthDisplayName(selectedMonth)}`,
      `${'='.repeat(40)}`,
      ``,
      `Einnahmen:          ${formatCurrency(totalIncome, settings)}`,
      `Fixkosten:         -${formatCurrency(totalFixedExpenses, settings)}`,
      ...(totalDebtPayments > 0 ? [`  davon Kreditraten: ${formatCurrency(totalDebtPayments, settings)}`] : []),
      `Variable Ausgaben: -${formatCurrency(totalVariableExpenses, settings)}`,
      `Gespart:           -${formatCurrency(totalSavingsInput, settings)}`,
      `${'─'.repeat(40)}`,
      `Verbleibend:        ${formatCurrency(remaining, settings)}`,
      ``,
    ];
    if (debtBookings.length > 0) {
      lines.push('Schulden-Zahlungen:');
      debtBookings.forEach(ab => {
        const debt = debts.find(d => d.id === ab.linkedDebtId);
        lines.push(`  • ${debt?.name || 'Kredit'}: ${formatCurrency(ab.amount, settings)}`);
      });
      lines.push('');
    }
    const allocations = Object.entries(savingsInputs).filter(([, v]) => parseFloat(v) > 0);
    if (allocations.length > 0) {
      lines.push('Sparziel-Zuweisungen:');
      allocations.forEach(([goalId, v]) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        lines.push(`  • ${goal?.name || 'Ziel'}: ${formatCurrency(parseFloat(v), settings)}`);
      });
      lines.push('');
    }
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateSummaryText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = () => {
    const text = generateSummaryText();
    const subject = encodeURIComponent(`Monatsabschluss ${getMonthDisplayName(selectedMonth)}`);
    const body = encodeURIComponent(text);
    const email = settings.reportEmail || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const stepIndex = STEPS.indexOf(step);
  const canPrev = stepIndex > 0;
  const canNext = stepIndex < STEPS.length - 1;
  const isLast = stepIndex === STEPS.length - 1;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Monatsabschluss — ${getMonthDisplayName(selectedMonth)}`}>
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(s)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${s === step ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : i < stepIndex ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-500'}`}>
              {i < stepIndex ? <CheckCircle2 size={12} /> : <span className="w-4 h-4 flex items-center justify-center rounded-full bg-current/10 text-[10px]">{i + 1}</span>}
              {STEP_LABELS[s]}
            </button>
          ))}
        </div>

        {isAlreadyClosed && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">Dieser Monat wurde bereits abgeschlossen. Erneutes Abschließen aktualisiert den bestehenden Eintrag.</p>
          </div>
        )}

        {/* STEP: Bookings */}
        {step === 'bookings' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Prüfe, ob alle Fixkosten für diesen Monat gebucht wurden.
            </p>
            {unbookedFixed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{unbookedFixed.length} Fixkosten noch nicht gebucht:</p>
                {unbookedFixed.map(fe => (
                  <div key={fe.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
                    <span className="text-sm text-gray-900 dark:text-white">{fe.name}</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">-{formatCurrency(fe.amount, settings)}</span>
                  </div>
                ))}
                <Button onClick={handleAutoBook} icon="Play" className="w-full">Alle jetzt buchen</Button>
              </div>
            )}
            {unbookedFixed.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Alle Fixkosten gebucht!</p>
                <p className="text-xs text-slate-500 mt-1">{monthBookings.filter(ab => ab.sourceType === 'fixedExpense').length} Buchungen für diesen Monat</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Debts */}
        {step === 'debts' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Übersicht der Kreditraten, die diesen Monat verbucht wurden.
            </p>
            {debtBookings.length > 0 ? (
              <div className="space-y-2">
                {debtBookings.map(ab => {
                  const debt = debts.find(d => d.id === ab.linkedDebtId);
                  return (
                    <div key={ab.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{debt?.name || 'Kredit'}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">Restschuld: {formatCurrency(debt?.remainingAmount || 0, settings)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">-{formatCurrency(ab.amount, settings)}</p>
                        <Badge color="#10b981">Verbucht</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <ArrowRightLeft size={28} className="mx-auto text-slate-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Keine Kreditraten in diesem Monat.</p>
                <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">Verknüpfe Fixkosten mit Krediten, um automatische Schuldenreduzierung zu aktivieren.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Budget Rollover */}
        {step === 'budget' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Ungenutztes Budget kann in den nächsten Monat übertragen werden.
            </p>
            {budgetRollovers.length > 0 ? (
              <div className="space-y-2">
                {budgetRollovers.map(br => (
                  <div key={br.budget.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{br.budget.category}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        {formatCurrency(br.spent, settings)} von {formatCurrency(br.budget.monthlyLimit, settings)} ausgegeben
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(br.remaining, settings)}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-600">Rollover</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <BarChart3 size={28} className="mx-auto text-slate-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Kein Budget-Rollover verfügbar.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Savings */}
        {step === 'savings' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Verteile übrig gebliebenes Geld auf deine Sparziele.
            </p>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-3">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Verfügbar: {formatCurrency(remaining, settings)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                Einnahmen − Fixkosten − Variable Ausgaben − Sparzuweisungen
              </p>
            </div>
            {activeGoals.length > 0 ? (
              <div className="space-y-2">
                {activeGoals.map(goal => {
                  const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                  return (
                    <div key={goal.id} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon name={goal.icon} size={16} color={goal.color} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{goal.name}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-gray-500">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-gray-800 mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={savingsInputs[goal.id] || ''}
                          onChange={(e) => setSavingsInputs(prev => ({ ...prev, [goal.id]: e.target.value }))}
                          placeholder="0.00"
                          className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-slate-400"
                        />
                        <span className="text-xs text-slate-500 dark:text-gray-500">
                          {formatCurrency(goal.currentAmount, settings)} / {formatCurrency(goal.targetAmount, settings)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <PiggyBank size={28} className="mx-auto text-slate-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-500">Keine aktiven Sparziele vorhanden.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Summary */}
        {step === 'summary' && (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between"><span className="text-slate-600 dark:text-gray-400">Einnahmen</span><span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(totalIncome, settings)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600 dark:text-gray-400">Fixkosten</span><span className="text-amber-600 dark:text-amber-400">-{formatCurrency(totalFixedExpenses, settings)}</span></div>
              {totalDebtPayments > 0 && (
                <div className="flex justify-between pl-4"><span className="text-xs text-slate-400 dark:text-gray-500">davon Kreditraten</span><span className="text-xs text-violet-500 dark:text-violet-400">{formatCurrency(totalDebtPayments, settings)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-600 dark:text-gray-400">Variable Ausgaben</span><span className="text-amber-600 dark:text-amber-400">-{formatCurrency(totalVariableExpenses, settings)}</span></div>
              {totalSavingsInput > 0 && (
                <div className="flex justify-between"><span className="text-slate-600 dark:text-gray-400">Gespart</span><span className="text-blue-600 dark:text-blue-400">-{formatCurrency(totalSavingsInput, settings)}</span></div>
              )}
              <div className="border-t border-slate-200 dark:border-gray-700 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Verbleibend</span>
                <span className={`font-bold ${remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(remaining, settings)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCopy} className="flex-1">
                {copied ? <Check size={14} className="inline mr-1" /> : <Copy size={14} className="inline mr-1" />}
                {copied ? 'Kopiert!' : 'Kopieren'}
              </Button>
              <Button variant="secondary" onClick={handleEmail} className="flex-1">
                <Mail size={14} className="inline mr-1" />E-Mail
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-gray-800">
          <Button variant="secondary" onClick={() => canPrev && setStep(STEPS[stepIndex - 1])} disabled={!canPrev}>
            <ChevronLeft size={16} className="inline" /> Zurück
          </Button>
          {isLast ? (
            <Button onClick={handleComplete}>
              Monat abschließen <CheckCircle2 size={16} className="inline ml-1" />
            </Button>
          ) : (
            <Button onClick={() => canNext && setStep(STEPS[stepIndex + 1])}>
              Weiter <ChevronRight size={16} className="inline" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
