import { ChangeEvent, useState } from 'react';
import { Camera, Mic, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Button, Input, Modal, Select } from './ui';
import { FIXED_EXPENSE_CATEGORIES, INCOME_TYPES } from '../utils/constants';
import { getExpenseCategoryMap, parseTags } from '../utils/helpers';
import { analyzeReceiptWithAI, parseSpeechExpenses } from '../services/ai';
import type { ExpenseAttachment, ExpenseCategory, FixedExpenseCategory, IncomeType } from '../types';

type CaptureType = 'expense' | 'income' | 'fixed';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
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

export function QuickCaptureFab() {
  const { state, dispatch } = useFinance();
  const { settings, accounts } = state;
  const [isOpen, setIsOpen] = useState(false);
  const [captureType, setCaptureType] = useState<CaptureType>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>((settings.lastUsedExpenseCategory as ExpenseCategory) || 'food');
  const [incomeType, setIncomeType] = useState<IncomeType>('salary');
  const [fixedCategory, setFixedCategory] = useState<FixedExpenseCategory>('housing');
  const [accountId, setAccountId] = useState(settings.lastUsedAccountId || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState(settings.lastUsedExpenseTags.join(', '));
  const [note, setNote] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [attachment, setAttachment] = useState<ExpenseAttachment | undefined>();
  const [aiError, setAIError] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  if (!settings.quickEntry) {
    return null;
  }

  const expenseCategoryOptions = Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({
    value,
    label: info.labelDe,
  }));
  const accountOptions = [{ value: '', label: 'Ohne Konto' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];
  const incomeOptions = Object.entries(INCOME_TYPES).map(([value, info]) => ({ value, label: info.labelDe }));
  const fixedOptions = Object.entries(FIXED_EXPENSE_CATEGORIES).map(([value, info]) => ({ value, label: info.labelDe }));
  const dayOptions = Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}. des Monats` }));
  const aiCategoryOptions = Object.entries(getExpenseCategoryMap(settings)).map(([value, info]) => ({ id: value, label: info.labelDe }));

  const closeModal = () => {
    setIsOpen(false);
    setName('');
    setAmount('');
    setNote('');
    setAttachment(undefined);
    setVoiceTranscript('');
    setAIError('');
  };

  const applySuggestionToForm = (suggestion: { description: string; amount: number; category: string; date: string; note?: string; tags?: string[] }) => {
    setName(suggestion.description || '');
    setAmount(String(suggestion.amount || ''));
    setNote(suggestion.note || '');
    if (suggestion.date?.length >= 10) {
      setDate(suggestion.date.slice(0, 10));
    }
    if (captureType === 'expense') {
      setExpenseCategory(suggestion.category as ExpenseCategory);
      setTags((suggestion.tags || []).join(', '));
    }
  };

  const handleSave = () => {
    if (!name || !amount) return;

    if (captureType === 'expense') {
      const parsedTags = parseTags(tags);
      dispatch({
        type: 'ADD_EXPENSE',
        payload: {
          description: name,
          amount: parseFloat(amount),
          category: expenseCategory,
          date,
          month: date.slice(0, 7),
          note: note || undefined,
          tags: parsedTags,
          accountId: accountId || undefined,
          attachment,
        },
      });
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          lastUsedExpenseCategory: expenseCategory,
          lastUsedAccountId: accountId || undefined,
          lastUsedExpenseTags: parsedTags,
        },
      });
    }

    if (captureType === 'income') {
      dispatch({
        type: 'ADD_INCOME',
        payload: {
          name,
          amount: parseFloat(amount),
          type: incomeType,
          isRecurring: false,
          date,
          month: date.slice(0, 7),
          note: note || undefined,
        },
      });
    }

    if (captureType === 'fixed') {
      dispatch({
        type: 'ADD_FIXED_EXPENSE',
        payload: {
          name,
          amount: parseFloat(amount),
          category: fixedCategory,
          dueDay: parseInt(dueDay, 10),
          isActive: true,
          note: note || undefined,
        },
      });
    }

    closeModal();
  };

  const analyzeAttachment = async (nextAttachment: ExpenseAttachment) => {
    setAIError('');
    if (!settings.ai.enabled || settings.ai.provider === 'disabled') {
      setAIError('AI in Einstellungen aktivieren');
      return;
    }
    setAILoading(true);
    try {
      const suggestions = await analyzeReceiptWithAI({
        settings,
        attachment: nextAttachment,
        categories: aiCategoryOptions,
        selectedMonth: date.slice(0, 7),
      });
      if (!suggestions[0]) {
        setAIError('Keine Erkennung');
      } else {
        applySuggestionToForm(suggestions[0]);
      }
    } catch (error) {
      setAIError(error instanceof Error ? error.message : 'Analyse fehlgeschlagen');
    } finally {
      setAILoading(false);
    }
  };

  const onAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachment(undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextAttachment = {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string,
      };
      setAttachment(nextAttachment);
      void analyzeAttachment(nextAttachment);
    };
    reader.readAsDataURL(file);
  };

  const startVoiceCapture = () => {
    const RecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
      onerror: ((event: Event) => void) | null;
      start: () => void;
    }) | undefined;
    if (!RecognitionClass) {
      setAIError('Browser ohne Sprache');
      return;
    }
    const recognition = new RecognitionClass();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setVoiceTranscript(transcript);
      void analyzeVoice(transcript);
    };
    recognition.onerror = () => setAIError('Spracheingabe fehlgeschlagen');
    recognition.start();
  };

  const analyzeVoice = async (transcriptValue = voiceTranscript) => {
    setAIError('');
    if (!transcriptValue.trim()) {
      setAIError('Bitte Sprache aufnehmen');
      return;
    }
    if (!settings.ai.enabled || settings.ai.provider === 'disabled') {
      setAIError('AI in Einstellungen aktivieren');
      return;
    }
    setAILoading(true);
    try {
      const suggestions = await parseSpeechExpenses({
        settings,
        transcript: transcriptValue,
        categories: aiCategoryOptions,
        selectedMonth: date.slice(0, 7),
      });
      if (!suggestions[0]) {
        setAIError('Keine Erkennung');
      } else {
        applySuggestionToForm(suggestions[0]);
      }
    } catch (error) {
      setAIError(error instanceof Error ? error.message : 'Sprache fehlgeschlagen');
    } finally {
      setAILoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[80] inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-700"
        aria-label="Schnellerfassung öffnen"
      >
        <Plus size={24} />
      </button>

      <Modal isOpen={isOpen} onClose={closeModal} title="Schnellerfassung">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'expense', label: 'Ausgabe', icon: Wallet },
              { id: 'income', label: 'Einnahme', icon: TrendingUp },
              { id: 'fixed', label: 'Fixkosten', icon: Receipt },
            ].map((item) => {
              const ItemIcon = item.icon;
              const active = captureType === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCaptureType(item.id as CaptureType)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-medium transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-gray-900 dark:border-gray-800 dark:bg-gray-800/50 dark:text-white'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <ItemIcon size={18} />
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>

          <Input
            label={captureType === 'expense' ? 'Beschreibung' : 'Bezeichnung'}
            value={name}
            onChange={setName}
            placeholder={captureType === 'expense' ? 'z.B. Supermarkt, Tanken, Kino' : 'z.B. Gehalt, Miete'}
            icon="Edit3"
          />
          <Input label="Betrag" type="number" value={amount} onChange={setAmount} placeholder="0.00" icon="Euro" />

          {(captureType === 'expense' || captureType === 'income') && (
            <>
              <div className="flex gap-2">
                <label
                  title="Bild auswählen"
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
                >
                  <Camera size={15} />
                  <input type="file" accept="image/*,.pdf" onChange={onAttachmentChange} className="sr-only" />
                </label>
                <button
                  title="Sprache aufnehmen"
                  onClick={startVoiceCapture}
                  disabled={aiLoading}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
                >
                  <Mic size={15} />
                </button>
              </div>
              {aiError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{aiError}</p>}
            </>
          )}

          {captureType === 'expense' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Kategorie" value={expenseCategory} onChange={(value) => setExpenseCategory(value as ExpenseCategory)} options={expenseCategoryOptions} />
                <Select label="Konto" value={accountId} onChange={setAccountId} options={accountOptions} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Datum" type="date" value={date} onChange={setDate} />
                <Input label="Tags" value={tags} onChange={setTags} placeholder="z.B. Familie, Arbeit" />
              </div>
            </>
          )}

          {captureType === 'income' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Typ" value={incomeType} onChange={(value) => setIncomeType(value as IncomeType)} options={incomeOptions} />
                <Input label="Datum" type="date" value={date} onChange={setDate} />
              </div>
            </>
          )}

          {captureType === 'fixed' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Kategorie" value={fixedCategory} onChange={(value) => setFixedCategory(value as FixedExpenseCategory)} options={fixedOptions} />
              <Select label="Fälligkeit" value={dueDay} onChange={setDueDay} options={dayOptions} />
            </div>
          )}

          <Input label="Notiz" value={note} onChange={setNote} placeholder="Optional" />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSave} className="flex-1">Sofort speichern</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
