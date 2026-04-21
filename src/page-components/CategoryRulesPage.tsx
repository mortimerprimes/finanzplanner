'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { EXPENSE_CATEGORIES } from '@/src/utils/constants';
import {
  Zap, Plus, Trash2, Edit, Check, X, ToggleLeft, ToggleRight, Search,
} from 'lucide-react';
import type { CategoryRule, ExpenseCategory } from '@/src/types';

export function CategoryRulesPage() {
  const { state, dispatch } = useFinance();
  const rules = state.categoryRules || [];
  const [editId, setEditId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [matchType, setMatchType] = useState<CategoryRule['matchType']>('contains');
  const [showAdd, setShowAdd] = useState(false);

  const allCategories = [
    ...Object.entries(EXPENSE_CATEGORIES).map(([id, info]) => ({ id, label: info.labelDe })),
    ...(state.settings.customExpenseCategories || []).map(c => ({ id: c.id, label: c.labelDe || c.label })),
  ];

  const getCategoryLabel = (catId: string) => {
    const found = allCategories.find(c => c.id === catId);
    return found?.label || catId;
  };

  const handleAdd = () => {
    if (!keyword.trim()) return;
    dispatch({
      type: 'ADD_CATEGORY_RULE',
      payload: { keyword: keyword.trim(), category, matchType, isActive: true },
    });
    dispatch({
      type: 'ADD_ACTIVITY_LOG',
      payload: { action: 'create', entity: 'other', label: `Kategorie-Regel: "${keyword.trim()}" → ${getCategoryLabel(category)}` },
    });
    setKeyword('');
    setCategory('food');
    setMatchType('contains');
    setShowAdd(false);
  };

  const handleUpdate = (rule: CategoryRule) => {
    dispatch({ type: 'UPDATE_CATEGORY_RULE', payload: rule });
    setEditId(null);
  };

  const handleDelete = (id: string) => {
    const rule = rules.find(r => r.id === id);
    dispatch({ type: 'DELETE_CATEGORY_RULE', payload: id });
    if (rule) {
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        payload: { action: 'delete', entity: 'other', label: `Kategorie-Regel gelöscht: "${rule.keyword}"` },
      });
    }
  };

  const handleToggle = (rule: CategoryRule) => {
    dispatch({ type: 'UPDATE_CATEGORY_RULE', payload: { ...rule, isActive: !rule.isActive } });
  };

  const matchTypeLabels: Record<CategoryRule['matchType'], string> = {
    contains: 'Enthält',
    startsWith: 'Beginnt mit',
    exact: 'Exakt',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap size={28} className="text-amber-500" />
            Kategorie-Regeln
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Automatische Kategorisierung bei Bank-Import & neuen Ausgaben
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Neue Regel
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-200 dark:border-blue-900/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Neue Regel erstellen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Suchbegriff</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder='z.B. "REWE", "Amazon"...'
                  className="block w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="block w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {allCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Übereinstimmung</label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as CategoryRule['matchType'])}
                className="block w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {Object.entries(matchTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
              Abbrechen
            </button>
            <button onClick={handleAdd} disabled={!keyword.trim()} className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
              <Check size={16} className="inline mr-1" /> Speichern
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-gray-500">
          <Zap size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Noch keine Regeln</p>
          <p className="text-sm mt-1">Erstelle Regeln wie &quot;REWE&quot; → Lebensmittel</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isEditing = editId === rule.id;
            return (
              <div key={rule.id} className={`bg-white dark:bg-gray-900 rounded-xl border p-3 flex items-center gap-3 ${
                rule.isActive ? 'border-slate-200 dark:border-gray-800' : 'border-slate-200 dark:border-gray-800 opacity-50'
              }`}>
                {/* Toggle */}
                <button onClick={() => handleToggle(rule)} className="flex-shrink-0">
                  {rule.isActive
                    ? <ToggleRight size={24} className="text-green-500" />
                    : <ToggleLeft size={24} className="text-slate-400" />
                  }
                </button>

                {isEditing ? (
                  <EditRuleRow
                    rule={rule}
                    allCategories={allCategories}
                    matchTypeLabels={matchTypeLabels}
                    onSave={handleUpdate}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                          &quot;{rule.keyword}&quot;
                        </code>
                        <span className="text-xs text-slate-400">→</span>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {getCategoryLabel(rule.category)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">
                        {matchTypeLabels[rule.matchType]}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setEditId(rule.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800">
                        <Edit size={14} className="text-slate-400" />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Wie funktionieren Regeln?</h3>
        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
          <li>• <strong>Enthält:</strong> &quot;REWE&quot; findet &quot;REWE Markt Berlin&quot;</li>
          <li>• <strong>Beginnt mit:</strong> &quot;AMAZON&quot; findet &quot;AMAZON MARKETPLACE&quot;</li>
          <li>• <strong>Exakt:</strong> Nur exakte Übereinstimmung</li>
          <li>• Regeln werden beim Bank-Import automatisch angewandt</li>
        </ul>
      </div>
    </div>
  );
}

// Inline edit row component
function EditRuleRow({
  rule,
  allCategories,
  matchTypeLabels,
  onSave,
  onCancel,
}: {
  rule: CategoryRule;
  allCategories: { id: string; label: string }[];
  matchTypeLabels: Record<CategoryRule['matchType'], string>;
  onSave: (rule: CategoryRule) => void;
  onCancel: () => void;
}) {
  const [kw, setKw] = useState(rule.keyword);
  const [cat, setCat] = useState(rule.category);
  const [mt, setMt] = useState(rule.matchType);

  return (
    <div className="flex-1 flex flex-col sm:flex-row gap-2">
      <input
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
      <select
        value={cat}
        onChange={(e) => setCat(e.target.value as ExpenseCategory)}
        className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none"
      >
        {allCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select
        value={mt}
        onChange={(e) => setMt(e.target.value as CategoryRule['matchType'])}
        className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none"
      >
        {Object.entries(matchTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="flex gap-1">
        <button onClick={() => onSave({ ...rule, keyword: kw, category: cat, matchType: mt })} className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-950/30">
          <Check size={14} className="text-green-600" />
        </button>
        <button onClick={onCancel} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30">
          <X size={14} className="text-red-600" />
        </button>
      </div>
    </div>
  );
}
