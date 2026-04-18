import { ChangeEvent, useMemo, useState } from 'react';
import { BrainCircuit, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Select, Input, Badge, EmptyState } from '../components/ui';
import { INCOME_TYPES } from '../utils/constants';
import { formatCurrency, generateId, getExpenseCategoryMap } from '../utils/helpers';
import { categorizeBankTransactionsWithAI } from '../services/ai';
import { parseSyncFile, saveImportedHashes, type SyncParseResult, type SyncTransaction } from '../utils/elbaSync';
import type { ExpenseCategory, IncomeType } from '../types';

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
}

export function BankSyncPage() {
  const { state, dispatch } = useFinance();
  const { bankConnections, syncSessions, accounts, settings } = state;

  const [newConnectionName, setNewConnectionName] = useState('');
  const [newConnectionAccountId, setNewConnectionAccountId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [drafts, setDrafts] = useState<SyncDraft[]>([]);
  const [syncInfo, setSyncInfo] = useState<SyncParseResult | null>(null);
  const [sourceFileName, setSourceFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAILoading] = useState(false);

  const selectedConnection = bankConnections.find((item) => item.id === connectionId) || null;
  const accountOptions = [{ value: '', label: 'Ohne Konto importieren' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const connectionOptions = bankConnections.map((item) => ({
    value: item.id,
    label: item.lastSyncAt ? `${item.name} · letzter Sync ${new Date(item.lastSyncAt).toLocaleDateString('de-DE')}` : item.name,
  }));
  const expenseCategoryOptions = Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({ value, label: info.labelDe }));
  const incomeTypeOptions = Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));

  const counters = useMemo(() => ({
    total: drafts.length,
    duplicates: drafts.filter((item) => item.isDuplicate).length,
    selected: drafts.filter((item) => item.selected && item.direction !== 'ignore').length,
    incomes: drafts.filter((item) => item.direction === 'income').length,
    expenses: drafts.filter((item) => item.direction === 'expense').length,
  }), [drafts]);

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
      setDrafts(result.transactions.map((tx) => mapSyncTransactionToDraft(tx, selectedConnection.accountId || '')));
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
        return {
          ...draft,
          category: draft.direction === 'expense' ? (suggestion.category as ExpenseCategory) : draft.category,
          incomeType: draft.direction === 'income' ? suggestion.incomeType : draft.incomeType,
          description: suggestion.description || draft.description,
          note: suggestion.note || draft.note,
          confidence: suggestion.confidence ?? draft.confidence,
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

    const accountLabel = accounts.find((account) => account.id === (selectedConnection.accountId || ''))?.name;
    const importedHashes: string[] = [];

    selected.forEach((draft) => {
      if (draft.direction === 'expense') {
        dispatch({
          type: 'ADD_EXPENSE',
          payload: {
            description: draft.description,
            amount: draft.amount,
            category: draft.category,
            date: draft.date,
            month: draft.date.slice(0, 7),
            accountId: draft.accountId || selectedConnection.accountId || undefined,
            tags: ['banksync', 'elba'],
            note: [draft.note, accountLabel ? `Konto: ${accountLabel}` : '', sourceFileName ? `Quelle: ${sourceFileName}` : '']
              .filter(Boolean)
              .join(' · ') || undefined,
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
            note: [draft.note, accountLabel ? `Konto: ${accountLabel}` : '', sourceFileName ? `Quelle: ${sourceFileName}` : '']
              .filter(Boolean)
              .join(' · ') || undefined,
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">2. Sync starten</h3>
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
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: 'Buchungen', value: counters.total },
              { label: 'Neu', value: counters.total - counters.duplicates },
              { label: 'Duplikate', value: counters.duplicates },
              { label: 'Ausgaben', value: counters.expenses },
              { label: 'Einnahmen', value: counters.incomes },
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
                </div>
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

function mapSyncTransactionToDraft(transaction: SyncTransaction, accountId: string): SyncDraft {
  return {
    id: transaction.id,
    selected: !transaction.isDuplicate,
    direction: transaction.amount < 0 ? 'expense' : 'income',
    date: transaction.date,
    amount: Math.abs(transaction.amount),
    description: transaction.description,
    note: transaction.purpose || '',
    category: transaction.suggestedCategory,
    incomeType: transaction.suggestedIncomeType,
    accountId,
    confidence: transaction.classificationConfidence,
    isDuplicate: transaction.isDuplicate,
    fingerprint: transaction.fingerprint,
  };
}
