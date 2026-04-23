import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarRange,
  Check,
  CircleDollarSign,
  Download,
  FileBarChart,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinance } from '@/lib/finance-context';
import { useTheme } from '../hooks/useTheme';
import { Badge, Button, Card, EmptyState, Icon, ProgressBar } from '../components/ui';
import {
  calculateNetWorth,
  formatCurrency,
  getMonthDisplayName,
  getShortMonthName,
  shiftMonth,
} from '../utils/helpers';
import { buildMonthlyReportData } from '../utils/monthlyReport';

const formatHours = (value: number): string => `${value.toFixed(1)} h`;

export function MonthlyReportPage() {
  const { state, dispatch } = useFinance();
  const { resolvedTheme } = useTheme();
  const [showSuccess, setShowSuccess] = useState('');

  const reportData = useMemo(() => buildMonthlyReportData(state, state.selectedMonth), [state]);

  const {
    latestCompletedMonth,
    currentMonth,
    reportMonth,
    previousMonth,
    adjustedFromSelection,
    summary,
    previousSummary,
    totalSpent,
    previousTotalSpent,
    savingsRate,
    previousSavingsRate,
    comparisonChartData,
    categoryComparison,
    topIncreaseCategories,
    topDecreaseCategories,
    expenseComposition,
    topVariableExpenses,
    fixedExpenses,
    dailySpendData,
    workSummary,
    previousWorkSummary,
    workComparisonData,
    netWorthTrend,
    debtSnapshot,
  } = reportData;

  const hasMonthData = totalSpent > 0 || summary.totalIncome > 0 || workSummary.sessionCount > 0 || fixedExpenses.length > 0;
  const currentNetWorth = calculateNetWorth(state.accounts, state.debts);
  const totalAssets = state.accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalDebts = state.debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const spendingDiff = totalSpent - previousTotalSpent;
  const remainingDiff = summary.remaining - previousSummary.remaining;
  const hoursDiff = workSummary.totalHours - previousWorkSummary.totalHours;
  const revenueDiff = workSummary.revenue - previousWorkSummary.revenue;
  const spendingDiffPercent = previousTotalSpent > 0 ? (spendingDiff / previousTotalSpent) * 100 : null;
  const remainingDiffPercent = previousSummary.remaining !== 0 ? (remainingDiff / Math.abs(previousSummary.remaining)) * 100 : null;
  const savingsRateDiff = savingsRate - previousSavingsRate;
  const availableTrendPoints = netWorthTrend.filter((point) => point.netWorth !== null);
  const latestTrendPoint = availableTrendPoints[availableTrendPoints.length - 1] || null;
  const previousTrendPoint = availableTrendPoints[availableTrendPoints.length - 2] || null;
  const netWorthTrendDiff = latestTrendPoint && previousTrendPoint && latestTrendPoint.netWorth !== null && previousTrendPoint.netWorth !== null
    ? latestTrendPoint.netWorth - previousTrendPoint.netWorth
    : null;
  const quickMonths = Array.from({ length: 4 }, (_, index) => shiftMonth(latestCompletedMonth, -index));
  const categoryChartData = categoryComparison.slice(0, 8).map((entry) => ({
    label: entry.label,
    current: entry.current,
    previous: entry.previous,
    color: entry.color,
  }));
  const strongestIncrease = topIncreaseCategories[0] || null;
  const strongestDecrease = topDecreaseCategories[0] || null;
  const leadingProject = workSummary.projectBreakdown[0] || null;

  const chartStroke = resolvedTheme === 'dark' ? '#334155' : '#cbd5e1';
  const chartTick = resolvedTheme === 'dark' ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
    borderColor: resolvedTheme === 'dark' ? '#334155' : '#e2e8f0',
    color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a',
    borderRadius: '14px',
  };

  const formatDeltaCurrency = (value: number) => `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value), state.settings)}`;
  const formatDeltaPercent = (value: number | null) => value === null ? 'Neu' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  const flash = (message: string) => {
    setShowSuccess(message);
    window.setTimeout(() => setShowSuccess(''), 2500);
  };

  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      Berichtsmonat: reportMonth,
      Vormonat: previousMonth,
      Einnahmen: summary.totalIncome,
      Fixkosten: summary.totalFixedExpenses,
      Schulden: summary.totalDebtPayments,
      Variable_Ausgaben: summary.totalVariableExpenses,
      Gesamtausgaben: totalSpent,
      Verfuegbar: summary.remaining,
      Sparquote_Pct: Number(savingsRate.toFixed(1)),
      Nettovermoegen_Heute: currentNetWorth,
      Vermoegenswerte_Heute: totalAssets,
      Schulden_Heute: totalDebts,
      Arbeitsstunden: Number(workSummary.totalHours.toFixed(1)),
      Billable_Stunden: Number(workSummary.billableHours.toFixed(1)),
      Freelance_Umsatz: workSummary.revenue,
    }]), 'Uebersicht');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      comparisonChartData.map((entry) => ({
        Kennzahl: entry.label,
        Berichtsmonat: entry.current,
        Vormonat: entry.previous,
        Differenz: entry.current - entry.previous,
      }))
    ), 'Monatsvergleich');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      categoryComparison.map((entry) => ({
        Kategorie: entry.label,
        Berichtsmonat: entry.current,
        Vormonat: entry.previous,
        Differenz: entry.diff,
        Veraenderung_Pct: entry.percentChange === null ? '' : Number(entry.percentChange.toFixed(1)),
        Anteil_Berichtsmonat_Pct: Number(entry.shareOfCurrent.toFixed(1)),
      }))
    ), 'Kategorien');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      topVariableExpenses.map((expense) => ({
        Datum: expense.date,
        Beschreibung: expense.description,
        Kategorie: expense.categoryLabel,
        Betrag: expense.amount,
      }))
    ), 'Top_Ausgaben');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      fixedExpenses.map((entry) => ({
        Fixkosten: entry.name,
        Betrag: entry.amount,
        Bankabgleich: entry.matchedImportedExpense ? 'Ja' : 'Nein',
        Schuldenrate: entry.linkedDebt ? 'Ja' : 'Nein',
      }))
    ), 'Fixkosten');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        Berichtsmonat: reportMonth,
        Gesamtstunden: Number(workSummary.totalHours.toFixed(1)),
        Billable_Stunden: Number(workSummary.billableHours.toFixed(1)),
        Nicht_Billable_Stunden: Number(workSummary.nonBillableHours.toFixed(1)),
        Arbeitstage: workSummary.workdayCount,
        Durchschnitt_je_Arbeitstag: Number(workSummary.averageHoursPerWorkday.toFixed(1)),
        Sessions: workSummary.sessionCount,
        Billable_Sessions: workSummary.billableSessionCount,
        Umsatz: workSummary.revenue,
      },
      {
        Berichtsmonat: previousMonth,
        Gesamtstunden: Number(previousWorkSummary.totalHours.toFixed(1)),
        Billable_Stunden: Number(previousWorkSummary.billableHours.toFixed(1)),
        Nicht_Billable_Stunden: Number(previousWorkSummary.nonBillableHours.toFixed(1)),
        Arbeitstage: previousWorkSummary.workdayCount,
        Durchschnitt_je_Arbeitstag: Number(previousWorkSummary.averageHoursPerWorkday.toFixed(1)),
        Sessions: previousWorkSummary.sessionCount,
        Billable_Sessions: previousWorkSummary.billableSessionCount,
        Umsatz: previousWorkSummary.revenue,
      },
    ]), 'Arbeit');

    if (workSummary.projectBreakdown.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
        workSummary.projectBreakdown.map((project) => ({
          Projekt: project.projectName,
          Kunde: project.clientName,
          Stunden: Number(project.hours.toFixed(1)),
          Umsatz: project.revenue,
          Sessions: project.sessions,
        }))
      ), 'Projekte');
    }

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      debtSnapshot.map((debt) => ({
        Schuld: debt.name,
        Restschuld: debt.remainingAmount,
        Ursprungsbetrag: debt.totalAmount,
        Monatsrate: debt.monthlyPayment,
        Getilgt_Pct: Number(debt.progressPercent.toFixed(1)),
      }))
    ), 'Schulden');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      netWorthTrend.map((entry) => ({
        Monat: entry.month,
        Nettovermoegen: entry.netWorth ?? '',
        Vermoegenswerte: entry.assets ?? '',
        Schulden: entry.debts ?? '',
      }))
    ), 'Nettovermoegen');

    XLSX.writeFile(workbook, `finanzplanner-monatsbericht-${reportMonth}.xlsx`);
    flash('Excel-Monatsbericht exportiert');
  };

  const handleExportPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text(`Finanzplanner Monatsbericht ${reportMonth}`, 14, 20);
    pdf.setFontSize(11);
    pdf.text(`Vergleich mit ${previousMonth}`, 14, 28);

    autoTable(pdf, {
      startY: 36,
      head: [['Kennzahl', 'Berichtsmonat', 'Vormonat', 'Differenz']],
      body: [
        ['Einnahmen', formatCurrency(summary.totalIncome, state.settings), formatCurrency(previousSummary.totalIncome, state.settings), formatDeltaCurrency(summary.totalIncome - previousSummary.totalIncome)],
        ['Fixkosten', formatCurrency(summary.totalFixedExpenses, state.settings), formatCurrency(previousSummary.totalFixedExpenses, state.settings), formatDeltaCurrency(summary.totalFixedExpenses - previousSummary.totalFixedExpenses)],
        ['Schulden', formatCurrency(summary.totalDebtPayments, state.settings), formatCurrency(previousSummary.totalDebtPayments, state.settings), formatDeltaCurrency(summary.totalDebtPayments - previousSummary.totalDebtPayments)],
        ['Variable Ausgaben', formatCurrency(summary.totalVariableExpenses, state.settings), formatCurrency(previousSummary.totalVariableExpenses, state.settings), formatDeltaCurrency(summary.totalVariableExpenses - previousSummary.totalVariableExpenses)],
        ['Verfuegbar', formatCurrency(summary.remaining, state.settings), formatCurrency(previousSummary.remaining, state.settings), formatDeltaCurrency(summary.remaining - previousSummary.remaining)],
        ['Sparquote', `${savingsRate.toFixed(1)}%`, `${previousSavingsRate.toFixed(1)}%`, `${savingsRateDiff >= 0 ? '+' : ''}${savingsRateDiff.toFixed(1)} pp`],
      ],
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [15, 118, 110] },
    });

    let y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;

    autoTable(pdf, {
      startY: y + 10,
      head: [['Kategorie', reportMonth, previousMonth, 'Differenz']],
      body: categoryComparison.slice(0, 10).map((entry) => [
        entry.label,
        formatCurrency(entry.current, state.settings),
        formatCurrency(entry.previous, state.settings),
        formatDeltaCurrency(entry.diff),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 170;
    if (y > 205) {
      pdf.addPage();
      y = 20;
    }

    autoTable(pdf, {
      startY: y + 10,
      head: [['Top-Ausgabe', 'Kategorie', 'Datum', 'Betrag']],
      body: topVariableExpenses.map((expense) => [
        expense.description,
        expense.categoryLabel,
        expense.date,
        formatCurrency(expense.amount, state.settings),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [217, 119, 6] },
    });

    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;

    autoTable(pdf, {
      startY: y + 10,
      head: [['Arbeitskennzahl', reportMonth, previousMonth]],
      body: [
        ['Gesamtstunden', formatHours(workSummary.totalHours), formatHours(previousWorkSummary.totalHours)],
        ['Billable Stunden', formatHours(workSummary.billableHours), formatHours(previousWorkSummary.billableHours)],
        ['Nicht billable', formatHours(workSummary.nonBillableHours), formatHours(previousWorkSummary.nonBillableHours)],
        ['Arbeitstage', String(workSummary.workdayCount), String(previousWorkSummary.workdayCount)],
        ['Freelance Umsatz', formatCurrency(workSummary.revenue, state.settings), formatCurrency(previousWorkSummary.revenue, state.settings)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
    });

    if (debtSnapshot.length > 0) {
      pdf.addPage();
      pdf.setFontSize(15);
      pdf.text('Schuldenuebersicht', 14, 20);
      autoTable(pdf, {
        startY: 28,
        head: [['Schuld', 'Restschuld', 'Monatsrate', 'Getilgt']],
        body: debtSnapshot.map((debt) => [
          debt.name,
          formatCurrency(debt.remainingAmount, state.settings),
          formatCurrency(debt.monthlyPayment, state.settings),
          `${debt.progressPercent.toFixed(0)}%`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] },
      });
    }

    pdf.save(`finanzplanner-monatsbericht-${reportMonth}.pdf`);
    flash('PDF-Monatsbericht exportiert');
  };

  if (!hasMonthData) {
    return (
      <Card>
        <EmptyState
          icon="FileBarChart"
          title="Noch kein Monatsbericht vorhanden"
          description="Sobald im letzten abgeschlossenen Monat Einnahmen, Ausgaben oder Arbeitszeiten erfasst wurden, erscheint hier dein detaillierter Report."
          helpText="Der Bericht vergleicht immer einen abgeschlossenen Monat mit dem Vormonat. Wenn du gerade erst startest, erfasse zuerst ein paar typische Ausgaben oder importiere deine Bankdaten."
          action={{
            label: 'Zu Ausgaben wechseln',
            onClick: () => dispatch({ type: 'SET_SELECTED_MONTH', payload: latestCompletedMonth }),
          }}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-900 text-white shadow-2xl shadow-slate-950/20">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.85fr] lg:p-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
                <FileBarChart size={14} className="text-cyan-300" />
                Monatsbericht
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {getMonthDisplayName(reportMonth)} vs. {getMonthDisplayName(previousMonth)}
              </span>
              {adjustedFromSelection && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
                  Aktueller Monat noch offen
                </span>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <Button onClick={handleExportPdf} icon="FileText" className="!bg-white/10 !text-white hover:!bg-white/20">
                  PDF
                </Button>
                <Button onClick={handleExportExcel} icon="FileSpreadsheet" className="!bg-white/10 !text-white hover:!bg-white/20">
                  Excel
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-300">Vergleich des zuletzt abgeschlossenen Monats mit seinem direkten Vormonat</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {getMonthDisplayName(reportMonth)} im Detail
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Du siehst hier nicht nur Einnahmen, Ausgaben und Restbetrag, sondern auch Verschiebungen in einzelnen Kategorien,
                den Verlauf innerhalb des Monats, die aktuelle Vermögenslage, deine Schuldenstruktur und die Entwicklung deiner Arbeitszeit.
              </p>
            </div>

            {adjustedFromSelection && (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                Der ausgewählte Monat {getMonthDisplayName(currentMonth)} ist noch nicht abgeschlossen. Deshalb zeigt der Bericht automatisch {getMonthDisplayName(reportMonth)}.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {quickMonths.map((month) => {
                const isActive = month === reportMonth;
                return (
                  <button
                    key={month}
                    onClick={() => dispatch({ type: 'SET_SELECTED_MONTH', payload: month })}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                      isActive
                        ? 'border-white/20 bg-white/14 text-white shadow-md shadow-cyan-900/30'
                        : 'border-white/10 bg-white/6 text-slate-200 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {getShortMonthName(month)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Monatsfazit</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(summary.remaining, state.settings)}</p>
                <p className="mt-1 text-sm text-slate-300">verfügbar nach allen fixen, variablen und schuldenbezogenen Abflüssen</p>
              </div>
              <div className={`rounded-2xl p-3 ${summary.remaining >= previousSummary.remaining ? 'bg-emerald-400/15 text-emerald-100' : 'bg-red-400/15 text-red-100'}`}>
                {summary.remaining >= previousSummary.remaining ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-white/8 px-4 py-3">
                <p className="text-xs text-slate-300">Gesamtausgaben vs. Vormonat</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">{formatDeltaCurrency(spendingDiff)}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${spendingDiff <= 0 ? 'bg-emerald-400/15 text-emerald-100' : 'bg-red-400/15 text-red-100'}`}>
                    {formatDeltaPercent(spendingDiffPercent)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/8 px-4 py-3">
                <p className="text-xs text-slate-300">Sparquote</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">{savingsRate.toFixed(1)}%</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${savingsRateDiff >= 0 ? 'bg-emerald-400/15 text-emerald-100' : 'bg-amber-400/15 text-amber-100'}`}>
                    {savingsRateDiff >= 0 ? '+' : ''}{savingsRateDiff.toFixed(1)} pp
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/8 px-4 py-3">
                <p className="text-xs text-slate-300">Größte Bewegung</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {strongestIncrease
                    ? `${strongestIncrease.label}: ${formatDeltaCurrency(strongestIncrease.diff)}`
                    : 'Keine markante Verschiebung'}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {leadingProject
                    ? `Top-Projekt: ${leadingProject.projectName} mit ${formatHours(leadingProject.hours)} und ${formatCurrency(leadingProject.revenue, state.settings)}.`
                    : 'Sobald Arbeitszeiten erfasst sind, erscheinen hier auch Projekt-Highlights.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {showSuccess && (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check size={16} />
          {showSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            title: 'Einnahmen',
            value: formatCurrency(summary.totalIncome, state.settings),
            delta: formatDeltaCurrency(summary.totalIncome - previousSummary.totalIncome),
            tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
            icon: TrendingUp,
          },
          {
            title: 'Gesamtausgaben',
            value: formatCurrency(totalSpent, state.settings),
            delta: formatDeltaCurrency(spendingDiff),
            tone: spendingDiff <= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
            icon: Wallet,
          },
          {
            title: 'Verfügbar',
            value: formatCurrency(summary.remaining, state.settings),
            delta: formatDeltaCurrency(remainingDiff),
            tone: summary.remaining >= 0 ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
            icon: PiggyBank,
          },
          {
            title: 'Sparquote',
            value: `${savingsRate.toFixed(1)}%`,
            delta: `${savingsRateDiff >= 0 ? '+' : ''}${savingsRateDiff.toFixed(1)} pp`,
            tone: savingsRateDiff >= 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
            icon: CircleDollarSign,
          },
          {
            title: 'Arbeitszeit',
            value: formatHours(workSummary.totalHours),
            delta: `${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(1)} h`,
            tone: hoursDiff >= 0 ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
            icon: BriefcaseBusiness,
          },
          {
            title: 'Nettovermögen heute',
            value: formatCurrency(currentNetWorth, state.settings),
            delta: netWorthTrendDiff !== null ? formatDeltaCurrency(netWorthTrendDiff) : 'Trend wird aufgebaut',
            tone: currentNetWorth >= 0 ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
            icon: CalendarRange,
          },
        ].map((item) => {
          const ItemIcon = item.icon;
          return (
            <Card key={item.title} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-gray-500">{item.title}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{item.value}</p>
                </div>
                <div className={`rounded-2xl p-3 ${item.tone}`}>
                  <ItemIcon size={18} />
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-gray-400">{item.delta}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Vergleich der Monatsbausteine</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Einnahmen, Fixkosten, Schulden, variable Ausgaben und Restbetrag direkt nebeneinander</p>
            </div>
            <Badge color="#0f766e">{getShortMonthName(reportMonth)} vs. {getShortMonthName(previousMonth)}</Badge>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), state.settings)} />
                <Tooltip
                  formatter={(value: number | string | readonly (number | string)[] | undefined) => formatCurrency(Number(Array.isArray(value) ? value[0] : value || 0), state.settings)}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: tooltipStyle.color }}
                  labelStyle={{ color: tooltipStyle.color }}
                />
                <Legend />
                <Bar name={getShortMonthName(previousMonth)} dataKey="previous" fill="#94a3b8" radius={[10, 10, 0, 0]} />
                <Bar name={getShortMonthName(reportMonth)} dataKey="current" fill="#14b8a6" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kurzfazit</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                {spendingDiff <= 0 ? <TrendingDown size={16} className="text-emerald-500" /> : <TrendingUp size={16} className="text-red-500" />}
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Ausgabenentwicklung</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                {spendingDiff <= 0
                  ? `Du hast ${formatCurrency(Math.abs(spendingDiff), state.settings)} weniger ausgegeben als im Vormonat.`
                  : `Du hast ${formatCurrency(spendingDiff, state.settings)} mehr ausgegeben als im Vormonat.`}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Icon name={strongestIncrease ? strongestIncrease.icon : 'Tag'} size={16} color={strongestIncrease?.color || '#64748b'} />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Größter Anstieg</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                {strongestIncrease
                  ? `${strongestIncrease.label} liegt ${formatDeltaCurrency(strongestIncrease.diff)} über dem Vormonat.`
                  : 'Keine Kategorie ist gegenüber dem Vormonat sichtbar angestiegen.'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Icon name={strongestDecrease ? strongestDecrease.icon : 'Tag'} size={16} color={strongestDecrease?.color || '#64748b'} />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Größter Rückgang</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                {strongestDecrease
                  ? `${strongestDecrease.label} liegt ${formatCurrency(Math.abs(strongestDecrease.diff), state.settings)} unter dem Vormonat.`
                  : 'Keine Kategorie ist gegenüber dem Vormonat sichtbar gefallen.'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness size={16} className="text-violet-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Arbeitsleistung</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                {workSummary.sessionCount > 0
                  ? `${formatHours(workSummary.totalHours)} auf ${workSummary.workdayCount} Arbeitstage verteilt, davon ${formatHours(workSummary.billableHours)} abrechenbar.`
                  : 'Für diesen Monat wurden keine Arbeitszeiten erfasst.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kategorievergleich</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">So haben sich Lebensmittel, Tanken, Freizeit und andere variable Ausgaben verschoben</p>
            </div>
          </div>
          {categoryChartData.length > 0 ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} horizontal={false} />
                  <XAxis type="number" tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), state.settings)} />
                  <YAxis dataKey="label" type="category" width={120} tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number | string | readonly (number | string)[] | undefined) => formatCurrency(Number(Array.isArray(value) ? value[0] : value || 0), state.settings)}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: tooltipStyle.color }}
                    labelStyle={{ color: tooltipStyle.color }}
                  />
                  <Legend />
                  <Bar name={getShortMonthName(previousMonth)} dataKey="previous" fill="#cbd5e1" radius={[0, 10, 10, 0]} />
                  <Bar name={getShortMonthName(reportMonth)} dataKey="current" radius={[0, 10, 10, 0]}>
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[360px] items-center justify-center text-sm text-slate-400 dark:text-gray-600">
              Keine variablen Kategorien zum Vergleichen vorhanden.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Top-Bewegungen</h2>
          <div className="mt-4 space-y-3">
            {categoryComparison.slice(0, 6).map((entry) => (
              <div key={entry.category} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name={entry.icon} size={16} color={entry.color} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.label}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">{entry.shareOfCurrent.toFixed(0)}% Anteil im Berichtsmonat</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.current, state.settings)}</p>
                    <p className={`text-xs font-semibold ${entry.diff <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatDeltaCurrency(entry.diff)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Tagesverlauf der variablen Ausgaben</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Kumulierte Entwicklung innerhalb des Monats, Tag für Tag mit dem Vormonat verglichen</p>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySpendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), state.settings)} />
                <Tooltip
                  formatter={(value: number | string | readonly (number | string)[] | undefined) => formatCurrency(Number(Array.isArray(value) ? value[0] : value || 0), state.settings)}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: tooltipStyle.color }}
                  labelStyle={{ color: tooltipStyle.color }}
                />
                <Legend />
                <Line name={`${getShortMonthName(previousMonth)} kumuliert`} type="monotone" dataKey="previousCumulative" stroke="#94a3b8" strokeWidth={2.5} dot={false} />
                <Line name={`${getShortMonthName(reportMonth)} kumuliert`} type="monotone" dataKey="currentCumulative" stroke="#0f766e" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Ausgabenstruktur</h2>
          {expenseComposition.length > 0 ? (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseComposition} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={2}>
                      {expenseComposition.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string | readonly (number | string)[] | undefined) => formatCurrency(Number(Array.isArray(value) ? value[0] : value || 0), state.settings)}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: tooltipStyle.color }}
                      labelStyle={{ color: tooltipStyle.color }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {expenseComposition.slice(0, 6).map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-slate-600 dark:text-gray-400">{entry.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.value, state.settings)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[320px] items-center justify-center text-sm text-slate-400 dark:text-gray-600">
              Keine variablen Ausgaben in diesem Monat.
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Größte variable Ausgaben</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Die wichtigsten Einzelposten im Berichtsmonat</p>
            </div>
          </div>
          <div className="space-y-3">
            {topVariableExpenses.length > 0 ? topVariableExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-gray-800">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-2xl p-2" style={{ backgroundColor: `${expense.categoryColor}18` }}>
                    <Icon name="Receipt" size={16} color={expense.categoryColor} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{expense.description}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-500">{expense.categoryLabel} · {expense.date}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(expense.amount, state.settings)}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-500 dark:text-gray-500">Keine variablen Ausgaben vorhanden.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Fixkosten im Berichtsmonat</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Wiederkehrende Kosten, die den Monat geprägt haben</p>
            </div>
          </div>
          <div className="space-y-3">
            {fixedExpenses.length > 0 ? fixedExpenses.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {entry.matchedImportedExpense && <Badge color="#0f766e">Bankabgleich</Badge>}
                      {entry.linkedDebt && <Badge color="#7c3aed">Schuldenrate</Badge>}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.amount, state.settings)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500 dark:text-gray-500">Keine Fixkosten im Berichtsmonat erkannt.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Vermögenstrend</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Nettovermögen, Vermögenswerte und Schulden über die letzten verfügbaren Monatssnapshots</p>
            </div>
          </div>
          {availableTrendPoints.length > 1 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthTrend}>
                  <defs>
                    <linearGradient id="netWorthFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), state.settings)} />
                  <Tooltip
                    formatter={(value: number | string | readonly (number | string)[] | undefined) => formatCurrency(Number(Array.isArray(value) ? value[0] : value || 0), state.settings)}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: tooltipStyle.color }}
                    labelStyle={{ color: tooltipStyle.color }}
                  />
                  <Legend />
                  <Area name="Vermögenswerte" type="monotone" dataKey="assets" stroke="#2563eb" fill="url(#assetFill)" strokeWidth={2} />
                  <Area name="Nettovermögen" type="monotone" dataKey="netWorth" stroke="#0f766e" fill="url(#netWorthFill)" strokeWidth={3} />
                  <Line name="Schulden" type="monotone" dataKey="debts" stroke="#dc2626" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center text-center text-sm text-slate-400 dark:text-gray-600">
              <p>Für einen Verlauf werden mindestens zwei Monatssnapshots benötigt.</p>
              <p className="mt-2 max-w-md text-xs">Die App baut diese Historie automatisch auf, sobald du sie in mehreren Monaten verwendest.</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Vermögenswerte heute', value: formatCurrency(totalAssets, state.settings) },
              { label: 'Schulden heute', value: formatCurrency(totalDebts, state.settings) },
              { label: 'Nettovermögen heute', value: formatCurrency(currentNetWorth, state.settings) },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-gray-800/50">
                <p className="text-xs text-slate-500 dark:text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Aktuelle Schuldenstruktur</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Reststände, Fortschritt und monatliche Belastung deiner offenen Verbindlichkeiten</p>
            </div>
          </div>
          <div className="space-y-4">
            {debtSnapshot.length > 0 ? debtSnapshot.map((debt) => (
              <div key={debt.id} className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{debt.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Monatsrate {formatCurrency(debt.monthlyPayment, state.settings)}</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {formatCurrency(debt.remainingAmount, state.settings)}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
                    <span>{debt.progressPercent.toFixed(0)}% bereits getilgt</span>
                    <span>{formatCurrency(debt.totalAmount, state.settings)} Ursprung</span>
                  </div>
                  <ProgressBar value={debt.progressPercent} max={100} color="#dc2626" size="md" />
                </div>
              </div>
            )) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-slate-400 dark:text-gray-600">
                Keine offenen Schulden vorhanden.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Arbeitszeit und Freelance-Entwicklung</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Billable vs. nicht billable Stunden im Vergleich zum Vormonat</p>
            </div>
          </div>
          {workSummary.sessionCount > 0 || previousWorkSummary.sessionCount > 0 ? (
            <>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number | string | readonly (number | string)[] | undefined, name) => {
                        const numericValue = Number(Array.isArray(value) ? value[0] : value || 0);
                        if (name === 'Umsatz') return formatCurrency(numericValue, state.settings);
                        return formatHours(numericValue);
                      }}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: tooltipStyle.color }}
                      labelStyle={{ color: tooltipStyle.color }}
                    />
                    <Legend />
                    <Bar name="Billable Stunden" dataKey="billableHours" stackId="hours" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                    <Bar name="Nicht billable Stunden" dataKey="nonBillableHours" stackId="hours" fill="#c4b5fd" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Stunden', value: formatHours(workSummary.totalHours), delta: `${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(1)} h` },
                  { label: 'Billable', value: formatHours(workSummary.billableHours), delta: `${(workSummary.billableHours - previousWorkSummary.billableHours) >= 0 ? '+' : ''}${(workSummary.billableHours - previousWorkSummary.billableHours).toFixed(1)} h` },
                  { label: 'Umsatz', value: formatCurrency(workSummary.revenue, state.settings), delta: formatDeltaCurrency(revenueDiff) },
                  { label: 'Ø je Arbeitstag', value: formatHours(workSummary.averageHoursPerWorkday), delta: `${workSummary.workdayCount} Tage` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-gray-800/50">
                    <p className="text-xs text-slate-500 dark:text-gray-500">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{item.value}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-gray-400">{item.delta}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-slate-400 dark:text-gray-600">
              Noch keine Arbeitszeiten im Berichtsmonat oder Vormonat vorhanden.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Projektaufschlüsselung</h2>
              <p className="text-sm text-slate-500 dark:text-gray-500">Welches Projekt die meiste Zeit und den meisten Umsatz gebunden hat</p>
            </div>
          </div>
          <div className="space-y-4">
            {workSummary.projectBreakdown.length > 0 ? workSummary.projectBreakdown.map((project) => {
              const revenueShare = workSummary.revenue > 0 ? (project.revenue / workSummary.revenue) * 100 : 0;
              return (
                <div key={project.projectId} className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.projectName}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{project.clientName} · {project.sessions} Sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(project.revenue, state.settings)}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">{formatHours(project.hours)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
                      <span>Umsatzanteil</span>
                      <span>{revenueShare.toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={revenueShare} max={100} color="#8b5cf6" size="md" />
                  </div>
                </div>
              );
            }) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-slate-400 dark:text-gray-600">
                Noch keine Projekte mit Arbeitszeiten im Berichtsmonat vorhanden.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}