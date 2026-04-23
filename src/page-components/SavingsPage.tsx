import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFinance } from '@/lib/finance-context';
import { Card, Button, Input, Select, Modal, EmptyState, Icon, Badge, ProgressBar } from '../components/ui';
import { formatCurrency, calculateSavingsStreak } from '../utils/helpers';
import { focusElementById, getSearchFocus } from '../utils/searchFocus';
import { SavingsGoal } from '../types';
import { Pencil, Trash2, PiggyBank, Plus, Minus, Flame, Star } from 'lucide-react';

const GOAL_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  emergency: { icon: 'Shield', color: '#ef4444', label: 'Notgroschen' },
  vacation: { icon: 'Plane', color: '#3b82f6', label: 'Urlaub' },
  car: { icon: 'Car', color: '#8b5cf6', label: 'Auto' },
  electronics: { icon: 'Laptop', color: '#06b6d4', label: 'Elektronik' },
  home: { icon: 'Home', color: '#f59e0b', label: 'Wohnung' },
  education: { icon: 'GraduationCap', color: '#10b981', label: 'Bildung' },
  other: { icon: 'Target', color: '#6366f1', label: 'Sonstiges' },
};

export function SavingsPage() {
  const { state, dispatch } = useFinance();
  const { savingsGoals, settings } = state;
  const lastSearchFocusRef = useRef('');
  const searchParams = useSearchParams();
  const savingsFocus = getSearchFocus(searchParams, 'savings');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isWithdraw, setIsWithdraw] = useState(false);
  const [highlightedGoalId, setHighlightedGoalId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [goalCategory, setGoalCategory] = useState('other');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('3');
  const [confettiGoalId, setConfettiGoalId] = useState<string | null>(null);
  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
  const totalMonthly = savingsGoals.reduce((s, g) => s + g.monthlyContribution, 0);

  const openModal = (goal?: SavingsGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setName(goal.name); setTargetAmount(goal.targetAmount.toString());
      setCurrentAmount(goal.currentAmount.toString()); setMonthlyContribution(goal.monthlyContribution.toString());
      setGoalCategory(goal.goalCategory || 'other'); setDeadline(goal.deadline || ''); setNote(goal.note || '');
      setPriority(String(goal.priority || 3));
    } else {
      setEditingGoal(null);
      setName(''); setTargetAmount(''); setCurrentAmount('0'); setMonthlyContribution('0');
      setGoalCategory('other'); setDeadline(''); setNote('');
      setPriority('3');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingGoal(null); };

  const handleSubmit = () => {
    if (!name || !targetAmount) return;
    const data = {
      name, targetAmount: parseFloat(targetAmount), currentAmount: parseFloat(currentAmount || '0'),
      monthlyContribution: parseFloat(monthlyContribution || '0'), deadline: deadline || undefined,
      goalCategory, note: note || undefined,
      color: GOAL_ICONS[goalCategory]?.color || '#6366f1',
      icon: GOAL_ICONS[goalCategory]?.icon || 'Target',
      isCompleted: parseFloat(currentAmount || '0') >= parseFloat(targetAmount),
      priority: parseInt(priority) || 3,
    };
    if (editingGoal) dispatch({ type: 'UPDATE_SAVINGS_GOAL', payload: { ...editingGoal, ...data } });
    else dispatch({ type: 'ADD_SAVINGS_GOAL', payload: data });
    closeModal();
  };

  const handleDelete = (id: string) => { if (confirm('Sparziel löschen?')) dispatch({ type: 'DELETE_SAVINGS_GOAL', payload: id }); };

  const handleDeposit = () => {
    if (!depositGoal || !depositAmount) return;
    const amt = parseFloat(depositAmount);
    const newAmt = isWithdraw ? Math.max(0, depositGoal.currentAmount - amt) : depositGoal.currentAmount + amt;
    const oldProgress = (depositGoal.currentAmount / depositGoal.targetAmount) * 100;
    const newProgress = (newAmt / depositGoal.targetAmount) * 100;
    // Check milestone crossings (25%, 50%, 75%, 100%)
    const milestones = [25, 50, 75, 100];
    const crossed = milestones.some(m => oldProgress < m && newProgress >= m);
    if (crossed && !isWithdraw) {
      setConfettiGoalId(depositGoal.id);
      setTimeout(() => setConfettiGoalId(null), 3000);
    }
    dispatch({ type: 'UPDATE_SAVINGS_GOAL', payload: { ...depositGoal, currentAmount: newAmt } });
    setDepositGoal(null); setDepositAmount('');
  };

  const goalOptions = Object.entries(GOAL_ICONS).map(([v, info]) => ({ value: v, label: info.label }));

  useEffect(() => {
    if (!savingsFocus) return;

    const signature = savingsFocus.id;
    if (lastSearchFocusRef.current === signature) return;

    let clearHighlightTimeout: number | undefined;
    const cleanupFocus = focusElementById(`savings-${savingsFocus.id}`, () => {
      lastSearchFocusRef.current = signature;
      setHighlightedGoalId(savingsFocus.id);
      clearHighlightTimeout = window.setTimeout(() => {
        setHighlightedGoalId((current) => current === savingsFocus.id ? null : current);
      }, 2600);
    });

    return () => {
      cleanupFocus();
      if (clearHighlightTimeout) {
        window.clearTimeout(clearHighlightTimeout);
      }
    };
  }, [savingsFocus?.id]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sparziele</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {formatCurrency(totalSaved, settings)} von {formatCurrency(totalTarget, settings)} gespart
          </p>
        </div>
        <Button onClick={() => openModal()} icon="Plus">Sparziel hinzufügen</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <PiggyBank size={22} />
            <div><p className="text-xs opacity-80">Gesamt gespart</p><p className="text-xl font-bold">{formatCurrency(totalSaved, settings)}</p></div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <Icon name="Target" size={22} />
            <div><p className="text-xs opacity-80">Gesamtziel</p><p className="text-xl font-bold">{formatCurrency(totalTarget, settings)}</p></div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-violet-500 to-purple-600 border-0">
          <div className="flex items-center gap-3 text-white">
            <Icon name="TrendingUp" size={22} />
            <div><p className="text-xs opacity-80">Monatlich sparen</p><p className="text-xl font-bold">{formatCurrency(totalMonthly, settings)}</p></div>
          </div>
        </Card>
      </div>

      {/* Confetti animation */}
      {confettiGoalId && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          <div className="animate-bounce text-6xl">🎉🎊✨</div>
          <div className="absolute text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">Meilenstein erreicht!</p>
          </div>
        </div>
      )}

      {savingsGoals.length === 0 ? (
        <Card><EmptyState icon="PiggyBank" title="Keine Sparziele"
          description="Erstelle ein Sparziel, um auf deine Wünsche hinzusparen."
          action={{ label: 'Erstes Sparziel erstellen', onClick: () => openModal() }} /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {savingsGoals.map((goal) => {
            const info = GOAL_ICONS[goal.goalCategory || 'other'] || GOAL_ICONS.other;
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const done = goal.currentAmount >= goal.targetAmount;
            const remaining = goal.targetAmount - goal.currentAmount;
            const monthsLeft = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : Infinity;
            const streak = calculateSavingsStreak(goal.depositHistory || []);
            return (
              <Card
                key={goal.id}
                id={`savings-${goal.id}`}
                className={`scroll-mt-28 p-5 ${done ? 'ring-2 ring-emerald-400 dark:ring-emerald-600' : ''} ${highlightedGoalId === goal.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 bg-blue-50/40 dark:bg-blue-950/20 dark:ring-offset-gray-950' : ''}`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: `${info.color}15` }}>
                        <Icon name={info.icon} size={20} color={info.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{goal.name}</h3>
                          {done && <Badge color="#10b981">Erreicht! 🎉</Badge>}
                          {streak > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400"><Flame size={12} /> {streak} Monate Streak</span>}
                          {(goal.priority || 0) <= 2 && <Star size={12} className="text-amber-400" />}
                        </div>
                        {goal.monthlyContribution > 0 && (
                          <p className="text-xs text-slate-500 dark:text-gray-500">+{formatCurrency(goal.monthlyContribution, settings)}/Monat
                            {!done && monthsLeft < Infinity && ` · ~${monthsLeft} Monate`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setDepositGoal(goal); setIsWithdraw(false); setDepositAmount(''); }}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Einzahlung">
                        <Plus size={15} className="text-emerald-500" />
                      </button>
                      <button onClick={() => { setDepositGoal(goal); setIsWithdraw(true); setDepositAmount(''); }}
                        className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Auszahlung">
                        <Minus size={15} className="text-amber-500" />
                      </button>
                      <button onClick={() => openModal(goal)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
                        <Pencil size={15} className="text-slate-400" />
                      </button>
                      <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <Trash2 size={15} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 text-xs mb-1.5">
                      <span className="text-slate-600 dark:text-gray-400 font-medium">{formatCurrency(goal.currentAmount, settings)}</span>
                      <div className="flex-1"><ProgressBar value={Math.min(progress, 100)} max={100} color={done ? '#10b981' : info.color} size="md" /></div>
                      <span className="text-slate-600 dark:text-gray-400 font-medium">{formatCurrency(goal.targetAmount, settings)}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-500">{Math.min(progress, 100).toFixed(1)}% erreicht
                      {!done && ` · Noch ${formatCurrency(remaining, settings)}`}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingGoal ? 'Sparziel bearbeiten' : 'Neues Sparziel'}>
        <div className="space-y-4">
          <Input label="Bezeichnung" value={name} onChange={setName} placeholder="z.B. Urlaub, Notgroschen..." icon="Edit3" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Zielbetrag" type="number" value={targetAmount} onChange={setTargetAmount} placeholder="0.00" icon="Euro" />
            <Input label="Bereits gespart" type="number" value={currentAmount} onChange={setCurrentAmount} placeholder="0.00" icon="Euro" />
          </div>
          <Input label="Monatlicher Sparbetrag" type="number" value={monthlyContribution} onChange={setMonthlyContribution} placeholder="0.00" icon="Euro" />
          <Select label="Kategorie" value={goalCategory} onChange={setGoalCategory} options={goalOptions} />
          <Input label="Zieldatum (optional)" type="date" value={deadline} onChange={setDeadline} />
          <Input label="Notiz (optional)" value={note} onChange={setNote} placeholder="Zusätzliche Informationen..." />
          <Select label="Priorität" value={priority} onChange={setPriority} options={[
            { value: '1', label: '⭐ Sehr hoch' },
            { value: '2', label: '🔥 Hoch' },
            { value: '3', label: 'Normal' },
            { value: '4', label: 'Niedrig' },
            { value: '5', label: 'Sehr niedrig' },
          ]} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingGoal ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!depositGoal} onClose={() => setDepositGoal(null)} title={isWithdraw ? 'Geld entnehmen' : 'Einzahlung'}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            {isWithdraw ? 'Entnehme Geld von' : 'Zahle ein auf'}{' '}
            <strong className="text-gray-900 dark:text-white">{depositGoal?.name}</strong>
          </p>
          <Input label="Betrag (€)" type="number" value={depositAmount} onChange={setDepositAmount} placeholder="0.00" icon="Euro" />
          <p className="text-xs text-slate-500 dark:text-gray-500">
            Neuer Stand: {formatCurrency(
              isWithdraw
                ? Math.max(0, (depositGoal?.currentAmount || 0) - parseFloat(depositAmount || '0'))
                : (depositGoal?.currentAmount || 0) + parseFloat(depositAmount || '0'),
              settings
            )}
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDepositGoal(null)} className="flex-1">Abbrechen</Button>
            <Button onClick={handleDeposit} className="flex-1">{isWithdraw ? 'Entnehmen' : 'Einzahlen'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
