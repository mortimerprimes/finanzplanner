import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, Badge } from '../components/ui';
import { formatCurrency, reconcileFixedExpensesForMonth } from '../utils/helpers';
import { FIXED_EXPENSE_CATEGORIES } from '../utils/constants';
import { FixedExpense, FixedExpenseCategory } from '../types';
import { Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

export function FixedExpensesPage() {
  const { state, dispatch } = useFinance();
  const { fixedExpenses, settings, expenses, selectedMonth } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FixedExpenseCategory>('housing');
  const [dueDay, setDueDay] = useState('1');
  const [note, setNote] = useState('');

  const activeExpenses = fixedExpenses.filter(e => e.isActive);
  const fixedReconciliation = reconcileFixedExpensesForMonth(fixedExpenses, expenses, selectedMonth);
  const totalFixed = fixedReconciliation.totalEffective;

  const openModal = (expense?: FixedExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setName(expense.name); setAmount(expense.amount.toString());
      setCategory(expense.category); setDueDay(expense.dueDay.toString()); setNote(expense.note || '');
    } else {
      setEditingExpense(null);
      setName(''); setAmount(''); setCategory('housing'); setDueDay('1'); setNote('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingExpense(null); };

  const handleSubmit = () => {
    if (!name || !amount) return;
    const data = { name, amount: parseFloat(amount), category, dueDay: parseInt(dueDay), isActive: editingExpense?.isActive ?? true, note: note || undefined };
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Monatliche Fixkosten: {formatCurrency(totalFixed, settings)}
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {activeExpenses.length} aktive Fixkosten
            {fixedReconciliation.matchedImportedExpenseIds.size > 0 ? ` · ${fixedReconciliation.matchedImportedExpenseIds.size} Buchungen abgeglichen` : ''}
          </p>
        </div>
        <Button onClick={() => openModal()} icon="Plus">Fixkosten hinzufügen</Button>
      </div>

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
                  {items.map((expense) => (
                    <Card key={expense.id} className={`p-4 ${!expense.isActive ? 'opacity-50' : ''}`}>
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
                              {fixedReconciliation.matchedFixedExpenseIds.has(expense.id) && (
                                <Badge color="#0ea5e9">Abgeglichen</Badge>
                              )}
                            </div>
                            {expense.note && <p className="text-xs text-slate-500 dark:text-gray-500 truncate">{expense.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">-{formatCurrency(expense.amount, settings)}</p>
                          <div className="flex gap-1">
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
                  ))}
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
