import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { downloadCsv, fetchLowStock } from '../api';
import { DataTable } from '../components/DataTable';

interface Row {
  id: number;
  code: string;
  name: string;
  category: { name: string } | null;
  lowStockThreshold: string;
  remaining: { toFixed: (n: number) => string };
}

export function StockLowPage() {
  const { t } = useTranslation();
  const { data = [] } = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: () => fetchLowStock() as Promise<Row[]>,
  });

  const columns: ColumnDef<Row, any>[] = [
    { header: t('product.code'), accessorKey: 'code' },
    { header: t('product.name'), accessorKey: 'name' },
    { header: t('product.category'), cell: ({ row }) => row.original.category?.name ?? '—' },
    { header: t('product.remaining'), cell: ({ row }) => String(row.original.remaining) },
    { header: t('product.lowStockThreshold'), accessorKey: 'lowStockThreshold' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('product.lowStock')}</h1>
        <button
          onClick={() => void downloadCsv('/stock/low-stock', 'azalan.csv')}
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm"
        >
          {t('app.export')}
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
