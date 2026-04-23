import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Icon } from './ui';
import { globalSearch, SearchResult } from '../utils/helpers';
import { buildSearchResultHref } from '../utils/searchFocus';
import { useRouter } from 'next/navigation';

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

export function GlobalSearch({ buttonClassName, iconOnly = false }: GlobalSearchProps) {
  const { state } = useFinance();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions: QuickAction[] = [
    {
      id: 'setup',
      title: 'Einrichtungsassistent öffnen',
      subtitle: 'Geführtes Setup für Konto, Einnahmen und Fixkosten',
      icon: 'Sparkles',
      color: '#2563eb',
      badge: 'Setup',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-onboarding'));
        setOpen(false);
      },
    },
    {
      id: 'quick-capture',
      title: 'Schnellerfassung starten',
      subtitle: 'Direkt eine Ausgabe, Einnahme oder Fixkosten erfassen',
      icon: 'Plus',
      color: '#10b981',
      badge: 'Aktion',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-quick-capture', { detail: { type: 'expense' } }));
        setOpen(false);
      },
    },
    {
      id: 'shortcuts',
      title: 'Tastenkürzel anzeigen',
      subtitle: 'Alle Kurzbefehle und Suchtricks auf einen Blick',
      icon: 'Keyboard',
      color: '#8b5cf6',
      badge: 'Hilfe',
      action: () => {
        window.dispatchEvent(new CustomEvent('show-shortcuts'));
        setOpen(false);
      },
    },
    {
      id: 'bank-sync',
      title: 'Kontoauszug importieren',
      subtitle: 'Zum Import-Flow für CSV, ELBA und MT940',
      icon: 'Upload',
      color: '#f59e0b',
      badge: 'Import',
      action: () => {
        router.push('/bank-sync');
        setOpen(false);
      },
    },
  ];

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
            <div className="max-h-80 overflow-y-auto p-2">
              {quickActions.map((item, index) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'
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
            <div className="p-4 text-center text-xs text-slate-400 dark:text-gray-600">
              Schnellaktionen oben · <kbd className="rounded border px-1">↑↓</kbd> navigieren · <kbd className="rounded border px-1">Enter</kbd> ausführen
            </div>
          )}
        </div>
      </div>
    </>
  );
}
