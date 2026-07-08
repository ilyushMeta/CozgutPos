import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { downloadCsv, fetchAmmar } from '../api';
import { DataTable } from '../components/DataTable';

interface BatchRow {
  id: number;
  qtyRemaining: string;
  buyPrice: string;
  sellPrice: string;
  currency: string;
  receivedAt: string;
  invoiceNo: number | null;
  product: { code: string; name: string; category: { name: string } | null };
}

export function StockAmmarPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { data = [] } = useQuery({
    queryKey: ['stock', 'ammar', search],
    queryFn: () => fetchAmmar(search || undefined) as Promise<BatchRow[]>,
  });

  const columns: ColumnDef<BatchRow, any>[] = [
    { header: t('product.code'), cell: ({ row }) => row.original.product.code },
    { header: t('product.name'), cell: ({ row }) => row.original.product.name },
    {
      header: t('product.category'),
      cell: ({ row }) => row.original.product.category?.name ?? '—',
    },
    { header: t('product.remaining'), accessorKey: 'qtyRemaining' },
    { header: t('product.buyPrice'), accessorKey: 'buyPrice' },
    { header: t('product.sellPrice'), accessorKey: 'sellPrice' },
    { header: t('nav.currency'), accessorKey: 'currency' },
    {
      header: t('common.date'),
      cell: ({ row }) => new Date(row.original.receivedAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('nav.warehouse')}</h1>
        <button
          onClick={() =>
            void downloadCsv('/stock/ammar', 'ammar.csv', { search: search || undefined })
          }
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm"
        >
          {t('app.export')}
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('product.searchPlaceholder')}
        className="mb-4 w-full max-w-sm rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm"
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
