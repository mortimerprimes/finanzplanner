import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Icon } from './ui';
import { globalSearch, SearchResult } from '../utils/helpers';
import { buildSearchResultHref } from '../utils/searchFocus';
import { usePathname, useRouter } from 'next/navigation';

interface GlobalSearchProps {
  buttonClassName?: string;
  iconOnly?: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  badge: string;
  action: () => void;
}

interface QuickActionSection {
  id: string;
  title: string;
  description: string;
  items: QuickAction[];
}

interface IndexedQuickAction extends QuickAction {
  listIndex: number;
}

interface IndexedQuickActionSection extends Omit<QuickActionSection, 'items'> {
  items: IndexedQuickAction[];
}

export function GlobalSearch({ buttonClassName, iconOnly = false }: GlobalSearchProps) {
  const { state } = useFinance();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isGuidedMode = state.settings.userExperience.mode === 'guided';
  const hasFreelanceWorkspace = state.settings.userExperience.profile !== 'personal';

  const quickActionSections = useMemo<IndexedQuickActionSection[]>(() => {
    const runAndClose = (action: () => void) => () => {
      action();
      setOpen(false);
    };

    let contextSection: QuickActionSection | null = null;

    if (pathname.startsWith('/dashboard')) {
      contextSection = {
        id: 'context-dashboard',
        title: 'Aktueller Bereich: Dashboard',
        description: 'Direktaktionen für Monatsabschluss und erweiterte Einblicke.',
        items: [
          {
            id: 'dashboard-month-end',
            title: 'Monatsabschluss öffnen',
            subtitle: 'Öffnet den Assistenten für Abschluss und Rückblick',
            icon: 'ClipboardCheck',
            color: '#2563eb',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('dashboard-open-month-end'))),
          },
          {
            id: 'dashboard-toggle-advanced',
            title: 'Erweiterte Einblicke umschalten',
            subtitle: 'Blendet tiefere Widgets im Dashboard ein oder aus',
            icon: 'LineChart',
            color: '#7c3aed',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('dashboard-toggle-advanced-insights'))),
          },
        ],
      };
    } else if (pathname.startsWith('/expenses')) {
      contextSection = {
        id: 'context-expenses',
        title: 'Aktueller Bereich: Ausgaben',
        description: 'Erfassung, Filter und Helfer für die laufende Buchungsansicht.',
        items: [
          {
            id: 'expenses-create',
            title: 'Ausgabe erfassen',
            subtitle: 'Öffnet direkt den Eingabedialog dieser Seite',
            icon: 'Plus',
            color: '#10b981',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('expenses-open-create'))),
          },
          {
            id: 'expenses-filters',
            title: 'Filter öffnen',
            subtitle: 'Blendet Suche und Filter für diese Liste ein',
            icon: 'SlidersHorizontal',
            color: '#2563eb',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('expenses-open-filters'))),
          },
          {
            id: 'expenses-helpers',
            title: 'Erfassungshelfer öffnen',
            subtitle: 'Zeigt Beleganalyse, Spracheingabe und Auswahlmodus',
            icon: 'Sparkles',
            color: '#8b5cf6',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('expenses-open-helpers'))),
          },
        ],
      };
    } else if (pathname.startsWith('/accounts')) {
      contextSection = {
        id: 'context-accounts',
        title: 'Aktueller Bereich: Konten',
        description: 'Häufige Kontoaktionen, ohne die Übersicht zu verlassen.',
        items: [
          {
            id: 'accounts-create',
            title: 'Konto hinzufügen',
            subtitle: 'Öffnet direkt den Kontodialog',
            icon: 'Plus',
            color: '#2563eb',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('accounts-open-create'))),
          },
          {
            id: 'accounts-transfer',
            title: 'Transfer starten',
            subtitle: 'Öffnet den Transferdialog auf der Kontoseite',
            icon: 'ArrowRightLeft',
            color: '#0f766e',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('accounts-open-transfer'))),
          },
          {
            id: 'accounts-import',
            title: 'Kontoauszug importieren',
            subtitle: 'Startet direkt den Importdialog',
            icon: 'Upload',
            color: '#f59e0b',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('accounts-open-import'))),
          },
        ],
      };
    } else if (pathname.startsWith('/budget')) {
      contextSection = {
        id: 'context-budget',
        title: 'Aktueller Bereich: Budget',
        description: 'Budgets anlegen und die Sicht auf den Zeitraum anpassen.',
        items: [
          {
            id: 'budget-create',
            title: 'Budget hinzufügen',
            subtitle: 'Öffnet direkt den Budgetdialog',
            icon: 'Plus',
            color: '#2563eb',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('budget-open-create'))),
          },
          {
            id: 'budget-weekly',
            title: 'Wochenansicht umschalten',
            subtitle: 'Wechselt zwischen Wochen- und Monatsblick',
            icon: 'CalendarDays',
            color: '#0f766e',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('budget-toggle-weekly'))),
          },
        ],
      };
    } else if (pathname.startsWith('/settings')) {
      contextSection = {
        id: 'context-settings',
        title: 'Aktueller Bereich: Einstellungen',
        description: 'Springe direkt in den passenden Einstellungsbereich.',
        items: [
          {
            id: 'settings-basics',
            title: 'Alltag öffnen',
            subtitle: 'Bedienung, Setup-Hinweise und Basispräferenzen',
            icon: 'SlidersHorizontal',
            color: '#2563eb',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('settings-open-section', { detail: { section: 'basics' } }))),
          },
          {
            id: 'settings-workspace',
            title: 'Oberfläche öffnen',
            subtitle: 'Navigation, Dashboard und Kategorien anpassen',
            icon: 'LayoutDashboard',
            color: '#8b5cf6',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('settings-open-section', { detail: { section: 'workspace' } }))),
          },
          {
            id: 'settings-automation',
            title: 'Automationen öffnen',
            subtitle: 'Erinnerungen, AI und Benachrichtigungen prüfen',
            icon: 'Bot',
            color: '#0f766e',
            badge: 'Hier',
            action: runAndClose(() => window.dispatchEvent(new CustomEvent('settings-open-section', { detail: { section: 'automation' } }))),
          },
        ],
      };
    }

    const primaryActions: QuickAction[] = [];

    if (!state.settings.userExperience.initialSetupCompleted || isGuidedMode) {
      primaryActions.push({
        id: 'setup',
        title: 'Einrichtungsassistent öffnen',
        subtitle: 'Geführtes Setup für Konto, Einnahmen und Fixkosten',
        icon: 'Sparkles',
        color: '#2563eb',
        badge: 'Setup',
        action: runAndClose(() => window.dispatchEvent(new CustomEvent('open-onboarding'))),
      });
    }

    primaryActions.push({
      id: 'capture-expense',
      title: 'Ausgabe erfassen',
      subtitle: 'Direkt eine neue Ausgabe oder einen Beleg starten',
      icon: 'Plus',
      color: '#10b981',
      badge: 'Alltag',
      action: runAndClose(() => window.dispatchEvent(new CustomEvent('open-quick-capture', { detail: { type: 'expense' } }))),
    });

    if (!isGuidedMode) {
      primaryActions.push({
        id: 'capture-income',
        title: 'Einnahme erfassen',
        subtitle: 'Gehalt, Erstattung oder Nebenverdienst eintragen',
        icon: 'TrendingUp',
        color: '#0f766e',
        badge: 'Alltag',
        action: runAndClose(() => window.dispatchEvent(new CustomEvent('open-quick-capture', { detail: { type: 'income' } }))),
      });
    }

    primaryActions.push(
      isGuidedMode
        ? {
            id: 'open-budget',
            title: 'Budgets prüfen',
            subtitle: 'Restbeträge, Warnungen und Monatsbudget öffnen',
            icon: 'Wallet',
            color: '#7c3aed',
            badge: 'Uebersicht',
            action: runAndClose(() => router.push('/budget')),
          }
        : {
            id: 'open-dashboard',
            title: 'Dashboard öffnen',
            subtitle: 'Fokus, Kennzahlen und heutige Aktionen ansehen',
            icon: 'LayoutDashboard',
            color: '#2563eb',
            badge: 'Uebersicht',
            action: runAndClose(() => router.push('/dashboard')),
          }
    );

    const supportActions: QuickAction[] = [
      {
        id: 'shortcuts',
        title: 'Tastenkürzel anzeigen',
        subtitle: 'Kurzbefehle und Suchtricks auf einen Blick',
        icon: 'Keyboard',
        color: '#8b5cf6',
        badge: 'Hilfe',
        action: runAndClose(() => window.dispatchEvent(new CustomEvent('show-shortcuts'))),
      },
    ];

    if (!isGuidedMode) {
      supportActions.unshift({
        id: 'bank-sync',
        title: 'Kontoauszug importieren',
        subtitle: 'Zum Import-Flow für CSV, ELBA und MT940',
        icon: 'Upload',
        color: '#f59e0b',
        badge: 'Import',
        action: runAndClose(() => router.push('/bank-sync')),
      });
    }

    if (hasFreelanceWorkspace) {
      supportActions.unshift({
        id: 'freelance',
        title: 'Freelance-Bereich öffnen',
        subtitle: 'Projekte, Rechnungen und Limits im Blick behalten',
        icon: 'Briefcase',
        color: '#9333ea',
        badge: 'Bereich',
        action: runAndClose(() => router.push('/freelance')),
      });
    }

    const sections: QuickActionSection[] = [
      contextSection,
      {
        id: 'primary',
        title: isGuidedMode ? 'Häufig gebraucht' : 'Direkt starten',
        description: isGuidedMode ? 'Alltagsaufgaben ohne Umwege.' : 'Schnelle Aktionen für den häufigsten Einstieg.',
        items: primaryActions,
      },
      {
        id: 'support',
        title: 'Mehr Optionen',
        description: 'Hilfen und weiterführende Bereiche.',
        items: supportActions,
      },
    ].filter((section): section is QuickActionSection => Boolean(section && section.items.length > 0));

    let offset = 0;
    return sections.map((section) => {
      const items = section.items.map((item, index) => ({
        ...item,
        listIndex: offset + index,
      }));
      offset += items.length;
      return {
        ...section,
        items,
      };
    });
  }, [hasFreelanceWorkspace, isGuidedMode, pathname, router, state.settings.userExperience.initialSetupCompleted]);

  const quickActions = useMemo(() => quickActionSections.flatMap((section) => section.items), [quickActionSections]);

  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    const addSuggestion = (value?: string) => {
      const trimmed = value?.trim();
      if (trimmed && trimmed.length >= 2) {
        suggestions.add(trimmed);
      }
    };

    state.expenses.slice(0, 2).forEach((item) => addSuggestion(item.description));
    state.fixedExpenses.slice(0, 1).forEach((item) => addSuggestion(item.name));
    state.incomes.slice(0, 1).forEach((item) => addSuggestion(item.name));

    if (hasFreelanceWorkspace) {
      state.freelanceProjects.slice(0, 1).forEach((item) => addSuggestion(item.clientName || item.name));
    }

    if (suggestions.size === 0) {
      (isGuidedMode ? ['Miete', 'Supermarkt', 'Gehalt'] : ['Miete', 'Kreditkarte', 'Rechnung']).forEach(addSuggestion);
    }

    return Array.from(suggestions).slice(0, 4);
  }, [hasFreelanceWorkspace, isGuidedMode, state.expenses, state.fixedExpenses, state.freelanceProjects, state.incomes]);

  // Keyboard shortcut: / or Cmd/Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-command-palette', handler);
    return () => window.removeEventListener('open-command-palette', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setSelectedIndex(0);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(globalSearch(q, state));
  }, [state]);

  const navigate = (result: SearchResult) => {
    router.push(buildSearchResultHref(result));
    setOpen(false);
  };

  const showQuickActions = query.trim().length < 2;
  const activeItemsCount = showQuickActions ? quickActions.length : results.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(activeItemsCount - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (e.key === 'Enter') {
      if (showQuickActions && quickActions[selectedIndex]) {
        quickActions[selectedIndex].action();
      } else if (!showQuickActions && results[selectedIndex]) {
        navigate(results[selectedIndex]);
      }
    }
  };

  const typeLabels: Record<string, string> = {
    expense: 'Ausgabe', income: 'Einnahme', 'fixed-expense': 'Fixkosten',
    debt: 'Schulden', savings: 'Sparziel', transfer: 'Transfer',
    'freelance-project': 'Projekt', invoice: 'Rechnung',
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Suche öffnen"
        className={buttonClassName || 'hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400 dark:hover:bg-gray-700 lg:inline-flex'}
      >
        <Search size={14} />
        {!iconOnly && (
          <>
            <span>Suche</span>
                <div className="ml-2 flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-gray-600 dark:text-gray-500">⌘K</kbd>
                  <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-gray-600 dark:text-gray-500">/</kbd>
                </div>
          </>
        )}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 animate-overlay" onClick={() => setOpen(false)} />
      <div className="fixed inset-x-0 top-[calc(3.75rem+var(--safe-area-top))] z-[101] mx-auto w-full max-w-lg animate-fade-in px-3 sm:left-1/2 sm:top-[15%] sm:-translate-x-1/2 sm:px-0">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 max-h-[calc(100dvh-var(--safe-area-top)-5rem)] sm:max-h-none">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-gray-800">
            <Search size={18} className="text-slate-400 dark:text-gray-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ausgaben, Einnahmen, Projekte durchsuchen..."
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-gray-500"
            />
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-gray-800">
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          {showQuickActions && (
            <div className="max-h-80 overflow-y-auto p-3">
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Schnell starten oder direkt suchen</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                  Tippe mindestens 2 Buchstaben, um Buchungen, Ziele und Projekte zu finden. Solange das Feld leer ist, siehst du die wichtigsten Einstiege und, auf Kernseiten, direkte Aktionen für den aktuellen Bereich.
                </p>
              </div>

              <div className="space-y-4">
                {quickActionSections.map((section) => (
                  <div key={section.id}>
                    <div className="mb-2 px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">{section.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{section.description}</p>
                    </div>
                    <div className="space-y-1.5">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={item.action}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            item.listIndex === selectedIndex ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="rounded-lg p-1.5" style={{ backgroundColor: `${item.color}15` }}>
                            <Icon name={item.icon} size={16} color={item.color} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-gray-500">{item.subtitle}</p>
                          </div>
                          <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-gray-800 dark:text-gray-500">
                            {item.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showQuickActions && results.length > 0 && (
            <div className="max-h-80 overflow-y-auto p-2">
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => navigate(r)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    i === selectedIndex ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="rounded-lg p-1.5" style={{ backgroundColor: `${r.color}15` }}>
                    <Icon name={r.icon} size={16} color={r.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{r.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-gray-500">{r.subtitle}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-gray-800 dark:text-gray-500">
                    {typeLabels[r.type] || r.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!showQuickActions && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-gray-500">
              Keine Ergebnisse für "{query}"
            </div>
          )}

          {showQuickActions && (
            <div className="border-t border-slate-200 px-4 py-3 dark:border-gray-800">
              {searchSuggestions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">Suchideen</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {searchSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSearch(suggestion)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-3 text-center text-xs text-slate-400 dark:text-gray-600">
                <kbd className="rounded border px-1">↑↓</kbd> navigieren · <kbd className="rounded border px-1">Enter</kbd> ausführen · <kbd className="rounded border px-1">Esc</kbd> schließen
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
