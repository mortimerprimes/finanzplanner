import { useMemo, useState, type MouseEvent } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Calculator, CircleDollarSign, Pencil, Trash2 } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { useTheme } from '../hooks/useTheme';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, Badge, ProgressBar } from '../components/ui';
import { formatCurrency, formatDate } from '../utils/helpers';
import { DEBT_TYPES } from '../utils/constants';
import { Debt, DebtType } from '../types';
import { calculateDebtProjection, calculateRequiredMonthlyPayment } from '../utils/debtCalculations';

function formatMonthsLabel(months: number): string {
  if (!Number.isFinite(months)) return 'Nicht tragfähig';
  if (months <= 1) return '1 Monat';
  return `${months} Monate`;
}

export function DebtsPage() {
  const { state, dispatch } = useFinance();
  const { resolvedTheme } = useTheme();
  const { debts, settings } = state;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedScenarioDebtId, setSelectedScenarioDebtId] = useState('');
  const [scenarioExtraMonthly, setScenarioExtraMonthly] = useState('100');
  const [scenarioLumpSum, setScenarioLumpSum] = useState('0');
  const [scenarioInterestRate, setScenarioInterestRate] = useState('');
  const [scenarioTargetMonths, setScenarioTargetMonths] = useState('24');

  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [type, setType] = useState<DebtType>('loan');
  const [note, setNote] = useState('');

  const activeDebts = useMemo(() => debts.filter((debt) => debt.remainingAmount > 0), [debts]);
  const debtProjections = useMemo(
    () => debts.map((debt) => ({ debt, projection: calculateDebtProjection(debt) })),
    [debts]
  );

  const selectedScenarioDebt = activeDebts.find((debt) => debt.id === selectedScenarioDebtId) || null;
  const effectiveScenarioInterestRate = scenarioInterestRate || selectedScenarioDebt?.interestRate.toString() || '0';
  const extraMonthlyValue = Math.max(0, parseFloat(scenarioExtraMonthly || '0'));
  const lumpSumValue = Math.max(0, parseFloat(scenarioLumpSum || '0'));
  const interestRateValue = Math.max(0, parseFloat(effectiveScenarioInterestRate || '0'));
  const targetMonthsValue = Math.max(1, Math.round(parseFloat(scenarioTargetMonths || '1')));

  const totalDebt = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const totalMonthly = debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
  const totalInterestRemaining = debtProjections.reduce((sum, item) => sum + (item.projection.feasible ? item.projection.totalInterest : 0), 0);
  const slowestProjection = debtProjections
    .filter((item) => item.debt.remainingAmount > 0 && item.projection.feasible)
    .sort((left, right) => right.projection.months - left.projection.months)[0];

  const baselineScenario = selectedScenarioDebt ? calculateDebtProjection(selectedScenarioDebt) : null;
  const monthlyScenario = selectedScenarioDebt ? calculateDebtProjection(selectedScenarioDebt, { extraMonthlyPayment: extraMonthlyValue }) : null;
  const lumpSumScenario = selectedScenarioDebt ? calculateDebtProjection(selectedScenarioDebt, { lumpSumPayment: lumpSumValue }) : null;
  const rateScenario = selectedScenarioDebt ? calculateDebtProjection(selectedScenarioDebt, { interestRateOverride: interestRateValue }) : null;
  const combinedScenario = selectedScenarioDebt ? calculateDebtProjection(selectedScenarioDebt, {
    extraMonthlyPayment: extraMonthlyValue,
    lumpSumPayment: lumpSumValue,
    interestRateOverride: interestRateValue,
  }) : null;
  const targetMonthlyPayment = selectedScenarioDebt
    ? calculateRequiredMonthlyPayment(selectedScenarioDebt, targetMonthsValue, {
        lumpSumPayment: lumpSumValue,
        interestRateOverride: interestRateValue,
      })
    : 0;
  const targetScenario = selectedScenarioDebt
    ? calculateDebtProjection(selectedScenarioDebt, {
        lumpSumPayment: lumpSumValue,
        interestRateOverride: interestRateValue,
        monthlyPaymentOverride: targetMonthlyPayment,
      })
    : null;

  const scenarioRows = !selectedScenarioDebt || !baselineScenario || !monthlyScenario || !lumpSumScenario || !rateScenario || !combinedScenario || !targetScenario
    ? []
    : [
        {
          key: 'current',
          title: 'Aktuell',
          accent: '#64748b',
          projection: baselineScenario,
          description: 'Heute hinterlegte Rate und Zinsen.',
          monthlyPayment: selectedScenarioDebt.monthlyPayment,
        },
        {
          key: 'monthly',
          title: 'Mehr Rate',
          accent: '#8b5cf6',
          projection: monthlyScenario,
          description: `+${formatCurrency(extraMonthlyValue, settings)} pro Monat.`,
          monthlyPayment: monthlyScenario.monthlyPayment,
        },
        {
          key: 'lump',
          title: 'Sondertilgung',
          accent: '#10b981',
          projection: lumpSumScenario,
          description: `${formatCurrency(lumpSumValue, settings)} sofort auf den Kredit.`,
          monthlyPayment: lumpSumScenario.monthlyPayment,
        },
        {
          key: 'rate',
          title: 'Neuer Zins',
          accent: '#f59e0b',
          projection: rateScenario,
          description: `${interestRateValue.toFixed(2)}% statt heute.`,
          monthlyPayment: rateScenario.monthlyPayment,
        },
        {
          key: 'combined',
          title: 'Kombiniert',
          accent: '#2563eb',
          projection: combinedScenario,
          description: 'Mehr Rate + Sondertilgung + neuer Zins.',
          monthlyPayment: combinedScenario.monthlyPayment,
        },
        {
          key: 'target',
          title: 'Zieltempo',
          accent: '#ec4899',
          projection: targetScenario,
          description: `Fertig in ${targetMonthsValue} Monaten.`,
          monthlyPayment: targetMonthlyPayment,
        },
      ];

  const payoffComparisonData = !baselineScenario || !combinedScenario
    ? []
    : Array.from({ length: Math.max(baselineScenario.schedule.length, combinedScenario.schedule.length) }, (_, month) => {
        const baselineLast = baselineScenario.schedule[baselineScenario.schedule.length - 1];
        const combinedLast = combinedScenario.schedule[combinedScenario.schedule.length - 1];
        const baselinePoint = baselineScenario.schedule[Math.min(month, baselineScenario.schedule.length - 1)] || baselineLast;
        const combinedPoint = combinedScenario.schedule[Math.min(month, combinedScenario.schedule.length - 1)] || combinedLast;

        return {
          month,
          baselineBalance: baselinePoint.balance,
          scenarioBalance: combinedPoint.balance,
        };
      });

  const monthlySplitData = combinedScenario
    ? combinedScenario.schedule.slice(1, 13).map((point) => ({
        month: `M${point.month}`,
        principal: point.principalPaid,
        interest: point.interestPaid,
      }))
    : [];

  const scenarioMonthsChart = scenarioRows.map((item) => ({
    name: item.title,
    months: Number.isFinite(item.projection.months) ? item.projection.months : 0,
    accent: item.accent,
  }));

  const scenarioInterestChart = scenarioRows.map((item) => ({
    name: item.title,
    interest: item.projection.totalInterest,
    accent: item.accent,
  }));

  const selectedDebtSummary = selectedScenarioDebt && baselineScenario && combinedScenario
    ? {
        savedMonths: baselineScenario.feasible && combinedScenario.feasible ? Math.max(0, baselineScenario.months - combinedScenario.months) : 0,
        savedInterest: baselineScenario.feasible && combinedScenario.feasible ? Math.max(0, baselineScenario.totalInterest - combinedScenario.totalInterest) : 0,
        currentInterestShare: baselineScenario.totalPaid > 0 ? (baselineScenario.totalInterest / baselineScenario.totalPaid) * 100 : 0,
      }
    : null;

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

  const openModal = (debt?: Debt) => {
    if (debt) {
      setEditingDebt(debt);
      setName(debt.name);
      setTotalAmount(debt.totalAmount.toString());
      setRemainingAmount(debt.remainingAmount.toString());
      setMonthlyPayment(debt.monthlyPayment.toString());
      setInterestRate(debt.interestRate.toString());
      setType(debt.type);
      setNote(debt.note || '');
    } else {
      setEditingDebt(null);
      setName('');
      setTotalAmount('');
      setRemainingAmount('');
      setMonthlyPayment('');
      setInterestRate('0');
      setType('loan');
      setNote('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDebt(null);
  };

  const handleSubmit = () => {
    if (!name || !totalAmount || !monthlyPayment) return;

    const data = {
      name,
      totalAmount: parseFloat(totalAmount),
      remainingAmount: parseFloat(remainingAmount || totalAmount),
      monthlyPayment: parseFloat(monthlyPayment),
      interestRate: parseFloat(interestRate || '0'),
      type,
      startDate: editingDebt?.startDate || new Date().toISOString(),
      note: note || undefined,
    };

    if (editingDebt) {
      dispatch({ type: 'UPDATE_DEBT', payload: { ...editingDebt, ...data } });
    } else {
      dispatch({ type: 'ADD_DEBT', payload: data });
    }

    closeModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Schuld löschen?')) {
      dispatch({ type: 'DELETE_DEBT', payload: id });
      if (selectedScenarioDebtId === id) {
        setSelectedScenarioDebtId('');
      }
    }
  };

  const handlePayment = () => {
    if (!paymentDebt || !paymentAmount) return;
    dispatch({ type: 'MAKE_DEBT_PAYMENT', payload: { id: paymentDebt.id, amount: parseFloat(paymentAmount) } });
    setPaymentDebt(null);
    setPaymentAmount('');
  };

  const openDebtCalculator = (debt: Debt) => {
    setSelectedScenarioDebtId(debt.id);
    setScenarioInterestRate(debt.interestRate.toString());
    setScenarioTargetMonths(String(Math.max(6, Math.min(36, Math.ceil(calculateDebtProjection(debt).months / 2) || 24))));
    document.getElementById('debt-calculator-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stopCardClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const typeOptions = Object.entries(DEBT_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Gesamtschulden: {formatCurrency(totalDebt, settings)}</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">Monatliche Tilgung: {formatCurrency(totalMonthly, settings)}</p>
        </div>
        <Button onClick={() => openModal()} icon="Plus">Schuld hinzufügen</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 bg-gradient-to-br from-red-500 to-red-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <Icon name="TrendingDown" size={22} />
            <div>
              <p className="text-xs opacity-80">Offene Schulden</p>
              <p className="text-xl font-bold">{formatCurrency(totalDebt, settings)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <Icon name="Calendar" size={22} />
            <div>
              <p className="text-xs opacity-80">Monatliche Rate</p>
              <p className="text-xl font-bold">{formatCurrency(totalMonthly, settings)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-violet-500 to-violet-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <Icon name="BadgePercent" size={22} />
            <div>
              <p className="text-xs opacity-80">Restzinsen gesamt</p>
              <p className="text-xl font-bold">{formatCurrency(totalInterestRemaining, settings)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <Icon name="Target" size={22} />
            <div>
              <p className="text-xs opacity-80">Schuldenfrei ca.</p>
              <p className="text-lg font-bold">{slowestProjection?.projection.payoffDate ? formatDate(slowestProjection.projection.payoffDate) : 'Offen'}</p>
            </div>
          </div>
        </Card>
      </div>

      {debts.length === 0 ? (
        <Card>
          <EmptyState
            icon="CreditCard"
            title="Keine Schulden"
            description="Füge Schulden hinzu, um Tilgung, Zinsen und verschiedene Rückzahlungswege zu simulieren."
            action={{ label: 'Schuld hinzufügen', onClick: () => openModal() }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            Am Seitenanfang siehst du jetzt nur deine Kredite. <span className="font-semibold text-gray-900 dark:text-white">Klicke auf einen Kredit</span>, um den detaillierten Tilgungsrechner und die What-if-Grafiken zu öffnen.
          </div>

          {debtProjections.map(({ debt, projection }) => {
            const info = DEBT_TYPES[debt.type];
            const progress = debt.totalAmount > 0 ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100 : 0;
            const done = debt.remainingAmount <= 0;
            const isSelected = selectedScenarioDebtId === debt.id;

            return (
              <Card
                key={debt.id}
                className={`p-5 transition-all ${done ? 'opacity-60' : 'cursor-pointer'} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : ''}`}
                onClick={() => {
                  if (!done) openDebtCalculator(debt);
                }}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-xl p-2.5 flex-shrink-0" style={{ backgroundColor: `${info.color}15` }}>
                        <Icon name={info.icon} size={20} color={info.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{debt.name}</h3>
                          <Badge color={info.color}>{info.labelDe}</Badge>
                          {done && <Badge color="#10b981">Abbezahlt</Badge>}
                          {isSelected && !done && <Badge color="#2563eb">Im Rechner geöffnet</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-500">
                          {projection.feasible && !done
                            ? `ca. ${formatMonthsLabel(projection.months)} · fertig ${projection.payoffDate ? formatDate(projection.payoffDate) : 'offen'}`
                            : !done
                              ? 'Mit aktueller Rate nicht sauber tilgbar'
                              : 'Komplett zurückgezahlt'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-gray-500">Monatliche Rate</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">-{formatCurrency(debt.monthlyPayment, settings)}</p>
                        {!done && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                            Restzinsen {formatCurrency(projection.totalInterest, settings)}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1" onClick={stopCardClick}>
                        {!done && (
                          <>
                            <button
                              onClick={() => {
                                setPaymentDebt(debt);
                                setPaymentAmount(debt.monthlyPayment.toString());
                              }}
                              className="rounded-lg p-1.5 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Zahlung erfassen"
                            >
                              <CircleDollarSign size={15} className="text-emerald-500" />
                            </button>
                            <button
                              onClick={() => openDebtCalculator(debt)}
                              className="rounded-lg p-1.5 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              title="Kreditrechner öffnen"
                            >
                              <Calculator size={15} className="text-blue-500" />
                            </button>
                          </>
                        )}
                        <button onClick={() => openModal(debt)} className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800">
                          <Pencil size={15} className="text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(debt.id)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 size={15} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-3 text-xs">
                      <span className="font-medium text-slate-600 dark:text-gray-400">{formatCurrency(debt.totalAmount - debt.remainingAmount, settings)}</span>
                      <div className="flex-1">
                        <ProgressBar value={progress} max={100} color={done ? '#10b981' : info.color} size="md" />
                      </div>
                      <span className="font-medium text-slate-600 dark:text-gray-400">{formatCurrency(debt.totalAmount, settings)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-gray-500">
                      <span>{progress.toFixed(1)}% abbezahlt</span>
                      <span>Offen: {formatCurrency(debt.remainingAmount, settings)}</span>
                      <span>Gesamtaufwand ab jetzt: {formatCurrency(projection.totalPaid, settings)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedScenarioDebt && baselineScenario && combinedScenario && targetScenario ? (
        <div id="debt-calculator-section" className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Kreditrechner: {selectedScenarioDebt.name}</h3>
                <p className="text-sm text-slate-500 dark:text-gray-500">
                  Klarer Vergleich zwischen aktuellem Kreditverlauf, besseren Raten, Sondertilgung, Zinswechsel und Wunsch-Laufzeit.
                </p>
              </div>
              <Badge color={DEBT_TYPES[selectedScenarioDebt.type].color}>{DEBT_TYPES[selectedScenarioDebt.type].labelDe}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Monatsrate aktuell</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(selectedScenarioDebt.monthlyPayment, settings)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Fertig aktuell</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{baselineScenario.payoffDate ? formatDate(baselineScenario.payoffDate) : 'Offen'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Zinsen aktuell</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(baselineScenario.totalInterest, settings)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">Mit Szenario schneller</p>
                <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{selectedDebtSummary?.savedMonths || 0} Monate</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <p className="text-xs text-blue-700 dark:text-blue-300">Zinsen sparbar</p>
                <p className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(selectedDebtSummary?.savedInterest || 0, settings)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">What-if Einstellungen</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Extra pro Monat</p>
                <Input label="" type="number" value={scenarioExtraMonthly} onChange={setScenarioExtraMonthly} placeholder="0" icon="Euro" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Sondertilgung einmalig</p>
                <Input label="" type="number" value={scenarioLumpSum} onChange={setScenarioLumpSum} placeholder="0" icon="Euro" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Alternativer Zinssatz</p>
                <Input label="" type="number" value={effectiveScenarioInterestRate} onChange={setScenarioInterestRate} placeholder="0" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Wunsch-Laufzeit</p>
                <Input label="" type="number" value={scenarioTargetMonths} onChange={setScenarioTargetMonths} placeholder="24" />
                <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                  Dafür bräuchtest du ca. {formatCurrency(targetMonthlyPayment, settings)} monatlich.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {scenarioRows.map((item) => {
              const savedMonths = baselineScenario.feasible && item.projection.feasible ? Math.max(0, baselineScenario.months - item.projection.months) : 0;
              const savedInterest = baselineScenario.feasible && item.projection.feasible ? Math.max(0, baselineScenario.totalInterest - item.projection.totalInterest) : 0;

              return (
                <Card key={item.key} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                    <Badge color={item.accent}>{item.projection.feasible ? formatMonthsLabel(item.projection.months) : 'Nicht tragfähig'}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">{item.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-gray-500">Monatsrate</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.monthlyPayment, settings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-gray-500">Fertig am</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{item.projection.payoffDate ? formatDate(item.projection.payoffDate) : 'Offen'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-gray-500">Restzinsen</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.projection.totalInterest, settings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-gray-500">Gesamtkosten</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.projection.totalPaid, settings)}</p>
                    </div>
                  </div>
                  {item.key !== 'current' && (
                    <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {savedMonths > 0 ? `${savedMonths} Monate schneller` : 'Kein Zeitgewinn'} · {savedInterest > 0 ? `${formatCurrency(savedInterest, settings)} weniger Zinsen` : 'Keine Zinsersparnis'}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Restschuld im Zeitverlauf</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Die wichtigste Grafik: so schnell sinkt dein offener Betrag heute vs. im kombinierten Szenario.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={payoffComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} />
                    <XAxis dataKey="month" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} labelFormatter={(value) => `Monat ${value}`} />
                    <Area type="monotone" dataKey="baselineBalance" name="Aktuell" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.22} />
                    <Area type="monotone" dataKey="scenarioBalance" name="Kombiniert" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Zins- und Tilgungsanteil</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Die ersten 12 Monate im kombinierten Szenario: wie viel geht wirklich in Tilgung, wie viel in Zinsen?</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySplitData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} />
                    <XAxis dataKey="month" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                    <Bar dataKey="principal" name="Tilgung" stackId="split" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="interest" name="Zinsen" stackId="split" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Laufzeitvergleich</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Welche Option bringt dich am schnellsten ans Ziel.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioMonthsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} />
                    <XAxis dataKey="name" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip formatter={(value) => `${Number(value ?? 0)} Monate`} contentStyle={tooltipStyle} />
                    <Bar dataKey="months" name="Monate">
                      {scenarioMonthsChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.accent} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Zinskostenvergleich</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Hier siehst du sofort, welche Variante die günstigste ist.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioInterestChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} />
                    <XAxis dataKey="name" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                    <Bar dataKey="interest" name="Zinsen gesamt" radius={[8, 8, 0, 0]}>
                      {scenarioInterestChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.accent} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Offener Betrag</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(selectedScenarioDebt.remainingAmount, settings)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Aktueller Zinsanteil</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selectedDebtSummary?.currentInterestShare.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-gray-900/60">
                <p className="text-xs text-slate-500 dark:text-gray-500">Wunschrate für Zieltempo</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(targetMonthlyPayment, settings)}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : debts.length > 0 ? (
        <div id="debt-calculator-section">
          <Card className="p-6">
          <EmptyState
            icon="Calculator"
            title="Kredit auswählen"
            description="Wähle oben einen Kredit aus, dann erscheinen hier der detaillierte Kreditrechner, klare What-if-Vergleiche und mehrere Rückzahlungs-Grafiken."
          />
          </Card>
        </div>
      ) : null}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingDebt ? 'Schuld bearbeiten' : 'Neue Schuld'}>
        <div className="space-y-4">
          <Input label="Bezeichnung" value={name} onChange={setName} placeholder="z.B. Autokredit..." icon="Edit3" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Gesamtbetrag" type="number" value={totalAmount} onChange={setTotalAmount} placeholder="0.00" icon="Euro" />
            <Input label="Offener Betrag" type="number" value={remainingAmount} onChange={setRemainingAmount} placeholder={totalAmount || '0.00'} icon="Euro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Monatliche Rate" type="number" value={monthlyPayment} onChange={setMonthlyPayment} placeholder="0.00" icon="Euro" />
            <Input label="Zinssatz (%)" type="number" value={interestRate} onChange={setInterestRate} placeholder="0" />
          </div>
          <Select label="Typ" value={type} onChange={(value) => setType(value as DebtType)} options={typeOptions} />
          <Input label="Notiz (optional)" value={note} onChange={setNote} placeholder="Zusätzliche Informationen..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingDebt ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!paymentDebt} onClose={() => setPaymentDebt(null)} title="Zahlung erfassen">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-gray-400">Zahlung für <strong className="text-gray-900 dark:text-white">{paymentDebt?.name}</strong></p>
          <Input label="Zahlungsbetrag (€)" type="number" value={paymentAmount} onChange={setPaymentAmount} placeholder="0.00" icon="Euro" />
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Offener Betrag danach: {formatCurrency(Math.max(0, (paymentDebt?.remainingAmount || 0) - parseFloat(paymentAmount || '0')), settings)}
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setPaymentDebt(null)} className="flex-1">Abbrechen</Button>
            <Button onClick={handlePayment} className="flex-1">Zahlung erfassen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
