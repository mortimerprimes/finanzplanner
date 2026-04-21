'use client';

import { useMemo, useState } from 'react';
import { Check, Edit3, Landmark, Plus, Search, ToggleLeft, ToggleRight, Trash2, WalletCards, X, Zap } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { EXPENSE_CATEGORIES } from '@/src/utils/constants';
import type { AccountRule, CategoryRule, ExpenseCategory } from '@/src/types';
import { Badge, Button, Card, Input, Select } from '../components/ui';

type RuleKind = 'category' | 'account';

const MATCH_TYPE_LABELS: Record<'contains' | 'startsWith' | 'exact', string> = {
  contains: 'Enthaelt',
  startsWith: 'Beginnt mit',
  exact: 'Exakt',
};

export function CategoryRulesPage() {
  const { state, dispatch } = useFinance();
  const categoryRules = state.categoryRules || [];
  const accountRules = state.accountRules || [];
  const accounts = state.accounts || [];

  const [showAdd, setShowAdd] = useState(false);
  const [ruleKind, setRuleKind] = useState<RuleKind>('category');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [accountId, setAccountId] = useState('');
  const [accountCategory, setAccountCategory] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'startsWith' | 'exact'>('contains');

  const allCategories = useMemo(() => [
    ...Object.entries(EXPENSE_CATEGORIES).map(([id, info]) => ({ id, label: info.labelDe })),
    ...(state.settings.customExpenseCategories || []).map((item) => ({ id: item.id, label: item.labelDe || item.label })),
  ], [state.settings.customExpenseCategories]);

  const categoryOptions = useMemo(
    () => allCategories.map((item) => ({ value: item.id, label: item.label })),
    [allCategories]
  );
  const optionalCategoryOptions = useMemo(
    () => [{ value: '', label: 'Keine Kategorie mitgeben' }, ...categoryOptions],
    [categoryOptions]
  );
  const accountOptions = useMemo(
    () => accounts.map((item) => ({ value: item.id, label: item.name })),
    [accounts]
  );
  const matchTypeOptions = useMemo(
    () => Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    []
  );

  const sortedCategoryRules = useMemo(
    () => [...categoryRules].sort((left, right) => left.keyword.localeCompare(right.keyword, 'de', { sensitivity: 'base' })),
    [categoryRules]
  );
  const sortedAccountRules = useMemo(
    () => [...accountRules].sort((left, right) => left.keyword.localeCompare(right.keyword, 'de', { sensitivity: 'base' })),
    [accountRules]
  );

  const metrics = useMemo(() => ({
    total: categoryRules.length + accountRules.length,
    active: categoryRules.filter((rule) => rule.isActive).length + accountRules.filter((rule) => rule.isActive ?? true).length,
    categoryRules: categoryRules.length,
    accountRules: accountRules.length,
  }), [accountRules, categoryRules]);

  const getCategoryLabel = (categoryId?: string) => {
    if (!categoryId) return 'Keine Kategorie';
    return allCategories.find((item) => item.id === categoryId)?.label || categoryId;
  };

  const getAccountLabel = (targetAccountId: string) => {
    return accounts.find((item) => item.id === targetAccountId)?.name || 'Unbekanntes Konto';
  };

  const resetForm = () => {
    setKeyword('');
    setCategory('food');
    setAccountId('');
    setAccountCategory('');
    setMatchType('contains');
    setRuleKind('category');
    setShowAdd(false);
  };

  const handleAdd = () => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;

    if (ruleKind === 'category') {
      dispatch({
        type: 'ADD_CATEGORY_RULE',
        payload: { keyword: normalizedKeyword, category, matchType, isActive: true },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        payload: {
          action: 'create',
          entity: 'other',
          label: `Kategorie-Regel: "${normalizedKeyword}" -> ${getCategoryLabel(category)}`,
        },
      });
    } else {
      if (!accountId) return;
      dispatch({
        type: 'ADD_ACCOUNT_RULE',
        payload: {
          keyword: normalizedKeyword,
          accountId,
          category: (accountCategory || undefined) as ExpenseCategory | undefined,
          matchType,
          isActive: true,
        },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        payload: {
          action: 'create',
          entity: 'other',
          label: `Kontoregel: "${normalizedKeyword}" -> ${getAccountLabel(accountId)}`,
        },
      });
    }

    resetForm();
  };

  const handleDeleteCategoryRule = (id: string) => {
    const rule = categoryRules.find((item) => item.id === id);
    dispatch({ type: 'DELETE_CATEGORY_RULE', payload: id });
    if (rule) {
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        payload: { action: 'delete', entity: 'other', label: `Kategorie-Regel geloescht: "${rule.keyword}"` },
      });
    }
  };

  const handleDeleteAccountRule = (id: string) => {
    const rule = accountRules.find((item) => item.id === id);
    dispatch({ type: 'DELETE_ACCOUNT_RULE', payload: id });
    if (rule) {
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        payload: { action: 'delete', entity: 'other', label: `Kontoregel geloescht: "${rule.keyword}"` },
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap size={22} className="text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import-Regelzentrale</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            Verwalte Kategorie-Regeln und Kontoregeln an einer Stelle. Beide greifen im Bank Sync und beim direkten Kontoauszug-Import.
          </p>
        </div>
        <Button onClick={() => setShowAdd((current) => !current)}>
          <Plus size={16} />
          Neue Regel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Regeln gesamt', value: metrics.total, color: '#0f172a' },
          { label: 'Aktiv', value: metrics.active, color: '#0f766e' },
          { label: 'Kategorie', value: metrics.categoryRules, color: '#2563eb' },
          { label: 'Konto', value: metrics.accountRules, color: '#7c3aed' },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <Badge color={item.color}>{item.label}</Badge>
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
          </Card>
        ))}
      </div>

      {showAdd && (
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Neue Import-Regel</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                Lege fest, ob ein Buchungstext eine Kategorie bekommt oder direkt einem Konto zugeordnet wird.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant={ruleKind === 'category' ? 'primary' : 'secondary'} size="sm" onClick={() => setRuleKind('category')}>
                <Search size={14} />
                Kategorie-Regel
              </Button>
              <Button variant={ruleKind === 'account' ? 'primary' : 'secondary'} size="sm" onClick={() => setRuleKind('account')}>
                <WalletCards size={14} />
                Kontoregel
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
            <Input
              label="Suchbegriff"
              value={keyword}
              onChange={setKeyword}
              placeholder="z.B. REWE, Spar, Gehalt GmbH"
            />
            <Select
              label="Trefferart"
              value={matchType}
              onChange={(value) => setMatchType(value as typeof matchType)}
              options={matchTypeOptions}
            />
            {ruleKind === 'category' ? (
              <Select
                label="Kategorie"
                value={category}
                onChange={(value) => setCategory(value as ExpenseCategory)}
                options={categoryOptions}
              />
            ) : (
              <Select
                label="Zielkonto"
                value={accountId}
                onChange={setAccountId}
                options={accountOptions}
                placeholder="Konto waehlen"
              />
            )}
            {ruleKind === 'account' ? (
              <Select
                label="Kategorie optional"
                value={accountCategory}
                onChange={setAccountCategory}
                options={optionalCategoryOptions}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                Wirkt sofort auf neue Import-Vorschlaege und auf manuelle Re-Anwendung der Regeln.
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={resetForm} className="flex-1">Abbrechen</Button>
            <Button onClick={handleAdd} className="flex-1" disabled={!keyword.trim() || (ruleKind === 'account' && !accountId)}>
              Regel speichern
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kategorie-Regeln</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Ordnen Buchungstexte einer Ausgabenkategorie zu.</p>
            </div>
            <Badge color="#2563eb">{sortedCategoryRules.length}</Badge>
          </div>

          <div className="mt-4 space-y-2">
            {sortedCategoryRules.length === 0 ? (
              <EmptyHint
                icon={<Search size={20} className="text-slate-400" />}
                title="Noch keine Kategorie-Regeln"
                description="Typische Haendler oder Lastschriften lassen sich hier dauerhaft vorkategorisieren."
              />
            ) : sortedCategoryRules.map((rule) => {
              const isEditing = editKey === `category:${rule.id}`;
              return (
                <div key={rule.id} className={`rounded-2xl border p-4 ${rule.isActive ? 'border-slate-200 dark:border-gray-800' : 'border-slate-200/70 opacity-60 dark:border-gray-800'}`}>
                  {isEditing ? (
                    <EditCategoryRuleRow
                      rule={rule}
                      categoryOptions={categoryOptions}
                      onCancel={() => setEditKey(null)}
                      onSave={(nextRule) => {
                        dispatch({ type: 'UPDATE_CATEGORY_RULE', payload: nextRule });
                        setEditKey(null);
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button onClick={() => dispatch({ type: 'UPDATE_CATEGORY_RULE', payload: { ...rule, isActive: !rule.isActive } })} className="mt-0.5">
                            {rule.isActive ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} className="text-slate-400" />}
                          </button>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge color="#2563eb">Kategorie</Badge>
                              <Badge color={rule.isActive ? '#0f766e' : '#64748b'}>{rule.isActive ? 'Aktiv' : 'Pausiert'}</Badge>
                              <Badge color="#334155">{MATCH_TYPE_LABELS[rule.matchType]}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{`"${rule.keyword}" -> ${getCategoryLabel(rule.category)}`}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Greift auf importierte Ausgaben und bei der erneuten Regelanwendung.</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setEditKey(`category:${rule.id}`)}><Edit3 size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCategoryRule(rule.id)}><Trash2 size={14} /></Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kontoregeln</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Lenken Importe auf das richtige Konto und optional gleich in die passende Kategorie.</p>
            </div>
            <Badge color="#7c3aed">{sortedAccountRules.length}</Badge>
          </div>

          <div className="mt-4 space-y-2">
            {sortedAccountRules.length === 0 ? (
              <EmptyHint
                icon={<Landmark size={20} className="text-slate-400" />}
                title="Noch keine Kontoregeln"
                description="Ideal fuer Kreditkarten, Zweitkonten oder Importe mit wiederkehrenden Gegenparteien."
              />
            ) : sortedAccountRules.map((rule) => {
              const isEditing = editKey === `account:${rule.id}`;
              return (
                <div key={rule.id} className={`rounded-2xl border p-4 ${(rule.isActive ?? true) ? 'border-slate-200 dark:border-gray-800' : 'border-slate-200/70 opacity-60 dark:border-gray-800'}`}>
                  {isEditing ? (
                    <EditAccountRuleRow
                      rule={rule}
                      accountOptions={accountOptions}
                      categoryOptions={optionalCategoryOptions}
                      onCancel={() => setEditKey(null)}
                      onSave={(nextRule) => {
                        dispatch({ type: 'UPDATE_ACCOUNT_RULE', payload: nextRule });
                        setEditKey(null);
                      }}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button onClick={() => dispatch({ type: 'UPDATE_ACCOUNT_RULE', payload: { ...rule, isActive: !(rule.isActive ?? true) } })} className="mt-0.5">
                          {(rule.isActive ?? true) ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} className="text-slate-400" />}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color="#7c3aed">Konto</Badge>
                            <Badge color={(rule.isActive ?? true) ? '#0f766e' : '#64748b'}>{(rule.isActive ?? true) ? 'Aktiv' : 'Pausiert'}</Badge>
                            <Badge color="#334155">{MATCH_TYPE_LABELS[rule.matchType || 'contains']}</Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{`"${rule.keyword}" -> ${getAccountLabel(rule.accountId)}`}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                            {rule.category ? `Setzt zusaetzlich ${getCategoryLabel(rule.category)}.` : 'Setzt nur das Konto und laesst die Kategorie offen.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditKey(`account:${rule.id}`)}><Edit3 size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteAccountRule(rule.id)}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
        <h2 className="text-base font-semibold text-blue-900 dark:text-blue-200">Zusammenspiel mit dem Import</h2>
        <div className="mt-3 space-y-2 text-sm text-blue-900/80 dark:text-blue-200/80">
          <p>Kategorie-Regeln bestimmen zunaechst die fachliche Einordnung einer importierten Ausgabe.</p>
          <p>Kontoregeln entscheiden, auf welchem Konto die Buchung landet und koennen dabei direkt eine Kategorie mitgeben.</p>
          <p>Danach greift die neue Import-Vorschau: Fixkosten, wiederkehrende Einnahmen und Kreditraten koennen schon vor dem Import explizit verbunden werden.</p>
        </div>
      </Card>
    </div>
  );
}

function EditCategoryRuleRow({
  rule,
  categoryOptions,
  onSave,
  onCancel,
}: {
  rule: CategoryRule;
  categoryOptions: Array<{ value: string; label: string }>;
  onSave: (rule: CategoryRule) => void;
  onCancel: () => void;
}) {
  const [keyword, setKeyword] = useState(rule.keyword);
  const [category, setCategory] = useState(rule.category);
  const [matchType, setMatchType] = useState(rule.matchType);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input value={keyword} onChange={setKeyword} label="Suchbegriff" placeholder="Suchbegriff" />
        <Select value={category} onChange={(value) => setCategory(value as ExpenseCategory)} label="Kategorie" options={categoryOptions} />
        <Select
          value={matchType}
          onChange={(value) => setMatchType(value as CategoryRule['matchType'])}
          label="Trefferart"
          options={Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1"><X size={14} />Abbrechen</Button>
        <Button size="sm" onClick={() => onSave({ ...rule, keyword: keyword.trim(), category, matchType })} className="flex-1" disabled={!keyword.trim()}><Check size={14} />Speichern</Button>
      </div>
    </div>
  );
}

function EditAccountRuleRow({
  rule,
  accountOptions,
  categoryOptions,
  onSave,
  onCancel,
}: {
  rule: AccountRule;
  accountOptions: Array<{ value: string; label: string }>;
  categoryOptions: Array<{ value: string; label: string }>;
  onSave: (rule: AccountRule) => void;
  onCancel: () => void;
}) {
  const [keyword, setKeyword] = useState(rule.keyword);
  const [accountId, setAccountId] = useState(rule.accountId);
  const [category, setCategory] = useState(rule.category || '');
  const [matchType, setMatchType] = useState(rule.matchType || 'contains');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input value={keyword} onChange={setKeyword} label="Suchbegriff" placeholder="Suchbegriff" />
        <Select value={accountId} onChange={setAccountId} label="Zielkonto" options={accountOptions} placeholder="Konto waehlen" />
        <Select value={category} onChange={setCategory} label="Kategorie optional" options={categoryOptions} />
        <Select
          value={matchType}
          onChange={(value) => setMatchType(value as NonNullable<AccountRule['matchType']>)}
          label="Trefferart"
          options={Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1"><X size={14} />Abbrechen</Button>
        <Button
          size="sm"
          onClick={() => onSave({ ...rule, keyword: keyword.trim(), accountId, category: (category || undefined) as ExpenseCategory | undefined, matchType, isActive: rule.isActive ?? true })}
          className="flex-1"
          disabled={!keyword.trim() || !accountId}
        >
          <Check size={14} />Speichern
        </Button>
      </div>
    </div>
  );
}

function EmptyHint({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-gray-800">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{description}</p>
    </div>
  );
}