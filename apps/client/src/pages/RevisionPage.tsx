import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRevisionLine, fetchSystemQty, listProducts, listRevisionLines } from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

interface ProductSummary {
  id: number;
  name: string;
  code: string;
}

export function RevisionPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProductSummary | null>(null);
  const [countedQty, setCountedQty] = useState('');

  const { data: suggestions = [] } = useQuery({
    queryKey: ['revision-search', search],
    queryFn: () => listProducts(search) as Promise<ProductSummary[]>,
    enabled: search.length > 0 && !selected,
  });

  const { data: systemQty } = useQuery({
    queryKey: ['revision-system-qty', selected?.id],
    queryFn: () => fetchSystemQty(selected!.id),
    enabled: !!selected,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['revision-history'],
    queryFn: listRevisionLines,
  });

  const save = useMutation({
    mutationFn: (qty: number) => createRevisionLine({ productId: selected!.id, countedQty: qty }),
    onSuccess: () => {
      setSelected(null);
      setSearch('');
      setCountedQty('');
      qc.invalidateQueries({ queryKey: ['revision-history'] });
    },
  });

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  useEffect(() => {
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
  }, []);

  async function handleScan(code: string) {
    const matches = (await listProducts(code)) as ProductSummary[];
    const exact = matches.find((p) => p.code === code);
    if (exact) {
      setSelected(exact);
      setSearch('');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('nav.revision')}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        {!selected ? (
          <div className="relative">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('product.searchPlaceholder')}
              className={`${inputCls} w-full`}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelected(p);
                      setSearch('');
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
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {selected.name} ({selected.code})
              </div>
              <button onClick={() => setSelected(null)} className="text-sm underline">
                {t('sale.remove')}
              </button>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('revision.systemQty')}: {systemQty?.systemQty ?? '…'}
            </div>
            <div className="flex gap-2">
              <input
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                placeholder={t('revision.countedQty')}
                className={`${inputCls} w-32`}
              />
              <button
                onClick={() => save.mutate(Number(countedQty))}
                disabled={countedQty === ''}
                className={primaryBtnCls}
              >
                {t('app.save')}
              </button>
              <button onClick={() => save.mutate(0)} className={secondaryBtnCls}>
                {t('revision.zeroStock')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="font-medium mb-3">{t('revision.history')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('product.name')}</th>
              <th className="py-1">{t('revision.systemQty')}</th>
              <th className="py-1">{t('revision.countedQty')}</th>
              <th className="py-1">{t('common.difference')}</th>
              <th className="py-1">{t('debt.amount')}</th>
              <th className="py-1">{t('common.result')}</th>
            </tr>
          </thead>
          <tbody>
            {(history as any[]).map((line) => (
              <tr key={line.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{line.product?.name}</td>
                <td className="py-1">{line.systemQty}</td>
                <td className="py-1">{line.countedQty}</td>
                <td className="py-1">{line.diff}</td>
                <td className="py-1">{line.amount}</td>
                <td className="py-1">{line.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
