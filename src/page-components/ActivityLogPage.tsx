'use client';

import { useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import {
  Clock, Trash2, Plus, Edit, ArrowRightLeft, CreditCard, Download,
  RefreshCw, Settings as SettingsIcon, FileText,
} from 'lucide-react';
import type { ActivityAction, ActivityEntity } from '@/src/types';

const ACTION_LABELS: Record<ActivityAction, { label: string; color: string }> = {
  create: { label: 'Erstellt', color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  update: { label: 'Bearbeitet', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  delete: { label: 'Gelöscht', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  import: { label: 'Importiert', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' },
  payment: { label: 'Zahlung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  transfer: { label: 'Transfer', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400' },
};

const ENTITY_ICONS: Record<ActivityEntity, typeof Clock> = {
  income: Plus,
  fixedExpense: FileText,
  expense: CreditCard,
  debt: CreditCard,
  savingsGoal: Download,
  budgetLimit: SettingsIcon,
  account: CreditCard,
  transfer: ArrowRightLeft,
  freelanceProject: FileText,
  workSession: Clock,
  freelanceInvoice: FileText,
  settings: SettingsIcon,
  bankSync: RefreshCw,
  other: Clock,
};

const ENTITY_LABELS: Record<ActivityEntity, string> = {
  income: 'Einnahme',
  fixedExpense: 'Fixkosten',
  expense: 'Ausgabe',
  debt: 'Schulden',
  savingsGoal: 'Sparziel',
  budgetLimit: 'Budget',
  account: 'Konto',
  transfer: 'Transfer',
  freelanceProject: 'Projekt',
  workSession: 'Arbeitszeit',
  freelanceInvoice: 'Rechnung',
  settings: 'Einstellungen',
  bankSync: 'Bank Sync',
  other: 'Sonstiges',
};

export function ActivityLogPage() {
  const { state, dispatch } = useFinance();
  const log = state.activityLog || [];

  const grouped = useMemo(() => {
    const groups: Record<string, typeof log> = {};
    for (const entry of log) {
      const date = entry.createdAt.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [log]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return 'Heute';
      if (d.toDateString() === yesterday.toDateString()) return 'Gestern';
      return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: state.settings.currency || 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock size={28} className="text-blue-500" />
            Aktivitätsprotokoll
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{log.length} Einträge</p>
        </div>
        {log.length > 0 && (
          <button
            onClick={() => { if (confirm('Gesamtes Protokoll löschen?')) dispatch({ type: 'CLEAR_ACTIVITY_LOG' }); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
          >
            <Trash2 size={16} />
            Löschen
          </button>
        )}
      </div>

      {log.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-gray-500">
          <Clock size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Noch keine Aktivitäten</p>
          <p className="text-sm mt-1">Änderungen werden hier automatisch protokolliert</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, entries]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-400 mb-3 sticky top-0 bg-slate-50 dark:bg-gray-950 py-1 z-10">
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const actionInfo = ACTION_LABELS[entry.action] || ACTION_LABELS.create;
                  const Icon = ENTITY_ICONS[entry.entity] || Clock;
                  return (
                    <div key={entry.id} className="flex items-start gap-3 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-3">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-gray-800 flex-shrink-0 mt-0.5">
                        <Icon size={16} className="text-slate-500 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-wide">
                            {ENTITY_LABELS[entry.entity]}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 truncate">{entry.label}</p>
                        {entry.details && (
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 truncate">{entry.details}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400 dark:text-gray-500">{formatTime(entry.createdAt)}</p>
                        {entry.amount != null && entry.amount > 0 && (
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{formatCurrency(entry.amount)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
