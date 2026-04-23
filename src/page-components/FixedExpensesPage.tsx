import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, Badge } from '../components/ui';
import { formatCurrency, reconcileFixedExpensesForMonth, getMonthDisplayName } from '../utils/helpers';
import { focusElementById, getSearchFocus } from '../utils/searchFocus';
import { FIXED_EXPENSE_CATEGORIES } from '../utils/constants';
import { FixedExpense, FixedExpenseCategory } from '../types';
import { Pencil, Trash2, ToggleLeft, ToggleRight, Link2, CheckCircle2, Play, Undo2 } from 'lucide-react';

function isAutoBookEnabled(expense: Pick<FixedExpense, 'autoBookEnabled'>): boolean {
  return expense.autoBookEnabled ?? true;
}

export function FixedExpensesPage() {
  const { state, dispatch } = useFinance();
  const { fixedExpenses, debts, settings, expenses, selectedMonth, autoBookings, accounts } = state;
  const lastSearchFocusRef = useRef('');
  const searchParams = useSearchParams();
  const fixedExpenseFocus = getSearchFocus(searchParams, 'fixed-expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [highlightedExpenseId, setHighlightedExpenseId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FixedExpenseCategory>('housing');
  const [dueDay, setDueDay] = useState('1');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [autoBookEnabled, setAutoBookEnabled] = useState(true);

  const activeExpenses = fixedExpenses.filter(e => e.isActive);
  const autoBookableExpenses = activeExpenses.filter((expense) => isAutoBookEnabled(expense));
  const fixedReconciliation = reconcileFixedExpensesForMonth(fixedExpenses, expenses, selectedMonth);
  const totalFixed = fixedReconciliation.totalEffective;

  const monthBookings = useMemo(() => {
    return (autoBookings || []).filter(ab => ab.month === selectedMonth && ab.sourceType === 'fixedExpense');
  }, [autoBookings, selectedMonth]);

  const bookedCount = monthBookings.filter((booking) => autoBookableExpenses.some((expense) => expense.id === booking.sourceId)).length;
  const allBooked = autoBookableExpenses.length > 0 && bookedCount >= autoBookableExpenses.length;

  const debtOptions = [
    { value: '', label: 'Kein Kredit verknüpft' },
    ...debts.map(d => ({ value: d.id, label: `${d.name} (${d.remainingAmount > 0 ? formatCurrency(d.remainingAmount, settings) + ' offen' : 'Bezahlt'})` })),
  ];
  const accountOptions = [{ value: '', label: 'Kein Konto belasten' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];

  const handleAutoBook = () => {
    dispatch({ type: 'RUN_MONTH_AUTO_BOOKING', payload: selectedMonth });
  };

  const handleUndoBooking = (sourceId: string) => {
    if (confirm('Auto-Buchung rückgängig machen?')) {
      dispatch({ type: 'UNDO_AUTO_BOOKING', payload: { month: selectedMonth, sourceId } });
    }
  };

  const openModal = (expense?: FixedExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setName(expense.name); setAmount(expense.amount.toString());
      setCategory(expense.category); setDueDay(expense.dueDay.toString()); setNote(expense.note || '');
      setAccountId(expense.accountId || '');
      setLinkedDebtId(expense.linkedDebtId || '');
      setAutoBookEnabled(isAutoBookEnabled(expense));
    } else {
      setEditingExpense(null);
      setName(''); setAmount(''); setCategory('housing'); setDueDay('1'); setNote('');
      setAccountId('');
      setLinkedDebtId('');
      setAutoBookEnabled(true);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingExpense(null); };

  const handleSubmit = () => {
    if (!name || !amount) return;
    const data: any = {
      name,
      amount: parseFloat(amount),
      category,
      dueDay: parseInt(dueDay),
      isActive: editingExpense?.isActive ?? true,
      autoBookEnabled,
      note: note || undefined,
      accountId: accountId || undefined,
    };
    if (linkedDebtId) data.linkedDebtId = linkedDebtId;
    else data.linkedDebtId = undefined;
    if (editingExpense) {
      dispatch({ type: 'UPDATE_FIXED_EXPENSE', payload: { ...editingExpense, ...data } });
    } else {
      dispatch({ type: 'ADD_FIXED_EXPENSE', payload: data });
    }
    closeModal();
  };

  const toggleActive = (e: FixedExpense) => {
    dispatch({ type: 'UPDATE_FIXED_EXPENSE', payload: { ...e, isActive: !e.isActive } });
  };

  const toggleAutoBook = (expense: FixedExpense) => {
    dispatch({ type: 'UPDATE_FIXED_EXPENSE', payload: { ...expense, autoBookEnabled: !isAutoBookEnabled(expense) } });
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchtest du diese Fixkosten wirklich löschen?')) {
      dispatch({ type: 'DELETE_FIXED_EXPENSE', payload: id });
    }
  };

  const categoryOptions = Object.entries(FIXED_EXPENSE_CATEGORIES).map(([value, info]) => ({ value, label: info.labelDe }));
  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}. des Monats` }));

  const grouped = fixedExpenses.reduce((g, e) => {
    if (!g[e.category]) g[e.category] = [];
    g[e.category].push(e);
    return g;
  }, {} as Record<string, FixedExpense[]>);

  useEffect(() => {
    if (!fixedExpenseFocus) return;

    const signature = fixedExpenseFocus.id;
    if (lastSearchFocusRef.current === signature) return;

    let clearHighlightTimeout: number | undefined;
    const cleanupFocus = focusElementById(`fixed-expense-${fixedExpenseFocus.id}`, () => {
      lastSearchFocusRef.current = signature;
      setHighlightedExpenseId(fixedExpenseFocus.id);
      clearHighlightTimeout = window.setTimeout(() => {
        setHighlightedExpenseId((current) => current === fixedExpenseFocus.id ? null : current);
      }, 2600);
    });

    return () => {
      cleanupFocus();
      if (clearHighlightTimeout) {
        window.clearTimeout(clearHighlightTimeout);
      }
    };
  }, [fixedExpenseFocus?.id]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Monatliche Fixkosten: {formatCurrency(totalFixed, settings)}
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {activeExpenses.length} aktive Fixkosten · {autoBookableExpenses.length} mit Auto-Buchung · {bookedCount} gebucht für {getMonthDisplayName(selectedMonth)}
            {fixedReconciliation.matchedImportedExpenseIds.size > 0 ? ` · ${fixedReconciliation.matchedImportedExpenseIds.size} Buchungen abgeglichen` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!allBooked && autoBookableExpenses.length > 0 && (
            <Button variant="secondary" onClick={handleAutoBook} icon="Play">
              Auto-Buchen ({Math.max(autoBookableExpenses.length - bookedCount, 0)} offen)
            </Button>
          )}
          {allBooked && autoBookableExpenses.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Alle gebucht
            </span>
          )}
          <Button onClick={() => openModal()} icon="Plus">Fixkosten hinzufügen</Button>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Solide gegen Doppelbuchungen</p>
        <div className="mt-2 space-y-1 text-sm text-blue-900/80 dark:text-blue-200/80">
          <p>Auto-Buchung an: Die Fixkostenposition kann per Monatslauf als eigene Buchung erzeugt werden.</p>
          <p>Nur Abgleich: Die Fixkostenposition bleibt fuer Planung und Import-Matching aktiv, erzeugt aber keine automatische Zusatzbuchung.</p>
          <p>Importierte Kontoauszugs-Buchungen werden weiterhin mit passenden Fixkosten abgeglichen und nicht doppelt als neue Ausgabe angelegt.</p>
        </div>
      </Card>

      {/* Category Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(FIXED_EXPENSE_CATEGORIES).slice(0, 4).map(([key, info]) => {
          const catTotal = fixedExpenses.filter(e => e.category === key && e.isActive).reduce((sum, e) => sum + e.amount, 0);
          return (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${info.color}15` }}>
                  <Icon name={info.icon} size={14} color={info.color} />
                </div>
                <span className="text-xs text-slate-500 dark:text-gray-500 truncate">{info.labelDe}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(catTotal, settings)}</p>
            </Card>
          );
        })}
      </div>

      {fixedExpenses.length === 0 ? (
        <Card>
          <EmptyState icon="Receipt" title="Keine Fixkosten"
            description="Füge deine monatlichen Fixkosten hinzu, wie Miete, Strom, Versicherungen und Abonnements."
            action={{ label: 'Erste Fixkosten hinzufügen', onClick: () => openModal() }}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => {
            const catInfo = FIXED_EXPENSE_CATEGORIES[cat as FixedExpenseCategory];
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-gray-600 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Icon name={catInfo.icon} size={14} color={catInfo.color} />
                  {catInfo.labelDe}
                </h3>
                <div className="space-y-2">
                  {items.map((expense) => {
                    const isBooked = monthBookings.some(ab => ab.sourceId === expense.id);
                    const linkedDebt = expense.linkedDebtId ? debts.find(d => d.id === expense.linkedDebtId) : null;
                    return (
                      <Card
                        key={expense.id}
                        id={`fixed-expense-${expense.id}`}
                        className={`scroll-mt-28 p-4 ${!expense.isActive ? 'opacity-50' : ''} ${highlightedExpenseId === expense.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 bg-blue-50/40 dark:bg-blue-950/20 dark:ring-offset-gray-950' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button onClick={() => toggleActive(expense)} className="flex-shrink-0">
                              {expense.isActive
                                ? <ToggleRight size={26} className="text-emerald-500" />
                                : <ToggleLeft size={26} className="text-slate-300 dark:text-gray-600" />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{expense.name}</h4>
                                <Badge color="#94a3b8">{expense.dueDay}. des Monats</Badge>
                                <Badge color={isAutoBookEnabled(expense) ? '#2563eb' : '#64748b'}>
                                  {isAutoBookEnabled(expense) ? 'Auto-Buchung an' : 'Nur Abgleich'}
                                </Badge>
                                {linkedDebt && (
                                  <Badge color="#8b5cf6">
                                    <Link2 size={10} className="inline mr-1" />{linkedDebt.name}
                                  </Badge>
                                )}
                                {isBooked && (
                                  <Badge color="#10b981">
                                    <CheckCircle2 size={10} className="inline mr-1" />Gebucht
                                  </Badge>
                                )}
                                {!isBooked && fixedReconciliation.matchedFixedExpenseIds.has(expense.id) && (
                                  <Badge color="#0ea5e9">Abgeglichen</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-gray-500 truncate">
                                {expense.note || ''}
                                {expense.accountId ? ` · Konto: ${accounts.find((account) => account.id === expense.accountId)?.name || 'zugewiesen'}` : ''}
                                {linkedDebt ? ` · Kredit: ${formatCurrency(linkedDebt.remainingAmount, settings)} offen` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">-{formatCurrency(expense.amount, settings)}</p>
                            <div className="flex gap-1">
                              <button onClick={() => toggleAutoBook(expense)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" title={isAutoBookEnabled(expense) ? 'Auto-Buchung deaktivieren' : 'Auto-Buchung aktivieren'}>
                                {isAutoBookEnabled(expense)
                                  ? <ToggleRight size={15} className="text-blue-500" />
                                  : <ToggleLeft size={15} className="text-slate-400" />}
                              </button>
                              {isBooked && (
                                <button onClick={() => handleUndoBooking(expense.id)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Buchung rückgängig">
                                  <Undo2 size={15} className="text-amber-500" />
                                </button>
                              )}
                              <button onClick={() => openModal(expense)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
                                <Pencil size={15} className="text-slate-400" />
                              </button>
                              <button onClick={() => handleDelete(expense.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                <Trash2 size={15} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingExpense ? 'Fixkosten bearbeiten' : 'Neue Fixkosten'}>
        <div className="space-y-4">
          <Input label="Bezeichnung" value={name} onChange={setName} placeholder="z.B. Miete, Strom, Netflix..." icon="Edit3" />
          <Input label="Betrag (€)" type="number" value={amount} onChange={setAmount} placeholder="0.00" icon="Euro" />
          <Select label="Kategorie" value={category} onChange={(v) => setCategory(v as FixedExpenseCategory)} options={categoryOptions} />
          <Select label="Fälligkeitstag" value={dueDay} onChange={setDueDay} options={dayOptions} />
          <Select label="Belastetes Konto" value={accountId} onChange={setAccountId} options={accountOptions} />
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <input
              type="checkbox"
              checked={autoBookEnabled}
              onChange={(event) => setAutoBookEnabled(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">Auto-Buchung aktivieren</span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-gray-400">
                Wenn deaktiviert, bleibt die Fixkostenposition für Planung und Import-Abgleich aktiv, wird aber nicht per Monatslauf automatisch als Buchung erzeugt.
              </span>
            </span>
          </label>
          {debts.length > 0 && (
            <div>
              <Select label="Verknüpfter Kredit" value={linkedDebtId} onChange={setLinkedDebtId} options={debtOptions} />
              {linkedDebtId && (
                <div className="mt-2 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 p-3">
                  <p className="text-xs text-violet-700 dark:text-violet-300">
                    💡 Beim Auto-Buchen wird der Betrag automatisch als Kreditrate verbucht und der Restbetrag des Kredits entsprechend reduziert.
                  </p>
                </div>
              )}
            </div>
          )}
          <Input label="Notiz (optional)" value={note} onChange={setNote} placeholder="Zusätzliche Informationen..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingExpense ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
