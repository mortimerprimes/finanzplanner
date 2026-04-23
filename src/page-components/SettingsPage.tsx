'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Check, Download, Eye, EyeOff, LoaderCircle, Menu, Mic, PlugZap, ReceiptText, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFinance } from '@/lib/finance-context';
import { useTheme } from '../hooks/useTheme';
import { Badge, Button, Card, Icon, Input, Select, Toggle } from '../components/ui';
import { HelpTooltip } from '../components/HelpTooltip';
import { AI_ENDPOINT_PRESETS, AI_PROVIDER_DEFAULTS, AI_PROVIDER_OPTIONS, CURRENCIES, DASHBOARD_WIDGET_OPTIONS, DEFAULT_SETTINGS, UI_COLORS } from '../utils/constants';
import { fetchAvailableModels, testAIConnection } from '../services/ai';
import {
  calculateMonthSummary,
  convertRowsToCsv,
  downloadTextFile,
  formatCurrency,
  formatDate,
  getExpenseCategoryInfo,
  getPreviousMonths,
} from '../utils/helpers';
import type { FinanceState, Settings } from '../types';

const iconOptions = [
  'UtensilsCrossed',
  'ShoppingBasket',
  'Car',
  'PartyPopper',
  'ShoppingBag',
  'Heart',
  'GraduationCap',
  'Gift',
  'Home',
  'User',
  'Briefcase',
  'ReceiptText',
  'Tv',
  'Users',
  'PawPrint',
  'Gamepad2',
  'Plane',
];

const suggestedCategoryTemplates = [
  { label: 'Post & Versand', icon: 'Package', color: '#3b82f6' },
  { label: 'Versicherungen', icon: 'Shield', color: '#10b981' },
  { label: 'Auto-Werkstatt', icon: 'Wrench', color: '#f59e0b' },
  { label: 'Streaming', icon: 'MonitorPlay', color: '#8b5cf6' },
  { label: 'Kleidung', icon: 'Shirt', color: '#ec4899' },
  { label: 'Beauty & Pflege', icon: 'Sparkles', color: '#f97316' },
] as const;

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  );
}

export function SettingsPage() {
  const { state, dispatch } = useFinance();
  const { settings, selectedMonth } = state;
  const { theme, setTheme } = useTheme();
  const [showSuccess, setShowSuccess] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customIcon, setCustomIcon] = useState(iconOptions[0]);
  const [customColor, setCustomColor] = useState(UI_COLORS[0]);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; label: string }>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [aiStatus, setAIStatus] = useState('');
  const [aiStatusTone, setAIStatusTone] = useState<'success' | 'error'>('success');
  const [aiTesting, setAITesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'basics' | 'workspace' | 'automation' | 'data'>('basics');
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  const flash = (message: string) => {
    setShowSuccess(message);
    window.setTimeout(() => setShowSuccess(''), 2500);
  };

  useEffect(() => {
    const refreshNotificationPermission = () => {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        setBrowserNotificationPermission('unsupported');
        return;
      }

      setBrowserNotificationPermission(Notification.permission);
    };

    refreshNotificationPermission();
    window.addEventListener('focus', refreshNotificationPermission);
    return () => window.removeEventListener('focus', refreshNotificationPermission);
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
  };

  const updateNotification = (key: keyof Settings['notifications'], value: boolean) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        notifications: {
          ...settings.notifications,
          [key]: value,
        },
      },
    });
  };

  const requestSystemNotificationPermission = async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      flash('Dieser Browser unterstuetzt keine System-Benachrichtigungen.');
      setBrowserNotificationPermission('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setBrowserNotificationPermission('denied');
      flash('Benachrichtigungen sind blockiert. Aktiviere sie bitte in den Browser- oder Systemeinstellungen.');
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserNotificationPermission(permission);

    if (permission === 'granted') {
      flash('System-Benachrichtigungen wurden aktiviert.');
      return;
    }

    flash('System-Benachrichtigungen wurden nicht freigegeben.');
  };

  const sendSystemNotificationTest = () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      flash('Dieser Browser unterstuetzt keine System-Benachrichtigungen.');
      return;
    }

    if (Notification.permission !== 'granted') {
      flash('Bitte erteile zuerst die Berechtigung fuer System-Benachrichtigungen.');
      return;
    }

    const notification = new Notification('Finanzplanner', {
      body: 'System-Benachrichtigungen sind aktiv. Der Monatsbericht meldet sich zum Monatswechsel automatisch.',
      icon: '/icons/icon-192.svg',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    flash('Test-Benachrichtigung gesendet.');
  };

  const updateAISetting = useCallback(<K extends keyof Settings['ai']>(key: K, value: Settings['ai'][K]) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        ai: {
          ...settings.ai,
          [key]: value,
        },
      },
    });
  }, [dispatch, settings.ai]);

  const updateAISettings = useCallback((nextAI: Partial<Settings['ai']>) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        ai: {
          ...settings.ai,
          ...nextAI,
        },
      },
    });
  }, [dispatch, settings.ai]);

  const aiEndpointPresets = useMemo(() => {
    if (settings.ai.provider === 'gemini') return AI_ENDPOINT_PRESETS.gemini;
    if (settings.ai.provider === 'openrouter') return AI_ENDPOINT_PRESETS.openrouter;
    if (settings.ai.provider === 'openai-compatible') return AI_ENDPOINT_PRESETS['openai-compatible'];
    return [];
  }, [settings.ai.provider]);

  useEffect(() => {
    setAIStatus('');
    setAvailableModels([]);

    const provider = settings.ai.provider;
    if (!settings.ai.enabled || provider === 'disabled' || settings.ai.apiKey.trim().length < 10) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void loadModels();
    }, 350);

    const loadModels = async () => {
      setModelsLoading(true);
      try {
        const models = await fetchAvailableModels({
          provider,
          model: settings.ai.model,
          apiKey: settings.ai.apiKey,
          endpoint: settings.ai.endpoint,
        });

        if (!cancelled) {
          setAvailableModels(models);
          if (models.length > 0 && !models.some((item) => item.id === settings.ai.model)) {
            updateAISetting('model', models[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAIStatus(error instanceof Error ? error.message : 'Modelle konnten nicht geladen werden.');
          setAIStatusTone('error');
        }
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    };

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [settings.ai.apiKey, settings.ai.enabled, settings.ai.endpoint, settings.ai.model, settings.ai.provider, updateAISetting]);

  const applyProviderDefaults = (provider: Settings['ai']['provider']) => {
    if (provider === 'disabled') {
      updateAISettings({
        provider,
        enabled: false,
        endpoint: '',
        model: '',
      });
      return;
    }

    const defaults = AI_PROVIDER_DEFAULTS[provider];
    updateAISettings({
      provider,
      enabled: true,
      endpoint: defaults.endpoint,
      model: defaults.model,
    });
  };

  const reloadModels = async () => {
    if (!settings.ai.apiKey || settings.ai.provider === 'disabled') {
      setAIStatus('Bitte zuerst Provider und API-Key eintragen.');
      setAIStatusTone('error');
      return;
    }

    setAIStatus('');
    setModelsLoading(true);
    try {
      const models = await fetchAvailableModels({
        provider: settings.ai.provider,
        model: settings.ai.model,
        apiKey: settings.ai.apiKey,
        endpoint: settings.ai.endpoint,
      });
      setAvailableModels(models);
      setAIStatus(models.length > 0 ? `${models.length} Modelle geladen.` : 'Keine Modelle gefunden.');
      setAIStatusTone('success');
      if (models.length > 0 && !models.some((item) => item.id === settings.ai.model)) {
        updateAISetting('model', models[0].id);
      }
    } catch (error) {
      setAIStatus(error instanceof Error ? error.message : 'Modelle konnten nicht geladen werden.');
      setAIStatusTone('error');
    } finally {
      setModelsLoading(false);
    }
  };

  const runConnectionTest = async () => {
    setAIStatus('');
    setAITesting(true);
    try {
      const message = await testAIConnection({
        provider: settings.ai.provider,
        model: settings.ai.model,
        apiKey: settings.ai.apiKey,
        endpoint: settings.ai.endpoint,
      });
      setAIStatus(message);
      setAIStatusTone('success');
    } catch (error) {
      setAIStatus(error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen.');
      setAIStatusTone('error');
    } finally {
      setAITesting(false);
    }
  };

  const exportRows = state.expenses
    .filter((expense) => expense.month === selectedMonth)
    .map((expense) => ({
      Monat: expense.month,
      Datum: expense.date,
      Beschreibung: expense.description,
      Kategorie: getExpenseCategoryInfo(expense.category, settings).labelDe,
      Konto: state.accounts.find((account) => account.id === expense.accountId)?.name || '',
      Betrag: expense.amount,
      Wiederkehrend: expense.isRecurring ? 'Ja' : 'Nein',
      Tags: (expense.tags || []).join(', '),
      Notiz: expense.note || '',
      Beleg: expense.attachment?.name || '',
    }));

  const handleExportJson = () => {
    downloadTextFile(JSON.stringify(state, null, 2), `finanzplanner-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    flash('Vollbackup exportiert');
  };

  const handleExportExpensesCsv = () => {
    downloadTextFile(convertRowsToCsv(exportRows), `ausgaben-${selectedMonth}.csv`, 'text/csv;charset=utf-8');
    flash('Ausgaben als CSV exportiert');
  };

  const handleExportTrendCsv = () => {
    const rows = getPreviousMonths(12, selectedMonth).map((month) => {
      const summary = calculateMonthSummary(month, state.incomes, state.fixedExpenses, state.debts, state.expenses);
      return {
        Monat: month,
        Einnahmen: summary.totalIncome,
        Fixkosten: summary.totalFixedExpenses,
        Schulden: summary.totalDebtPayments,
        VariableAusgaben: summary.totalVariableExpenses,
        Verfuegbar: summary.remaining,
      };
    });

    downloadTextFile(convertRowsToCsv(rows), `trend-report-${selectedMonth}.csv`, 'text/csv;charset=utf-8');
    flash('Trend-Report exportiert');
  };

  const handleExportExcel = () => {
    const summary = calculateMonthSummary(selectedMonth, state.incomes, state.fixedExpenses, state.debts, state.expenses);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      Monat: selectedMonth,
      Einnahmen: summary.totalIncome,
      Fixkosten: summary.totalFixedExpenses,
      Schulden: summary.totalDebtPayments,
      VariableAusgaben: summary.totalVariableExpenses,
      Verfuegbar: summary.remaining,
    }]), 'Monatsueberblick');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Ausgaben');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.budgetLimits.map((budget) => ({
      Monat: budget.month,
      Kategorie: getExpenseCategoryInfo(budget.category, settings).labelDe,
      Limit: budget.monthlyLimit,
      Wiederkehrend: budget.isRecurring ? 'Ja' : 'Nein',
    }))), 'Budgets');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.accounts.map((account) => ({
      Konto: account.name,
      Typ: account.type,
      Kontostand: account.balance,
      Notiz: account.note || '',
    }))), 'Konten');
    XLSX.writeFile(workbook, `finanzplanner-report-${selectedMonth}.xlsx`);
    flash('Excel-Report exportiert');
  };

  const handleExportPdf = () => {
    const summary = calculateMonthSummary(selectedMonth, state.incomes, state.fixedExpenses, state.debts, state.expenses);
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(`Finanzplanner Monatsreport ${selectedMonth}`, 14, 20);
    pdf.setFontSize(11);
    pdf.text(`Einnahmen: ${formatCurrency(summary.totalIncome, settings)}`, 14, 34);
    pdf.text(`Fixkosten: ${formatCurrency(summary.totalFixedExpenses, settings)}`, 14, 41);
    pdf.text(`Schulden: ${formatCurrency(summary.totalDebtPayments, settings)}`, 14, 48);
    pdf.text(`Variable Ausgaben: ${formatCurrency(summary.totalVariableExpenses, settings)}`, 14, 55);
    pdf.text(`Verfügbar: ${formatCurrency(summary.remaining, settings)}`, 14, 62);

    autoTable(pdf, {
      startY: 72,
      head: [['Datum', 'Beschreibung', 'Kategorie', 'Betrag']],
      body: exportRows.map((row) => [row.Datum, row.Beschreibung, row.Kategorie, formatCurrency(Number(row.Betrag), settings)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    pdf.save(`finanzplanner-report-${selectedMonth}.pdf`);
    flash('PDF-Monatsreport exportiert');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const parsed = JSON.parse(loadEvent.target?.result as string) as Partial<FinanceState>;
          dispatch({ type: 'IMPORT_DATA', payload: parsed });
          flash('Backup importiert');
        } catch {
          alert('Die Datei konnte nicht importiert werden.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm('Wirklich alle Finanzdaten löschen?')) {
      dispatch({ type: 'RESET_ALL' });
      flash('Alle Daten wurden gelöscht');
    }
  };

  const moveWidget = (widgetId: string, direction: -1 | 1) => {
    const currentIndex = settings.dashboardWidgets.indexOf(widgetId);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= settings.dashboardWidgets.length) return;
    const nextWidgets = [...settings.dashboardWidgets];
    [nextWidgets[currentIndex], nextWidgets[nextIndex]] = [nextWidgets[nextIndex], nextWidgets[currentIndex]];
    updateSetting('dashboardWidgets', nextWidgets);
  };

  const toggleWidget = (widgetId: string) => {
    const isActive = settings.dashboardWidgets.includes(widgetId);
    updateSetting(
      'dashboardWidgets',
      isActive
        ? settings.dashboardWidgets.filter((item) => item !== widgetId)
        : [...settings.dashboardWidgets, widgetId]
    );
  };

  const saveCustomCategory = (label: string, icon = customIcon, color = customColor) => {
    if (!label.trim()) return;
    const id = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    updateSetting('customExpenseCategories', [
      ...settings.customExpenseCategories.filter((item) => item.id !== id),
      {
        id,
        label,
        labelDe: label,
        icon,
        color,
      },
    ]);
  };

  const addCustomCategory = () => {
    if (!customLabel.trim()) return;
    saveCustomCategory(customLabel, customIcon, customColor);
    setCustomLabel('');
    flash('Eigene Kategorie gespeichert');
  };

  const removeCustomCategory = (id: string) => {
    updateSetting('customExpenseCategories', settings.customExpenseCategories.filter((item) => item.id !== id));
  };

  const providerLabel = 'Vercel KV';

  return (
    <div className="max-w-6xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Einstellungen & Backup-Center</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">Dashboard personalisieren, Exporte steuern und Premium-Workflows anpassen</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span className="font-medium text-gray-900 dark:text-white">{providerLabel} als Backup-Ziel</span>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100">
        Deine App-Konfiguration wird automatisch gespeichert: Theme, Widgets, Navigation, AI-Provider, API-Key, Backup-Ziele und weitere Einstellungen werden deinem Konto zugeordnet und zusätzlich lokal auf diesem Gerät zwischengespeichert.
      </div>

      {showSuccess && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Check size={16} />
          {showSuccess}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'basics', label: 'Basis' },
          { id: 'workspace', label: 'Personalisierung' },
          { id: 'automation', label: 'Automatisierung' },
          { id: 'data', label: 'Daten & Export' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSettingsSection(item.id as typeof settingsSection)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              settingsSection === item.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {settingsSection === 'basics' && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="SlidersHorizontal" size={16} className="text-blue-500" /> Erlebnis & Bedienung
            <HelpTooltip
              title="Weniger Reibung im Alltag"
              description="Hier steuerst du, wie reduziert oder umfangreich die App auftritt. Der geführte Modus blendet fortgeschrittene Bereiche standardmäßig aus."
              example="Beispiel: Für Privatnutzung reicht oft Profil Privat + Modus Geführt."
            />
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Theme"
              value={theme}
              onChange={(value) => {
                setTheme(value as Settings['theme']);
                updateSetting('theme', value as Settings['theme']);
              }}
              options={[
                { value: 'light', label: 'Hell' },
                { value: 'dark', label: 'Dunkel' },
                { value: 'system', label: 'System' },
              ]}
            />
            <Select
              label="Startseite"
              value={settings.defaultView}
              onChange={(value) => updateSetting('defaultView', value as Settings['defaultView'])}
              options={[
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'analytics', label: 'Analysen' },
                { value: 'budget', label: 'Budgets' },
                { value: 'expenses', label: 'Ausgaben' },
                { value: 'accounts', label: 'Konten' },
                { value: 'banksync', label: 'Bank Sync (ELBA)' },
                { value: 'freelance', label: 'Freelance' },
                { value: 'savings', label: 'Sparziele' },
              ]}
            />
            <Select
              label="Währung"
              value={settings.currency}
              onChange={(value) => {
                const currency = CURRENCIES.find((item) => item.code === value);
                dispatch({ type: 'UPDATE_SETTINGS', payload: { currency: value, currencySymbol: currency?.symbol || value } });
              }}
              options={CURRENCIES.map((currency) => ({ value: currency.code, label: `${currency.symbol} ${currency.code} – ${currency.name}` }))}
            />
            <Select
              label="Analysefenster"
              value={String(settings.analyticsMonths)}
              onChange={(value) => updateSetting('analyticsMonths', Number(value) as Settings['analyticsMonths'])}
              options={[
                { value: '6', label: '6 Monate' },
                { value: '12', label: '12 Monate' },
              ]}
            />
            <Select
              label="Bedienmodus"
              value={settings.userExperience.mode}
              onChange={(value) => updateSetting('userExperience', { ...settings.userExperience, mode: value as Settings['userExperience']['mode'] })}
              options={[
                { value: 'guided', label: 'Geführt – reduziert & einsteigerfreundlich' },
                { value: 'standard', label: 'Standard – ausgewogen' },
                { value: 'power', label: 'Power – alle Bereiche sichtbar' },
              ]}
            />
            <Select
              label="App-Profil"
              value={settings.userExperience.profile}
              onChange={(value) => updateSetting('userExperience', { ...settings.userExperience, profile: value as Settings['userExperience']['profile'] })}
              options={[
                { value: 'personal', label: 'Privat – ohne Freelance-Fokus' },
                { value: 'freelance', label: 'Freelance – mit Projekt- und Rechnungsfokus' },
                { value: 'complete', label: 'Komplett – voller Funktionsumfang' },
              ]}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Geführtes Setup & Hinweise</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">
                  Status: {settings.userExperience.initialSetupCompleted ? 'Einrichtung abgeschlossen' : 'Einrichtung noch offen'} · Hinweise {settings.userExperience.shortcutsHintSeen ? 'bereits gesehen' : 'noch aktiv'}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding'))}>
                  Setup-Assistent öffnen
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => updateSetting('userExperience', { ...settings.userExperience, shortcutsHintSeen: false })}
                >
                  Hinweise erneut zeigen
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <SettingSwitch title="Cent-Beträge anzeigen" description={`Aktuelle Vorschau: ${formatCurrency(1234.56, settings)}`} checked={settings.showCents} onChange={(value) => updateSetting('showCents', value)} />
            <SettingSwitch title="Quick Entry aktivieren" description="Floating Action Button, Schnellerfassung und gemerkte Standardwerte." checked={settings.quickEntry} onChange={(value) => updateSetting('quickEntry', value)} />
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-3">Freelance</h4>
            <Input
              label="Jährliche Verdienstgrenze (€)"
              type="number"
              value={settings.freelanceYearlyLimit ? String(settings.freelanceYearlyLimit) : ''}
              onChange={(value) => updateSetting('freelanceYearlyLimit', value ? Number(value) : 0)}
              placeholder="z.B. 11000 (Kleinunternehmergrenze)"
            />
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              Bei Erreichen der Grenze wirst du auf der Freelance-Seite gewarnt. Leer lassen = keine Warnung.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="BrainCircuit" size={16} className="text-violet-500" /> Analyse-Qualität
            <HelpTooltip
              title="Warnungen und Monatslogik"
              description="Diese Einstellungen bestimmen, wie früh Budgets warnen und wie Monatsvergleiche interpretiert werden."
              example="Wenn dein Gehalt erst am 3. kommt, kann ein späterer Monatsbeginn realistischer sein."
            />
          </h3>
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs text-slate-500 dark:text-gray-500">Budget-Warnschwelle</p>
              <div className="mt-3 flex items-center gap-3">
                <input type="range" min="50" max="100" step="5" value={settings.budgetWarningThreshold} onChange={(event) => updateSetting('budgetWarningThreshold', parseInt(event.target.value, 10))} className="w-full accent-violet-500" />
                <span className="w-12 text-right text-sm font-bold text-violet-600 dark:text-violet-400">{settings.budgetWarningThreshold}%</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
              <Select
                label="Finanzmonat beginnt am"
                value={String(settings.monthStartDay)}
                onChange={(value) => updateSetting('monthStartDay', parseInt(value, 10))}
                options={Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}. Tag` }))}
              />
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Premium-Hinweis</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">Mit 12 Monaten Analysefenster, Warnfällen und Kontenzuordnung werden Forecasts deutlich präziser.</p>
            </div>
          </div>
        </Card>
      </div>
      )}

      {settingsSection === 'basics' && (
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Menu size={16} className="text-indigo-500" /> Menü-Sichtbarkeit
          <HelpTooltip
            title="Navigation vereinfachen"
            description="Blende selten genutzte Bereiche aus. Zusammen mit dem Bedienmodus wird die Sidebar deutlich ruhiger."
            example="Für reine Privatnutzung kannst du Berichte, Regeln und Aktivitätslog oft ausblenden."
          />
        </h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-gray-500">
          Blende Menüpunkte aus, die du nicht brauchst, um die Navigation übersichtlicher zu gestalten. Dashboard und Einstellungen bleiben immer sichtbar.
        </p>
        <div className="space-y-4">
          {[
            {
              group: 'Übersicht',
              items: [
                { href: '/analytics', label: 'Analysen' },
                { href: '/cashflow', label: 'Cashflow' },
              ],
            },
            {
              group: 'Finanzen',
              items: [
                { href: '/income', label: 'Einnahmen' },
                { href: '/fixed-expenses', label: 'Fixkosten' },
                { href: '/debts', label: 'Schulden' },
                { href: '/expenses', label: 'Ausgaben' },
                { href: '/budget', label: 'Budgets' },
              ],
            },
            {
              group: 'Vermögen',
              items: [
                { href: '/savings', label: 'Sparziele' },
                { href: '/accounts', label: 'Konten' },
                { href: '/freelance', label: 'Freelance' },
              ],
            },
            {
              group: 'Berichte',
              items: [
                { href: '/monthly-report', label: 'Monatsbericht' },
                { href: '/annual-report', label: 'Jahresbericht' },
                { href: '/finance-score', label: 'Finanz-Score' },
                { href: '/finance-goals', label: 'Finanz-Ziele' },
              ],
            },
            {
              group: 'Tools',
              items: [
                { href: '/bank-sync', label: 'Bank Sync' },
                { href: '/receipts', label: 'Belege' },
                { href: '/category-rules', label: 'Regeln' },
                { href: '/activity-log', label: 'Aktivitäten' },
              ],
            },
          ].map((section) => {
            const hiddenItems = settings.hiddenMenuItems || [];
            const allHidden = section.items.every(item => hiddenItems.includes(item.href));
            const noneHidden = section.items.every(item => !hiddenItems.includes(item.href));
            return (
              <div key={section.group} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.group}</p>
                  <button
                    onClick={() => {
                      if (noneHidden) {
                        updateSetting('hiddenMenuItems', [...hiddenItems, ...section.items.map(i => i.href)]);
                      } else {
                        updateSetting('hiddenMenuItems', hiddenItems.filter(h => !section.items.some(i => i.href === h)));
                      }
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {noneHidden ? 'Alle ausblenden' : 'Alle einblenden'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item) => {
                    const isHidden = hiddenItems.includes(item.href);
                    return (
                      <button
                        key={item.href}
                        onClick={() => {
                          if (isHidden) {
                            updateSetting('hiddenMenuItems', hiddenItems.filter(h => h !== item.href));
                          } else {
                            updateSetting('hiddenMenuItems', [...hiddenItems, item.href]);
                          }
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                          isHidden
                            ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 line-through'
                            : 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {(settings.hiddenMenuItems || []).length > 0 && (
          <button
            onClick={() => updateSetting('hiddenMenuItems', [])}
            className="mt-4 text-xs font-medium text-slate-500 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Alle Menüpunkte wieder einblenden
          </button>
        )}
      </Card>
      )}

      {settingsSection === 'automation' && (
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Bot size={16} className="text-fuchsia-500" /> AI-Schnittstelle für Belege & Sprache
          <HelpTooltip
            title="Optionaler Komfort"
            description="Die AI-Funktionen sind nicht nötig, machen Belegimport und Spracheingabe aber deutlich schneller. Wenn du alles manuell machen willst, kannst du sie komplett auslassen."
            example="Workflow: API-Key hinterlegen, Verbindung testen, dann in Ausgaben einen Beleg analysieren lassen."
            side="left"
          />
        </h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/70 p-4 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Schnellstart</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
                    1. Provider wählen, 2. API-Key eintragen, 3. Modelle werden automatisch geladen, 4. Verbindung testen.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={reloadModels} disabled={modelsLoading || !settings.ai.apiKey || settings.ai.provider === 'disabled'}>
                  {modelsLoading ? <LoaderCircle size={14} className="animate-spin" /> : <PlugZap size={14} />}
                  Modelle laden
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Provider"
                value={settings.ai.provider}
                onChange={(value) => applyProviderDefaults(value as Settings['ai']['provider'])}
                options={AI_PROVIDER_OPTIONS}
              />
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">API-Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.ai.apiKey}
                    onChange={(event) => updateAISetting('apiKey', event.target.value)}
                    placeholder="API-Key hier einfügen"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-30 text-sm leading-6 text-gray-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clipboardText = await navigator.clipboard.readText();
                          if (clipboardText) {
                            updateAISetting('apiKey', clipboardText.trim());
                          }
                        } catch {
                          setAIStatus('Zwischenablage konnte nicht gelesen werden. Bitte mit Cmd/Ctrl+V einfügen.');
                          setAIStatusTone('error');
                        }
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Einfügen
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowApiKey((value) => !value)}
                      className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      aria-label={showApiKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">Du kannst den Schlüssel jetzt direkt einfügen oder per Button aus der Zwischenablage übernehmen.</p>
              </div>
              <div className="space-y-2">
                <Select
                  label="Modell"
                  value={settings.ai.model}
                  onChange={(value) => updateAISetting('model', value)}
                  options={
                    availableModels.length > 0
                      ? availableModels.map((model) => ({ value: model.id, label: model.label }))
                      : [{ value: settings.ai.model || '', label: settings.ai.model || 'Modell manuell eintragen' }]
                  }
                />
                <Input
                  value={settings.ai.model}
                  onChange={(value) => updateAISetting('model', value)}
                  placeholder="Oder Modell-ID manuell eingeben"
                />
              </div>
              <Input
                label="Endpoint"
                value={settings.ai.endpoint || ''}
                onChange={(value) => updateAISetting('endpoint', value)}
                placeholder={settings.ai.provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models' : 'https://api.openai.com/v1/chat/completions'}
              />
            </div>

            {aiEndpointPresets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">Empfohlene Endpoints</p>
                <div className="flex flex-wrap gap-2">
                  {aiEndpointPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => updateAISetting('endpoint', preset.value)}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                        settings.ai.endpoint === preset.value
                          ? 'bg-fuchsia-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={reloadModels} disabled={modelsLoading || !settings.ai.apiKey || settings.ai.provider === 'disabled'}>
                {modelsLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Bot size={14} />}
                Modelle aktualisieren
              </Button>
              <Button onClick={runConnectionTest} disabled={aiTesting || !settings.ai.apiKey || !settings.ai.model || settings.ai.provider === 'disabled'}>
                {aiTesting ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                API-Key prüfen
              </Button>
            </div>

            {aiStatus && (
              <div
                className={`rounded-2xl border p-3 text-sm ${
                  aiStatusTone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
                }`}
              >
                {aiStatus}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <SettingSwitch
                title="AI-Funktionen aktivieren"
                description="Optional. Wenn deaktiviert, bleibt alles komplett manuell."
                checked={settings.ai.enabled}
                onChange={(value) => updateAISetting('enabled', value)}
              />
              <SettingSwitch
                title="Beleganalyse mit AI"
                description="Foto hochladen, AI liest Betrag, Beschreibung und passende Kategorie aus."
                checked={settings.ai.receiptAssistant}
                onChange={(value) => updateAISetting('receiptAssistant', value)}
              />
              <SettingSwitch
                title="Spracheingabe mit AI"
                description="Gesprochene Ausgaben erkennen, strukturieren und vor dem Speichern bestätigen."
                checked={settings.ai.voiceAssistant}
                onChange={(value) => updateAISetting('voiceAssistant', value)}
              />
              <SettingSwitch
                title="Vor dem Speichern bestätigen"
                description="Empfohlen: AI-Vorschläge werden erst nach Nutzer-Bestätigung importiert."
                checked={settings.ai.confirmBeforeSave}
                onChange={(value) => updateAISetting('confirmBeforeSave', value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <ReceiptText size={16} className="text-blue-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Beleg-Workflow</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                Mobilfoto hochladen, AI analysiert den Beleg, schlägt Beschreibung, Datum, Betrag und Kategorie vor und zeigt alles vor dem Import an.
              </p>
              <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                Upload-Ort: <span className="font-semibold">Ausgaben → Beleg mit AI analysieren → Foto auswählen</span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <Mic size={16} className="text-emerald-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Sprach-Workflow</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                Beispiel: „50 Euro tanken, 52 Euro essen“. Das Transkript wird angezeigt, strukturiert und erst nach Bestätigung gebucht.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Wichtiger Hinweis</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                Die Konfiguration wird lokal in deinem Browser gespeichert. Ohne Backend laufen die AI-Aufrufe direkt vom Gerät zum gewählten Modellanbieter.
              </p>
            </div>
          </div>
        </div>
      </Card>
      )}

      {settingsSection === 'workspace' && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="LayoutDashboard" size={16} className="text-cyan-500" /> Startseite personalisieren
          </h3>
          <div className="space-y-3">
            {DASHBOARD_WIDGET_OPTIONS.map((widget) => {
              const activeIndex = settings.dashboardWidgets.indexOf(widget.id);
              const isActive = activeIndex >= 0;
              return (
                <div key={widget.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{widget.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{isActive ? `Position ${activeIndex + 1}` : 'Derzeit ausgeblendet'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleWidget(widget.id)} className={`rounded-xl px-3 py-2 text-xs font-medium ${isActive ? 'bg-slate-100 text-gray-900 dark:bg-gray-800 dark:text-white' : 'bg-blue-600 text-white'}`}>
                      {isActive ? 'Ausblenden' : 'Einblenden'}
                    </button>
                    {isActive && (
                      <>
                        <button onClick={() => moveWidget(widget.id, -1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-gray-900 dark:border-gray-800 dark:text-white">↑</button>
                        <button onClick={() => moveWidget(widget.id, 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-gray-900 dark:border-gray-800 dark:text-white">↓</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="Palette" size={16} className="text-pink-500" /> Eigene Kategorien
          </h3>
          <div className="space-y-4">
            <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-4 dark:border-pink-900/50 dark:bg-pink-950/20">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Mehr Kontrolle über deine Kategorien</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
                Eigene Kategorien erscheinen sofort in Ausgaben, Budgets, AI-Vorschlägen und Auswertungen.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">Schnelle Vorlagen</p>
              <div className="flex flex-wrap gap-2">
                {suggestedCategoryTemplates.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => {
                      saveCustomCategory(template.label, template.icon, template.color);
                      flash(`${template.label} hinzugefügt`);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800"
                  >
                    + {template.label}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Name" value={customLabel} onChange={setCustomLabel} placeholder="z.B. Haustiere, Reisen Inland, Business" />
            <Select label="Icon" value={customIcon} onChange={setCustomIcon} options={iconOptions.map((icon) => ({ value: icon, label: icon }))} />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Farbe</label>
              <div className="flex flex-wrap gap-2">
                {UI_COLORS.map((color) => (
                  <button key={color} onClick={() => setCustomColor(color)} className={`h-8 w-8 rounded-full border-2 ${customColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            <Button onClick={addCustomCategory}>Kategorie anlegen</Button>
            <div className="space-y-2">
              {settings.customExpenseCategories.length > 0 ? settings.customExpenseCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${category.color}15` }}>
                      <Icon name={category.icon} size={16} color={category.color} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{category.labelDe}</span>
                  </div>
                  <button onClick={() => removeCustomCategory(category.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-300">
                    Entfernen
                  </button>
                </div>
              )) : <p className="text-sm text-slate-500 dark:text-gray-500">Noch keine eigenen Kategorien angelegt.</p>}
            </div>
          </div>
        </Card>
      </div>
      )}

      {settingsSection === 'automation' && (
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="BellRing" size={16} className="text-emerald-500" /> Erinnerungen & Alerts
          </h3>
          <div className="space-y-3">
            <SettingSwitch title="Budget-Warnungen" description="Meldet frühzeitig, wenn dein Monatsbudget knapp wird, und zeigt nach neuen Ausgaben direkt dein Restbudget." checked={settings.notifications.budgetWarnings} onChange={(value) => updateNotification('budgetWarnings', value)} />
            <SettingSwitch title="Rechnungs-Erinnerungen" description="Praktisch für Fixkosten und Fälligkeitstage." checked={settings.notifications.billReminders} onChange={(value) => updateNotification('billReminders', value)} />
            <SettingSwitch title="Sparziel-Impulse" description="Benachrichtigt bei Meilensteinen und Rückstand." checked={settings.notifications.savingsGoals} onChange={(value) => updateNotification('savingsGoals', value)} />
            <SettingSwitch title="Monatsbericht bereit" description="Meldet zum Monatswechsel, dass der Bericht des letzten abgeschlossenen Monats fertig ist." checked={settings.notifications.monthlyReport} onChange={(value) => updateNotification('monthlyReport', value)} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <Icon name="MonitorSmartphone" size={16} className="text-cyan-500" /> System-Benachrichtigungen
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                Browser- oder System-Popups zusaetzlich zur internen Glocke. Aktuell nutzt die App sie fuer den fertigen Monatsbericht.
              </p>
            </div>
            <Badge
              color={
                browserNotificationPermission === 'granted'
                  ? '#10b981'
                  : browserNotificationPermission === 'denied'
                    ? '#ef4444'
                    : browserNotificationPermission === 'default'
                      ? '#f59e0b'
                      : '#64748b'
              }
            >
              {browserNotificationPermission === 'granted'
                ? 'Aktiv'
                : browserNotificationPermission === 'denied'
                  ? 'Blockiert'
                  : browserNotificationPermission === 'default'
                    ? 'Nicht freigegeben'
                    : 'Nicht unterstuetzt'}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => { void requestSystemNotificationPermission(); }}
              variant={browserNotificationPermission === 'granted' ? 'secondary' : 'primary'}
              icon="BellRing"
            >
              {browserNotificationPermission === 'granted' ? 'Berechtigung aktiv' : 'Berechtigung anfordern'}
            </Button>
            <Button
              onClick={sendSystemNotificationTest}
              variant="secondary"
              icon="Send"
              disabled={browserNotificationPermission !== 'granted'}
            >
              Test senden
            </Button>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">
            Wenn der Status auf "Blockiert" steht, muss die Freigabe direkt in den Browser- oder macOS-Mitteilungseinstellungen wieder aktiviert werden.
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="Mail" size={16} className="text-blue-500" /> Berichte per E-Mail
          </h3>
          <div className="space-y-3">
            <Input label="E-Mail-Adresse" value={settings.reportEmail || ''} onChange={(v) => updateSetting('reportEmail', v)} placeholder="deine@email.de" icon="Mail" />
            <Select
              label="Berichtsfrequenz"
              value={settings.emailReportFrequency || 'none'}
              onChange={(v) => updateSetting('emailReportFrequency', v as 'none' | 'weekly' | 'monthly')}
              options={[
                { value: 'none', label: 'Kein automatischer Bericht' },
                { value: 'weekly', label: 'Wöchentlich' },
                { value: 'monthly', label: 'Monatlich' },
              ]}
            />
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Beim Monatsabschluss-Wizard kannst du die Zusammenfassung direkt per E-Mail versenden oder kopieren.
            </p>
          </div>
        </Card>
      </div>
      )}

      {settingsSection === 'data' && (
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Download size={16} className="text-blue-500" /> Export-Center
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { title: 'Vollbackup JSON', text: 'Kompletter App-Stand für Import oder Cloud-Archiv.', icon: <Download size={18} className="text-blue-500" />, onClick: handleExportJson },
            { title: 'Ausgaben CSV', text: `Alle variablen Ausgaben für ${selectedMonth}.`, icon: <Icon name="FileSpreadsheet" size={18} className="text-emerald-500" />, onClick: handleExportExpensesCsv },
            { title: 'Trend-Report CSV', text: '12-Monats-Übersicht für Excel oder BI-Tools.', icon: <Icon name="ChartColumn" size={18} className="text-violet-500" />, onClick: handleExportTrendCsv },
            { title: 'Excel-Report', text: 'Mehrere Sheets für Summary, Ausgaben, Budgets und Konten.', icon: <Icon name="Sheet" size={18} className="text-emerald-500" />, onClick: handleExportExcel },
            { title: 'PDF-Monatsreport', text: 'Sauber formatierter Monatsbericht zum Teilen oder Archivieren.', icon: <Icon name="FileText" size={18} className="text-red-500" />, onClick: handleExportPdf },
          ].map((item) => (
            <button key={item.title} onClick={item.onClick} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 dark:bg-gray-800">{item.icon}</div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{item.text}</p>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button onClick={handleImport} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-all hover:border-slate-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:border-gray-700">
            <span className="inline-flex items-center gap-2"><Upload size={16} /> Backup importieren</span>
          </button>
        </div>
      </Card>
      )}

      {settingsSection === 'data' && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon name="BarChart3" size={16} className="text-cyan-500" /> Datenübersicht
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Ausgaben', value: state.expenses.length },
              { label: 'Konten', value: state.accounts.length },
              { label: 'Budgets', value: state.budgetLimits.length },
              { label: 'Eigene Kategorien', value: settings.customExpenseCategories.length },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 p-4 text-center dark:border-gray-800">
                <p className="text-xs font-medium text-slate-500 dark:text-gray-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {settings.lastUsedExpenseTags.map((tag) => (
              <Badge key={tag} color="#8b5cf6">{tag}</Badge>
            ))}
            {settings.lastUsedExpenseTags.length === 0 && <p className="text-sm text-slate-500 dark:text-gray-500">Noch keine gemerkten Standard-Tags.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <RotateCcw size={16} className="text-red-500" /> Datenverwaltung
          </h3>
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-gray-500">Nutze zuerst Export oder Backup, bevor du Daten zurücksetzt.</p>
            <Button variant="danger" onClick={handleReset}>Alle Daten löschen</Button>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
