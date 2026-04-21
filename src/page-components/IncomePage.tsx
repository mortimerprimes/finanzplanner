import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, Badge, MonthPicker } from '../components/ui';
import { formatCurrency, reconcileIncomesForMonth, getMonthDisplayName } from '../utils/helpers';
import { INCOME_TYPES } from '../utils/constants';
import { Income, IncomeType, PlannedIncome } from '../types';
import { Pencil, Trash2, CalendarClock, TrendingUp, Plus } from 'lucide-react';

export function IncomePage() {
  const { state, dispatch } = useFinance();
  const { incomes, settings, selectedMonth, plannedIncomes, accounts } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [plannedModalOpen, setPlannedModalOpen] = useState(false);
  const [editingPlanned, setEditingPlanned] = useState<PlannedIncome | null>(null);
  const [showForecast, setShowForecast] = useState(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<IncomeType>('salary');
  const [isRecurring, setIsRecurring] = useState(true);
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [effectiveFromMonth, setEffectiveFromMonth] = useState('');

  // Planned income form
  const [plannedName, setPlannedName] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [plannedType, setPlannedType] = useState<IncomeType>('salary');
  const [plannedStartMonth, setPlannedStartMonth] = useState('');
  const [plannedIsRecurring, setPlannedIsRecurring] = useState(true);
  const [plannedNote, setPlannedNote] = useState('');

  const reconciliation = reconcileIncomesForMonth(incomes, selectedMonth);
  const totalIncome = reconciliation.totalEffective;

  // Filter incomes relevant for selected month
  const monthIncomes = useMemo(() => {
    return incomes.filter((income) => {
      if (income.isRecurring) {
        const startMonth = income.startMonth || income.createdAt?.slice(0, 7);
        if (startMonth && selectedMonth < startMonth) return false;
        if (income.effectiveFromMonth && selectedMonth < income.effectiveFromMonth) return false;
        return true;
      }
      // One-time: show if month matches
      const incomeMonth = income.month || income.date?.slice(0, 7) || income.createdAt?.slice(0, 7);
      return incomeMonth === selectedMonth;
    });
  }, [incomes, selectedMonth]);

  // Planned incomes active in this month
  const activePlannedIncomes = useMemo(() => {
    return (plannedIncomes || []).filter(p => {
      if (p.isRecurring) return selectedMonth >= p.startMonth;
      return p.startMonth === selectedMonth;
    });
  }, [plannedIncomes, selectedMonth]);

  // Forecast: next 12 months
  const forecast = useMemo(() => {
    const months: { month: string; regular: number; planned: number; total: number }[] = [];
    const [y, m] = selectedMonth.split('-').map(Number);
    for (let i = 0; i < 12; i++) {
      const d = new Date(y, m - 1 + i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rec = reconcileIncomesForMonth(incomes, month);
      const plannedTotal = (plannedIncomes || [])
        .filter(p => p.isRecurring ? month >= p.startMonth : p.startMonth === month)
        .reduce((s, p) => s + p.amount, 0);
      months.push({ month, regular: rec.totalEffective, planned: plannedTotal, total: rec.totalEffective + plannedTotal });
    }
    return months;
  }, [incomes, plannedIncomes, selectedMonth]);

  const openModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income);
      setName(income.name);
      setAmount(income.amount.toString());
      setType(income.type);
      setIsRecurring(income.isRecurring);
      setNote(income.note || '');
      setAccountId(income.accountId || '');
      setEffectiveFromMonth(income.effectiveFromMonth || '');
    } else {
      setEditingIncome(null);
      setName(''); setAmount(''); setType('salary'); setIsRecurring(true); setNote('');
      setAccountId('');
      setEffectiveFromMonth('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingIncome(null); };

  const handleSubmit = () => {
    if (!name || !amount) return;
    const data: any = {
      name,
      amount: parseFloat(amount),
      type,
      isRecurring,
      note: note || undefined,
      accountId: accountId || undefined,
    };
    if (effectiveFromMonth) data.effectiveFromMonth = effectiveFromMonth;
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

  const openPlannedModal = (planned?: PlannedIncome) => {
    if (planned) {
      setEditingPlanned(planned);
      setPlannedName(planned.name);
      setPlannedAmount(planned.amount.toString());
      setPlannedType(planned.type);
      setPlannedStartMonth(planned.startMonth);
      setPlannedIsRecurring(planned.isRecurring);
      setPlannedNote(planned.note || '');
    } else {
      setEditingPlanned(null);
      setPlannedName(''); setPlannedAmount(''); setPlannedType('salary');
      // Default: next month
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m, 1);
      setPlannedStartMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      setPlannedIsRecurring(true); setPlannedNote('');
    }
    setPlannedModalOpen(true);
  };

  const handleSubmitPlanned = () => {
    if (!plannedName || !plannedAmount || !plannedStartMonth) return;
    const data = {
      name: plannedName,
      amount: parseFloat(plannedAmount),
      type: plannedType,
      startMonth: plannedStartMonth,
      isRecurring: plannedIsRecurring,
      note: plannedNote || undefined,
    };
    if (editingPlanned) {
      dispatch({ type: 'UPDATE_PLANNED_INCOME', payload: { ...editingPlanned, ...data } });
    } else {
      dispatch({ type: 'ADD_PLANNED_INCOME', payload: data });
    }
    setPlannedModalOpen(false);
    setEditingPlanned(null);
  };

  const deletePlanned = (id: string) => {
    if (confirm('Geplante Einnahme löschen?')) {
      dispatch({ type: 'DELETE_PLANNED_INCOME', payload: id });
    }
  };

  const typeOptions = Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));
  const accountOptions = [{ value: '', label: 'Kein Konto zuweisen' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Einnahmen {getMonthDisplayName(selectedMonth)}: {formatCurrency(totalIncome, settings)}
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {monthIncomes.length} aktive Einnahmen für diesen Monat
            {reconciliation.matchedImportedIds.size > 0 ? ` · ${reconciliation.matchedImportedIds.size} Bankeingänge abgeglichen` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openPlannedModal()} icon="CalendarClock">Zukünftige Einnahme</Button>
          <Button variant="secondary" onClick={() => setShowForecast(!showForecast)} icon="TrendingUp">
            {showForecast ? 'Forecast ausblenden' : 'Forecast'}
          </Button>
          <Button onClick={() => openModal()} icon="Plus">Einnahme hinzufügen</Button>
        </div>
      </div>

      {/* Planned incomes active in this month */}
      {activePlannedIncomes.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
            <CalendarClock size={16} /> Geplante Einnahmen in diesem Monat
          </h3>
          <div className="space-y-2">
            {activePlannedIncomes.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-blue-800 dark:text-blue-300 font-medium">{p.name}</span>
                  <Badge color="#3b82f6">{p.isRecurring ? `Ab ${getMonthDisplayName(p.startMonth)}` : getMonthDisplayName(p.startMonth)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">+{formatCurrency(p.amount, settings)}</span>
                  <button onClick={() => openPlannedModal(p)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40"><Pencil size={13} className="text-blue-500" /></button>
                  <button onClick={() => deletePlanned(p.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 size={13} className="text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Forecast */}
      {showForecast && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" /> Einnahmen-Forecast (12 Monate)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="pb-2 pr-3">Monat</th>
                  <th className="pb-2 pr-3 text-right">Regulär</th>
                  <th className="pb-2 pr-3 text-right">Geplant</th>
                  <th className="pb-2 text-right font-bold">Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {forecast.map(f => (
                  <tr key={f.month}
                    className={`cursor-pointer transition-colors ${f.month === selectedMonth ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'}`}
                    onClick={() => dispatch({ type: 'SET_SELECTED_MONTH', payload: f.month })}
                  >
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                      <span className={f.month > selectedMonth ? 'text-blue-600 dark:text-blue-400 underline decoration-dotted' : ''}>
                        {getMonthDisplayName(f.month)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-600 dark:text-gray-400">{formatCurrency(f.regular, settings)}</td>
                    <td className="py-2 pr-3 text-right text-blue-600 dark:text-blue-400">{f.planned > 0 ? `+${formatCurrency(f.planned, settings)}` : '—'}</td>
                    <td className="py-2 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(f.total, settings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* All planned incomes */}
      {(plannedIncomes || []).length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-blue-500" /> Geplante zukünftige Einnahmen
          </h3>
          <div className="space-y-2">
            {(plannedIncomes || []).map(p => {
              const info = INCOME_TYPES[p.type];
              const isFuture = p.startMonth > selectedMonth;
              return (
                <div key={p.id} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${isFuture ? 'bg-slate-50 dark:bg-gray-800/50' : 'bg-emerald-50 dark:bg-emerald-950/20'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${info.color}15` }}>
                      <Icon name={info.icon} size={18} color={info.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {p.isRecurring ? 'Monatlich' : 'Einmalig'} ab {getMonthDisplayName(p.startMonth)}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(p.amount, settings)}</p>
                    <div className="flex gap-1">
                      <button onClick={() => openPlannedModal(p)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800"><Pencil size={14} className="text-slate-400" /></button>
                      <button onClick={() => deletePlanned(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={14} className="text-red-400" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {monthIncomes.length === 0 ? (
        <Card>
          <EmptyState
            icon="TrendingUp"
            title="Keine Einnahmen in diesem Monat"
            description="Füge deine Einkommensquellen hinzu, wie Gehalt, Nebenjobs oder andere Einkünfte."
            action={{ label: 'Einnahme hinzufügen', onClick: () => openModal() }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {monthIncomes.map((income) => {
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
                        {income.isRecurring && income.startMonth && (
                          <Badge color="#8b5cf6">ab {getMonthDisplayName(income.startMonth)}</Badge>
                        )}
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

      {/* Add/Edit Income Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingIncome ? 'Einnahme bearbeiten' : 'Neue Einnahme'}>
        <div className="space-y-4">
          <Input label="Bezeichnung" value={name} onChange={setName} placeholder="z.B. Gehalt, Nebenjob..." icon="Edit3" />
          <Input label="Betrag (€)" type="number" value={amount} onChange={setAmount} placeholder="0.00" icon="Euro" />
          <Select label="Typ" value={type} onChange={(v) => setType(v as IncomeType)} options={typeOptions} />
          <Select label="Zielkonto" value={accountId} onChange={setAccountId} options={accountOptions} />
          <div className="flex items-center gap-3">
            <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="recurring" className="text-sm text-gray-700 dark:text-gray-300">Wiederkehrend (monatlich)</label>
          </div>
          {isRecurring && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                Diese Einnahme wird ab dem aktuell gewählten Monat ({getMonthDisplayName(selectedMonth)}) gerechnet, nicht rückwirkend.
              </p>
              {accountId && (
                <p className="mb-2 text-xs text-blue-700 dark:text-blue-300">
                  Wenn du den laufenden Monat geöffnet hast, wird das ausgewählte Konto automatisch gutgeschrieben, damit Dashboard und Kontostand sofort stimmen.
                </p>
              )}
              <MonthPicker label="Wirksam ab (optional, überschreibt Startmonat)" value={effectiveFromMonth} onChange={setEffectiveFromMonth} allowEmpty />
            </div>
          )}
          <Input label="Notiz (optional)" value={note} onChange={setNote} placeholder="Zusätzliche Informationen..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingIncome ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>

      {/* Planned Income Modal */}
      <Modal isOpen={plannedModalOpen} onClose={() => { setPlannedModalOpen(false); setEditingPlanned(null); }} title={editingPlanned ? 'Geplante Einnahme bearbeiten' : 'Zukünftige Einnahme planen'}>
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Plane eine zukünftige Einnahme ein, z.B. einen neuen Job der in einigen Monaten beginnt. Diese Einnahme erscheint im Forecast und wird ab dem Startmonat automatisch berücksichtigt.
            </p>
          </div>
          <Input label="Bezeichnung" value={plannedName} onChange={setPlannedName} placeholder="z.B. Neuer Job bei Firma X" icon="Edit3" />
          <Input label="Betrag (€ / Monat)" type="number" value={plannedAmount} onChange={setPlannedAmount} placeholder="0.00" icon="Euro" />
          <Select label="Typ" value={plannedType} onChange={(v) => setPlannedType(v as IncomeType)} options={typeOptions} />
          <MonthPicker label="Startmonat" value={plannedStartMonth} onChange={setPlannedStartMonth} />
          <div className="flex items-center gap-3">
            <input type="checkbox" id="plannedRecurring" checked={plannedIsRecurring} onChange={(e) => setPlannedIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="plannedRecurring" className="text-sm text-gray-700 dark:text-gray-300">Wiederkehrend (monatlich)</label>
          </div>
          <Input label="Notiz (optional)" value={plannedNote} onChange={setPlannedNote} placeholder="z.B. Probezeit 3 Monate..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setPlannedModalOpen(false); setEditingPlanned(null); }} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmitPlanned} className="flex-1">{editingPlanned ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
