'use client';

import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Image, Search, Calendar, Tag, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Expense } from '@/src/types';

export function ReceiptGalleryPage() {
  const { state } = useFinance();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const expensesWithReceipts = useMemo(() => {
    return state.expenses
      .filter((e): e is Expense & { attachment: NonNullable<Expense['attachment']> } =>
        !!e.attachment?.dataUrl
      )
      .filter(e => {
        if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (selectedCategory && e.category !== selectedCategory) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.expenses, search, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    state.expenses.forEach(e => { if (e.attachment?.dataUrl) cats.add(e.category); });
    return Array.from(cats).sort();
  }, [state.expenses]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return d; }
  };

  const formatCurrency = (v: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: state.settings.currency || 'EUR' }).format(v);
  };

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const prevImage = () => setLightboxIdx(i => i != null ? Math.max(0, i - 1) : null);
  const nextImage = () => setLightboxIdx(i => i != null ? Math.min(expensesWithReceipts.length - 1, i + 1) : null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Image size={28} className="text-purple-500" />
          Beleg-Galerie
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{expensesWithReceipts.length} Belege</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Belege suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">Alle Kategorien</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Gallery Grid */}
      {expensesWithReceipts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-gray-500">
          <Image size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Keine Belege gefunden</p>
          <p className="text-sm mt-1">Füge Belege beim Erstellen von Ausgaben hinzu</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {expensesWithReceipts.map((expense, idx) => (
            <div
              key={expense.id}
              className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
              onClick={() => openLightbox(idx)}
            >
              <div className="aspect-square overflow-hidden bg-slate-100 dark:bg-gray-800">
                {expense.attachment.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={expense.attachment.dataUrl}
                    alt={expense.description}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Image size={40} />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <ZoomIn size={20} className="absolute top-3 right-3 text-white" />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{expense.description}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar size={10} /> {formatDate(expense.date)}
                  </span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(expense.amount)}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                  <Tag size={10} /> {expense.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx != null && expensesWithReceipts[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closeLightbox}>
          <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X size={24} />
          </button>
          {lightboxIdx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
              <ChevronLeft size={24} />
            </button>
          )}
          {lightboxIdx < expensesWithReceipts.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
              <ChevronRight size={24} />
            </button>
          )}
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expensesWithReceipts[lightboxIdx].attachment.dataUrl}
              alt={expensesWithReceipts[lightboxIdx].description}
              className="max-h-[70vh] rounded-xl object-contain"
            />
            <div className="mt-4 text-center">
              <p className="text-white font-semibold">{expensesWithReceipts[lightboxIdx].description}</p>
              <p className="text-white/60 text-sm mt-1">
                {formatDate(expensesWithReceipts[lightboxIdx].date)} · {formatCurrency(expensesWithReceipts[lightboxIdx].amount)} · {expensesWithReceipts[lightboxIdx].category}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
