import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Paperclip,
  Pencil,
  Repeat,
  SlidersHorizontal,
  Tag,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, Select } from '../components/ui';
import { analyzeReceiptWithAI, AIExpenseSuggestion, parseSpeechExpenses } from '../services/ai';
import {
  calculateBudgetStatus,
  formatCurrency,
  formatDate,
  generateId,
  getExpenseCategoryInfo,
  getExpenseCategoryMap,
  parseTags,
  findDuplicateExpenses,
} from '../utils/helpers';
import { emitExpenseBudgetFeedback } from '../utils/budgetFeedback';
import { focusElementById, getSearchFocus } from '../utils/searchFocus';
import { Expense, ExpenseAttachment, ExpenseCategory } from '../types';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

interface SuggestionDraft extends AIExpenseSuggestion {
  id: string;
  selected: boolean;
  accountId: string;
  attachment?: ExpenseAttachment;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ExpensesPage() {
  const { state, dispatch } = useFinance();
  const { expenses, settings, currentMonth, selectedMonth, budgetLimits, accounts } = state;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const lastSearchFocusRef = useRef('');
  const searchParams = useSearchParams();
  const expenseFocus = getSearchFocus(searchParams, 'expense');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterMonth, setFilterMonth] = useState(selectedMonth);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterRecurring, setFilterRecurring] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');

  // Sync filterMonth with global selectedMonth when header month picker changes
  useEffect(() => {
    setFilterMonth(selectedMonth);
  }, [selectedMonth]);
  const [maxAmount, setMaxAmount] = useState('');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [highlightedExpenseId, setHighlightedExpenseId] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>((settings.lastUsedExpenseCategory as ExpenseCategory) || 'food');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState(settings.lastUsedAccountId || '');
  const [tags, setTags] = useState(settings.lastUsedExpenseTags.join(', '));
  const [isRecurring, setIsRecurring] = useState(false);
  const [attachment, setAttachment] = useState<ExpenseAttachment | undefined>();

  const [receiptAttachment, setReceiptAttachment] = useState<ExpenseAttachment | undefined>();
  const [receiptError, setReceiptError] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptSuggestions, setReceiptSuggestions] = useState<SuggestionDraft[]>([]);

  const [voiceError, setVoiceError] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceSuggestions, setVoiceSuggestions] = useState<SuggestionDraft[]>([]);

  const categoryMap = getExpenseCategoryMap(settings);
  const monthExpenses = expenses.filter((expense) => expense.month === filterMonth);
  const totalMonth = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchCategory, setBatchCategory] = useState('');
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredExpenses.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
  };
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Ausgaben löschen?`)) return;
    dispatch({ type: 'DELETE_EXPENSES_BATCH', payload: Array.from(selectedIds) });
    setSelectedIds(new Set());
  };
  const handleBatchCategoryChange = () => {
    if (selectedIds.size === 0 || !batchCategory) return;
    dispatch({ type: 'UPDATE_EXPENSES_CATEGORY', payload: { ids: Array.from(selectedIds), category: batchCategory } });
    setSelectedIds(new Set());
    setBatchCategory('');
  };

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');

  useEffect(() => {
    if (!expenseFocus) return;

    const signature = `${expenseFocus.id}:${expenseFocus.month || ''}`;
    if (lastSearchFocusRef.current === signature) return;

    setSearch('');
    setFilterCategory('all');
    setFilterAccount('all');
    setFilterRecurring('all');
    setFiltersOpen(false);
    setMinAmount('');
    setMaxAmount('');
    setWarningsOnly(false);
    setSelectedIds(new Set());

    if (expenseFocus.month) {
      setFilterMonth(expenseFocus.month);
      if (selectedMonth !== expenseFocus.month) {
        dispatch({ type: 'SET_SELECTED_MONTH', payload: expenseFocus.month });
      }
    }

    let clearHighlightTimeout: number | undefined;
    const cleanupFocus = focusElementById(`expense-${expenseFocus.id}`, () => {
      lastSearchFocusRef.current = signature;
      setHighlightedExpenseId(expenseFocus.id);
      clearHighlightTimeout = window.setTimeout(() => {
        setHighlightedExpenseId((current) => current === expenseFocus.id ? null : current);
      }, 2600);
    });

    return () => {
      cleanupFocus();
      if (clearHighlightTimeout) {
        window.clearTimeout(clearHighlightTimeout);
      }
    };
  }, [dispatch, expenseFocus?.id, expenseFocus?.month, selectedMonth]);

  const categoryOptions = Object.entries(categoryMap).map(([value, info]) => ({ value, label: info.labelDe }));
  const aiCategoryOptions = Object.entries(categoryMap).map(([value, info]) => ({ id: value, label: info.labelDe }));
  const accountOptions = [{ value: '', label: 'Ohne Konto' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];
  const filterAccountOptions = [{ value: 'all', label: 'Alle Konten' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];

  const rememberDefaults = (nextCategory: string, nextAccountId: string, nextTags: string[]) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        lastUsedExpenseCategory: nextCategory,
        lastUsedAccountId: nextAccountId || undefined,
        lastUsedExpenseTags: nextTags,
      },
    });
  };

  const mapSuggestionsToDrafts = (suggestions: AIExpenseSuggestion[], nextAttachment?: ExpenseAttachment): SuggestionDraft[] => {
    return suggestions.map((suggestion) => ({
      ...suggestion,
      id: generateId(),
      selected: true,
      accountId: settings.lastUsedAccountId || '',
      attachment: nextAttachment,
      date: suggestion.date.length >= 10 ? suggestion.date.slice(0, 10) : `${currentMonth}-01`,
      tags: suggestion.tags || [],
    }));
  };

  const updateSuggestionDraft = (
    suggestions: SuggestionDraft[],
    suggestionId: string,
    updater: (current: SuggestionDraft) => SuggestionDraft
  ): SuggestionDraft[] => suggestions.map((item) => (item.id === suggestionId ? updater(item) : item));

  const applySuggestionDrafts = (suggestions: SuggestionDraft[]) => {
    const selected = suggestions.filter((suggestion) => suggestion.selected);
    if (selected.length === 0) return;

    if (selected.length === 1) {
      const firstSuggestion = selected[0];
      emitExpenseBudgetFeedback({
        description: firstSuggestion.description,
        amount: firstSuggestion.amount,
        category: firstSuggestion.category,
        date: firstSuggestion.date,
        month: firstSuggestion.date.slice(0, 7),
      });
    }

    selected.forEach((suggestion) => {
      dispatch({
        type: 'ADD_EXPENSE',
        payload: {
          description: suggestion.description,
          amount: suggestion.amount,
          category: suggestion.category,
          date: suggestion.date,
          month: suggestion.date.slice(0, 7),
          note: suggestion.note || undefined,
          accountId: suggestion.accountId || undefined,
          tags: suggestion.tags || [],
          attachment: suggestion.attachment,
          isRecurring: suggestion.isRecurring,
        },
      });
    });

    const first = selected[0];
    rememberDefaults(first.category, first.accountId, first.tags || []);
  };

  const readAttachment = (event: ChangeEvent<HTMLInputElement>, setter: (attachment: ExpenseAttachment | undefined) => void) => {
    const file = event.target.files?.[0];
    if (!file) {
      setter(undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const openModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDate(expense.date);
      setNote(expense.note || '');
      setAccountId(expense.accountId || '');
      setTags((expense.tags || []).join(', '));
      setIsRecurring(Boolean(expense.isRecurring));
      setAttachment(expense.attachment);
    } else {
      setEditingExpense(null);
      setDescription('');
      setAmount('');
      setCategory((settings.lastUsedExpenseCategory as ExpenseCategory) || 'food');
      setDate(today());
      setNote('');
      setAccountId(settings.lastUsedAccountId || '');
      setTags(settings.lastUsedExpenseTags.join(', '));
      setIsRecurring(false);
      setAttachment(undefined);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const resetReceiptFlow = () => {
    setReceiptAttachment(undefined);
    setReceiptError('');
    setReceiptLoading(false);
    setReceiptSuggestions([]);
  };

  const resetVoiceFlow = () => {
    setVoiceError('');
    setVoiceLoading(false);
    setVoiceListening(false);
    setVoiceTranscript('');
    setVoiceSuggestions([]);
    recognitionRef.current?.stop();
  };

  const handleSubmit = () => {
    if (!description || !amount) return;

    // Duplicate detection (only for new expenses)
    if (!editingExpense) {
      const dupes = findDuplicateExpenses(
        { amount: parseFloat(amount), date, description },
        expenses
      );
      if (dupes.length > 0 && !duplicateWarning) {
        setDuplicateWarning(`Mögliches Duplikat: "${description}" für ${amount} am ${date} existiert bereits.`);
        return;
      }
    }
    setDuplicateWarning('');

    const parsedTags = parseTags(tags);
    const payload = {
      description,
      amount: parseFloat(amount),
      category,
      date,
      month: date.slice(0, 7),
      note: note || undefined,
      accountId: accountId || undefined,
      tags: parsedTags,
      isRecurring,
      attachment,
    };

    if (editingExpense) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: { ...editingExpense, ...payload } });
    } else {
      emitExpenseBudgetFeedback(payload);
      dispatch({ type: 'ADD_EXPENSE', payload });
    }

    rememberDefaults(category, accountId, parsedTags);
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Ausgabe löschen?')) {
      dispatch({ type: 'DELETE_EXPENSE', payload: id });
    }
  };

  const handleAnalyzeReceipt = async () => {
    setReceiptError('');
    if (!receiptAttachment) {
      setReceiptError('Bitte zuerst ein Belegfoto oder eine Rechnung auswählen.');
      return;
    }
    if (!settings.ai.enabled || !settings.ai.receiptAssistant || settings.ai.provider === 'disabled') {
      setReceiptError('Die AI-Beleganalyse ist in den Einstellungen aktuell deaktiviert.');
      return;
    }

    setReceiptLoading(true);
    try {
      const suggestions = await analyzeReceiptWithAI({
        settings,
        attachment: receiptAttachment,
        categories: aiCategoryOptions,
        selectedMonth: currentMonth,
      });

      if (suggestions.length === 0) {
        setReceiptError('Die AI konnte aus diesem Beleg keine sicheren Buchungen ableiten.');
        setReceiptSuggestions([]);
      } else {
        setReceiptSuggestions(mapSuggestionsToDrafts(suggestions, receiptAttachment));
      }
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Die Beleganalyse ist fehlgeschlagen.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const startVoiceCapture = () => {
    setVoiceError('');
    const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionClass) {
      setVoiceError('Dein Browser unterstützt keine direkte Spracheingabe. Du kannst das Gesagte trotzdem unten manuell einfügen.');
      return;
    }

    const recognition = new RecognitionClass();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setVoiceTranscript(transcript.trim());
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      setVoiceError('Die Spracheingabe konnte nicht gestartet oder ausgewertet werden.');
    };
    recognition.onend = () => {
      setVoiceListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setVoiceListening(true);
  };

  const stopVoiceCapture = () => {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  };

  const handleParseVoiceTranscript = async () => {
    setVoiceError('');
    if (!voiceTranscript.trim()) {
      setVoiceError('Bitte sprich etwas ein oder füge zuerst ein Transkript ein.');
      return;
    }

    setVoiceLoading(true);
    try {
      const suggestions = await parseSpeechExpenses({
        settings,
        transcript: voiceTranscript,
        categories: aiCategoryOptions,
        selectedMonth: currentMonth,
      });

      if (suggestions.length === 0) {
        setVoiceError('Aus dem Transkript konnten keine klaren Ausgaben erkannt werden.');
        setVoiceSuggestions([]);
      } else {
        setVoiceSuggestions(mapSuggestionsToDrafts(suggestions));
      }
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Die Spracheingabe konnte nicht verarbeitet werden.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => expense.month === filterMonth)
      .filter((expense) => filterCategory === 'all' || expense.category === filterCategory)
      .filter((expense) => filterAccount === 'all' || (expense.accountId || '') === filterAccount)
      .filter((expense) => filterRecurring === 'all' || (filterRecurring === 'yes' ? expense.isRecurring : !expense.isRecurring))
      .filter((expense) => {
        const min = minAmount ? parseFloat(minAmount) : 0;
        const max = maxAmount ? parseFloat(maxAmount) : Number.POSITIVE_INFINITY;
        return expense.amount >= min && expense.amount <= max;
      })
      .filter((expense) => {
        const haystack = `${expense.description} ${expense.note || ''} ${(expense.tags || []).join(' ')}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .filter((expense) => {
        if (!warningsOnly) return true;
        const budgetStatus = calculateBudgetStatus(expense, expenses, budgetLimits, settings.budgetWarningThreshold);
        return budgetStatus.isWarning;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [budgetLimits, expenses, filterAccount, filterCategory, filterMonth, filterRecurring, maxAmount, minAmount, search, settings.budgetWarningThreshold, warningsOnly]);

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([key, info]) => {
      const categoryExpenses = monthExpenses.filter((expense) => expense.category === key);
      return {
        key,
        ...info,
        total: categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        count: categoryExpenses.length,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const groupedByDate = filteredExpenses.reduce((groups, expense) => {
    if (!groups[expense.date]) groups[expense.date] = [];
    groups[expense.date].push(expense);
    return groups;
  }, {} as Record<string, Expense[]>);

  const activeFilterCount = [
    search.trim() !== '',
    filterMonth !== currentMonth,
    filterCategory !== 'all',
    filterAccount !== 'all',
    filterRecurring !== 'all',
    minAmount !== '',
    maxAmount !== '',
    warningsOnly,
  ].filter(Boolean).length;

  const renderSuggestionEditor = (
    suggestions: SuggestionDraft[],
    setSuggestions: React.Dispatch<React.SetStateAction<SuggestionDraft[]>>
  ) => (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div key={suggestion.id} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
              <input
                type="checkbox"
                checked={suggestion.selected}
                onChange={(event) => {
                  setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, selected: event.target.checked })));
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Buchung übernehmen
            </label>
            {suggestion.confidence != null && (
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                Sicherheit {Math.round(suggestion.confidence * 100)}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Beschreibung"
              value={suggestion.description}
              onChange={(value) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, description: value })))}
            />
            <Input
              label="Betrag"
              type="number"
              value={suggestion.amount}
              onChange={(value) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, amount: parseFloat(value || '0') })))}
            />
            <Select
              label="Kategorie"
              value={suggestion.category}
              onChange={(value) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, category: value })))}
              options={categoryOptions}
            />
            <Select
              label="Konto"
              value={suggestion.accountId}
              onChange={(value) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, accountId: value })))}
              options={accountOptions}
            />
            <Input
              label="Datum"
              type="date"
              value={suggestion.date}
              onChange={(value) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, date: value })))}
            />
            <Input
              label="Tags"
              value={(suggestion.tags || []).join(', ')}
              onChange={(value) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, tags: parseTags(value) })))}
              placeholder="z.B. Auto, Arbeit"
            />
          </div>

          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Notiz</label>
            <textarea
              value={suggestion.note || ''}
              onChange={(event) => setSuggestions((current) => updateSuggestionDraft(current, suggestion.id, (item) => ({ ...item, note: event.target.value })))}
              rows={3}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ausgaben: {formatCurrency(totalMonth, settings)}</h2>
          <p className="text-sm text-slate-500 dark:text-gray-500">{monthExpenses.length} Buchungen in {filterMonth}</p>
        </div>
        <Button onClick={() => openModal()} icon="Plus">Ausgabe erfassen</Button>
      </div>

      

      {categoryBreakdown.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-1 pb-1">
          {categoryBreakdown.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilterCategory(filterCategory === item.key ? 'all' : item.key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                filterCategory === item.key
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              <div className="rounded-md p-1" style={{ backgroundColor: `${item.color}15` }}>
                <Icon name={item.icon} size={12} color={item.color} />
              </div>
              <span>{item.labelDe}</span>
              <span className="font-bold">{formatCurrency(item.total, settings)}</span>
            </button>
          ))}
        </div>
      )}

      <Card className="p-5">
        <button
          onClick={() => setFiltersOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2 dark:bg-gray-800">
              <SlidersHorizontal size={16} className="text-slate-500 dark:text-gray-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Suche & Filter</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                {activeFilterCount > 0 ? `${activeFilterCount} aktive Filter` : 'Einklappen für eine ruhigere Ausgabenansicht'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                {activeFilterCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </button>

        {filtersOpen && (
          <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-gray-800">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input value={search} onChange={setSearch} placeholder="Nach Text, Notiz oder Tags suchen" icon="Search" />
              <Input type="month" value={filterMonth} onChange={setFilterMonth} />
              <Select value={filterCategory} onChange={setFilterCategory} options={[{ value: 'all', label: 'Alle Kategorien' }, ...categoryOptions]} />
              <Select value={filterAccount} onChange={setFilterAccount} options={filterAccountOptions} />
              <Input type="number" value={minAmount} onChange={setMinAmount} placeholder="Mindestbetrag" icon="Euro" />
              <Input type="number" value={maxAmount} onChange={setMaxAmount} placeholder="Maximalbetrag" icon="Euro" />
              <Select
                value={filterRecurring}
                onChange={setFilterRecurring}
                options={[
                  { value: 'all', label: 'Alle Buchungen' },
                  { value: 'yes', label: 'Nur wiederkehrend' },
                  { value: 'no', label: 'Nur einmalig' },
                ]}
              />
              <button
                onClick={() => setWarningsOnly((value) => !value)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  warningsOnly
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-slate-200 text-gray-900 dark:border-gray-800 dark:text-white'
                }`}
              >
                Nur Warnfälle
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSearch('');
                  setFilterMonth(currentMonth);
                  setFilterCategory('all');
                  setFilterAccount('all');
                  setFilterRecurring('all');
                  setMinAmount('');
                  setMaxAmount('');
                  setWarningsOnly(false);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 dark:border-gray-800 dark:text-gray-300"
              >
                Alles zurücksetzen
              </button>
            </div>
          </div>
        )}
      </Card>

      {monthExpenses.length === 0 ? (
        <Card>
          <EmptyState
            icon="ShoppingBag"
            title="Keine Ausgaben"
            description="Erfasse deine Ausgaben mit Tags, Konten, Belegen und optionaler AI-Unterstützung für eine belastbare Monatsplanung."
            action={{ label: 'Erste Ausgabe erfassen', onClick: () => openModal() }}
          />
        </Card>
      ) : filteredExpenses.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-gray-500">Für diese Filter gibt es keine Treffer.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Batch action bar */}
          {selectedIds.size > 0 && (
            <Card className="flex flex-wrap items-center gap-3 bg-blue-50 p-3 dark:bg-blue-950/20">
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{selectedIds.size} ausgewählt</span>
              <Select value={batchCategory} onChange={setBatchCategory} options={[{ value: '', label: 'Kategorie ändern...' }, ...categoryOptions]} />
              {batchCategory && (
                <Button size="sm" onClick={handleBatchCategoryChange}>Anwenden</Button>
              )}
              <Button size="sm" variant="danger" onClick={handleBatchDelete}>Löschen</Button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-gray-400">Auswahl aufheben</button>
            </Card>
          )}
          {filteredExpenses.length > 3 && (
            <button onClick={toggleSelectAll} className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400">
              {selectedIds.size === filteredExpenses.length ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          )}
          {Object.entries(groupedByDate).map(([dateKey, items]) => {
            const dayTotal = items.reduce((sum, expense) => sum + expense.amount, 0);
            return (
              <div key={dateKey}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-600">{formatDate(dateKey)}</h3>
                  <span className="text-xs font-semibold text-red-500 dark:text-red-400">{formatCurrency(dayTotal, settings)}</span>
                </div>
                <div className="space-y-2">
                  {items.map((expense) => {
                    const categoryInfo = getExpenseCategoryInfo(expense.category, settings);
                    const budgetStatus = calculateBudgetStatus(expense, expenses, budgetLimits, settings.budgetWarningThreshold);
                    const account = accounts.find((item) => item.id === expense.accountId);
                    return (
                      <Card
                        key={expense.id}
                        id={`expense-${expense.id}`}
                        className={`scroll-mt-28 p-4 ${highlightedExpenseId === expense.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 bg-blue-50/40 dark:bg-blue-950/20 dark:ring-offset-gray-950' : ''}`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(expense.id)}
                              onChange={() => toggleSelect(expense.id)}
                              className="mt-2 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="rounded-xl p-2" style={{ backgroundColor: `${categoryInfo.color}15` }}>
                              <Icon name={categoryInfo.icon} size={16} color={categoryInfo.color} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{expense.description}</h4>
                                <Badge color={categoryInfo.color}>{categoryInfo.labelDe}</Badge>
                                {expense.isRecurring && <Badge color="#8b5cf6">Wiederkehrend</Badge>}
                                {budgetStatus.isWarning && (
                                  <Badge color={budgetStatus.isOver ? '#ef4444' : '#f59e0b'}>
                                    {budgetStatus.isOver ? 'Budget überschritten' : 'Budget-Warnung'}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                                {account ? `Konto: ${account.name}` : 'Ohne Konto'}
                                {expense.note ? ` · ${expense.note}` : ''}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(expense.tags || []).map((item) => (
                                  <span key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                                    <Tag size={11} />
                                    {item}
                                  </span>
                                ))}
                                {expense.attachment && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                                    <Paperclip size={11} />
                                    {expense.attachment.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 lg:justify-end">
                            <div className="flex items-center gap-2">
                              {budgetStatus.isWarning && (
                                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                  <TriangleAlert size={12} />
                                  {budgetStatus.percentage.toFixed(0)}%
                                </div>
                              )}
                              {expense.isRecurring && <Repeat size={14} className="text-violet-500" />}
                            </div>
                            <p className="text-base font-bold text-red-600 dark:text-red-400">-{formatCurrency(expense.amount, settings)}</p>
                            <div className="flex gap-1">
                              <button onClick={() => openModal(expense)} className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800">
                                <Pencil size={15} className="text-slate-400" />
                              </button>
                              <button onClick={() => handleDelete(expense.id)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingExpense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}>
        <div className="space-y-4">
          <Input label="Beschreibung" value={description} onChange={setDescription} placeholder="z.B. Supermarkt, Restaurant, Tanken" icon="Edit3" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Betrag" type="number" value={amount} onChange={setAmount} placeholder="0.00" icon="Euro" />
            <Input label="Datum" type="date" value={date} onChange={setDate} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Kategorie" value={category} onChange={(value) => setCategory(value as ExpenseCategory)} options={categoryOptions} />
            <Select label="Konto" value={accountId} onChange={setAccountId} options={accountOptions} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Tags" value={tags} onChange={setTags} placeholder="z.B. Arbeit, Alltag, Auto" icon="Tag" />
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Beleg oder Datei</label>
              <input
                type="file"
                accept="image/*,.pdf,.txt,.doc,.docx"
                onChange={(event) => readAttachment(event, setAttachment)}
                className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              {attachment && <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">Gespeichert: {attachment.name}</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <input
                id="expense-recurring"
                type="checkbox"
                checked={isRecurring}
                onChange={(event) => setIsRecurring(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="expense-recurring" className="text-sm text-gray-700 dark:text-gray-300">
                Als wiederkehrende Ausgabe markieren
              </label>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Notiz</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Zusätzliche Infos, Händler, Vertragsdetails oder Kontext"
              rows={4}
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          {duplicateWarning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/20">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{duplicateWarning}</p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Nochmal klicken um trotzdem zu speichern.</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSubmit} className="flex-1">{editingExpense ? 'Speichern' : 'Hinzufügen'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={receiptModalOpen} onClose={() => { setReceiptModalOpen(false); resetReceiptFlow(); }} title="Beleg mit AI analysieren">
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Hier lädst du das Foto hoch</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">
              Akzeptiert werden Handyfotos, Screenshots und PDF-Rechnungen. Nach dem Upload startest du direkt die Analyse.
            </p>
            <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-white/90 px-4 py-5 text-center transition hover:border-blue-400 dark:border-blue-800 dark:bg-gray-900/80 dark:hover:border-blue-700">
              <Camera size={22} className="text-blue-500" />
              <span className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">Foto oder Rechnung auswählen</span>
              <span className="mt-1 text-xs text-slate-500 dark:text-gray-500">PNG, JPG, HEIC oder PDF</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => readAttachment(event, setReceiptAttachment)}
                className="sr-only"
              />
            </label>
            {receiptAttachment && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                Ausgewählt: {receiptAttachment.name}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Aktive AI-Konfiguration</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
              {settings.ai.enabled && settings.ai.provider !== 'disabled'
                ? `${settings.ai.provider} · ${settings.ai.model}`
                : 'AI aktuell deaktiviert - bitte in den Einstellungen aktivieren.'}
            </p>
          </div>

          {receiptError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{receiptError}</p>}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setReceiptModalOpen(false); resetReceiptFlow(); }} className="flex-1">Schließen</Button>
            <Button onClick={handleAnalyzeReceipt} className="flex-1" disabled={receiptLoading}>
              {receiptLoading ? <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" /> Analysiere...</span> : 'Analyse starten'}
            </Button>
          </div>

          {receiptSuggestions.length > 0 && (
            <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Vorschau vor dem Import</p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">Erst prüfen, dann als Ausgaben übernehmen.</p>
                </div>
                <Badge color="#8b5cf6">{receiptSuggestions.filter((item) => item.selected).length} ausgewählt</Badge>
              </div>
              {renderSuggestionEditor(receiptSuggestions, setReceiptSuggestions)}
              <Button
                onClick={() => {
                  applySuggestionDrafts(receiptSuggestions);
                  setReceiptModalOpen(false);
                  resetReceiptFlow();
                }}
                className="w-full"
              >
                Ausgewählte Buchungen importieren
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={voiceModalOpen} onClose={() => { setVoiceModalOpen(false); resetVoiceFlow(); }} title="Spracheingabe erfassen">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap gap-3">
              <Button onClick={startVoiceCapture} disabled={voiceListening}>
                {voiceListening ? 'Aufnahme läuft...' : 'Spracheingabe starten'}
              </Button>
              <Button variant="secondary" onClick={stopVoiceCapture} disabled={!voiceListening}>Stoppen</Button>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">
              Beispiel: „50 Euro tanken, 52 Euro essen, 60 Euro Freizeit“.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Transkript</label>
            <textarea
              value={voiceTranscript}
              onChange={(event) => setVoiceTranscript(event.target.value)}
              rows={5}
              placeholder="Hier erscheint die Spracheingabe oder du fügst Text manuell ein."
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {voiceError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{voiceError}</p>}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setVoiceModalOpen(false); resetVoiceFlow(); }} className="flex-1">Schließen</Button>
            <Button onClick={handleParseVoiceTranscript} className="flex-1" disabled={voiceLoading}>
              {voiceLoading ? <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" /> Verarbeite...</span> : 'In Buchungen umwandeln'}
            </Button>
          </div>

          {voiceSuggestions.length > 0 && (
            <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Buchungsvorschau</p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">Du bestätigst erst nach Sichtprüfung.</p>
                </div>
                <Badge color="#10b981">{voiceSuggestions.filter((item) => item.selected).length} ausgewählt</Badge>
              </div>
              {renderSuggestionEditor(voiceSuggestions, setVoiceSuggestions)}
              <Button
                onClick={() => {
                  applySuggestionDrafts(voiceSuggestions);
                  setVoiceModalOpen(false);
                  resetVoiceFlow();
                }}
                className="w-full"
              >
                Ausgewählte Buchungen importieren
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
