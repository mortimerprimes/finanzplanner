import { useState } from 'react';
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useFinance } from '@/lib/finance-context';
import { Button, Card, Icon } from '../components/ui';
import {
  calculateMonthSummary,
  calculateNetWorth,
  formatCurrency,
  getExpenseCategoryInfo,
  getShortMonthName,
  calculateWorkSessionHours,
  calculateFreelanceSessionNetAmount,
} from '../utils/helpers';

export function AnnualReport() {
  const { state } = useFinance();
  const { settings, incomes, fixedExpenses, debts, expenses, savingsGoals, accounts, budgetLimits, freelanceProjects, workSessions, freelanceInvoices } = state;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const monthlyData = months.map(month => {
    const summary = calculateMonthSummary(month, incomes, fixedExpenses, debts, expenses);
    return { ...summary };
  });

  const totals = monthlyData.reduce(
    (acc, m) => ({
      income: acc.income + m.totalIncome,
      fixed: acc.fixed + m.totalFixedExpenses,
      debt: acc.debt + m.totalDebtPayments,
      variable: acc.variable + m.totalVariableExpenses,
      remaining: acc.remaining + m.remaining,
    }),
    { income: 0, fixed: 0, debt: 0, variable: 0, remaining: 0 }
  );

  const totalExpenses = totals.fixed + totals.debt + totals.variable;
  const savingsRate = totals.income > 0 ? (totals.remaining / totals.income) * 100 : 0;

  // Category ranking for the year
  const yearExpenses = expenses.filter(e => e.date.startsWith(String(year)));
  const categoryTotals: Record<string, number> = {};
  for (const exp of yearExpenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
  }
  const categoryRanking = Object.entries(categoryTotals)
    .map(([cat, total]) => ({ cat, total, info: getExpenseCategoryInfo(cat, settings) }))
    .sort((a, b) => b.total - a.total);

  // Savings progress
  const savingsProgress = savingsGoals.map(g => ({
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    pct: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0,
    completed: g.isCompleted,
  }));

  // Debt progress
  const debtProgress = debts.map(d => ({
    name: d.name,
    total: d.totalAmount,
    remaining: d.remainingAmount,
    paid: d.totalAmount - d.remainingAmount,
    pct: d.totalAmount > 0 ? ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100 : 0,
  }));

  // Freelance stats for the year
  const yearSessions = workSessions.filter(s => s.date.startsWith(String(year)));
  const yearInvoices = freelanceInvoices.filter(i => i.issueDate.startsWith(String(year)));
  const totalFreelanceHours = yearSessions.reduce((sum, s) => sum + calculateWorkSessionHours(s), 0);
  const totalFreelanceNet = yearSessions.reduce((sum, s) => {
    const project = freelanceProjects.find(p => p.id === s.projectId);
    return sum + calculateFreelanceSessionNetAmount(s, project);
  }, 0);
  const totalFreelanceInvoiced = yearInvoices.reduce((sum, i) => sum + i.grossAmount, 0);
  const totalFreelanceVat = yearInvoices.reduce((sum, i) => sum + i.vatAmount, 0);
  const totalFreelancePaid = yearInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.grossAmount, 0);

  const netWorth = calculateNetWorth(accounts, debts);

  // ── Export functions ──

  const handleExportPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text(`Finanzplanner Jahresbericht ${year}`, 14, 20);

    pdf.setFontSize(11);
    pdf.text('Jahresueberblick', 14, 35);

    autoTable(pdf, {
      startY: 40,
      head: [['Kennzahl', 'Betrag']],
      body: [
        ['Gesamteinnahmen', formatCurrency(totals.income, settings)],
        ['Fixkosten', formatCurrency(totals.fixed, settings)],
        ['Schulden-Tilgung', formatCurrency(totals.debt, settings)],
        ['Variable Ausgaben', formatCurrency(totals.variable, settings)],
        ['Gesamtausgaben', formatCurrency(totalExpenses, settings)],
        ['Verbleibendes', formatCurrency(totals.remaining, settings)],
        ['Sparquote', `${savingsRate.toFixed(1)}%`],
        ['Nettovermoegen', formatCurrency(netWorth, settings)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    let y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

    // Monthly breakdown
    pdf.text('Monatsuebersicht', 14, y + 12);
    autoTable(pdf, {
      startY: y + 16,
      head: [['Monat', 'Einnahmen', 'Fixkosten', 'Schulden', 'Variable', 'Verbleibt']],
      body: monthlyData.map(m => [
        getShortMonthName(m.month),
        formatCurrency(m.totalIncome, settings),
        formatCurrency(m.totalFixedExpenses, settings),
        formatCurrency(m.totalDebtPayments, settings),
        formatCurrency(m.totalVariableExpenses, settings),
        formatCurrency(m.remaining, settings),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200;

    // Category ranking
    if (categoryRanking.length > 0 && y < 240) {
      pdf.text('Top Ausgaben-Kategorien', 14, y + 12);
      autoTable(pdf, {
        startY: y + 16,
        head: [['Kategorie', 'Betrag']],
        body: categoryRanking.slice(0, 10).map(c => [c.info.labelDe, formatCurrency(c.total, settings)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [99, 102, 241] },
      });
    }

    // Freelance page
    if (totalFreelanceHours > 0) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Freelance & Steuerdaten', 14, 20);
      pdf.setFontSize(11);

      autoTable(pdf, {
        startY: 28,
        head: [['Kennzahl', 'Wert']],
        body: [
          ['Gesamtstunden', `${totalFreelanceHours.toFixed(1)} h`],
          ['Netto-Umsatz (berechnet)', formatCurrency(totalFreelanceNet, settings)],
          ['Rechnungen (brutto)', formatCurrency(totalFreelanceInvoiced, settings)],
          ['Davon USt.', formatCurrency(totalFreelanceVat, settings)],
          ['Davon bezahlt', formatCurrency(totalFreelancePaid, settings)],
          ['Offene Rechnungen', formatCurrency(totalFreelanceInvoiced - totalFreelancePaid, settings)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [139, 92, 246] },
      });

      y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

      if (yearInvoices.length > 0) {
        pdf.text('Rechnungsuebersicht', 14, y + 12);
        autoTable(pdf, {
          startY: y + 16,
          head: [['Nr.', 'Kunde', 'Datum', 'Netto', 'USt.', 'Brutto', 'Status']],
          body: yearInvoices.map(inv => [
            inv.invoiceNumber,
            inv.clientName,
            inv.issueDate,
            formatCurrency(inv.netAmount, settings),
            formatCurrency(inv.vatAmount, settings),
            formatCurrency(inv.grossAmount, settings),
            inv.status === 'paid' ? 'Bezahlt' : inv.status === 'cancelled' ? 'Storniert' : 'Offen',
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [139, 92, 246] },
        });
      }
    }

    pdf.save(`finanzplanner-jahresbericht-${year}.pdf`);
  };

  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Overview sheet
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      Jahr: year,
      Einnahmen: totals.income,
      Fixkosten: totals.fixed,
      Schulden_Tilgung: totals.debt,
      Variable_Ausgaben: totals.variable,
      Gesamtausgaben: totalExpenses,
      Verbleibt: totals.remaining,
      Sparquote_Pct: Number(savingsRate.toFixed(1)),
      Nettovermoegen: netWorth,
    }]), 'Jahresueberblick');

    // Monthly sheet
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      monthlyData.map(m => ({
        Monat: m.month,
        Einnahmen: m.totalIncome,
        Fixkosten: m.totalFixedExpenses,
        Schulden: m.totalDebtPayments,
        Variable: m.totalVariableExpenses,
        Verbleibt: m.remaining,
      }))
    ), 'Monatsuebersicht');

    // Category sheet
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      categoryRanking.map(c => ({ Kategorie: c.info.labelDe, Betrag: c.total }))
    ), 'Kategorien');

    // All expenses
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      yearExpenses.map(e => ({
        Datum: e.date,
        Beschreibung: e.description,
        Kategorie: getExpenseCategoryInfo(e.category, settings).labelDe,
        Betrag: e.amount,
        Konto: accounts.find(a => a.id === e.accountId)?.name || '',
        Tags: (e.tags || []).join(', '),
        Notiz: e.note || '',
      }))
    ), 'Alle_Ausgaben');

    // Freelance
    if (yearInvoices.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
        yearInvoices.map(inv => ({
          Rechnungsnummer: inv.invoiceNumber,
          Kunde: inv.clientName,
          Datum: inv.issueDate,
          Stunden: inv.hours,
          Netto: inv.netAmount,
          USt: inv.vatAmount,
          Brutto: inv.grossAmount,
          Status: inv.status === 'paid' ? 'Bezahlt' : inv.status === 'cancelled' ? 'Storniert' : 'Offen',
        }))
      ), 'Rechnungen');

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
        Gesamtstunden: Number(totalFreelanceHours.toFixed(1)),
        Netto_Umsatz: totalFreelanceNet,
        Brutto_Rechnungen: totalFreelanceInvoiced,
        USt_Gesamt: totalFreelanceVat,
        Bezahlt: totalFreelancePaid,
        Offen: totalFreelanceInvoiced - totalFreelancePaid,
      }]), 'Freelance_Steuerdaten');
    }

    XLSX.writeFile(workbook, `finanzplanner-jahresbericht-${year}.xlsx`);
  };

  const best = monthlyData.reduce((best, m) => m.remaining > best.remaining ? m : best, monthlyData[0]);
  const worst = monthlyData.reduce((worst, m) => m.remaining < worst.remaining ? m : worst, monthlyData[0]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 text-white shadow-2xl">
        <div className="p-6 lg:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setYear(y => y - 1)} className="rounded-xl border border-white/20 p-2 transition-colors hover:bg-white/10">
                <ChevronLeft size={18} />
              </button>
              <h1 className="text-2xl font-bold">Jahresbericht {year}</h1>
              <button onClick={() => setYear(y => y + 1)} className="rounded-xl border border-white/20 p-2 transition-colors hover:bg-white/10">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportPdf} className="!bg-white/10 !text-white hover:!bg-white/20">
                <FileText size={16} /> PDF
              </Button>
              <Button onClick={handleExportExcel} className="!bg-white/10 !text-white hover:!bg-white/20">
                <Download size={16} /> Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: 'Einnahmen', value: formatCurrency(totals.income, settings), tone: 'bg-emerald-400/15 text-emerald-100' },
              { label: 'Gesamtausgaben', value: formatCurrency(totalExpenses, settings), tone: 'bg-red-400/15 text-red-100' },
              { label: 'Verbleibt', value: formatCurrency(totals.remaining, settings), tone: totals.remaining >= 0 ? 'bg-emerald-400/15 text-emerald-100' : 'bg-red-400/15 text-red-100' },
              { label: 'Sparquote', value: `${savingsRate.toFixed(1)}%`, tone: 'bg-blue-400/15 text-blue-100' },
              { label: 'Nettovermögen', value: formatCurrency(netWorth, settings), tone: 'bg-violet-400/15 text-violet-100' },
              { label: 'Ø pro Monat', value: formatCurrency(totals.remaining / 12, settings), tone: 'bg-white/8 text-white/90' },
            ].map(item => (
              <div key={item.label} className={`rounded-2xl border border-white/10 px-4 py-3 ${item.tone}`}>
                <p className="text-[10px] font-medium text-white/70">{item.label}</p>
                <p className="mt-1 text-lg font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Monthly breakdown */}
      <Card className="p-5">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Monatsübersicht</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-gray-800">
                {['Monat', 'Einnahmen', 'Fixkosten', 'Schulden', 'Variable', 'Verbleibt'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={m.month} className="border-b border-slate-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{getShortMonthName(m.month)}</td>
                  <td className="px-3 py-2.5 text-emerald-600 dark:text-emerald-400">{formatCurrency(m.totalIncome, settings)}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-gray-400">{formatCurrency(m.totalFixedExpenses, settings)}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-gray-400">{formatCurrency(m.totalDebtPayments, settings)}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-gray-400">{formatCurrency(m.totalVariableExpenses, settings)}</td>
                  <td className={`px-3 py-2.5 font-semibold ${m.remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(m.remaining, settings)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold dark:bg-gray-800/30">
                <td className="px-3 py-2.5 text-gray-900 dark:text-white">Gesamt</td>
                <td className="px-3 py-2.5 text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.income, settings)}</td>
                <td className="px-3 py-2.5 text-slate-700 dark:text-gray-300">{formatCurrency(totals.fixed, settings)}</td>
                <td className="px-3 py-2.5 text-slate-700 dark:text-gray-300">{formatCurrency(totals.debt, settings)}</td>
                <td className="px-3 py-2.5 text-slate-700 dark:text-gray-300">{formatCurrency(totals.variable, settings)}</td>
                <td className={`px-3 py-2.5 ${totals.remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(totals.remaining, settings)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Best & Worst months */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Highlights</h3>
          <div className="space-y-3">
            {best && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <Icon name="TrendingUp" size={16} className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Bester Monat</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{getShortMonthName(best.month)}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatCurrency(best.remaining, settings)} übrig</p>
                </div>
              </div>
            )}
            {worst && (
              <div className="flex items-center justify-between rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
                <div className="flex items-center gap-2">
                  <Icon name="TrendingDown" size={16} className="text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Schwächster Monat</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">{getShortMonthName(worst.month)}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{formatCurrency(worst.remaining, settings)} übrig</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
              <div className="flex items-center gap-2">
                <Icon name="Wallet" size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Ø Monatsrest</span>
              </div>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totals.remaining / 12, settings)}</p>
            </div>
          </div>
        </Card>

        {/* Top categories */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Top Ausgaben-Kategorien</h3>
          <div className="space-y-2">
            {categoryRanking.slice(0, 8).map((c, i) => {
              const pct = totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0;
              return (
                <div key={c.cat} className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-slate-400 dark:text-gray-600">{i + 1}</span>
                  <div className="rounded-lg p-1.5" style={{ backgroundColor: `${c.info.color}15` }}>
                    <Icon name={c.info.icon} size={14} color={c.info.color} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.info.labelDe}</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(c.total, settings)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.info.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Savings & Debt progress */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {savingsProgress.length > 0 && (
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Sparziel-Fortschritt</h3>
            <div className="space-y-3">
              {savingsProgress.map(g => (
                <div key={g.name} className="rounded-xl border border-slate-200 p-3 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{g.name}</span>
                    <span className={`text-xs font-semibold ${g.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-gray-500'}`}>
                      {g.completed ? 'Erreicht!' : `${g.pct.toFixed(0)}%`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                    <div className={`h-full rounded-full ${g.completed ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, g.pct)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{formatCurrency(g.current, settings)} / {formatCurrency(g.target, settings)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {debtProgress.length > 0 && (
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Schulden-Abbau</h3>
            <div className="space-y-3">
              {debtProgress.map(d => (
                <div key={d.name} className="rounded-xl border border-slate-200 p-3 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{d.name}</span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-gray-500">{d.pct.toFixed(0)}% getilgt</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, d.pct)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                    {formatCurrency(d.paid, settings)} von {formatCurrency(d.total, settings)} getilgt · Rest: {formatCurrency(d.remaining, settings)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Freelance & Tax summary */}
      {totalFreelanceHours > 0 && (
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <Icon name="Briefcase" size={18} className="text-violet-500" /> Freelance & Steuerdaten {year}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Stunden gesamt', value: `${totalFreelanceHours.toFixed(1)} h`, color: 'text-gray-900 dark:text-white' },
              { label: 'Netto-Umsatz', value: formatCurrency(totalFreelanceNet, settings), color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Rechnungen (brutto)', value: formatCurrency(totalFreelanceInvoiced, settings), color: 'text-blue-600 dark:text-blue-400' },
              { label: 'USt. gesamt', value: formatCurrency(totalFreelanceVat, settings), color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Bezahlt', value: formatCurrency(totalFreelancePaid, settings), color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Offen', value: formatCurrency(totalFreelanceInvoiced - totalFreelancePaid, settings), color: 'text-red-600 dark:text-red-400' },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
                <p className="text-[10px] font-medium text-slate-500 dark:text-gray-500">{item.label}</p>
                <p className={`mt-1 text-sm font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {yearInvoices.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-800">
                    {['Nr.', 'Kunde', 'Datum', 'Netto', 'USt.', 'Brutto', 'Status'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-slate-500 dark:text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-slate-100 dark:border-gray-800/50">
                      <td className="px-2 py-2 font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                      <td className="px-2 py-2 text-slate-600 dark:text-gray-400">{inv.clientName}</td>
                      <td className="px-2 py-2 text-slate-600 dark:text-gray-400">{inv.issueDate}</td>
                      <td className="px-2 py-2 text-slate-600 dark:text-gray-400">{formatCurrency(inv.netAmount, settings)}</td>
                      <td className="px-2 py-2 text-slate-600 dark:text-gray-400">{formatCurrency(inv.vatAmount, settings)}</td>
                      <td className="px-2 py-2 font-medium text-gray-900 dark:text-white">{formatCurrency(inv.grossAmount, settings)}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : inv.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        }`}>
                          {inv.status === 'paid' ? 'Bezahlt' : inv.status === 'cancelled' ? 'Storniert' : 'Offen'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
