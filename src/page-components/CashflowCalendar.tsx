import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Card, Icon } from '../components/ui';
import { formatCurrency, getMonthDisplayName } from '../utils/helpers';

interface CalendarEvent {
  day: number;
  label: string;
  amount: number;
  type: 'income' | 'expense' | 'debt';
  icon: string;
  color: string;
}

export function CashflowCalendar() {
  const { state } = useFinance();
  const { settings, incomes, fixedExpenses, debts, expenses, selectedMonth } = state;
  const [viewMonth, setViewMonth] = useState(selectedMonth);

  const [year, month] = viewMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const startOffset = settings.firstDayOfWeek === 1
    ? (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)
    : firstDayOfWeek;

  // Build events map
  const eventsByDay: Record<number, CalendarEvent[]> = {};

  const addEvent = (day: number, event: CalendarEvent) => {
    if (day < 1 || day > daysInMonth) return;
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(event);
  };

  // Fixed expenses (recurring, by dueDay)
  for (const fe of fixedExpenses.filter(f => f.isActive)) {
    const day = Math.min(fe.dueDay, daysInMonth);
    addEvent(day, {
      day,
      label: fe.name,
      amount: fe.amount,
      type: 'expense',
      icon: 'Receipt',
      color: '#f59e0b',
    });
  }

  // Recurring incomes (salary = day 1 typically)
  for (const inc of incomes.filter(i => i.isRecurring)) {
    const incDay = inc.date ? new Date(inc.date).getDate() : 1;
    addEvent(Math.min(incDay, daysInMonth), {
      day: Math.min(incDay, daysInMonth),
      label: inc.name,
      amount: inc.amount,
      type: 'income',
      icon: 'TrendingUp',
      color: '#10b981',
    });
  }

  // One-time incomes for this month
  for (const inc of incomes.filter(i => !i.isRecurring && (i.month === viewMonth || (i.date && i.date.startsWith(viewMonth))))) {
    const incDay = inc.date ? new Date(inc.date).getDate() : 1;
    addEvent(Math.min(incDay, daysInMonth), {
      day: Math.min(incDay, daysInMonth),
      label: inc.name,
      amount: inc.amount,
      type: 'income',
      icon: 'TrendingUp',
      color: '#10b981',
    });
  }

  // Debts (monthly payments, assume day 1)
  for (const debt of debts.filter(d => d.remainingAmount > 0)) {
    addEvent(1, {
      day: 1,
      label: debt.name,
      amount: debt.monthlyPayment,
      type: 'debt',
      icon: 'CreditCard',
      color: '#ef4444',
    });
  }

  // Variable expenses for this month
  for (const exp of expenses.filter(e => e.month === viewMonth)) {
    const day = new Date(exp.date).getDate();
    addEvent(day, {
      day,
      label: exp.description,
      amount: exp.amount,
      type: 'expense',
      icon: 'ShoppingBag',
      color: '#8b5cf6',
    });
  }

  const weekDays = settings.firstDayOfWeek === 1
    ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const navigateMonth = (offset: number) => {
    const d = new Date(year, month - 1 + offset, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Day summary calculations
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  // Monthly totals
  const allEvents = Object.values(eventsByDay).flat();
  const totalIncome = allEvents.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = allEvents.filter(e => e.type === 'expense' || e.type === 'debt').reduce((s, e) => s + e.amount, 0);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigateMonth(-1)} className="rounded-xl border border-slate-200 p-2 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:hover:bg-gray-800">
              <ChevronLeft size={18} className="text-slate-600 dark:text-gray-400" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{getMonthDisplayName(viewMonth)}</h2>
            <button onClick={() => navigateMonth(1)} className="rounded-xl border border-slate-200 p-2 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:hover:bg-gray-800">
              <ChevronRight size={18} className="text-slate-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center dark:bg-emerald-950/30">
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Einnahmen</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalIncome, settings)}</p>
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-2 text-center dark:bg-red-950/30">
              <p className="text-[10px] font-medium text-red-600 dark:text-red-400">Ausgaben</p>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">{formatCurrency(totalExpenses, settings)}</p>
            </div>
            <div className={`rounded-xl px-3 py-2 text-center ${totalIncome - totalExpenses >= 0 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
              <p className={`text-[10px] font-medium ${totalIncome - totalExpenses >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>Cashflow</p>
              <p className={`text-sm font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {formatCurrency(totalIncome - totalExpenses, settings)}
              </p>
            </div>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-gray-500">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const events = eventsByDay[day] || [];
            const dayIncome = events.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
            const dayExpense = events.filter(e => e.type === 'expense' || e.type === 'debt').reduce((s, e) => s + e.amount, 0);
            const isToday = isCurrentMonth && today.getDate() === day;
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                className={`relative flex min-h-[72px] flex-col rounded-xl border p-1.5 text-left transition-all ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400 dark:border-blue-600 dark:bg-blue-950/30 dark:ring-blue-600'
                    : isToday
                      ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/30'
                }`}
              >
                <span className={`text-xs font-semibold ${
                  isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {day}
                </span>
                <div className="mt-auto flex flex-col gap-0.5">
                  {dayIncome > 0 && (
                    <div className="flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 dark:bg-emerald-900/40">
                      <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">+{formatCurrency(dayIncome, settings)}</span>
                    </div>
                  )}
                  {dayExpense > 0 && (
                    <div className="flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 dark:bg-red-900/40">
                      <span className="text-[9px] font-semibold text-red-700 dark:text-red-300 truncate">-{formatCurrency(dayExpense, settings)}</span>
                    </div>
                  )}
                  {events.length > 2 && (
                    <span className="text-[8px] text-slate-400 dark:text-gray-600">{events.length} Posten</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Detail panel for selected day */}
      {selectedDay && (
        <Card className="p-5 animate-fade-in">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
            {selectedDay}. {getMonthDisplayName(viewMonth)}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-gray-600">Keine Buchungen an diesem Tag.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${event.color}15` }}>
                      <Icon name={event.icon} size={16} color={event.color} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{event.label}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        {event.type === 'income' ? 'Einnahme' : event.type === 'debt' ? 'Schuldenrate' : 'Ausgabe'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    event.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {event.type === 'income' ? '+' : '-'}{formatCurrency(event.amount, settings)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Running balance chart */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Kontostand-Verlauf (kumuliert)</h3>
        <div className="space-y-1">
          {(() => {
            let runningBalance = 0;
            const maxAbs = Math.max(
              1,
              ...Array.from({ length: daysInMonth }, (_, i) => {
                const dayEvents = eventsByDay[i + 1] || [];
                const dayNet = dayEvents.reduce((sum, e) =>
                  sum + (e.type === 'income' ? e.amount : -e.amount), 0);
                runningBalance += dayNet;
                return Math.abs(runningBalance);
              })
            );
            runningBalance = 0;

            return Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dayEvents = eventsByDay[day] || [];
              const dayNet = dayEvents.reduce((sum, e) =>
                sum + (e.type === 'income' ? e.amount : -e.amount), 0);
              runningBalance += dayNet;
              if (dayNet === 0 && dayEvents.length === 0) return null;

              const barWidth = Math.max(2, (Math.abs(runningBalance) / maxAbs) * 100);
              const isPositive = runningBalance >= 0;

              return (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-6 text-right text-[10px] text-slate-400 dark:text-gray-600">{day}</span>
                  <div className="flex-1">
                    <div
                      className={`h-3 rounded-full transition-all ${isPositive ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-red-400 dark:bg-red-500'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className={`w-24 text-right text-[10px] font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(runningBalance, settings)}
                  </span>
                </div>
              );
            }).filter(Boolean);
          })()}
        </div>
      </Card>
    </div>
  );
}
