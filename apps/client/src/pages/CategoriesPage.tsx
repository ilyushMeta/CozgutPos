import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { createCategory, deleteCategory, listCategories } from '../api';
import { DataTable } from '../components/DataTable';

interface Category {
  id: number;
  name: string;
}

export function CategoriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const create = useMutation({
    mutationFn: () => createCategory({ name }),
    onSuccess: () => {
      setName('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: () => setError(t('product.deleteCategoryBlocked')),
  });

  const columns: ColumnDef<Category, any>[] = [
    { header: t('category.title'), accessorKey: 'name' },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <button
          onClick={() => {
            setError(null);
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
      <h1 className="text-xl font-semibold mb-4">{t('category.title')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('category.addNew')}
          className="rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          {t('app.add')}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
