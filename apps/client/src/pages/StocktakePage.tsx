import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  downloadCsv,
  finishStocktake,
  getStocktake,
  listProducts,
  scanStocktake,
  startStocktake,
} from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

type Filter = 'all' | 'shortage' | 'surplus';

export function StocktakePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [stocktakeId, setStocktakeId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [countedQty, setCountedQty] = useState('1');

  const { data: stocktake } = useQuery({
    queryKey: ['stocktake', stocktakeId],
    queryFn: () => getStocktake(stocktakeId!),
    enabled: !!stocktakeId,
  });

  const start = useMutation({
    mutationFn: startStocktake,
    onSuccess: (result) => setStocktakeId(result.id),
  });

  const scan = useMutation({
    mutationFn: (productId: number) =>
      scanStocktake(stocktakeId!, { productId, countedQty: Number(countedQty) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stocktake', stocktakeId] }),
  });

  const finish = useMutation({
    mutationFn: () => finishStocktake(stocktakeId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stocktake', stocktakeId] }),
  });

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  useEffect(() => {
    if (!stocktakeId || stocktake?.status === 'FINISHED') return;
    function isTextInput(el: EventTarget | null): boolean {
      const tag = (el as HTMLElement | null)?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTextInput(document.activeElement)) return;
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 100) bufferRef.current = '';
      lastKeyTimeRef.current = now;
      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= 3) void handleScan(code);
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stocktakeId, stocktake?.status]);

  async function handleScan(code: string) {
    const matches = (await listProducts(code)) as { id: number; code: string }[];
    const exact = matches.find((p) => p.code === code);
    if (exact) scan.mutate(exact.id);
  }

  const lines = stocktake?.lines ?? [];
  const filtered = lines.filter((l) => {
    const diff = Number(l.diff);
    if (filter === 'shortage') return diff < 0;
    if (filter === 'surplus') return diff > 0;
    return true;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('nav.stocktake')}</h1>

      {!stocktakeId ? (
        <button onClick={() => start.mutate()} className={primaryBtnCls}>
          {t('stocktake.start')}
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              #{stocktakeId} — {stocktake?.status}
            </span>
            {stocktake?.status === 'OPEN' && (
              <>
                <input
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  placeholder={t('revision.countedQty')}
                  className={`${inputCls} w-24`}
                />
                <button onClick={() => finish.mutate()} className={primaryBtnCls}>
                  {t('stocktake.finish')}
                </button>
              </>
            )}
            <button
              onClick={() =>
                void downloadCsv(`/stocktake/${stocktakeId}`, `tukelleme-${stocktakeId}.csv`)
              }
              className={secondaryBtnCls}
            >
              {t('app.export')}
            </button>
          </div>

          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setFilter('all')}
              className={filter === 'all' ? primaryBtnCls : secondaryBtnCls}
            >
              {t('common.all')} ({lines.length})
            </button>
            <button
              onClick={() => setFilter('shortage')}
              className={filter === 'shortage' ? primaryBtnCls : secondaryBtnCls}
            >
              {t('common.shortage')} ({lines.filter((l) => Number(l.diff) < 0).length})
            </button>
            <button
              onClick={() => setFilter('surplus')}
              className={filter === 'surplus' ? primaryBtnCls : secondaryBtnCls}
            >
              {t('common.surplus')} ({lines.filter((l) => Number(l.diff) > 0).length})
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-1">{t('product.name')}</th>
                  <th className="py-1">{t('product.code')}</th>
                  <th className="py-1">{t('revision.systemQty')}</th>
                  <th className="py-1">{t('revision.countedQty')}</th>
                  <th className="py-1">{t('common.difference')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1">{l.product.name}</td>
                    <td className="py-1 text-gray-400">{l.product.code}</td>
                    <td className="py-1">{l.systemQty}</td>
                    <td className="py-1">{l.countedQty}</td>
                    <td className="py-1">{l.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                {t('common.noResults')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
