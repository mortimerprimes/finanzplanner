import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, ProgressBar } from '../components/ui';
import { formatCurrency, getExpenseCategoryMap, getExpenseCategoryInfo, getActiveBudgetLimits, getBudgetLimitValue } from '../utils/helpers';
import { BudgetLimit, ExpenseCategory } from '../types';
import { Pencil, Trash2, AlertTriangle, RotateCcw, CalendarDays } from 'lucide-react';

export function BudgetPage() {
  const { state, dispatch } = useFinance();
  const { budgetLimits, expenses, settings, currentMonth } = state;
  const categoryMap = getExpenseCategoryMap(settings);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetLimit | null>(null);

  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [enableRollover, setEnableRollover] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);

  const monthExpenses = expenses.filter(e => e.month === currentMonth);
  const activeBudgets = useMemo(() => getActiveBudgetLimits(budgetLimits, currentMonth), [budgetLimits, currentMonth]);

  const openModal = (budget?: BudgetLimit) => {
    if (budget) {
      setEditingBudget(budget);
      setCategory(budget.category); setAmount(budget.amount.toString());
      setIsRecurring(budget.isRecurring);
      setEnableRollover(budget.enableRollover || false);
    } else {
      setEditingBudget(null); setCategory('food'); setAmount('');
      setIsRecurring(true);
      setEnableRollover(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingBudget(null); };

  const handleSubmit = () => {
    if (!amount) return;
    const parsedAmount = parseFloat(amount);
    const data = { category, amount: parsedAmount, monthlyLimit: parsedAmount, month: currentMonth, isRecurring, enableRollover };
    if (editingBudget) dispatch({ type: 'UPDATE_BUDGET_LIMIT', payload: { ...editingBudget, ...data } });
    else dispatch({ type: 'ADD_BUDGET_LIMIT', payload: data });
    closeModal();
  };

  const handleDelete = (id: string) => { if (confirm('Budgetlimit löschen?')) dispatch({ type: 'DELETE_BUDGET_LIMIT', payload: id }); };

  const categoryOptions = Object.entries(categoryMap).map(([v, info]) => ({ value: v, label: info.labelDe }));

  const totalBudget = activeBudgets.reduce((sum, budget) => sum + getBudgetLimitValue(budget), 0);
  const totalSpent = activeBudgets.reduce((s, b) => {
    return s + monthExpenses.filter(e => e.category === b.category).reduce((ss, e) => ss + e.amount, 0);
  }, 0);

  // unbudgeted spending
  const budgetedCategories = new Set(activeBudgets.map(b => b.category));
  const unbudgetedSpent = monthExpenses.filter(e => !budgetedCategories.has(e.category)).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Budgetplanung</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {formatCurrency(totalSpent, settings)} von {formatCurrency(totalBudget, settings)} ausgegeben
          </p>
        </div>
        <Button onClick={() => openModal()} icon="Plus">Budget hinzufügen</Button>
        <button
          onClick={() => setShowWeekly(v => !v)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${showWeekly ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'border-slate-200 text-gray-700 dark:border-gray-700 dark:text-gray-300'}`}
        >
          <CalendarDays size={14} className="inline mr-1" /> Wochenansicht
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex-shrink-0">
              <Icon name="Wallet" size={20} color="#3b82f6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-gray-500">Gesamtbudget</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{formatCurrency(totalBudget, settings)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 flex-shrink-0">
              <Icon name="ShoppingBag" size={20} color="#ef4444" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-gray-500">Ausgegeben</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{formatCurrency(totalSpent, settings)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex-shrink-0">
              <Icon name="PiggyBank" size={20} color="#10b981" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-gray-500">Verbleibend</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{formatCurrency(Math.max(0, totalBudget - totalSpent), settings)}</p>
            </div>
          </div>
        </Card>
      </div>

      {activeBudgets.length === 0 ? (
        <Card><EmptyState icon="Target" title="Keine Budgetlimits"
          description="Setze Budgetlimits für deine Ausgabenkategorien, um Überausgaben zu vermeiden."
          action={{ label: 'Erstes Budget setzen', onClick: () => openModal() }} /></Card>
      ) : (
        <div className="space-y-4">
          {activeBudgets.map((budget) => {
            const catInfo = getExpenseCategoryInfo(budget.category, settings);
            const spent = monthExpenses.filter(e => e.category === budget.category).reduce((s, e) => s + e.amount, 0);
            const rollover = budget.enableRollover ? budget.rolloverAmount || 0 : 0;
            const effectiveBudget = getBudgetLimitValue(budget);
            const progress = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;
            const isOver = spent > effectiveBudget;
            const isCritical = progress >= 90 && !isOver;
            const isWarning = progress >= 75 && !isCritical && !isOver;
            const weeklyBudget = effectiveBudget / 4.33;
            const alarmColor = isOver ? '#ef4444' : isCritical ? '#f97316' : isWarning ? '#f59e0b' : catInfo.color;
            return (
              <Card key={budget.id} className={`p-5 ${isOver ? 'ring-2 ring-red-300 dark:ring-red-700' : isCritical ? 'ring-2 ring-orange-300 dark:ring-orange-700' : ''}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: `${catInfo.color}15` }}>
                        <Icon name={catInfo.icon} size={20} color={catInfo.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{catInfo.labelDe}</h3>
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                            {budget.isRecurring ? 'Wiederkehrend' : getExpenseCategoryInfo(budget.category, settings).labelDe && currentMonth}
                          </span>
                          {isOver && <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle size={12} /> Überschritten!
                          </span>}
                          {isCritical && <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                            <AlertTriangle size={12} /> Kritisch
                          </span>}
                          {isWarning && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Fast am Limit</span>}
                          {rollover > 0 && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <RotateCcw size={10} /> +{formatCurrency(rollover, settings)} Rollover
                          </span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-500">
                          {formatCurrency(spent, settings)} von {formatCurrency(effectiveBudget, settings)}
                          {isOver && ` · ${formatCurrency(spent - effectiveBudget, settings)} zu viel`}
                          {showWeekly && ` · ~${formatCurrency(weeklyBudget, settings)}/Woche`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-lg font-bold ${isOver ? 'text-red-600 dark:text-red-400' : isCritical ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                        {Math.min(progress, 100).toFixed(0)}%
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => openModal(budget)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
                          <Pencil size={15} className="text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(budget.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                          <Trash2 size={15} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <ProgressBar value={Math.min(progress, 100)} max={100}
                    color={alarmColor} size="lg" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {unbudgetedSpent > 0 && (
        <Card className="p-5 border-dashed">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-gray-800 flex-shrink-0">
              <Icon name="HelpCircle" size={20} className="text-slate-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ausgaben ohne Budget</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                {formatCurrency(unbudgetedSpent, settings)} in Kategorien ohne Budgetlimit
              </p>
            </div>
          </div>
        </Card>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingBudget ? 'Budget bearbeiten' : 'Neues Budget'}>
        <div className="space-y-4">
          <Select label="Kategorie" value={category} onChange={(v) => setCategory(v as ExpenseCategory)} options={categoryOptions} />
          <Input label="Monatliches Budget (€)" type="number" value={amount} onChange={setAmount} placeholder="0.00" icon="Euro" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Als wiederkehrendes Budget-Template speichern</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enableRollover} onChange={e => setEnableRollover(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Ungenutztes Budget in nächsten Monat übertragen (Rollover)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingBudget ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
