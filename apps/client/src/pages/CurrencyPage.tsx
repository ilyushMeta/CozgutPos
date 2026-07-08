import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { addExchangeRate, fetchCurrentRate, fetchRateHistory, type ExchangeRateRow } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm w-40';
const primaryBtnCls = 'px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

export function CurrencyPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rate, setRate] = useState('');

  const { data: current } = useQuery({ queryKey: ['currency-current'], queryFn: fetchCurrentRate });
  const { data: history = [] } = useQuery({
    queryKey: ['currency-history'],
    queryFn: fetchRateHistory,
  });

  const add = useMutation({
    mutationFn: () => addExchangeRate({ rate: Number(rate) }),
    onSuccess: () => {
      setRate('');
      qc.invalidateQueries({ queryKey: ['currency-current'] });
      qc.invalidateQueries({ queryKey: ['currency-history'] });
    },
  });

  const columns: ColumnDef<ExchangeRateRow, any>[] = [
    {
      header: t('common.date'),
      cell: ({ row }) => new Date(row.original.effectiveFrom).toLocaleString(),
    },
    { header: t('currency.title'), accessorKey: 'rate' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('currency.title')}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-end gap-4">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('currency.currentRate')}
          </div>
          <div className="text-xl font-semibold">{current?.rate ?? '—'}</div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (rate.trim()) add.mutate();
          }}
          className="flex items-end gap-2"
        >
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t('currency.newRate')}
            </label>
            <input value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" className={primaryBtnCls}>
            {t('currency.add')}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="font-medium mb-3">{t('currency.history')}</h2>
        <DataTable data={history} columns={columns} />
      </div>
    </div>
  );
}
