import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRecipe, deleteRecipe, listProducts, listRecipes } from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

interface ProductSummary {
  id: number;
  name: string;
  code: string;
}

interface IngredientRow {
  key: number;
  productId: number | null;
  search: string;
  qty: string;
}

let nextKey = 1;

export function RecipesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [rows, setRows] = useState<IngredientRow[]>([
    { key: nextKey++, productId: null, search: '', qty: '1' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [activeSearchKey, setActiveSearchKey] = useState<number | null>(null);

  const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });

  const { data: suggestions = [] } = useQuery({
    queryKey: [
      'recipe-ingredient-search',
      activeSearchKey,
      rows.find((r) => r.key === activeSearchKey)?.search,
    ],
    queryFn: () =>
      listProducts(rows.find((r) => r.key === activeSearchKey)?.search ?? '') as Promise<
        ProductSummary[]
      >,
    enabled:
      activeSearchKey !== null &&
      (rows.find((r) => r.key === activeSearchKey)?.search.length ?? 0) > 0,
  });

  const create = useMutation({
    mutationFn: () =>
      createRecipe({
        name,
        items: rows
          .filter((r) => r.productId)
          .map((r) => ({ ingredientProductId: r.productId!, qty: Number(r.qty) })),
      }),
    onSuccess: () => {
      setName('');
      setRows([{ key: nextKey++, productId: null, search: '', qty: '1' }]);
      setError(null);
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: any) => setError(err?.response?.data?.code ?? 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteRecipe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });

  function updateRow(key: number, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey++, productId: null, search: '', qty: '1' }]);
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const canSubmit = name.trim().length > 0 && rows.some((r) => r.productId && Number(r.qty) > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('recipe.title')}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <h2 className="font-medium">{t('recipe.addNew')}</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('recipe.name')}
          className={`${inputCls} w-full max-w-sm`}
        />

        <div className="space-y-2">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">{t('recipe.ingredients')}</h3>
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <div className="relative w-64">
                <input
                  value={row.productId ? row.search : row.search}
                  onChange={(e) => {
                    updateRow(row.key, { search: e.target.value, productId: null });
                    setActiveSearchKey(row.key);
                  }}
                  onFocus={() => setActiveSearchKey(row.key)}
                  placeholder={t('product.searchPlaceholder')}
                  className={`${inputCls} w-full`}
                />
                {activeSearchKey === row.key && !row.productId && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          updateRow(row.key, { productId: p.id, search: p.name });
                          setActiveSearchKey(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-gray-400">{p.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                value={row.qty}
                onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                placeholder={t('product.quantity')}
                className={`${inputCls} w-24`}
              />
              <button
                onClick={() => removeRow(row.key)}
                className="text-red-600 hover:underline text-xs"
              >
                {t('sale.remove')}
              </button>
            </div>
          ))}
          <button onClick={addRow} className={secondaryBtnCls}>
            {t('recipe.addIngredient')}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
          className={primaryBtnCls}
        >
          {t('app.save')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('product.name')}</th>
              <th className="py-1">{t('product.code')}</th>
              <th className="py-1">{t('recipe.ingredients')}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {(recipes as any[]).map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{r.compositeProduct?.name}</td>
                <td className="py-1 text-gray-400">{r.compositeProduct?.code}</td>
                <td className="py-1 text-gray-500 dark:text-gray-400">
                  {(r.items ?? []).map((i: any) => `${i.ingredient?.name} ×${i.qty}`).join(', ')}
                </td>
                <td className="py-1">
                  <button
                    onClick={() => {
                      if (window.confirm(t('common.confirmDelete'))) remove.mutate(r.id);
                    }}
                    className="text-red-600 hover:underline text-xs"
                  >
                    {t('app.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recipes.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">{t('common.noResults')}</p>
        )}
      </div>
    </div>
  );
}
