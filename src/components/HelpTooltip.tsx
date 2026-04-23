'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
  example?: string;
  side?: 'left' | 'right';
}

export function HelpTooltip({ title, description, example, side = 'right' }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        aria-label={title}
        aria-expanded={open}
      >
        <HelpCircle size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-x-4 top-[calc(4rem+var(--safe-area-top))] z-[130] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:hidden">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">{description}</p>
            {example && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-gray-800/70 dark:text-gray-300">
                {example}
              </div>
            )}
          </div>
          <div
            className={`absolute top-7 z-[130] hidden w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:block ${
              side === 'left' ? 'right-0' : 'left-0'
            }`}
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">{description}</p>
            {example && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-gray-800/70 dark:text-gray-300">
                {example}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}