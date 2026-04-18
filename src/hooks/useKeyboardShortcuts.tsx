import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFinance } from '@/lib/finance-context';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { dispatch, state } = useFinance();

  const handleUndo = useCallback(() => {
    if ((state.undoStack || []).length > 0) {
      dispatch({ type: 'POP_UNDO' });
    }
  }, [dispatch, state.undoStack]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl/Cmd+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Single key shortcuts (no modifier)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'n': case 'N':
          // N = new expense — navigate to expenses page
          // The actual modal opening is handled by the page itself
          router.push('/expenses');
          break;
        case 'b': case 'B':
          router.push('/budget');
          break;
        case 'd': case 'D':
          router.push('/dashboard');
          break;
        case 'a': case 'A':
          router.push('/analytics');
          break;
        case 's': case 'S':
          router.push('/savings');
          break;
        case 'f': case 'F':
          router.push('/freelance');
          break;
        case '?':
          // Show shortcuts help — dispatch custom event
          window.dispatchEvent(new CustomEvent('show-shortcuts'));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, handleUndo]);
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '/', label: 'Globale Suche öffnen' },
    { key: 'N', label: 'Neue Ausgabe (→ Ausgaben-Seite)' },
    { key: 'D', label: 'Dashboard' },
    { key: 'B', label: 'Budgets' },
    { key: 'S', label: 'Sparziele' },
    { key: 'A', label: 'Analysen' },
    { key: 'F', label: 'Freelance' },
    { key: '⌘Z', label: 'Letzte Aktion rückgängig' },
    { key: '?', label: 'Diese Hilfe anzeigen' },
    { key: 'Esc', label: 'Schließen' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 animate-overlay" onClick={onClose} />
      <div className="fixed left-1/2 top-[20%] z-[101] w-full max-w-sm -translate-x-1/2 animate-fade-in">
        <div className="mx-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Tastenkürzel</h3>
          <div className="space-y-2">
            {shortcuts.map(s => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-gray-400">{s.label}</span>
                <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-slate-100 py-2 text-sm font-medium text-gray-900 hover:bg-slate-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            Schließen
          </button>
        </div>
      </div>
    </>
  );
}
