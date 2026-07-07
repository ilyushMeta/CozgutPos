import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { listProducts } from '../api';
import { DataTable } from '../components/DataTable';

interface ProductRow {
  id: number;
  name: string;
  code: string;
  category: { name: string } | null;
  isScaleItem: boolean;
}

export function ProductsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { data = [] } = useQuery({
    queryKey: ['products', search],
    queryFn: () => listProducts(search || undefined),
  });

  const columns: ColumnDef<ProductRow, any>[] = [
    { header: t('product.code'), accessorKey: 'code' },
    { header: t('product.name'), accessorKey: 'name' },
    { header: t('product.category'), cell: ({ row }) => row.original.category?.name ?? '—' },
    {
      header: t('product.scaleItem'),
      cell: ({ row }) => (row.original.isScaleItem ? t('app.yes') : t('app.no')),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <Link to={`/products/${row.original.id}`} className="text-blue-600 hover:underline text-sm">
          {t('app.edit')}
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('nav.products')}</h1>
        <Link
          to="/products/new"
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          {t('product.addNew')}
        </Link>
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
