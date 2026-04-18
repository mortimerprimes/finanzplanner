import { ChangeEvent, useMemo, useState } from 'react';
import { BrainCircuit, FileSpreadsheet, Pencil, Sparkles, Trash2, Upload, WalletCards } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Modal, Select, EmptyState, Icon, Badge } from '../components/ui';
import { ACCOUNT_TYPES, INCOME_TYPES, UI_COLORS } from '../utils/constants';
import { calculateNetWorth, formatCurrency, getExpenseCategoryMap } from '../utils/helpers';
import { categorizeBankTransactionsWithAI } from '../services/ai';
import { classifyBankTransactionLocally, parseBankStatementCsv, ParsedBankTransaction } from '../utils/bankImport';
import { hashTransaction } from '../utils/elbaSync';
import type { Account, AccountType, ExpenseCategory, IncomeType } from '../types';

interface BankImportDraft {
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
}

export function AccountsPage() {
  const { state, dispatch } = useFinance();
  const { accounts, debts, transfers, settings, expenses, incomes } = state;

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [color, setColor] = useState(UI_COLORS[0]);
  const [note, setNote] = useState('');

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const [importAccountId, setImportAccountId] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importAILoading, setImportAILoading] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedBankTransaction[]>([]);
  const [importDrafts, setImportDrafts] = useState<BankImportDraft[]>([]);

  const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalLiabilities = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const netWorth = calculateNetWorth(accounts, debts);

  const allocation = useMemo(() => {
    return Object.values(ACCOUNT_TYPES).map((accountType) => {
      const total = accounts
        .filter((account) => account.type === accountType.id)
        .reduce((sum, account) => sum + account.balance, 0);
      return { ...accountType, total };
    }).filter((item) => item.total !== 0);
  }, [accounts]);

  const accountOptions = accounts.map((account) => ({ value: account.id, label: account.name }));
  const typeOptions = Object.values(ACCOUNT_TYPES).map((accountType) => ({ value: accountType.id, label: accountType.labelDe }));
  const expenseCategoryOptions = Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({ value, label: info.labelDe }));
  const incomeTypeOptions = Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));
  const importAccountOptions = [{ value: '', label: 'Ohne Konto importieren' }, ...accountOptions];

  const importCounts = useMemo(() => ({
    total: importDrafts.length,
    selected: importDrafts.filter((draft) => draft.selected && draft.direction !== 'ignore').length,
    expenses: importDrafts.filter((draft) => draft.direction === 'expense').length,
    incomes: importDrafts.filter((draft) => draft.direction === 'income').length,
  }), [importDrafts]);

  const existingImportFingerprints = useMemo(() => {
    const importedExpenses = expenses
      .filter((expense) =>
        expense.tags?.includes('bankimport')
        || expense.tags?.includes('banksync')
        || (expense.note || '').includes('Quelle:')
      )
      .map((expense) => hashTransaction(expense.date, -Math.abs(expense.amount), expense.description));

    const importedIncomes = incomes
      .filter((income) => (income.note || '').includes('Quelle:'))
      .flatMap((income) => {
        const date = income.date || income.createdAt.slice(0, 10);
        return date ? [hashTransaction(date, Math.abs(income.amount), income.name)] : [];
      });

    return new Set([...importedExpenses, ...importedIncomes]);
  }, [expenses, incomes]);

  const openAccountModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setName(account.name);
      setBalance(account.balance.toString());
      setType(account.type);
      setColor(account.color);
      setNote(account.note || '');
    } else {
      setEditingAccount(null);
      setName('');
      setBalance('');
      setType('checking');
      setColor(UI_COLORS[0]);
      setNote('');
    }
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleSaveAccount = () => {
    if (!name || !balance) return;

    const accountTypeInfo = ACCOUNT_TYPES[type];
    const payload = {
      name,
      type,
      balance: parseFloat(balance),
      color,
      icon: accountTypeInfo.icon,
      isDefault: editingAccount?.isDefault ?? accounts.length === 0,
      note: note || undefined,
    };

    if (editingAccount) {
      dispatch({ type: 'UPDATE_ACCOUNT', payload: { ...editingAccount, ...payload } });
    } else {
      dispatch({ type: 'ADD_ACCOUNT', payload });
    }

    closeAccountModal();
  };

  const handleDeleteAccount = (id: string) => {
    if (confirm('Konto wirklich loeschen?')) {
      dispatch({ type: 'DELETE_ACCOUNT', payload: id });
    }
  };

  const handleTransfer = () => {
    if (!fromAccountId || !toAccountId || !transferAmount || fromAccountId === toAccountId) return;

    dispatch({
      type: 'ADD_TRANSFER',
      payload: {
        fromAccountId,
        toAccountId,
        amount: parseFloat(transferAmount),
        date: new Date().toISOString().slice(0, 10),
        note: transferNote || undefined,
      },
    });

    setTransferModalOpen(false);
    setTransferAmount('');
    setTransferNote('');
  };

  const resetImportFlow = () => {
    setImportModalOpen(false);
    setImportAccountId('');
    setImportFileName('');
    setImportError('');
    setImportLoading(false);
    setImportAILoading(false);
    setParsedTransactions([]);
    setImportDrafts([]);
  };

  const mapTransactionToDraft = (transaction: ParsedBankTransaction, accountId: string): BankImportDraft => {
    const local = classifyBankTransactionLocally(transaction);
    return {
      id: transaction.id,
      selected: true,
      direction: transaction.amount < 0 ? 'expense' : 'income',
      date: transaction.date,
      amount: Math.abs(transaction.amount),
      description: transaction.description,
      note: transaction.purpose || '',
      category: local.category as ExpenseCategory,
      incomeType: local.incomeType,
      accountId,
      confidence: local.confidence,
    };
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    try {
      const text = await file.text();
      const transactions = parseBankStatementCsv(text);
      if (transactions.length === 0) {
        throw new Error('Im CSV wurden keine verwertbaren Buchungen gefunden.');
      }

      setImportFileName(file.name);
      setParsedTransactions(transactions);
      setImportDrafts(transactions.map((transaction) => mapTransactionToDraft(transaction, importAccountId)));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Der Kontoauszug konnte nicht gelesen werden.');
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const runAICategorization = async () => {
    if (parsedTransactions.length === 0) {
      setImportError('Bitte zuerst einen CSV-Kontoauszug hochladen.');
      return;
    }

    setImportAILoading(true);
    setImportError('');
    try {
      const suggestions = await categorizeBankTransactionsWithAI({
        settings,
        transactions: parsedTransactions,
        categories: expenseCategoryOptions.map((option) => ({ id: option.value, label: option.label })),
      });

      setImportDrafts((currentDrafts) => currentDrafts.map((draft) => {
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
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'AI-Kategorisierung fehlgeschlagen.');
    } finally {
      setImportAILoading(false);
    }
  };

  const importBankTransactions = () => {
    const selectedDrafts = importDrafts.filter((draft) => draft.selected && draft.direction !== 'ignore');
    if (selectedDrafts.length === 0) {
      setImportError('Bitte mindestens eine Buchung zum Import auswählen.');
      return;
    }

    const accountLabel = accounts.find((account) => account.id === importAccountId)?.name;
    const seenFingerprints = new Set(existingImportFingerprints);
    const dedupedDrafts = selectedDrafts.filter((draft) => {
      const signedAmount = draft.direction === 'expense' ? -Math.abs(draft.amount) : Math.abs(draft.amount);
      const fingerprint = hashTransaction(draft.date, signedAmount, draft.description);
      if (seenFingerprints.has(fingerprint)) {
        return false;
      }
      seenFingerprints.add(fingerprint);
      return true;
    });

    if (dedupedDrafts.length === 0) {
      setImportError('Alle ausgewählten Buchungen sind bereits importiert (Duplikate).');
      return;
    }

    dedupedDrafts.forEach((draft) => {
      if (draft.direction === 'expense') {
        dispatch({
          type: 'ADD_EXPENSE',
          payload: {
            description: draft.description,
            amount: draft.amount,
            category: draft.category,
            date: draft.date,
            month: draft.date.slice(0, 7),
            note: [draft.note, accountLabel ? `Importkonto: ${accountLabel}` : '', importFileName ? `Quelle: ${importFileName}` : '']
              .filter(Boolean)
              .join(' · ') || undefined,
            accountId: draft.accountId || undefined,
            tags: ['bankimport'],
          },
        });
        return;
      }

      dispatch({
        type: 'ADD_INCOME',
        payload: {
          name: draft.description,
          amount: draft.amount,
          type: draft.incomeType,
          isRecurring: false,
          date: draft.date,
          month: draft.date.slice(0, 7),
          note: [draft.note, accountLabel ? `Importkonto: ${accountLabel}` : '', importFileName ? `Quelle: ${importFileName}` : '']
            .filter(Boolean)
            .join(' · ') || undefined,
        },
      });
    });

    resetImportFlow();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Konten & Nettovermögen</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">Verwalte Konten, Assets und interne Umbuchungen wie in Premium-Apps</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportModalOpen(true)} icon="Upload">Kontoauszug importieren</Button>
          <Button variant="secondary" onClick={() => setTransferModalOpen(true)} icon="ArrowRightLeft">Transfer</Button>
          <Button onClick={() => openAccountModal()} icon="Plus">Konto hinzufügen</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Assets gesamt</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAssets, settings)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Verbindlichkeiten</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalLiabilities, settings)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-500">Nettovermögen</p>
          <p className={`mt-1 text-2xl font-bold ${netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(netWorth, settings)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Kontenübersicht</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500">Liquidität, Sparkonten, Kreditkarten und Investments</p>
            </div>
            <WalletCards size={18} className="text-blue-500" />
          </div>

          {accounts.length === 0 ? (
            <EmptyState
              icon="WalletCards"
              title="Noch keine Konten"
              description="Lege Konten an, um Assets und Nettovermögen sichtbar zu machen."
              action={{ label: 'Erstes Konto anlegen', onClick: () => openAccountModal() }}
            />
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const accountType = ACCOUNT_TYPES[account.type];
                return (
                  <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-xl p-2.5" style={{ backgroundColor: `${account.color}18` }}>
                        <Icon name={account.icon || accountType.icon} size={18} color={account.color || accountType.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{account.name}</p>
                          <Badge color={account.color || accountType.color}>{accountType.labelDe}</Badge>
                          {account.isDefault && <Badge color="#10b981">Standard</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-gray-500 truncate">{account.note || 'Kein Hinweis hinterlegt'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-lg font-bold ${account.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(account.balance, settings)}
                      </p>
                      <div className="flex gap-1">
                        <button onClick={() => openAccountModal(account)} className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800">
                          <Pencil size={15} className="text-slate-400" />
                        </button>
                        <button onClick={() => handleDeleteAccount(account.id)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 size={15} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
          {allocation.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400 dark:text-gray-600">Noch keine Kontodaten</div>
          ) : (
            <div className="space-y-3">
              {allocation.map((item) => {
                const share = totalAssets > 0 ? (item.total / totalAssets) * 100 : 0;
                return (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-gray-800/50">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon name={item.icon} size={16} color={item.color} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{item.labelDe}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total, settings)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-700">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-gray-800">
            <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Letzte Transfers</h4>
            <div className="space-y-2">
              {transfers.slice(-4).reverse().map((transfer) => {
                const from = accounts.find((account) => account.id === transfer.fromAccountId);
                const to = accounts.find((account) => account.id === transfer.toAccountId);
                return (
                  <div key={transfer.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-800/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{from?.name || 'Quelle'} → {to?.name || 'Ziel'}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">{transfer.date}{transfer.note ? ` · ${transfer.note}` : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(transfer.amount, settings)}</span>
                  </div>
                );
              })}
              {transfers.length === 0 && <p className="text-sm text-slate-400 dark:text-gray-600">Noch keine Transfers</p>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Kontoauszug-Import mit AI</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500">CSV von der Bank hochladen, automatisch kategorisieren und vor dem Import prüfen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge color="#3b82f6">CSV-Import</Badge>
            <Badge color="#8b5cf6">AI-Kategorisierung</Badge>
            <Badge color="#10b981">Vorschau vor Import</Badge>
          </div>
        </div>
      </Card>

      <Modal isOpen={accountModalOpen} onClose={closeAccountModal} title={editingAccount ? 'Konto bearbeiten' : 'Neues Konto'}>
        <div className="space-y-4">
          <Input label="Kontoname" value={name} onChange={setName} placeholder="z.B. Girokonto, Tagesgeld, Depot" icon="Wallet" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Kontotyp" value={type} onChange={(value) => setType(value as AccountType)} options={typeOptions} />
            <Input label="Aktueller Kontostand" type="number" value={balance} onChange={setBalance} placeholder="0.00" icon="Euro" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Farbe</label>
            <div className="flex flex-wrap gap-2">
              {UI_COLORS.map((itemColor) => (
                <button
                  key={itemColor}
                  onClick={() => setColor(itemColor)}
                  className={`h-8 w-8 rounded-full border-2 ${color === itemColor ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: itemColor }}
                />
              ))}
            </div>
          </div>
          <Input label="Notiz (optional)" value={note} onChange={setNote} placeholder="Bank, Zweck oder Kommentar" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeAccountModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSaveAccount} className="flex-1">{editingAccount ? 'Speichern' : 'Anlegen'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Transfer zwischen Konten">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Von" value={fromAccountId} onChange={setFromAccountId} options={accountOptions} />
            <Select label="Nach" value={toAccountId} onChange={setToAccountId} options={accountOptions} />
          </div>
          <Input label="Betrag" type="number" value={transferAmount} onChange={setTransferAmount} placeholder="0.00" icon="Euro" />
          <Input label="Notiz (optional)" value={transferNote} onChange={setTransferNote} placeholder="Umbuchung oder Sparrate" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)} className="flex-1">Abbrechen</Button>
            <Button onClick={handleTransfer} className="flex-1">Transfer speichern</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={importModalOpen} onClose={resetImportFlow} title="Kontoauszug importieren">
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-blue-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">CSV von deiner Bank hochladen</p>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
              Geeignet für typische deutsche Bankexporte wie Raiffeisenbank, Volksbank oder Sparkasse. Die App liest Datum, Betrag und Buchungstext aus und ordnet alles vor dem Import zu.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Konto zuweisen" value={importAccountId} onChange={setImportAccountId} options={importAccountOptions} />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">CSV-Datei</label>
              <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600">
                <span className="inline-flex items-center gap-2">
                  <Upload size={16} />
                  {importLoading ? 'Lese CSV...' : 'CSV auswählen'}
                </span>
                <input type="file" accept=".csv,text/csv" onChange={handleImportFile} className="sr-only" />
              </label>
            </div>
          </div>

          {importFileName && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
              Geladen: <span className="font-semibold">{importFileName}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={runAICategorization} disabled={importAILoading || parsedTransactions.length === 0}>
              {importAILoading ? <Sparkles size={14} className="animate-pulse" /> : <BrainCircuit size={14} />}
              Mit AI kategorisieren
            </Button>
            <Button
              variant="secondary"
              onClick={() => setImportDrafts((current) => current.map((draft) => ({ ...draft, accountId: importAccountId })))}
              disabled={importDrafts.length === 0}
            >
              Konto für alle übernehmen
            </Button>
          </div>

          {importError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{importError}</p>}

          {importDrafts.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Buchungen', value: importCounts.total },
                  { label: 'Ausgaben', value: importCounts.expenses },
                  { label: 'Einnahmen', value: importCounts.incomes },
                  { label: 'Ausgewählt', value: importCounts.selected },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 p-3 text-center dark:border-gray-800">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-gray-500">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="max-h-[45dvh] space-y-3 overflow-y-auto pr-1">
                {importDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={draft.selected}
                          onChange={(event) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, selected: event.target.checked } : item))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{draft.description}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-500">{draft.date}{draft.confidence ? ` · AI ${Math.round(draft.confidence * 100)}%` : ''}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${draft.direction === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {draft.direction === 'expense' ? '-' : '+'}{formatCurrency(draft.amount, settings)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select
                        label="Typ"
                        value={draft.direction}
                        onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, direction: value as BankImportDraft['direction'] } : item))}
                        options={[
                          { value: 'expense', label: 'Als Ausgabe importieren' },
                          { value: 'income', label: 'Als Einnahme importieren' },
                          { value: 'ignore', label: 'Ignorieren' },
                        ]}
                      />
                      <Input
                        label="Beschreibung"
                        value={draft.description}
                        onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, description: value } : item))}
                        placeholder="Beschreibung"
                      />
                      <Input
                        label="Betrag"
                        type="number"
                        value={draft.amount}
                        onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, amount: Number(value) || 0 } : item))}
                        placeholder="0.00"
                      />
                      <Input
                        label="Datum"
                        type="date"
                        value={draft.date}
                        onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, date: value } : item))}
                      />
                      {draft.direction === 'expense' ? (
                        <Select
                          label="Kategorie"
                          value={draft.category}
                          onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, category: value as ExpenseCategory } : item))}
                          options={expenseCategoryOptions}
                        />
                      ) : (
                        <Select
                          label="Einnahmetyp"
                          value={draft.incomeType}
                          onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, incomeType: value as IncomeType } : item))}
                          options={incomeTypeOptions}
                        />
                      )}
                      <Select
                        label="Konto"
                        value={draft.accountId}
                        onChange={(value) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, accountId: value } : item))}
                        options={importAccountOptions}
                      />
                    </div>

                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Notiz</label>
                      <textarea
                        value={draft.note}
                        onChange={(event) => setImportDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, note: event.target.value } : item))}
                        rows={2}
                        className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={resetImportFlow} className="flex-1">Abbrechen</Button>
            <Button onClick={importBankTransactions} className="flex-1" disabled={importDrafts.length === 0}>
              Importieren
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
