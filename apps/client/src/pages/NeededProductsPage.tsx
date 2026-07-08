import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  createNeededProduct,
  deleteNeededProduct,
  listCategories,
  listNeededProducts,
} from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';

interface NeededProduct {
  id: number;
  name: string;
  code: string | null;
  qty: string;
  category: { id: number; name: string } | null;
}

export function NeededProductsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('1');
  const [categoryId, setCategoryId] = useState('');

  const { data = [] } = useQuery({ queryKey: ['needed-products'], queryFn: listNeededProducts });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const create = useMutation({
    mutationFn: () =>
      createNeededProduct({
        name,
        code: code.trim() || undefined,
        qty: Number(qty) || 0,
        categoryId: categoryId ? Number(categoryId) : undefined,
      }),
    onSuccess: () => {
      setName('');
      setCode('');
      setQty('1');
      setCategoryId('');
      qc.invalidateQueries({ queryKey: ['needed-products'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteNeededProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['needed-products'] }),
  });

  const columns: ColumnDef<NeededProduct, any>[] = [
    { header: t('product.name'), accessorKey: 'name' },
    { header: t('product.code'), accessorFn: (row) => row.code ?? '—' },
    { header: t('product.quantity'), accessorKey: 'qty' },
    { header: t('category.title'), accessorFn: (row) => row.category?.name ?? '—' },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <button
          onClick={() => {
            if (window.confirm(t('common.confirmDelete'))) remove.mutate(row.original.id);
          }}
          className="text-red-600 hover:underline text-sm"
        >
          {t('app.delete')}
        </button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">{t('nav.neededProducts')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
        className="flex flex-wrap gap-2 mb-4"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('neededProduct.addNew')}
          className={inputCls}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('product.code')}
          className={`${inputCls} w-32`}
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={t('product.quantity')}
          className={`${inputCls} w-24`}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputCls}
        >
          <option value="">{t('category.title')}</option>
          {(categories as { id: number; name: string }[]).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          {t('app.add')}
        </button>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
