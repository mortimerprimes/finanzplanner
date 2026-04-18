import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFinance } from '@/lib/finance-context';
import { useTheme } from '../hooks/useTheme';
import { Card, EmptyState } from '../components/ui';
import { formatCurrency, getShortMonthName, calculateNetWorth } from '../utils/helpers';

export function NetWorthHistory() {
  const { state } = useFinance();
  const { resolvedTheme } = useTheme();
  const { settings, netWorthHistory, accounts, debts } = state;

  const currentNetWorth = calculateNetWorth(accounts, debts);
  const totalAssets = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalDebts = debts.reduce((sum, d) => sum + d.remainingAmount, 0);

  const chartData = netWorthHistory.map(s => ({
    month: s.month,
    label: getShortMonthName(s.month),
    netWorth: s.netWorth,
    assets: s.totalAssets,
    debts: s.totalDebts,
  }));

  // Add current month if not already in history
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (!chartData.some(d => d.month === currentMonth)) {
    chartData.push({
      month: currentMonth,
      label: getShortMonthName(currentMonth),
      netWorth: currentNetWorth,
      assets: totalAssets,
      debts: totalDebts,
    });
  }

  chartData.sort((a, b) => a.month.localeCompare(b.month));

  const tooltipStyle = {
    backgroundColor: resolvedTheme === 'dark' ? '#111827' : '#ffffff',
    borderColor: resolvedTheme === 'dark' ? '#374151' : '#e2e8f0',
    color: resolvedTheme === 'dark' ? '#f9fafb' : '#0f172a',
    borderRadius: '14px',
  };

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const change = first && last ? last.netWorth - first.netWorth : 0;
  const changePct = first && first.netWorth !== 0 ? (change / Math.abs(first.netWorth)) * 100 : 0;

  if (chartData.length < 2) {
    return (
      <Card className="p-5">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Nettovermögens-Verlauf</h3>
        <EmptyState
          icon="TrendingUp"
          title="Noch nicht genug Daten"
          description="Dein Nettovermögen wird ab nächstem Monat hier als Zeitverlauf angezeigt. Jeden Monat wird automatisch ein Snapshot gespeichert."
        />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Nettovermögens-Verlauf</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">{chartData.length} Monate aufgezeichnet</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-gray-500">Aktuell</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(currentNetWorth, settings)}</p>
          </div>
          <div className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
            change >= 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
          }`}>
            {change >= 0 ? '+' : ''}{formatCurrency(change, settings)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e2e8f0'} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#9ca3af' : '#64748b' }} />
            <YAxis
              tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#9ca3af' : '#64748b' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => formatCurrency(Number(value), settings)}
              labelFormatter={(label) => String(label)}
            />
            <Area type="monotone" dataKey="assets" stroke="#10b981" fill="url(#assetGradient)" strokeWidth={1.5} name="Vermögen" />
            <Area type="monotone" dataKey="netWorth" stroke="#6366f1" fill="url(#nwGradient)" strokeWidth={2.5} name="Netto" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Vermögenswerte</p>
          <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalAssets, settings)}</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-950/30">
          <p className="text-xs text-red-600 dark:text-red-400">Verbindlichkeiten</p>
          <p className="mt-1 text-sm font-bold text-red-700 dark:text-red-300">{formatCurrency(totalDebts, settings)}</p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-950/30">
          <p className="text-xs text-indigo-600 dark:text-indigo-400">Nettovermögen</p>
          <p className="mt-1 text-sm font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(currentNetWorth, settings)}</p>
        </div>
      </div>
    </Card>
  );
}
