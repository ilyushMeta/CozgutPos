import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { downloadCsv, fetchExpiringSoon, listCategories } from '../api';
import { DataTable } from '../components/DataTable';

interface Row {
  id: number;
  code: string;
  name: string;
  expiryDate: string;
  category: { name: string } | null;
}

export function StockExpiringPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [categoryId, setCategoryId] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const { data = [] } = useQuery({
    queryKey: ['stock', 'expiring', days, categoryId],
    queryFn: () =>
      fetchExpiringSoon(days, categoryId ? Number(categoryId) : undefined) as Promise<Row[]>,
  });

  const columns: ColumnDef<Row, any>[] = [
    { header: t('product.code'), accessorKey: 'code' },
    { header: t('product.name'), accessorKey: 'name' },
    { header: t('product.category'), cell: ({ row }) => row.original.category?.name ?? '—' },
    {
      header: t('product.expiry'),
      cell: ({ row }) => new Date(row.original.expiryDate).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('product.expiringSoon')}</h1>
        <button
          onClick={() =>
            void downloadCsv('/stock/expiring-soon', 'mohleti-azalanlar.csv', {
              days,
              categoryId: categoryId || undefined,
            })
          }
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm"
        >
          {t('app.export')}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          {t('stock.expiringDays')}
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)}
            className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm"
          />
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm"
        >
          <option value="">{t('common.all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
