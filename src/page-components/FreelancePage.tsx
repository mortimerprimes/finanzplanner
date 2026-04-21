import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFinance } from '@/lib/finance-context';
import { Button, Card, EmptyState, Input, Modal, ProgressBar, Select, StatCard, Toggle } from '../components/ui';
import {
  calculateFreelanceSessionExtraAmount as getSessionExtraNetAmount,
  calculateFreelanceSessionLaborAmount as getSessionLaborNetAmount,
  calculateFreelanceSessionNetAmount as calculateSessionNetAmount,
  calculateFreelanceSessionTravelAmount as getSessionTravelNetAmount,
  calculateWorkSessionHours as calculateSessionHours,
  formatCurrency,
  formatDate,
  getMonthDisplayName,
  isSaturday,
} from '../utils/helpers';
import type { FreelanceInvoice, FreelanceInvoiceStatus, FreelanceProject, WorkSession } from '../types';

type SessionDraft = {
  projectId: string;
  date: string;
  durationHours: string;
  description: string;
  billable: boolean;
  customHourlyRate: string;
  customSaturdaySurchargePercent: string;
  extraFlatFee: string;
};

type BulkSessionDraft = {
  projectId: string;
  month: string;
  durationHours: string;
  description: string;
  billable: boolean;
  customHourlyRate: string;
  customSaturdaySurchargePercent: string;
  extraFlatFee: string;
};

const toNumber = (value: string): number => Number.parseFloat(value) || 0;

const createDefaultSessionDraft = (selectedMonth: string, projectId = ''): SessionDraft => ({
  projectId,
  date: `${selectedMonth}-01`,
  durationHours: '1',
  description: '',
  billable: true,
  customHourlyRate: '',
  customSaturdaySurchargePercent: '',
  extraFlatFee: '',
});

const createDefaultBulkDraft = (selectedMonth: string, projectId = ''): BulkSessionDraft => ({
  projectId,
  month: selectedMonth,
  durationHours: '1',
  description: '',
  billable: true,
  customHourlyRate: '',
  customSaturdaySurchargePercent: '',
  extraFlatFee: '',
});

const getSessionHourlyDisplayRate = (session: WorkSession, project?: FreelanceProject): number => {
  if (!project) return 0;
  const baseRate = session.customHourlyRate ?? project.hourlyRate;
  const saturdayPercent = session.customSaturdaySurchargePercent ?? project.saturdaySurchargePercent ?? 0;
  const saturdayMultiplier = isSaturday(session.date) ? 1 + (saturdayPercent / 100) : 1;
  return baseRate * saturdayMultiplier;
};

export function FreelancePage() {
  const { state, dispatch } = useFinance();
  const { selectedMonth, freelanceProjects, workSessions, freelanceInvoices, invoiceProfile, settings } = state;
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState({
    name: '',
    clientName: '',
    clientAddress: '',
    hourlyRate: '',
    travelFlatFee: '',
    saturdaySurchargePercent: '',
    note: '',
  });
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(createDefaultSessionDraft(selectedMonth, freelanceProjects[0]?.id || ''));
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [invoiceProjectId, setInvoiceProjectId] = useState(freelanceProjects[0]?.id || '');
  const [invoiceMonth, setInvoiceMonth] = useState(selectedMonth);
  const [selectedInvoiceSessionIds, setSelectedInvoiceSessionIds] = useState<string[]>([]);
  const [bulkDraft, setBulkDraft] = useState<BulkSessionDraft>(createDefaultBulkDraft(selectedMonth, freelanceProjects[0]?.id || ''));
  const [bulkSelectedDates, setBulkSelectedDates] = useState<string[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sessionFilterProject, setSessionFilterProject] = useState<string>('all');
  const [sessionFilterStatus, setSessionFilterStatus] = useState<'all' | 'open' | 'invoiced'>('all');
  const [sessionFilterMonth, setSessionFilterMonth] = useState<string>('all');
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<'all' | 'issued' | 'paid' | 'cancelled'>('all');

  const projectOptions = freelanceProjects.map((project) => ({ value: project.id, label: `${project.name} · ${project.clientName}` }));

  const monthSessions = useMemo(
    () => workSessions.filter((session) => session.date.slice(0, 7) === selectedMonth),
    [workSessions, selectedMonth]
  );

  const monthBillableHours = useMemo(
    () => monthSessions.filter((session) => session.billable).reduce((sum, session) => sum + calculateSessionHours(session), 0),
    [monthSessions]
  );

  const monthRevenue = useMemo(() => {
    return monthSessions
      .filter((session) => session.billable)
      .reduce((sum, session) => {
        const project = freelanceProjects.find((item) => item.id === session.projectId);
        if (!project) return sum;
        return sum + calculateSessionNetAmount(session, project);
      }, 0);
  }, [monthSessions, freelanceProjects]);

  const uninvoicedSessions = useMemo(
    () => workSessions.filter((session) => session.billable && !session.invoiceId),
    [workSessions]
  );

  const unbilledRevenue = useMemo(() => {
    return uninvoicedSessions.reduce((sum, session) => {
      const project = freelanceProjects.find((item) => item.id === session.projectId);
      if (!project) return sum;
      return sum + calculateSessionNetAmount(session, project);
    }, 0);
  }, [uninvoicedSessions, freelanceProjects]);

  // Overdue invoices (issued but not paid, older than 30 days)
  const overdueInvoices = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return freelanceInvoices.filter(inv =>
      inv.status === 'issued' && new Date(inv.issueDate) < thirtyDaysAgo
    );
  }, [freelanceInvoices]);

  // Yearly earnings tracking
  const currentYear = selectedMonth.slice(0, 4);
  const yearlyEarnings = useMemo(() => {
    return freelanceInvoices
      .filter(inv => inv.issueDate.slice(0, 4) === currentYear && (inv.status === 'paid' || inv.status === 'issued'))
      .reduce((sum, inv) => sum + inv.netAmount, 0);
  }, [freelanceInvoices, currentYear]);

  const yearlyEarningsFromSessions = useMemo(() => {
    return workSessions
      .filter(s => s.date.slice(0, 4) === currentYear && s.billable)
      .reduce((sum, s) => {
        const project = freelanceProjects.find(p => p.id === s.projectId);
        return sum + calculateSessionNetAmount(s, project);
      }, 0);
  }, [workSessions, freelanceProjects, currentYear]);

  const freelanceYearlyLimit = settings.freelanceYearlyLimit || 0;
  const yearlyTotal = Math.max(yearlyEarnings, yearlyEarningsFromSessions);
  const yearlyLimitPercent = freelanceYearlyLimit > 0 ? (yearlyTotal / freelanceYearlyLimit) * 100 : 0;
  const isNearLimit = freelanceYearlyLimit > 0 && yearlyLimitPercent >= 80;
  const isOverLimit = freelanceYearlyLimit > 0 && yearlyTotal >= freelanceYearlyLimit;

  // All sessions filtered
  const filteredSessions = useMemo(() => {
    let sessions = [...workSessions].sort((a, b) => b.date.localeCompare(a.date));
    if (sessionFilterProject !== 'all') sessions = sessions.filter(s => s.projectId === sessionFilterProject);
    if (sessionFilterStatus === 'open') sessions = sessions.filter(s => !s.invoiceId);
    if (sessionFilterStatus === 'invoiced') sessions = sessions.filter(s => !!s.invoiceId);
    if (sessionFilterMonth !== 'all') sessions = sessions.filter(s => s.date.slice(0, 7) === sessionFilterMonth);
    return sessions;
  }, [workSessions, sessionFilterProject, sessionFilterStatus, sessionFilterMonth]);

  // Available months for filter
  const availableSessionMonths = useMemo(() => {
    const months = new Set(workSessions.map(s => s.date.slice(0, 7)));
    return [...months].sort().reverse();
  }, [workSessions]);

  // All invoices filtered
  const filteredInvoices = useMemo(() => {
    let invoices = [...freelanceInvoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    if (invoiceFilterStatus !== 'all') invoices = invoices.filter(inv => inv.status === invoiceFilterStatus);
    return invoices;
  }, [freelanceInvoices, invoiceFilterStatus]);

  // Effective hourly rate per project
  const projectProfitability = useMemo(() => {
    return freelanceProjects.map(project => {
      const sessions = workSessions.filter(s => s.projectId === project.id);
      const totalHours = sessions.reduce((s, sess) => s + calculateSessionHours(sess), 0);
      const totalEarned = freelanceInvoices
        .filter(inv => inv.projectId === project.id && (inv.status === 'paid' || inv.status === 'issued'))
        .reduce((s, inv) => s + inv.netAmount, 0);
      const effectiveRate = totalHours > 0 ? totalEarned / totalHours : project.hourlyRate;
      return { project, totalHours, totalEarned, effectiveRate };
    });
  }, [freelanceProjects, workSessions, freelanceInvoices]);

  const invoiceCandidates = useMemo(() => {
    if (!invoiceProjectId) return [];
    return workSessions.filter(
      (session) =>
        session.projectId === invoiceProjectId
        && session.billable
        && !session.invoiceId
        && session.date.slice(0, 7) === invoiceMonth
    );
  }, [workSessions, invoiceProjectId, invoiceMonth]);

  const selectedInvoiceSessions = useMemo(
    () => invoiceCandidates.filter((session) => selectedInvoiceSessionIds.includes(session.id)),
    [invoiceCandidates, selectedInvoiceSessionIds]
  );

  const bulkCalendarDays = useMemo(() => {
    const [year, month] = bulkDraft.month.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    return {
      leadingEmpty: firstWeekday,
      dates: Array.from({ length: daysInMonth }, (_, index) => `${bulkDraft.month}-${String(index + 1).padStart(2, '0')}`),
    };
  }, [bulkDraft.month]);

  const invoiceDraftTotals = useMemo(() => {
    const project = freelanceProjects.find((item) => item.id === invoiceProjectId);
    const hours = selectedInvoiceSessions.reduce((sum, session) => sum + calculateSessionHours(session), 0);
    const netAmount = selectedInvoiceSessions.reduce((sum, session) => sum + calculateSessionNetAmount(session, project), 0);
    const averageRate = hours > 0 ? netAmount / hours : (project?.hourlyRate || 0);
    const vatRate = invoiceProfile.useVat ? invoiceProfile.defaultVatRate : 0;
    const vatAmount = netAmount * (vatRate / 100);
    const grossAmount = netAmount + vatAmount;
    return { hours, averageRate, vatRate, netAmount, vatAmount, grossAmount };
  }, [freelanceProjects, invoiceProfile.defaultVatRate, invoiceProfile.useVat, invoiceProjectId, selectedInvoiceSessions]);

  const bulkForecast = useMemo(() => {
    const project = freelanceProjects.find((item) => item.id === bulkDraft.projectId);
    const templateSession: WorkSession = {
      id: 'bulk-preview',
      projectId: bulkDraft.projectId,
      date: bulkSelectedDates[0] || `${bulkDraft.month}-01`,
      startTime: '',
      endTime: '',
      durationHours: toNumber(bulkDraft.durationHours),
      breakMinutes: 0,
      description: bulkDraft.description || 'Einsatz',
      billable: bulkDraft.billable,
      applyTravelFlat: true,
      customHourlyRate: bulkDraft.customHourlyRate ? toNumber(bulkDraft.customHourlyRate) : undefined,
      customSaturdaySurchargePercent: bulkDraft.customSaturdaySurchargePercent ? toNumber(bulkDraft.customSaturdaySurchargePercent) : undefined,
      extraFlatFee: bulkDraft.extraFlatFee ? toNumber(bulkDraft.extraFlatFee) : undefined,
      createdAt: new Date().toISOString(),
    };
    const totalHours = bulkSelectedDates.length * (templateSession.durationHours || 0);
    const totalAmount = bulkSelectedDates.reduce((sum, date) => sum + calculateSessionNetAmount({ ...templateSession, date }, project), 0);
    return { totalHours, totalAmount };
  }, [bulkDraft, bulkSelectedDates, freelanceProjects]);

  const saveProject = () => {
    if (!projectDraft.name.trim() || !projectDraft.clientName.trim() || !projectDraft.hourlyRate) return;
    const payload = {
      name: projectDraft.name.trim(),
      clientName: projectDraft.clientName.trim(),
      clientAddress: projectDraft.clientAddress.trim() || undefined,
      hourlyRate: toNumber(projectDraft.hourlyRate),
      travelFlatFee: toNumber(projectDraft.travelFlatFee),
      saturdaySurchargePercent: toNumber(projectDraft.saturdaySurchargePercent),
      vatRate: invoiceProfile.defaultVatRate,
      isActive: true,
      note: projectDraft.note.trim() || undefined,
    };
    if (editingProjectId) {
      const existing = freelanceProjects.find((project) => project.id === editingProjectId);
      if (!existing) return;
      dispatch({ type: 'UPDATE_FREELANCE_PROJECT', payload: { ...existing, ...payload } });
    } else {
      dispatch({
        type: 'ADD_FREELANCE_PROJECT',
        payload,
      });
    }
    setProjectDraft({
      name: '',
      clientName: '',
      clientAddress: '',
      hourlyRate: '',
      travelFlatFee: '',
      saturdaySurchargePercent: '',
      note: '',
    });
    setEditingProjectId(null);
    setProjectModalOpen(false);
  };

  const saveSession = () => {
    if (!sessionDraft.projectId || !sessionDraft.date || !sessionDraft.description.trim() || !sessionDraft.durationHours) return;
    const durationHours = toNumber(sessionDraft.durationHours);
    if (durationHours <= 0) return;
    const payload = {
      projectId: sessionDraft.projectId,
      date: sessionDraft.date,
      startTime: '',
      endTime: '',
      durationHours,
      breakMinutes: 0,
      description: sessionDraft.description.trim(),
      billable: sessionDraft.billable,
      applyTravelFlat: true,
      customHourlyRate: sessionDraft.customHourlyRate ? toNumber(sessionDraft.customHourlyRate) : undefined,
      customSaturdaySurchargePercent: sessionDraft.customSaturdaySurchargePercent ? toNumber(sessionDraft.customSaturdaySurchargePercent) : undefined,
      extraFlatFee: sessionDraft.extraFlatFee ? toNumber(sessionDraft.extraFlatFee) : undefined,
    };

    if (editingSessionId) {
      const existing = workSessions.find((session) => session.id === editingSessionId);
      if (!existing) return;
      dispatch({
        type: 'UPDATE_WORK_SESSION',
        payload: {
          ...existing,
          ...payload,
        },
      });
    } else {
      dispatch({
        type: 'ADD_WORK_SESSION',
        payload,
      });
    }

    setSessionDraft(createDefaultSessionDraft(selectedMonth, sessionDraft.projectId));
    setEditingSessionId(null);
    setSessionModalOpen(false);
  };

  const openNewSessionModal = () => {
    setEditingSessionId(null);
    setSessionDraft(createDefaultSessionDraft(selectedMonth, freelanceProjects[0]?.id || ''));
    setSessionModalOpen(true);
  };

  const openNewProjectModal = () => {
    setEditingProjectId(null);
    setProjectDraft({
      name: '',
      clientName: '',
      clientAddress: '',
      hourlyRate: '',
      travelFlatFee: '',
      saturdaySurchargePercent: '',
      note: '',
    });
    setProjectModalOpen(true);
  };

  const openEditProjectModal = (project: FreelanceProject) => {
    setEditingProjectId(project.id);
    setProjectDraft({
      name: project.name,
      clientName: project.clientName,
      clientAddress: project.clientAddress || '',
      hourlyRate: String(project.hourlyRate),
      travelFlatFee: project.travelFlatFee != null ? String(project.travelFlatFee) : '',
      saturdaySurchargePercent: project.saturdaySurchargePercent != null ? String(project.saturdaySurchargePercent) : '',
      note: project.note || '',
    });
    setProjectModalOpen(true);
  };

  const openEditSessionModal = (session: WorkSession) => {
    setEditingSessionId(session.id);
    setSessionDraft({
      projectId: session.projectId,
      date: session.date,
      durationHours: String(calculateSessionHours(session)),
      description: session.description,
      billable: session.billable,
      customHourlyRate: session.customHourlyRate != null ? String(session.customHourlyRate) : '',
      customSaturdaySurchargePercent: session.customSaturdaySurchargePercent != null ? String(session.customSaturdaySurchargePercent) : '',
      extraFlatFee: session.extraFlatFee != null ? String(session.extraFlatFee) : '',
    });
    setSessionModalOpen(true);
  };

  const openInvoiceModal = () => {
    const nextProjectId = invoiceProjectId || freelanceProjects[0]?.id || '';
    const nextMonth = selectedMonth;
    setInvoiceProjectId(nextProjectId);
    setInvoiceMonth(nextMonth);
    setSelectedInvoiceSessionIds(
      workSessions
        .filter(
          (session) =>
            session.projectId === nextProjectId
            && session.billable
            && !session.invoiceId
            && session.date.slice(0, 7) === nextMonth
        )
        .map((session) => session.id)
    );
    setInvoiceModalOpen(true);
  };

  const openBulkModal = () => {
    setBulkDraft(createDefaultBulkDraft(selectedMonth, freelanceProjects[0]?.id || ''));
    setBulkSelectedDates([]);
    setBulkModalOpen(true);
  };

  const saveBulkSessions = () => {
    if (!bulkDraft.projectId || !bulkDraft.description.trim() || !bulkDraft.durationHours || bulkSelectedDates.length === 0) return;
    const durationHours = toNumber(bulkDraft.durationHours);
    if (durationHours <= 0) return;
    bulkSelectedDates
      .slice()
      .sort()
      .forEach((date) => {
        dispatch({
          type: 'ADD_WORK_SESSION',
          payload: {
            projectId: bulkDraft.projectId,
            date,
            startTime: '',
            endTime: '',
            durationHours,
            breakMinutes: 0,
            description: bulkDraft.description.trim(),
            billable: bulkDraft.billable,
            applyTravelFlat: true,
            customHourlyRate: bulkDraft.customHourlyRate ? toNumber(bulkDraft.customHourlyRate) : undefined,
            customSaturdaySurchargePercent: bulkDraft.customSaturdaySurchargePercent ? toNumber(bulkDraft.customSaturdaySurchargePercent) : undefined,
            extraFlatFee: bulkDraft.extraFlatFee ? toNumber(bulkDraft.extraFlatFee) : undefined,
          },
        });
      });
    setBulkModalOpen(false);
    setBulkSelectedDates([]);
  };

  const generateInvoicePdf = (invoice: FreelanceInvoice, sessions: WorkSession[], project?: FreelanceProject) => {
    const pdf = new jsPDF();
    const dueDate = new Date(invoice.issueDate);
    dueDate.setDate(dueDate.getDate() + invoiceProfile.paymentTermDays);
    pdf.setFontSize(16);
    pdf.text(`Rechnung ${invoice.invoiceNumber}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(`${invoiceProfile.fullName}${invoiceProfile.companyName ? ` · ${invoiceProfile.companyName}` : ''}`, 14, 30);
    pdf.text(invoiceProfile.address || '-', 14, 36);
    pdf.text(`E-Mail: ${invoiceProfile.email || '-'} · Tel: ${invoiceProfile.phone || '-'}`, 14, 42);
    pdf.text(`${invoiceProfile.useVat ? 'Steuernummer' : 'Steuerhinweis'}: ${invoiceProfile.useVat ? (invoiceProfile.taxId || '-') : 'USt-frei / Kleinunternehmer'}`, 14, 48);
    pdf.text(`IBAN: ${invoiceProfile.iban || '-'} · BIC: ${invoiceProfile.bic || '-'}`, 14, 54);
    pdf.text(`Kunde: ${invoice.clientName}`, 130, 30);
    pdf.text(invoice.clientAddress || '-', 130, 36);
    pdf.text(`Rechnungsdatum: ${formatDate(invoice.issueDate)}`, 130, 42);
    pdf.text(`Leistungsmonat: ${getMonthDisplayName(invoice.serviceMonth)}`, 130, 48);
    pdf.text(`Zahlbar bis: ${formatDate(dueDate)}`, 130, 54);
    autoTable(pdf, {
      startY: 66,
      head: [['Datum', 'Leistung', 'Stunden', 'Satz', 'Netto']],
      body: sessions.flatMap((session) => {
        const sessionHours = calculateSessionHours(session);
        const laborNet = getSessionLaborNetAmount(session, project);
        const travelNet = getSessionTravelNetAmount(session, project);
        const extraNet = getSessionExtraNetAmount(session);
        const rate = getSessionHourlyDisplayRate(session, project);
        const rows = [[
          formatDate(session.date),
          `${session.description}${isSaturday(session.date) ? ' (Samstag)' : ''}`,
          sessionHours.toFixed(2),
          formatCurrency(rate, settings),
          formatCurrency(laborNet, settings),
        ]];
        if (travelNet > 0) {
          rows.push([
            formatDate(session.date),
            'Anfahrtspauschale',
            '',
            '',
            formatCurrency(travelNet, settings),
          ]);
        }
        if (extraNet > 0) {
          rows.push([
            formatDate(session.date),
            'Zusatzpauschale',
            '',
            '',
            formatCurrency(extraNet, settings),
          ]);
        }
        return rows;
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    const finalY = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120;
    pdf.setFontSize(11);
    pdf.text(`Netto: ${formatCurrency(invoice.netAmount, settings)}`, 140, finalY + 12);
    if (invoice.vatRate > 0) {
      pdf.text(`USt ${invoice.vatRate}%: ${formatCurrency(invoice.vatAmount, settings)}`, 140, finalY + 19);
      pdf.setFontSize(13);
      pdf.text(`Gesamt: ${formatCurrency(invoice.grossAmount, settings)}`, 140, finalY + 30);
    } else {
      pdf.text(`Keine Umsatzsteuer`, 140, finalY + 19);
      pdf.setFontSize(13);
      pdf.text(`Gesamt: ${formatCurrency(invoice.grossAmount, settings)}`, 140, finalY + 30);
    }
    if (invoiceProfile.note?.trim()) {
      pdf.setFontSize(10);
      pdf.text(invoiceProfile.note, 14, finalY + 40, { maxWidth: 180 });
    }
    const safeProjectName = project?.name?.replace(/[^a-z0-9-_]+/gi, '-') || 'freelance';
    pdf.save(`rechnung-${invoice.invoiceNumber}-${safeProjectName}.pdf`);
  };

  const createInvoice = () => {
    const project = freelanceProjects.find((item) => item.id === invoiceProjectId);
    if (!project || selectedInvoiceSessions.length === 0) return;
    const issueDate = new Date().toISOString().slice(0, 10);
    const invoiceNumber = `${invoiceProfile.invoicePrefix}-${new Date().getFullYear()}-${String(invoiceProfile.nextInvoiceNumber).padStart(4, '0')}`;
    const invoicePayload = {
      projectId: project.id,
      invoiceNumber,
      issueDate,
      serviceMonth: invoiceMonth,
      clientName: project.clientName,
      clientAddress: project.clientAddress,
      sessionIds: selectedInvoiceSessions.map((session) => session.id),
      hours: Number(invoiceDraftTotals.hours.toFixed(2)),
      hourlyRate: Number(invoiceDraftTotals.averageRate.toFixed(2)),
      netAmount: Number(invoiceDraftTotals.netAmount.toFixed(2)),
      vatRate: invoiceProfile.useVat ? invoiceProfile.defaultVatRate : 0,
      vatAmount: Number(invoiceDraftTotals.vatAmount.toFixed(2)),
      grossAmount: Number(invoiceDraftTotals.grossAmount.toFixed(2)),
      status: 'issued' as FreelanceInvoiceStatus,
    };
    dispatch({ type: 'CREATE_FREELANCE_INVOICE', payload: invoicePayload });
    const previewInvoice: FreelanceInvoice = {
      id: `preview-${invoiceNumber}`,
      createdAt: issueDate,
      ...invoicePayload,
    };
    generateInvoicePdf(previewInvoice, selectedInvoiceSessions, project);
    setInvoiceModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Freelance & Rechnungen</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">Stunden tracken, Monatsumsatz sehen und Rechnungen automatisch erzeugen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setProfileOpen(true)} icon="UserSquare2">Rechnungsprofil</Button>
          <Button onClick={openNewProjectModal} icon="FolderPlus">Projekt</Button>
          <Button onClick={openNewSessionModal} icon="Clock3">Stunde</Button>
          <Button variant="secondary" onClick={openBulkModal} icon="CalendarDays">Mehrere Tage</Button>
          <Button onClick={openInvoiceModal} icon="FileText">Rechnung</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Stunden (Monat)" value={`${monthBillableHours.toFixed(2)} h`} icon="Clock3" iconColor="#3b82f6" iconBg="bg-blue-50 dark:bg-blue-950/40" />
        <StatCard title="Umsatz (Monat)" value={formatCurrency(monthRevenue, settings)} icon="TrendingUp" iconColor="#10b981" iconBg="bg-emerald-50 dark:bg-emerald-950/40" />
        <StatCard title="Offen fakturierbar" value={formatCurrency(unbilledRevenue, settings)} icon="Wallet" iconColor="#f59e0b" iconBg="bg-amber-50 dark:bg-amber-950/40" />
        <StatCard title="Rechnungen gesamt" value={String(freelanceInvoices.length)} icon="ReceiptText" iconColor="#8b5cf6" iconBg="bg-violet-50 dark:bg-violet-950/40" />
      </div>

      {/* Overdue invoice warnings */}
      {overdueInvoices.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
          <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-2">⚠ Überfällige Rechnungen ({overdueInvoices.length})</h3>
          <div className="space-y-2">
            {overdueInvoices.map(inv => {
              const project = freelanceProjects.find(p => p.id === inv.projectId);
              const daysSince = Math.floor((Date.now() - new Date(inv.issueDate).getTime()) / 86400000);
              return (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="text-red-600 dark:text-red-300">{inv.invoiceNumber} · {project?.clientName || 'Unbekannt'}</span>
                  <span className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(inv.grossAmount, settings)} · {daysSince} Tage</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Project profitability */}
      {projectProfitability.length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Projekt-Profitabilität</h3>
          <div className="space-y-2">
            {projectProfitability.map(({ project, totalHours, totalEarned, effectiveRate }) => (
              <div key={project.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{project.name}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">{totalHours.toFixed(1)}h · {formatCurrency(totalEarned, settings)} Umsatz</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${effectiveRate >= project.hourlyRate ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(effectiveRate, settings)}/h
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">Soll: {formatCurrency(project.hourlyRate, settings)}/h</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Projekte</h3>
          <span className="text-xs font-medium text-slate-500 dark:text-gray-500">{freelanceProjects.length} aktiv</span>
        </div>
        {freelanceProjects.length > 0 ? (
          <div className="space-y-3">
            {freelanceProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{project.name}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">
                    {project.clientName} · {formatCurrency(project.hourlyRate, settings)}/h
                    {project.travelFlatFee ? ` · Anfahrt ${formatCurrency(project.travelFlatFee, settings)}` : ''}
                    {project.saturdaySurchargePercent ? ` · Samstag +${project.saturdaySurchargePercent}%` : ''}
                  </p>
                </div>
                <button
                  onClick={() => openEditProjectModal(project)}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Bearbeiten
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="Folder" title="Noch keine Projekte" description="Lege dein erstes Projekt an, damit Stundenerfassung und Rechnungen sofort funktionieren." action={{ label: 'Projekt anlegen', onClick: openNewProjectModal }} />
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Offen fakturierbare Projekte</h3>
        {freelanceProjects.length === 0 ? (
          <EmptyState icon="Folder" title="Noch keine Projekte" description="Lege zuerst ein Projekt an, dann kannst du Stunden erfassen." action={{ label: 'Projekt anlegen', onClick: openNewProjectModal }} />
        ) : (
          <div className="space-y-3">
            {freelanceProjects.map((project) => {
              const projectSessions = uninvoicedSessions.filter((session) => session.projectId === project.id);
              const value = projectSessions.reduce((sum, session) => sum + calculateSessionNetAmount(session, project), 0);
              const goal = Math.max(project.hourlyRate * 20, value || 1);
              return (
                <div key={project.id} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        {project.clientName} · {formatCurrency(project.hourlyRate, settings)}/h
                        {project.travelFlatFee ? ` · Anfahrt ${formatCurrency(project.travelFlatFee, settings)}` : ''}
                        {project.saturdaySurchargePercent ? ` · Sa +${project.saturdaySurchargePercent}%` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(value, settings)}</p>
                  </div>
                  <ProgressBar value={value} max={goal} color="#3b82f6" size="md" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Yearly Earnings Limit Warning */}
      {freelanceYearlyLimit > 0 && (
        <Card className={`p-5 ${isOverLimit ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20' : isNearLimit ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20' : ''}`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className={`text-sm font-bold ${isOverLimit ? 'text-red-700 dark:text-red-400' : isNearLimit ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {isOverLimit ? '🚨 Jahresgrenze überschritten!' : isNearLimit ? '⚠ Achtung: Jahresgrenze nähert sich!' : `📊 Jahresumsatz ${currentYear}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                {isOverLimit
                  ? `Du hast die Grenze von ${formatCurrency(freelanceYearlyLimit, settings)} überschritten! Achtung: Steuerpflicht!`
                  : isNearLimit
                    ? `Noch ${formatCurrency(freelanceYearlyLimit - yearlyTotal, settings)} bis zur Grenze von ${formatCurrency(freelanceYearlyLimit, settings)}`
                    : `Grenze: ${formatCurrency(freelanceYearlyLimit, settings)} · Noch ${formatCurrency(freelanceYearlyLimit - yearlyTotal, settings)} verfügbar`
                }
              </p>
            </div>
            <p className={`text-lg font-bold ${isOverLimit ? 'text-red-700 dark:text-red-400' : isNearLimit ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
              {formatCurrency(yearlyTotal, settings)}
            </p>
          </div>
          <ProgressBar value={Math.min(yearlyTotal, freelanceYearlyLimit)} max={freelanceYearlyLimit} color={isOverLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : '#10b981'} size="md" />
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 text-right">{yearlyLimitPercent.toFixed(1)}% ausgeschöpft</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ALL Work Sessions - Scrollable & Filterable */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Alle Zeiteinträge</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-gray-500">
              {filteredSessions.length} von {workSessions.length} Einträgen
            </span>
          </div>
          {/* Filters */}
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              value={sessionFilterProject}
              onChange={(e) => setSessionFilterProject(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">Alle Projekte</option>
              {freelanceProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={sessionFilterStatus}
              onChange={(e) => setSessionFilterStatus(e.target.value as 'all' | 'open' | 'invoiced')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">Alle Status</option>
              <option value="open">Offen</option>
              <option value="invoiced">Fakturiert</option>
            </select>
            <select
              value={sessionFilterMonth}
              onChange={(e) => setSessionFilterMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">Alle Monate</option>
              {availableSessionMonths.map(m => <option key={m} value={m}>{getMonthDisplayName(m)}</option>)}
            </select>
          </div>
          {workSessions.length === 0 ? (
            <EmptyState icon="Clock3" title="Keine Stunden erfasst" description="Trage deine Arbeitszeiten ein, damit Umsatz und Rechnung automatisch berechnet werden." />
          ) : filteredSessions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-gray-500 py-4 text-center">Keine Einträge für diese Filter.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredSessions.map((session) => {
                const project = freelanceProjects.find((item) => item.id === session.projectId);
                const hours = calculateSessionHours(session);
                const netAmount = calculateSessionNetAmount(session, project);
                return (
                  <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{session.description}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        {formatDate(session.date)} · {project?.name || 'Projekt'} · {hours.toFixed(2)} h
                        {project?.travelFlatFee ? ' · Anfahrt' : ''}
                        {isSaturday(session.date) ? ' · Samstag' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!session.invoiceId && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditSessionModal(session)}
                            className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Diesen Zeiteintrag löschen?')) {
                                dispatch({ type: 'DELETE_WORK_SESSION', payload: session.id });
                              }
                            }}
                            className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300"
                          >
                            Löschen
                          </button>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{hours.toFixed(2)} h</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">{formatCurrency(netAmount, settings)}</p>
                        <p className={`text-xs ${session.invoiceId ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{session.invoiceId ? 'Fakturiert' : 'Offen'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ALL Invoices - Scrollable & Filterable */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Rechnungen</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-gray-500">
              {filteredInvoices.length} von {freelanceInvoices.length}
            </span>
          </div>
          {/* Filter */}
          <div className="mb-3">
            <select
              value={invoiceFilterStatus}
              onChange={(e) => setInvoiceFilterStatus(e.target.value as 'all' | 'issued' | 'paid' | 'cancelled')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">Alle Status</option>
              <option value="issued">Offen</option>
              <option value="paid">Bezahlt</option>
              <option value="cancelled">Storniert</option>
            </select>
          </div>
          {freelanceInvoices.length === 0 ? (
            <EmptyState icon="FileText" title="Noch keine Rechnungen" description="Mit einem Klick erzeugst du eine Rechnung aus allen offenen Stunden eines Monats." />
          ) : filteredInvoices.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-gray-500 py-4 text-center">Keine Rechnungen für diesen Filter.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredInvoices.map((invoice) => {
                const project = freelanceProjects.find((item) => item.id === invoice.projectId);
                const sessions = workSessions.filter((session) => invoice.sessionIds.includes(session.id));
                return (
                  <div key={invoice.id} className="rounded-xl border border-slate-200 p-3 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">{project?.name || 'Projekt'} · {getMonthDisplayName(invoice.serviceMonth)} · {invoice.hours.toFixed(2)} h</p>
                        <p className="text-xs text-slate-400 dark:text-gray-500">Erstellt am {formatDate(invoice.issueDate)}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(invoice.grossAmount, settings)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs font-medium ${invoice.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : invoice.status === 'cancelled' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {invoice.status === 'paid' ? 'Bezahlt' : invoice.status === 'cancelled' ? 'Storniert' : 'Offen'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => generateInvoicePdf(invoice, sessions, project)}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          PDF
                        </button>
                        {invoice.status !== 'paid' && (
                          <button
                            onClick={() => dispatch({ type: 'UPDATE_FREELANCE_INVOICE', payload: { ...invoice, status: 'paid', paidDate: new Date().toISOString().slice(0, 10) } })}
                            className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            Als bezahlt
                          </button>
                        )}
                        {invoice.status === 'issued' && (
                          <button
                            onClick={() => {
                              if (confirm('Fakturierung rückgängig machen? Die Stunden werden wieder offen.')) {
                                dispatch({ type: 'DELETE_FREELANCE_INVOICE', payload: invoice.id });
                              }
                            }}
                            className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            Rückgängig
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={projectModalOpen} onClose={() => {
        setProjectModalOpen(false);
        setEditingProjectId(null);
      }} title={editingProjectId ? 'Freelance-Projekt bearbeiten' : 'Freelance-Projekt anlegen'}>
        <div className="space-y-3">
          <Input label="Projektname" value={projectDraft.name} onChange={(value) => setProjectDraft((prev) => ({ ...prev, name: value }))} placeholder="z.B. Website Betreuung" />
          <Input label="Kunde" value={projectDraft.clientName} onChange={(value) => setProjectDraft((prev) => ({ ...prev, clientName: value }))} placeholder="z.B. Muster GmbH" />
          <Input label="Kundenadresse" value={projectDraft.clientAddress} onChange={(value) => setProjectDraft((prev) => ({ ...prev, clientAddress: value }))} placeholder="Straße, PLZ Ort" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Stundensatz" type="number" value={projectDraft.hourlyRate} onChange={(value) => setProjectDraft((prev) => ({ ...prev, hourlyRate: value }))} />
            <Input label="Anfahrtspauschale" type="number" value={projectDraft.travelFlatFee} onChange={(value) => setProjectDraft((prev) => ({ ...prev, travelFlatFee: value }))} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Samstag-Zuschlag (%)" type="number" value={projectDraft.saturdaySurchargePercent} onChange={(value) => setProjectDraft((prev) => ({ ...prev, saturdaySurchargePercent: value }))} />
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-gray-800/60 dark:text-gray-300">
              Anfahrt wird bei Projekten mit Pauschale automatisch auf jeden Einsatz angewendet.
            </div>
          </div>
          <Input label="Notiz" value={projectDraft.note} onChange={(value) => setProjectDraft((prev) => ({ ...prev, note: value }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => {
              setProjectModalOpen(false);
              setEditingProjectId(null);
            }} className="flex-1">Abbrechen</Button>
            <Button onClick={saveProject} className="flex-1">{editingProjectId ? 'Änderungen speichern' : 'Speichern'}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={sessionModalOpen}
        onClose={() => {
          setSessionModalOpen(false);
          setEditingSessionId(null);
        }}
        title={editingSessionId ? 'Stundeneintrag bearbeiten' : 'Stundeneintrag erfassen'}
      >
        <div className="space-y-3">
          <Select label="Projekt" value={sessionDraft.projectId} onChange={(value) => setSessionDraft((prev) => ({ ...prev, projectId: value }))} options={projectOptions} />
          <Input label="Datum" type="date" value={sessionDraft.date} onChange={(value) => setSessionDraft((prev) => ({ ...prev, date: value }))} />
          <Input label="Arbeitsdauer (Stunden)" type="number" value={sessionDraft.durationHours} onChange={(value) => setSessionDraft((prev) => ({ ...prev, durationHours: value }))} placeholder="z.B. 2 oder 2.5" />
          <Input label="Leistungsbeschreibung" value={sessionDraft.description} onChange={(value) => setSessionDraft((prev) => ({ ...prev, description: value }))} placeholder="z.B. Feature-Entwicklung, Abstimmung, Bugfix" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Satz Override (optional)" type="number" value={sessionDraft.customHourlyRate} onChange={(value) => setSessionDraft((prev) => ({ ...prev, customHourlyRate: value }))} />
            <Input label="Sa-Zuschlag Override (%)" type="number" value={sessionDraft.customSaturdaySurchargePercent} onChange={(value) => setSessionDraft((prev) => ({ ...prev, customSaturdaySurchargePercent: value }))} />
            <Input label="Zusatzpauschale" type="number" value={sessionDraft.extraFlatFee} onChange={(value) => setSessionDraft((prev) => ({ ...prev, extraFlatFee: value }))} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-gray-800/60">
            <p className="text-sm text-gray-900 dark:text-white">Abrechenbar</p>
            <Toggle checked={sessionDraft.billable} onChange={(value) => setSessionDraft((prev) => ({ ...prev, billable: value }))} ariaLabel="Abrechenbar" />
          </div>
          <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
            Wenn im Projekt eine Anfahrtspauschale hinterlegt ist, wird sie automatisch mitgerechnet. Beispiel: **2 h bei 30 €/h + 10 € Anfahrt = 70 € netto**.
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => {
              setSessionModalOpen(false);
              setEditingSessionId(null);
            }} className="flex-1">Abbrechen</Button>
            <Button onClick={saveSession} className="flex-1">{editingSessionId ? 'Änderungen speichern' : 'Speichern'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Mehrere Tage planen">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Projekt" value={bulkDraft.projectId} onChange={(value) => setBulkDraft((prev) => ({ ...prev, projectId: value }))} options={projectOptions} />
            <Input label="Monat" type="month" value={bulkDraft.month} onChange={(value) => {
              setBulkDraft((prev) => ({ ...prev, month: value }));
              setBulkSelectedDates([]);
            }} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Stunden pro Tag" type="number" value={bulkDraft.durationHours} onChange={(value) => setBulkDraft((prev) => ({ ...prev, durationHours: value }))} placeholder="z.B. 2" />
            <Input label="Beschreibung" value={bulkDraft.description} onChange={(value) => setBulkDraft((prev) => ({ ...prev, description: value }))} placeholder="z.B. Coaching, Vor-Ort Termin" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Satz Override" type="number" value={bulkDraft.customHourlyRate} onChange={(value) => setBulkDraft((prev) => ({ ...prev, customHourlyRate: value }))} />
            <Input label="Sa-Zuschlag Override (%)" type="number" value={bulkDraft.customSaturdaySurchargePercent} onChange={(value) => setBulkDraft((prev) => ({ ...prev, customSaturdaySurchargePercent: value }))} />
            <Input label="Zusatzpauschale" type="number" value={bulkDraft.extraFlatFee} onChange={(value) => setBulkDraft((prev) => ({ ...prev, extraFlatFee: value }))} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-gray-800/60">
            <div>
              <p className="text-sm text-gray-900 dark:text-white">Abrechenbar</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Perfekt für Planung und Forecast über mehrere Tage.</p>
            </div>
            <Toggle checked={bulkDraft.billable} onChange={(value) => setBulkDraft((prev) => ({ ...prev, billable: value }))} ariaLabel="Bulk abrechenbar" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{getMonthDisplayName(bulkDraft.month)}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-gray-500">{bulkSelectedDates.length} Tage ausgewählt</p>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-gray-500">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: bulkCalendarDays.leadingEmpty }).map((_, index) => (
                <div key={`empty-${index}`} />
              ))}
              {bulkCalendarDays.dates.map((date) => {
                const active = bulkSelectedDates.includes(date);
                const saturday = isSaturday(date);
                return (
                  <button
                    key={date}
                    onClick={() => setBulkSelectedDates((prev) => prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date])}
                    className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : saturday
                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300'
                          : 'border-slate-200 bg-slate-50 text-gray-900 dark:border-gray-800 dark:bg-gray-800/50 dark:text-white'
                    }`}
                  >
                    {date.slice(-2)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Forecast</p>
            <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-gray-400">
              <p>Geplante Tage: {bulkSelectedDates.length}</p>
              <p>Geplante Stunden: {bulkForecast.totalHours.toFixed(2)} h</p>
              <p className="font-semibold text-gray-900 dark:text-white">Geplanter Umsatz: {formatCurrency(bulkForecast.totalAmount, settings)}</p>
            </div>
          </div>

          {bulkSelectedDates.length > 0 && (
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              Ausgewählt: {bulkSelectedDates.slice().sort().map((date) => formatDate(date)).join(', ')}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setBulkModalOpen(false)} className="flex-1">Abbrechen</Button>
            <Button onClick={saveBulkSessions} className="flex-1" disabled={bulkSelectedDates.length === 0}>Mehrere Tage speichern</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title="Rechnung automatisch erstellen">
        <div className="space-y-3">
          <Select
            label="Projekt"
            value={invoiceProjectId}
            onChange={(value) => {
              setInvoiceProjectId(value);
              setSelectedInvoiceSessionIds(
                workSessions
                  .filter(
                    (session) =>
                      session.projectId === value
                      && session.billable
                      && !session.invoiceId
                      && session.date.slice(0, 7) === invoiceMonth
                  )
                  .map((session) => session.id)
              );
            }}
            options={projectOptions}
          />
          <Input
            label="Leistungsmonat"
            type="month"
            value={invoiceMonth}
            onChange={(value) => {
              setInvoiceMonth(value);
              setSelectedInvoiceSessionIds(
                workSessions
                  .filter(
                    (session) =>
                      session.projectId === invoiceProjectId
                      && session.billable
                      && !session.invoiceId
                      && session.date.slice(0, 7) === value
                  )
                  .map((session) => session.id)
              );
            }}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Stunden auswählen</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedInvoiceSessionIds(invoiceCandidates.map((session) => session.id))}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Alle
                </button>
                <button
                  onClick={() => setSelectedInvoiceSessionIds([])}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Keine
                </button>
              </div>
            </div>
            {invoiceCandidates.length > 0 ? (
              <div className="space-y-2">
                {invoiceCandidates.map((session) => {
                  const project = freelanceProjects.find((item) => item.id === session.projectId);
                  const checked = selectedInvoiceSessionIds.includes(session.id);
                  return (
                    <label key={session.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedInvoiceSessionIds((prev) =>
                            event.target.checked
                              ? [...prev, session.id]
                              : prev.filter((id) => id !== session.id)
                          );
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{session.description}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">
                          {formatDate(session.date)} · {project?.name || 'Projekt'} · {calculateSessionHours(session).toFixed(2)} h
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(calculateSessionNetAmount(session, project), settings)}
                      </p>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-gray-500">Keine offenen Stunden für diese Auswahl.</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Vorschau</p>
            <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-gray-400">
              <p>Stunden: {invoiceDraftTotals.hours.toFixed(2)} h</p>
              <p>Ø Satz effektiv: {formatCurrency(invoiceDraftTotals.averageRate, settings)}/h</p>
              <p>Netto: {formatCurrency(invoiceDraftTotals.netAmount, settings)}</p>
              {invoiceProfile.useVat ? (
                <p>USt {invoiceDraftTotals.vatRate}%: {formatCurrency(invoiceDraftTotals.vatAmount, settings)}</p>
              ) : (
                <p>Keine Umsatzsteuer</p>
              )}
              <p className="font-semibold text-gray-900 dark:text-white">Gesamt: {formatCurrency(invoiceDraftTotals.grossAmount, settings)}</p>
              <p>Positionen: {selectedInvoiceSessions.length}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setInvoiceModalOpen(false)} className="flex-1">Abbrechen</Button>
            <Button onClick={createInvoice} className="flex-1" disabled={selectedInvoiceSessions.length === 0}>Rechnung erzeugen</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={profileOpen} onClose={() => setProfileOpen(false)} title="Rechnungsprofil">
        <div className="space-y-3">
          <Input label="Name" value={invoiceProfile.fullName} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { fullName: value } })} />
          <Input label="Firma (optional)" value={invoiceProfile.companyName} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { companyName: value } })} />
          <Input label="Adresse" value={invoiceProfile.address} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { address: value } })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="E-Mail" value={invoiceProfile.email} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { email: value } })} />
            <Input label="Telefon" value={invoiceProfile.phone} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { phone: value } })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Steuernummer" value={invoiceProfile.taxId} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { taxId: value } })} />
            <Input label="Ort" value={invoiceProfile.place} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { place: value } })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="IBAN" value={invoiceProfile.iban} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { iban: value } })} />
            <Input label="BIC" value={invoiceProfile.bic} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { bic: value } })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Prefix" value={invoiceProfile.invoicePrefix} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { invoicePrefix: value } })} />
            <Input label="Nächste Nummer" type="number" value={invoiceProfile.nextInvoiceNumber} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { nextInvoiceNumber: Number.parseInt(value || '1', 10) || 1 } })} />
            <Input label="Zahlungsziel (Tage)" type="number" value={invoiceProfile.paymentTermDays} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { paymentTermDays: Number.parseInt(value || '14', 10) || 14 } })} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-gray-800/60">
            <div>
              <p className="text-sm text-gray-900 dark:text-white">Umsatzsteuer berechnen</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Für Kleinunternehmer kannst du USt komplett deaktivieren.</p>
            </div>
            <Toggle checked={invoiceProfile.useVat} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { useVat: value } })} ariaLabel="Umsatzsteuer berechnen" />
          </div>
          {invoiceProfile.useVat && (
            <Input label="Standard-USt (%)" type="number" value={invoiceProfile.defaultVatRate} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { defaultVatRate: Number.parseFloat(value || '20') || 20 } })} />
          )}
          <Input label="Fußnote auf Rechnung" value={invoiceProfile.note || ''} onChange={(value) => dispatch({ type: 'UPDATE_INVOICE_PROFILE', payload: { note: value } })} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setProfileOpen(false)} className="flex-1">Schließen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
