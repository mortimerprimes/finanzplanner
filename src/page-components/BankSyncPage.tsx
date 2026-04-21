import { ChangeEvent, useMemo, useState } from 'react';
import { BrainCircuit, FileSpreadsheet, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Select, Input, Badge, EmptyState } from '../components/ui';
import { INCOME_TYPES } from '../utils/constants';
import { formatCurrency, generateId, getExpenseCategoryMap } from '../utils/helpers';
import { categorizeBankTransactionsWithAI } from '../services/ai';
import { parseSyncFile, saveImportedHashes, type SyncParseResult, type SyncTransaction } from '../utils/elbaSync';
import {
  collectImportedTransactionFingerprints,
  composeImportedTransactionNote,
  suggestExistingBankTransactionMatch,
  suggestBankTransactionAssignment,
} from '../utils/bankImport';
import type { AccountRule, ExpenseCategory, IncomeType } from '../types';

interface SyncDraft {
  id: string;
  selected: boolean;
  direction: 'expense' | 'income' | 'ignore';
  date: string;
  amount: number;
  description: string;
  note: string;
  category: ExpenseCategory;
  incomeType: IncomeType;
  accountId: string;
  confidence?: number;
  isDuplicate: boolean;
  fingerprint: string;
  categorySource: 'local' | 'category-rule' | 'account-rule';
  accountSource: 'none' | 'default-account' | 'account-rule';
  categoryRuleKeyword?: string;
  accountRuleKeyword?: string;
  existingMatchType: 'none' | 'fixedExpense' | 'recurringIncome' | 'debt';
  existingMatchTargetId: string;
  existingMatchTargetLabel?: string;
  existingMatchDetail?: string;
  existingMatchConfidence?: number;
}

export function BankSyncPage() {
  const { state, dispatch } = useFinance();
  const { bankConnections, syncSessions, accounts, settings, categoryRules, accountRules, expenses, incomes, fixedExpenses, debts } = state;

  const [newConnectionName, setNewConnectionName] = useState('');
  const [newConnectionAccountId, setNewConnectionAccountId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [drafts, setDrafts] = useState<SyncDraft[]>([]);
  const [syncInfo, setSyncInfo] = useState<SyncParseResult | null>(null);
  const [sourceFileName, setSourceFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleAccountId, setRuleAccountId] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');
  const [ruleMatchType, setRuleMatchType] = useState<NonNullable<AccountRule['matchType']>>('contains');

  const selectedConnection = bankConnections.find((item) => item.id === connectionId) || null;
  const accountOptions = [{ value: '', label: 'Ohne Konto importieren' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const connectionOptions = bankConnections.map((item) => ({
    value: item.id,
    label: item.lastSyncAt ? `${item.name} · letzter Sync ${new Date(item.lastSyncAt).toLocaleDateString('de-DE')}` : item.name,
  }));
  const expenseCategoryOptions = Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({ value, label: info.labelDe }));
  const incomeTypeOptions = Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));
  const fixedExpenseMatchOptions = [{ value: '', label: 'Fixkosten wählen' }, ...fixedExpenses.map((item) => ({ value: item.id, label: item.name }))];
  const recurringIncomeMatchOptions = [{ value: '', label: 'Einnahme wählen' }, ...incomes.filter((income) => income.isRecurring).map((item) => ({ value: item.id, label: item.name }))];
  const debtMatchOptions = [{ value: '', label: 'Kredit wählen' }, ...debts.map((item) => ({ value: item.id, label: item.name }))];
  const accountRuleCategoryOptions = [{ value: '', label: 'Keine Kategorie mitsetzen' }, ...expenseCategoryOptions];
  const accountRuleMatchTypeOptions = [
    { value: 'contains', label: 'Enthält' },
    { value: 'startsWith', label: 'Beginnt mit' },
    { value: 'exact', label: 'Exakt' },
  ];
  const knownImportFingerprints = useMemo(
    () => collectImportedTransactionFingerprints(expenses, incomes),
    [expenses, incomes]
  );

  const counters = useMemo(() => ({
    total: drafts.length,
    duplicates: drafts.filter((item) => item.isDuplicate).length,
    selected: drafts.filter((item) => item.selected && item.direction !== 'ignore').length,
    incomes: drafts.filter((item) => item.direction === 'income').length,
    expenses: drafts.filter((item) => item.direction === 'expense').length,
    accountAssigned: drafts.filter((item) => Boolean(item.accountId)).length,
    rulesApplied: drafts.filter((item) => item.accountSource === 'account-rule' || item.categorySource !== 'local').length,
  }), [drafts]);

  const mapTransactionsToDrafts = (transactions: SyncTransaction[], defaultAccountId: string) => {
    return transactions.map((transaction) => mapSyncTransactionToDraft(transaction, {
      defaultAccountId,
      knownImportFingerprints,
      categoryRules,
      accountRules,
      fixedExpenses,
      incomes,
      debts,
    }));
  };

  const createConnection = () => {
    if (!newConnectionName.trim()) {
      setError('Bitte einen Namen für die ELBA-Verbindung vergeben.');
      return;
    }
    dispatch({
      type: 'ADD_BANK_CONNECTION',
      payload: {
        name: newConnectionName.trim(),
        bankType: 'elba',
        accountId: newConnectionAccountId || undefined,
      },
    });
    setNewConnectionName('');
    setNewConnectionAccountId('');
    setError('');
  };

  const createAccountRule = () => {
    if (!ruleKeyword.trim() || !ruleAccountId) {
      setError('Bitte Suchbegriff und Zielkonto für die Kontoregel angeben.');
      return;
    }

    dispatch({
      type: 'ADD_ACCOUNT_RULE',
      payload: {
        keyword: ruleKeyword.trim(),
        accountId: ruleAccountId,
        category: (ruleCategory || undefined) as ExpenseCategory | undefined,
        matchType: ruleMatchType,
        isActive: true,
      },
    });
    dispatch({
      type: 'ADD_ACTIVITY_LOG',
      payload: {
        action: 'create',
        entity: 'bankSync',
        label: `Kontoregel: "${ruleKeyword.trim()}" → ${accounts.find((account) => account.id === ruleAccountId)?.name || 'Konto'}`,
      },
    });

    setRuleKeyword('');
    setRuleAccountId('');
    setRuleCategory('');
    setRuleMatchType('contains');
    setError('');

    if (syncInfo && selectedConnection) {
      setDrafts(mapTransactionsToDrafts(syncInfo.transactions, selectedConnection.accountId || ''));
    }
  };

  const toggleAccountRule = (rule: AccountRule) => {
    dispatch({
      type: 'UPDATE_ACCOUNT_RULE',
      payload: { ...rule, isActive: !(rule.isActive ?? true) },
    });

    if (syncInfo && selectedConnection) {
      setDrafts(mapTransactionsToDrafts(syncInfo.transactions, selectedConnection.accountId || ''));
    }
  };

  const deleteAccountRule = (ruleId: string) => {
    dispatch({ type: 'DELETE_ACCOUNT_RULE', payload: ruleId });
    if (syncInfo && selectedConnection) {
      setDrafts(mapTransactionsToDrafts(syncInfo.transactions, selectedConnection.accountId || ''));
    }
  };

  const reapplyRuleSuggestions = () => {
    if (!syncInfo || !selectedConnection) return;
    setDrafts(mapTransactionsToDrafts(syncInfo.transactions, selectedConnection.accountId || ''));
    setError('');
  };

  const handleSyncFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedConnection) {
      setError('Bitte zuerst eine ELBA-Verbindung auswählen.');
      event.target.value = '';
      return;
    }

    setLoading(true);
    setError('');
    try {
      const text = await file.text();
      const result = parseSyncFile(text, file.name);
      if (result.transactions.length === 0) {
        throw new Error('Keine verwertbaren Buchungen gefunden.');
      }

      setSourceFileName(file.name);
      setSyncInfo(result);
      setDrafts(mapTransactionsToDrafts(result.transactions, selectedConnection.accountId || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Datei konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const runAICategorization = async () => {
    if (!syncInfo || drafts.length === 0) return;
    setAILoading(true);
    setError('');
    try {
      const byId = new Map(syncInfo.transactions.map((item) => [item.id, item]));
      const suggestions = await categorizeBankTransactionsWithAI({
        settings,
        transactions: drafts.map((draft) => byId.get(draft.id)).filter(Boolean) as SyncTransaction[],
        categories: expenseCategoryOptions.map((option) => ({ id: option.value, label: option.label })),
      });

      setDrafts((current) => current.map((draft) => {
        const suggestion = suggestions.find((item) => item.id === draft.id);
        if (!suggestion) return draft;

        const keepExistingExpenseCategory = draft.direction === 'expense' && (
          draft.categorySource !== 'local'
          || ((suggestion.category as ExpenseCategory) === 'other' && draft.category !== 'other' && (suggestion.confidence ?? 0) <= (draft.confidence ?? 0))
        );
        const keepExistingIncomeType = draft.direction === 'income'
          && suggestion.incomeType === 'other'
          && draft.incomeType !== 'other'
          && (suggestion.confidence ?? 0) <= (draft.confidence ?? 0);

        return {
          ...draft,
          category: draft.direction === 'expense'
            ? (keepExistingExpenseCategory ? draft.category : (suggestion.category as ExpenseCategory))
            : draft.category,
          incomeType: draft.direction === 'income'
            ? (keepExistingIncomeType ? draft.incomeType : suggestion.incomeType)
            : draft.incomeType,
          description: suggestion.description || draft.description,
          note: suggestion.note || draft.note,
          confidence: Math.max(suggestion.confidence ?? 0, draft.confidence ?? 0) || undefined,
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Kategorisierung fehlgeschlagen.');
    } finally {
      setAILoading(false);
    }
  };

  const importSelected = () => {
    if (!selectedConnection) {
      setError('Keine Verbindung ausgewählt.');
      return;
    }

    const selected = drafts.filter((item) => item.selected && item.direction !== 'ignore');
    if (selected.length === 0) {
      setError('Bitte mindestens eine Buchung auswählen.');
      return;
    }

    const importedHashes: string[] = [];

    selected.forEach((draft) => {
      const resolvedAccountId = draft.accountId || selectedConnection.accountId || undefined;
      const importAccountLabel = resolvedAccountId ? accounts.find((account) => account.id === resolvedAccountId)?.name : undefined;
      if (draft.direction === 'expense') {
        dispatch({
          type: 'ADD_EXPENSE',
          payload: {
            description: draft.description,
            amount: draft.amount,
            category: draft.category,
            date: draft.date,
            month: draft.date.slice(0, 7),
            accountId: resolvedAccountId,
            linkedDebtId: draft.existingMatchType === 'debt' ? draft.existingMatchTargetId || undefined : undefined,
            bankImportMatch: draft.existingMatchType === 'fixedExpense' && draft.existingMatchTargetId
              ? { type: 'fixedExpense', targetId: draft.existingMatchTargetId }
              : undefined,
            tags: ['banksync', 'elba'],
            note: composeImportedTransactionNote(draft.note, importAccountLabel, sourceFileName),
          },
        });
      } else {
        dispatch({
          type: 'ADD_INCOME',
          payload: {
            name: draft.description,
            amount: draft.amount,
            type: draft.incomeType,
            isRecurring: false,
            date: draft.date,
            month: draft.date.slice(0, 7),
            accountId: resolvedAccountId,
            bankImportMatch: draft.existingMatchType === 'recurringIncome' && draft.existingMatchTargetId
              ? { type: 'recurringIncome', targetId: draft.existingMatchTargetId }
              : undefined,
            note: composeImportedTransactionNote(draft.note, importAccountLabel, sourceFileName),
          },
        });
      }
      importedHashes.push(draft.fingerprint);
    });

    saveImportedHashes(importedHashes);
    dispatch({
      type: 'ADD_SYNC_SESSION',
      payload: {
        id: generateId(),
        connectionId: selectedConnection.id,
        syncedAt: new Date().toISOString(),
        fileName: sourceFileName || 'manuell',
        transactionCount: drafts.length,
        newCount: selected.length,
        skippedCount: drafts.length - selected.length,
      },
    });

    setDrafts([]);
    setSyncInfo(null);
    setSourceFileName('');
    setError('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bank Sync (ELBA)</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">Importiere ELBA CSV/MT940, erkenne Duplikate automatisch und hole nur neue Umsätze.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge color="#3b82f6">ELBA CSV</Badge>
          <Badge color="#8b5cf6">MT940</Badge>
          <Badge color="#10b981">Duplikat-Schutz</Badge>
        </div>
      </div>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">1. Verbindung anlegen</h3>
        <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-gray-500">Einmalige Einrichtung wie in Finanz-Apps: Verbindung speichern und beim nächsten Sync wiederverwenden.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input value={newConnectionName} onChange={setNewConnectionName} label="Verbindungsname" placeholder="z.B. ELBA Girokonto Privat" />
          <Select value={newConnectionAccountId} onChange={setNewConnectionAccountId} label="Standardkonto" options={accountOptions} />
          <div className="flex items-end">
            <Button onClick={createConnection} className="w-full">Verbindung speichern</Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">2. Automatische Zuweisung</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Kategorie-Regeln und Kontoregeln greifen beim Bank Sync und beim direkten Kontoauszug-Import in Konten.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge color="#2563eb">{categoryRules.length} Kategorie-Regeln</Badge>
            <Badge color="#0f766e">{accountRules.length} Kontoregeln</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
          <Input value={ruleKeyword} onChange={setRuleKeyword} label="Suchbegriff" placeholder="z.B. Raiffeisen Energie, Spar, REWE" />
          <Select value={ruleAccountId} onChange={setRuleAccountId} label="Zielkonto" options={accountOptions} placeholder="Konto wählen" />
          <Select value={ruleCategory} onChange={setRuleCategory} label="Kategorie optional" options={accountRuleCategoryOptions} />
          <Select value={ruleMatchType} onChange={(value) => setRuleMatchType(value as NonNullable<AccountRule['matchType']>)} label="Treffer" options={accountRuleMatchTypeOptions} />
          <div className="flex items-end">
            <Button onClick={createAccountRule} className="w-full">Kontoregel speichern</Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {accountRules.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-gray-500">Noch keine Kontoregeln. Lege Regeln an, damit wiederkehrende Gegenparteien direkt dem richtigen Konto zugewiesen werden.</p>
          ) : (
            accountRules.map((rule) => {
              const ruleAccount = accounts.find((account) => account.id === rule.accountId);
              return (
                <div key={rule.id} className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 ${rule.isActive ?? true ? 'border-slate-200 dark:border-gray-800' : 'border-slate-200/60 opacity-60 dark:border-gray-800'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color={(rule.isActive ?? true) ? '#0f766e' : '#64748b'}>{(rule.isActive ?? true) ? 'Aktiv' : 'Pausiert'}</Badge>
                        <Badge color="#334155">{rule.matchType || 'contains'}</Badge>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{rule.keyword}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                        Konto: {ruleAccount?.name || 'Unbekannt'}{rule.category ? ` • Kategorie: ${expenseCategoryOptions.find((option) => option.value === rule.category)?.label || rule.category}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => toggleAccountRule(rule)}>{(rule.isActive ?? true) ? 'Pausieren' : 'Aktivieren'}</Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteAccountRule(rule.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">3. Sync starten</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            value={connectionId}
            onChange={setConnectionId}
            label="ELBA-Verbindung"
            options={connectionOptions}
            placeholder="Verbindung wählen"
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Kontoauszug (CSV/MT940)</label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600">
              <span className="inline-flex items-center gap-2">
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                {loading ? 'Lese Datei...' : 'Datei auswählen'}
              </span>
              <input type="file" accept=".csv,.mt940,.sta,text/plain" onChange={handleSyncFile} className="sr-only" />
            </label>
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={runAICategorization} disabled={drafts.length === 0 || aiLoading} className="w-full">
              {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
              Mit AI verfeinern
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={reapplyRuleSuggestions} disabled={!syncInfo || !selectedConnection}>
            Regeln neu anwenden
          </Button>
        </div>

        {sourceFileName && (
          <p className="mt-3 text-sm text-slate-600 dark:text-gray-400">
            Quelle: <span className="font-semibold">{sourceFileName}</span>
            {syncInfo?.fileType ? ` · Format: ${syncInfo.fileType}` : ''}
          </p>
        )}
      </Card>

      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      {drafts.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon="FileSpreadsheet"
            title="Noch keine Sync-Daten"
            description="Wähle eine Verbindung und lade einen ELBA-Export hoch."
          />
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              { label: 'Buchungen', value: counters.total },
              { label: 'Neu', value: counters.total - counters.duplicates },
              { label: 'Duplikate', value: counters.duplicates },
              { label: 'Ausgaben', value: counters.expenses },
              { label: 'Einnahmen', value: counters.incomes },
              { label: 'Regel-Treffer', value: counters.rulesApplied },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 p-3 text-center dark:border-gray-800">
                <p className="text-[11px] font-medium text-slate-500 dark:text-gray-500">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="max-h-[45dvh] space-y-3 overflow-y-auto pr-1">
            {drafts.map((draft) => (
              <div key={draft.id} className={`rounded-2xl border p-4 ${draft.isDuplicate ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10' : 'border-slate-200 dark:border-gray-800'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, selected: event.target.checked } : item))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{draft.description}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        {draft.date}
                        {draft.isDuplicate ? ' · vermutlich schon importiert' : ''}
                        {draft.confidence ? ` · AI ${Math.round(draft.confidence * 100)}%` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {draft.isDuplicate && <Badge color="#d97706">Duplikat</Badge>}
                        {draft.accountSource === 'account-rule' && <Badge color="#0f766e">Kontoregel: {draft.accountRuleKeyword}</Badge>}
                        {draft.accountSource === 'default-account' && <Badge color="#2563eb">Standardkonto</Badge>}
                        {draft.categorySource === 'category-rule' && <Badge color="#7c3aed">Kategorie-Regel: {draft.categoryRuleKeyword}</Badge>}
                        {draft.categorySource === 'account-rule' && <Badge color="#8b5cf6">Kategorie aus Kontoregel</Badge>}
                        {draft.existingMatchType !== 'none' && <Badge color="#0f172a">Abgleich: {draft.existingMatchTargetLabel || draft.existingMatchType}</Badge>}
                      </div>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${draft.direction === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {draft.direction === 'expense' ? '-' : '+'}{formatCurrency(draft.amount, settings)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Select
                    label="Typ"
                    value={draft.direction}
                    onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, direction: value as SyncDraft['direction'] } : item))}
                    options={[
                      { value: 'expense', label: 'Als Ausgabe importieren' },
                      { value: 'income', label: 'Als Einnahme importieren' },
                      { value: 'ignore', label: 'Ignorieren' },
                    ]}
                  />
                  <Input
                    label="Beschreibung"
                    value={draft.description}
                    onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, description: value } : item))}
                    placeholder="Beschreibung"
                  />
                  <Input
                    label="Betrag"
                    type="number"
                    value={draft.amount}
                    onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, amount: Number(value) || 0 } : item))}
                    placeholder="0.00"
                  />
                  <Input
                    label="Datum"
                    type="date"
                    value={draft.date}
                    onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, date: value } : item))}
                  />
                  {draft.direction === 'expense' ? (
                    <Select
                      label="Kategorie"
                      value={draft.category}
                      onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, category: value as ExpenseCategory } : item))}
                      options={expenseCategoryOptions}
                    />
                  ) : (
                    <Select
                      label="Einnahmetyp"
                      value={draft.incomeType}
                      onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, incomeType: value as IncomeType } : item))}
                      options={incomeTypeOptions}
                    />
                  )}
                  <Select
                    label="Konto"
                    value={draft.accountId}
                    onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, accountId: value } : item))}
                    options={accountOptions}
                  />
                  <Select
                    label="Abgleich"
                    value={draft.existingMatchType}
                    onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? {
                      ...item,
                      existingMatchType: value as SyncDraft['existingMatchType'],
                      existingMatchTargetId: '',
                      existingMatchTargetLabel: undefined,
                      existingMatchDetail: undefined,
                    } : item))}
                    options={draft.direction === 'expense'
                      ? [
                          { value: 'none', label: 'Kein Abgleich' },
                          { value: 'fixedExpense', label: 'Als Fixkosten-Treffer' },
                          { value: 'debt', label: 'Als Kreditrate' },
                        ]
                      : [
                          { value: 'none', label: 'Kein Abgleich' },
                          { value: 'recurringIncome', label: 'Mit wiederkehrender Einnahme abgleichen' },
                        ]}
                  />
                  {draft.existingMatchType === 'fixedExpense' && (
                    <Select
                      label="Fixkosten-Ziel"
                      value={draft.existingMatchTargetId}
                      onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? {
                        ...item,
                        existingMatchTargetId: value,
                        existingMatchTargetLabel: fixedExpenses.find((fixedExpense) => fixedExpense.id === value)?.name,
                      } : item))}
                      options={fixedExpenseMatchOptions}
                    />
                  )}
                  {draft.existingMatchType === 'debt' && (
                    <Select
                      label="Kredit-Ziel"
                      value={draft.existingMatchTargetId}
                      onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? {
                        ...item,
                        existingMatchTargetId: value,
                        existingMatchTargetLabel: debts.find((debt) => debt.id === value)?.name,
                      } : item))}
                      options={debtMatchOptions}
                    />
                  )}
                  {draft.existingMatchType === 'recurringIncome' && (
                    <Select
                      label="Einnahme-Ziel"
                      value={draft.existingMatchTargetId}
                      onChange={(value) => setDrafts((current) => current.map((item) => item.id === draft.id ? {
                        ...item,
                        existingMatchTargetId: value,
                        existingMatchTargetLabel: incomes.find((income) => income.id === value)?.name,
                      } : item))}
                      options={recurringIncomeMatchOptions}
                    />
                  )}
                </div>
                {draft.existingMatchType !== 'none' && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">
                    Vorschlag: {draft.existingMatchDetail || draft.existingMatchType}
                    {draft.existingMatchConfidence ? ` · ${Math.round(draft.existingMatchConfidence * 100)}%` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-gray-500">Ausgewählt für Import: <span className="font-semibold">{counters.selected}</span></p>
            <Button onClick={importSelected} icon="CheckCircle2">Neue Umsätze importieren</Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Letzte Sync-Läufe</h3>
          <FileSpreadsheet size={17} className="text-slate-400" />
        </div>
        <div className="mt-3 space-y-2">
          {syncSessions.slice(0, 8).map((session) => {
            const connection = bankConnections.find((item) => item.id === session.connectionId);
            return (
              <div key={session.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{connection?.name || 'Verbindung'}</p>
                <p className="text-xs text-slate-500 dark:text-gray-500">
                  {new Date(session.syncedAt).toLocaleString('de-DE')} · {session.fileName} · neu {session.newCount} · übersprungen {session.skippedCount}
                </p>
              </div>
            );
          })}
          {syncSessions.length === 0 && <p className="text-sm text-slate-400 dark:text-gray-600">Noch keine Sync-Historie.</p>}
        </div>
      </Card>
    </div>
  );
}

function mapSyncTransactionToDraft(
  transaction: SyncTransaction,
  options: {
    defaultAccountId: string;
    knownImportFingerprints: Set<string>;
    categoryRules: ReturnType<typeof useFinance>['state']['categoryRules'];
    accountRules: ReturnType<typeof useFinance>['state']['accountRules'];
    fixedExpenses: ReturnType<typeof useFinance>['state']['fixedExpenses'];
    incomes: ReturnType<typeof useFinance>['state']['incomes'];
    debts: ReturnType<typeof useFinance>['state']['debts'];
  }
): SyncDraft {
  const suggestion = suggestBankTransactionAssignment(transaction, {
    defaultAccountId: options.defaultAccountId,
    categoryRules: options.categoryRules,
    accountRules: options.accountRules,
  });
  const existingMatch = suggestExistingBankTransactionMatch(transaction, {
    accountId: suggestion.accountId || options.defaultAccountId,
    fixedExpenses: options.fixedExpenses,
    incomes: options.incomes,
    debts: options.debts,
  });
  const isDuplicate = transaction.isDuplicate || options.knownImportFingerprints.has(transaction.fingerprint);

  return {
    id: transaction.id,
    selected: !isDuplicate,
    direction: transaction.amount < 0 ? 'expense' : 'income',
    date: transaction.date,
    amount: Math.abs(transaction.amount),
    description: transaction.description,
    note: transaction.purpose || '',
    category: suggestion.category,
    incomeType: suggestion.incomeType,
    accountId: suggestion.accountId,
    confidence: Math.max(transaction.classificationConfidence, suggestion.confidence),
    isDuplicate,
    fingerprint: transaction.fingerprint,
    categorySource: suggestion.categorySource,
    accountSource: suggestion.accountSource,
    categoryRuleKeyword: suggestion.categoryRuleKeyword,
    accountRuleKeyword: suggestion.accountRuleKeyword,
    existingMatchType: existingMatch.type,
    existingMatchTargetId: existingMatch.targetId || '',
    existingMatchTargetLabel: existingMatch.targetLabel,
    existingMatchDetail: existingMatch.detail,
    existingMatchConfidence: existingMatch.confidence,
  };
}
