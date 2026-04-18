import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, Badge } from '../components/ui';
import { formatCurrency, reconcileIncomesForMonth } from '../utils/helpers';
import { INCOME_TYPES } from '../utils/constants';
import { Income, IncomeType } from '../types';
import { Pencil, Trash2 } from 'lucide-react';

export function IncomePage() {
  const { state, dispatch } = useFinance();
  const { incomes, settings, selectedMonth } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<IncomeType>('salary');
  const [isRecurring, setIsRecurring] = useState(true);
  const [note, setNote] = useState('');

  const reconciliation = reconcileIncomesForMonth(incomes, selectedMonth);
  const totalIncome = reconciliation.totalEffective;

  const openModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income);
      setName(income.name);
      setAmount(income.amount.toString());
      setType(income.type);
      setIsRecurring(income.isRecurring);
      setNote(income.note || '');
    } else {
      setEditingIncome(null);
      setName(''); setAmount(''); setType('salary'); setIsRecurring(true); setNote('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingIncome(null); };

  const handleSubmit = () => {
    if (!name || !amount) return;
    const data = { name, amount: parseFloat(amount), type, isRecurring, note: note || undefined };
    if (editingIncome) {
      dispatch({ type: 'UPDATE_INCOME', payload: { ...editingIncome, ...data } });
    } else {
      dispatch({ type: 'ADD_INCOME', payload: data });
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchtest du diese Einnahme wirklich löschen?')) {
      dispatch({ type: 'DELETE_INCOME', payload: id });
    }
  };

  const typeOptions = Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Monatliche Einnahmen: {formatCurrency(totalIncome, settings)}
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            Verwalte wiederkehrende und einmalige Einnahmen
            {reconciliation.matchedImportedIds.size > 0 ? ` · ${reconciliation.matchedImportedIds.size} Bankeingänge mit Fix-Einnahmen abgeglichen` : ''}
          </p>
        </div>
        <Button onClick={() => openModal()} icon="Plus">Einnahme hinzufügen</Button>
      </div>

      {incomes.length === 0 ? (
        <Card>
          <EmptyState
            icon="TrendingUp"
            title="Keine Einnahmen"
            description="Füge deine Einkommensquellen hinzu, wie Gehalt, Nebenjobs oder andere Einkünfte."
            action={{ label: 'Erste Einnahme hinzufügen', onClick: () => openModal() }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {incomes.map((income) => {
            const info = INCOME_TYPES[income.type];
            return (
              <Card key={income.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: `${info.color}15` }}>
                      <Icon name={info.icon} size={20} color={info.color} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{income.name}</h3>
                        <Badge color={income.isRecurring ? '#10b981' : '#3b82f6'}>
                          {income.isRecurring ? 'Monatlich' : income.month || 'Einmalig'}
                        </Badge>
                        {income.isRecurring && reconciliation.matchedRecurringIds.has(income.id) && (
                          <Badge color="#0ea5e9">Abgeglichen</Badge>
                        )}
                        {!income.isRecurring && reconciliation.matchedImportedIds.has(income.id) && (
                          <Badge color="#0ea5e9">Zu Fix-Einnahme gematcht</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-500 truncate">
                        {info.labelDe}{income.date ? ` · ${income.date}` : ''}{income.note && ` · ${income.note}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(income.amount, settings)}
                    </p>
                    <div className="flex gap-1">
                      <button onClick={() => openModal(income)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
                        <Pencil size={15} className="text-slate-400" />
                      </button>
                      <button onClick={() => handleDelete(income.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <Trash2 size={15} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingIncome ? 'Einnahme bearbeiten' : 'Neue Einnahme'}>
        <div className="space-y-4">
          <Input label="Bezeichnung" value={name} onChange={setName} placeholder="z.B. Gehalt, Nebenjob..." icon="Edit3" />
          <Input label="Betrag (€)" type="number" value={amount} onChange={setAmount} placeholder="0.00" icon="Euro" />
          <Select label="Typ" value={type} onChange={(v) => setType(v as IncomeType)} options={typeOptions} />
          <div className="flex items-center gap-3">
            <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="recurring" className="text-sm text-gray-700 dark:text-gray-300">Wiederkehrend (monatlich)</label>
          </div>
          <Input label="Notiz (optional)" value={note} onChange={setNote} placeholder="Zusätzliche Informationen..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingIncome ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
