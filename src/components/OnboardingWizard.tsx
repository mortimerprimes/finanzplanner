'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Landmark, Sparkles, Target, Wallet } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import type { AccountType, FixedExpenseCategory, IncomeType, Settings } from '../types';
import { ACCOUNT_TYPES, FIXED_EXPENSE_CATEGORIES, INCOME_TYPES, UI_COLORS } from '../utils/constants';
import { Badge, Button, Input, Modal, Select } from './ui';

type WizardStep = 'intro' | 'account' | 'income' | 'fixed' | 'finish';

const STEP_ORDER: WizardStep[] = ['intro', 'account', 'income', 'fixed', 'finish'];

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
  const { state, dispatch } = useFinance();
  const { accounts, fixedExpenses, incomes, expenses, settings } = state;

  const [step, setStep] = useState<WizardStep>('intro');
  const [profile, setProfile] = useState<Settings['userExperience']['profile']>(settings.userExperience.profile);
  const [mode, setMode] = useState<Settings['userExperience']['mode']>(settings.userExperience.mode);

  const [accountName, setAccountName] = useState('Mein Girokonto');
  const [accountBalance, setAccountBalance] = useState('0');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [accountColor, setAccountColor] = useState(UI_COLORS[0]);
  const [accountSaved, setAccountSaved] = useState(false);

  const [incomeName, setIncomeName] = useState('Gehalt');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('salary');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [incomeSaved, setIncomeSaved] = useState(false);

  const [fixedName, setFixedName] = useState('Miete');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedCategory, setFixedCategory] = useState<FixedExpenseCategory>('housing');
  const [fixedDueDay, setFixedDueDay] = useState('1');
  const [fixedAccountId, setFixedAccountId] = useState('');
  const [fixedSaved, setFixedSaved] = useState(false);

  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState('');
  const wasOpenRef = useRef(false);

  const accountOptions = useMemo(
    () => [{ value: '', label: 'Ohne Konto' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))],
    [accounts]
  );

  const checklist = [
    { key: 'account', label: 'Erstes Konto', done: accounts.length > 0 || accountSaved },
    { key: 'income', label: 'Einnahme hinterlegt', done: incomes.length > 0 || incomeSaved },
    { key: 'fixed', label: 'Fixkosten oder erste Ausgabe', done: fixedExpenses.length > 0 || expenses.length > 0 || fixedSaved },
  ];

  const setupComplete = checklist.every((item) => item.done);
  const stepIndex = STEP_ORDER.indexOf(step);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setStep('intro');
      setProfile(settings.userExperience.profile);
      setMode(settings.userExperience.mode);
      setAccountSaved(false);
      setIncomeSaved(false);
      setFixedSaved(false);
      setIncomeAccountId(settings.lastUsedAccountId || accounts.find((account) => account.isDefault)?.id || '');
      setFixedAccountId(settings.lastUsedAccountId || accounts.find((account) => account.isDefault)?.id || '');
      setDemoError('');
    }

    wasOpenRef.current = isOpen;
  }, [accounts, isOpen, settings.lastUsedAccountId, settings.userExperience.mode, settings.userExperience.profile]);

  const persistExperience = (next: Partial<Settings['userExperience']>) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        userExperience: {
          ...settings.userExperience,
          profile,
          mode,
          ...next,
        },
      },
    });
  };

  const goToStep = (nextStep: WizardStep) => {
    persistExperience({ onboardingCompleted: true, profile, mode });
    setStep(nextStep);
  };

  const handleCreateAccount = () => {
    if (accountSaved || !accountName.trim() || !accountBalance.trim()) {
      goToStep('income');
      return;
    }

    dispatch({
      type: 'ADD_ACCOUNT',
      payload: {
        name: accountName.trim(),
        type: accountType,
        balance: Number(accountBalance) || 0,
        color: accountColor,
        icon: ACCOUNT_TYPES[accountType].icon,
        isDefault: accounts.length === 0,
      },
    });

    setAccountSaved(true);
    goToStep('income');
  };

  const handleCreateIncome = () => {
    if (incomeSaved || !incomeName.trim() || !incomeAmount.trim()) {
      goToStep('fixed');
      return;
    }

    const incomeDate = new Date().toISOString().slice(0, 10);
    dispatch({
      type: 'ADD_INCOME',
      payload: {
        name: incomeName.trim(),
        amount: Number(incomeAmount) || 0,
        type: incomeType,
        isRecurring: true,
        date: incomeDate,
        month: incomeDate.slice(0, 7),
        accountId: incomeAccountId || undefined,
      },
    });
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { lastUsedAccountId: incomeAccountId || undefined },
    });

    setIncomeSaved(true);
    goToStep('fixed');
  };

  const handleCreateFixedExpense = () => {
    if (!fixedSaved && fixedName.trim() && fixedAmount.trim()) {
      dispatch({
        type: 'ADD_FIXED_EXPENSE',
        payload: {
          name: fixedName.trim(),
          amount: Number(fixedAmount) || 0,
          category: fixedCategory,
          dueDay: Number(fixedDueDay) || 1,
          isActive: true,
          accountId: fixedAccountId || undefined,
        },
      });
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: { lastUsedAccountId: fixedAccountId || undefined },
      });
      setFixedSaved(true);
    }

    goToStep('finish');
  };

  const handleDismiss = () => {
    persistExperience({ onboardingCompleted: true, profile, mode });
    onClose();
  };

  const handleFinish = () => {
    persistExperience({
      onboardingCompleted: true,
      initialSetupCompleted: setupComplete,
      profile,
      mode,
    });
    onClose();
  };

  const handleStartDemo = async () => {
    setDemoLoading(true);
    setDemoError('');

    try {
      const response = await fetch('/api/demo/start', { method: 'POST' });
      if (!response.ok) throw new Error('demo-start-failed');
      const { email, password } = await response.json();
      persistExperience({ onboardingCompleted: true, profile, mode });
      await signIn('credentials', { email, password, callbackUrl: '/dashboard' });
    } catch {
      setDemoError('Die Demo konnte gerade nicht gestartet werden.');
      setDemoLoading(false);
    }
  };

  const renderIntro = () => (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-500 p-4 text-white sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/90">Willkommen in deinem Finanzplanner</p>
            <h4 className="mt-2 text-xl font-bold sm:text-2xl">Wir richten dir die App in wenigen Minuten passend ein.</h4>
            <p className="mt-3 text-sm leading-6 text-white/85">
              Der Assistent reduziert Menupunkte, hilft beim ersten Konto und legt die wichtigsten Standardwerte direkt an.
            </p>
          </div>
          <Sparkles size={26} className="shrink-0 text-white/90" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          {
            value: 'personal',
            title: 'Privat',
            text: 'Fokus auf Konto, Budget, Ausgaben und Sparziele.',
            icon: Wallet,
          },
          {
            value: 'freelance',
            title: 'Freelance',
            text: 'Mit Fokus auf Projekte, Rechnungen und Einkommen.',
            icon: Briefcase,
          },
          {
            value: 'complete',
            title: 'Komplett',
            text: 'Alle Bereiche sichtbar, geeignet fuer Power-User.',
            icon: Target,
          },
        ].map((item) => {
          const ItemIcon = item.icon;
          const active = profile === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setProfile(item.value as Settings['userExperience']['profile'])}
              className={`rounded-2xl border p-4 text-left transition-all ${
                active
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-slate-200 hover:border-slate-300 dark:border-gray-800 dark:hover:border-gray-700'
              }`}
            >
              <ItemIcon size={18} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400'} />
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">{item.text}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Bedienmodus</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Gefuehrt blendet komplexe Bereiche standardmaessig aus.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {[
              { value: 'guided', label: 'Gefuehrt' },
              { value: 'standard', label: 'Standard' },
              { value: 'power', label: 'Power' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value as Settings['userExperience']['mode'])}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === item.value
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                } w-full justify-center sm:w-auto`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">So starten die meisten Nutzer</p>
        <div className="mt-3 space-y-2">
          {checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
              <CheckCircle2 size={16} className={item.done ? 'text-emerald-500' : 'text-slate-300 dark:text-gray-600'} />
              <span className="text-sm text-gray-900 dark:text-white">{item.label}</span>
              <span className="ml-auto text-xs text-slate-500 dark:text-gray-500">{item.done ? 'Erledigt' : 'Offen'}</span>
            </div>
          ))}
        </div>
      </div>

      {demoError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{demoError}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => goToStep('account')} className="flex-1">
          Gefuehrtes Setup starten
          <ChevronRight size={16} />
        </Button>
        <Button variant="secondary" onClick={handleStartDemo} disabled={demoLoading} className="flex-1">
          {demoLoading ? 'Demo wird vorbereitet...' : 'Lieber erst Demo laden'}
        </Button>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="w-full text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Erst mal selbst erkunden
      </button>
    </div>
  );

  const renderAccountStep = () => (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
            <Landmark size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Schritt 1: Hauptkonto anlegen</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Das Konto wird auf dem Dashboard, bei Imports und in der Schnellerfassung vorgeschlagen.</p>
          </div>
        </div>
      </div>

      <Input label="Kontoname" value={accountName} onChange={setAccountName} placeholder="z.B. Girokonto, Haushaltskonto" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Kontotyp"
          value={accountType}
          onChange={(value) => setAccountType(value as AccountType)}
          options={Object.values(ACCOUNT_TYPES).map((item) => ({ value: item.id, label: item.labelDe }))}
        />
        <Input label="Aktueller Kontostand" type="number" value={accountBalance} onChange={setAccountBalance} placeholder="0.00" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Farbe</label>
        <div className="flex flex-wrap gap-2">
          {UI_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccountColor(color)}
              className={`h-8 w-8 rounded-full border-2 ${accountColor === color ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => setStep('intro')} className="flex-1">
          <ChevronLeft size={16} />
          Zurueck
        </Button>
        <Button onClick={handleCreateAccount} className="flex-1">
          Weiter
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );

  const renderIncomeStep = () => (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Schritt 2: Regelmaessige Einnahme</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Eine erste Einnahme macht Budgets, Verfuegbar-Anzeigen und Forecasts sofort brauchbar.</p>
          </div>
        </div>
      </div>

      <Input label="Bezeichnung" value={incomeName} onChange={setIncomeName} placeholder="z.B. Gehalt, Nebenjob" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Monatsbetrag" type="number" value={incomeAmount} onChange={setIncomeAmount} placeholder="0.00" />
        <Select
          label="Typ"
          value={incomeType}
          onChange={(value) => setIncomeType(value as IncomeType)}
          options={Object.values(INCOME_TYPES).map((item) => ({ value: item.id, label: item.labelDe }))}
        />
      </div>
      <Select label="Auf Konto buchen" value={incomeAccountId} onChange={setIncomeAccountId} options={accountOptions} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => setStep('account')} className="flex-1">
          <ChevronLeft size={16} />
          Zurueck
        </Button>
        <Button onClick={handleCreateIncome} className="flex-1">
          Weiter
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );

  const renderFixedStep = () => (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
            <Target size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Schritt 3: Erste Fixkosten</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Optional, aber sehr hilfreich fuer Monatsplanung, Forecasts und Bank-Abgleich.</p>
          </div>
        </div>
      </div>

      <Input label="Name" value={fixedName} onChange={setFixedName} placeholder="z.B. Miete, Strom, Versicherung" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Monatsbetrag" type="number" value={fixedAmount} onChange={setFixedAmount} placeholder="0.00" />
        <Select
          label="Kategorie"
          value={fixedCategory}
          onChange={(value) => setFixedCategory(value as FixedExpenseCategory)}
          options={Object.values(FIXED_EXPENSE_CATEGORIES).map((item) => ({ value: item.id, label: item.labelDe }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Faellig am" type="number" value={fixedDueDay} onChange={setFixedDueDay} placeholder="1" />
        <Select label="Von Konto zahlen" value={fixedAccountId} onChange={setFixedAccountId} options={accountOptions} />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => setStep('income')} className="flex-1">
          <ChevronLeft size={16} />
          Zurueck
        </Button>
        <Button onClick={handleCreateFixedExpense} className="flex-1">
          Abschluss
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );

  const renderFinish = () => (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-5 text-white">
        <p className="text-sm font-semibold text-white/90">Setup gespeichert</p>
        <h4 className="mt-2 text-2xl font-bold">Die App ist jetzt deutlich leichter nutzbar.</h4>
        <p className="mt-3 text-sm leading-6 text-white/90">
          Suche, Schnellerfassung und die gefuehrte Navigation sind ab jetzt auf dein Profil abgestimmt.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {checklist.map((item) => (
          <div key={item.key} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className={item.done ? 'text-emerald-500' : 'text-slate-300 dark:text-gray-600'} />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-gray-500">{item.done ? 'Erledigt' : 'Kann spaeter fertiggestellt werden'}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Direkt als Naechstes praktisch</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge color="#2563eb">Cmd/Ctrl+K fuer Suche</Badge>
          <Badge color="#10b981">Schnellerfassung ueber Plus-Button</Badge>
          <Badge color="#8b5cf6">? zeigt alle Tastenkurzbefehle</Badge>
        </div>
      </div>

      {!setupComplete && (
        <p className="text-sm text-slate-500 dark:text-gray-500">
          Dein Setup ist noch nicht vollstaendig. Die App zeigt dir dafuer weiterhin eine kleine Erinnerung im Hauptbereich an.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => setStep('fixed')} className="flex-1">
          <ChevronLeft size={16} />
          Zurueck
        </Button>
        <Button onClick={handleFinish} className="flex-1">Zum Dashboard</Button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gefuehrtes Setup">
      <div className="space-y-4 sm:space-y-5">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {STEP_ORDER.map((item, index) => {
            const active = item === step;
            const done = index < stepIndex;
            return (
              <div
                key={item}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? 'bg-blue-600 text-white'
                    : done
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {index + 1}. {item === 'intro' ? 'Start' : item === 'account' ? 'Konto' : item === 'income' ? 'Einnahme' : item === 'fixed' ? 'Fixkosten' : 'Fertig'}
              </div>
            );
          })}
        </div>

        {step === 'intro' && renderIntro()}
        {step === 'account' && renderAccountStep()}
        {step === 'income' && renderIncomeStep()}
        {step === 'fixed' && renderFixedStep()}
        {step === 'finish' && renderFinish()}
      </div>
    </Modal>
  );
}