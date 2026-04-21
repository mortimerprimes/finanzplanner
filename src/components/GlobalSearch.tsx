import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Icon } from './ui';
import { globalSearch, SearchResult } from '../utils/helpers';
import { useRouter } from 'next/navigation';

const TYPE_ROUTES: Record<string, string> = {
  expense: '/expenses',
  income: '/income',
  'fixed-expense': '/fixed-expenses',
  debt: '/debts',
  savings: '/savings',
  transfer: '/accounts',
  'freelance-project': '/freelance',
  invoice: '/freelance',
};

interface GlobalSearchProps {
  buttonClassName?: string;
  iconOnly?: boolean;
}

export function GlobalSearch({ buttonClassName, iconOnly = false }: GlobalSearchProps) {
  const { state } = useFinance();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: / to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
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
    const route = TYPE_ROUTES[result.type] || '/dashboard';
    router.push(route);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex]);
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
            <kbd className="ml-2 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-gray-600 dark:text-gray-500">/</kbd>
          </>
        )}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 animate-overlay" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-[calc(4rem+var(--safe-area-top))] z-[101] w-full max-w-lg -translate-x-1/2 animate-fade-in sm:top-[15%]">
        <div className="mx-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
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

          {results.length > 0 && (
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

          {query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-gray-500">
              Keine Ergebnisse für "{query}"
            </div>
          )}

          {query.length < 2 && (
            <div className="p-4 text-center text-xs text-slate-400 dark:text-gray-600">
              Tippe mindestens 2 Zeichen zum Suchen · <kbd className="rounded border px-1">↑↓</kbd> navigieren · <kbd className="rounded border px-1">Enter</kbd> öffnen
            </div>
          )}
        </div>
      </div>
    </>
  );
}
