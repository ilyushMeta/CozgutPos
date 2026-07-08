import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  fetchCategoryBreakdown,
  fetchDashboardSummary,
  fetchProfitByMonth,
  listDebtors,
  listSuppliers,
  rebuildDailySummary,
} from '../api';
import { sumMoney } from '@cozgut/shared';

const tileCls = 'bg-white dark:bg-gray-800 rounded-lg shadow p-4';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

const BAR_COLOR = '#2563eb'; // Tailwind blue-600, matching the app's existing primary color

/**
 * Dashboard (SPEC §5.13): debt tiles + overdue list from Phase 4, extended in
 * Phase 6 with live today/period profit, cash balance, low-stock count, a
 * 12-month profit bar chart (from DailySummary), and a category breakdown
 * (live from SaleLine for the current month).
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: debtors = [] } = useQuery({ queryKey: ['debtors'], queryFn: () => listDebtors() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => fetchDashboardSummary(),
  });
  const { data: profitByMonth = [] } = useQuery({
    queryKey: ['profit-by-month'],
    queryFn: () => fetchProfitByMonth(12),
  });
  const { data: categoryBreakdown = [] } = useQuery({
    queryKey: ['category-breakdown'],
    queryFn: () => fetchCategoryBreakdown(),
  });

  const [rebuiltMessage, setRebuiltMessage] = useState<string | null>(null);
  const rebuild = useMutation({
    mutationFn: () => rebuildDailySummary(),
    onSuccess: () => {
      setRebuiltMessage(t('reports.rebuildSuccess'));
      qc.invalidateQueries({ queryKey: ['profit-by-month'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const tmtTotal = sumMoney(
    debtors.filter((d) => d.accountCurrency === 'TMT').map((d) => d.balance),
  );
  const usdTotal = sumMoney(
    debtors.filter((d) => d.accountCurrency === 'USD').map((d) => d.balance),
  );
  const supplierTotal = sumMoney(suppliers.map((s) => s.balance));
  const overdue = debtors.filter((d) => d.isOverdue);

  const profitChartData = profitByMonth.map((p) => ({ month: p.month, profit: Number(p.profit) }));
  const categoryChartData = categoryBreakdown.map((c) => ({
    category: c.category,
    revenue: Number(c.revenue),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('reports.title')}</h1>
        <button
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
          className={primaryBtnCls}
        >
          {t('reports.rebuild')}
        </button>
      </div>
      {rebuiltMessage && (
        <p className="text-sm text-green-600 dark:text-green-400">{rebuiltMessage}</p>
      )}

      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('reports.todayProfit')}</div>
          <div className="text-xl font-semibold">{summary?.todayProfit ?? '—'}</div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('reports.periodProfit')}
          </div>
          <div className="text-xl font-semibold">{summary?.periodProfit ?? '—'}</div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('reports.cashBalance')}</div>
          <div className="text-xl font-semibold">{summary?.cashBalance ?? '—'}</div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('reports.lowStockCount')}
          </div>
          <div className="text-xl font-semibold">{summary?.lowStockCount ?? '—'}</div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('reports.customerDebtTotal')}
          </div>
          <div className="text-xl font-semibold">
            {tmtTotal.toFixed(2)} TMT {usdTotal.greaterThan(0) ? `/ ${usdTotal.toFixed(2)} $` : ''}
          </div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('reports.supplierDebtTotal')}
          </div>
          <div className="text-xl font-semibold">{supplierTotal.toFixed(2)} TMT</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={tileCls}>
          <h2 className="font-medium mb-3">{t('reports.profitChart')}</h2>
          <div className="h-64 text-gray-400 dark:text-gray-600">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitChartData} margin={{ left: -20 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="currentColor"
                  tick={{ fill: 'currentColor' }}
                  fontSize={12}
                />
                <YAxis stroke="currentColor" tick={{ fill: 'currentColor' }} fontSize={12} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg, #fff)', fontSize: 12 }}
                  formatter={(value: any) => Number(value).toFixed(2)}
                />
                <Bar dataKey="profit" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={tileCls}>
          <h2 className="font-medium mb-3">{t('reports.categoryChart')}</h2>
          <div className="h-64 text-gray-400 dark:text-gray-600">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.2} horizontal={false} />
                <XAxis
                  type="number"
                  stroke="currentColor"
                  tick={{ fill: 'currentColor' }}
                  fontSize={12}
                />
                <YAxis
                  dataKey="category"
                  type="category"
                  stroke="currentColor"
                  tick={{ fill: 'currentColor' }}
                  fontSize={12}
                  width={90}
                />
                <Tooltip formatter={(value: any) => Number(value).toFixed(2)} />
                <Bar dataKey="revenue" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={tileCls}>
        <h2 className="font-medium mb-3">{t('reports.overdueDebtors')}</h2>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
        ) : (
          <ul className="space-y-1">
            {overdue.map((d) => (
              <li key={d.id} className="text-sm flex justify-between">
                <button
                  onClick={() => navigate(`/customer-debt/${d.id}`)}
                  className="text-blue-600 hover:underline"
                >
                  {d.name}
                </button>
                <span className="text-red-600 dark:text-red-400">
                  {d.overdueAmount} {d.accountCurrency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
