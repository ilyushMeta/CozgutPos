import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listDiscounts, updateDiscount, type DiscountRow } from '../api';
import type { PaymentMethod } from '@cozgut/shared';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm w-28';
const primaryBtnCls = 'px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'DEBT'];

export function DiscountsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['discounts'], queryFn: listDiscounts });

  const [percents, setPercents] = useState<Record<string, string>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const row of data as DiscountRow[]) map[row.method] = row.percent;
    setPercents((prev) => ({ ...map, ...prev }));
  }, [data]);

  const save = useMutation({
    mutationFn: (method: PaymentMethod) =>
      updateDiscount(method, { percent: Number(percents[method] ?? 0) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });

  const methodLabel: Record<PaymentMethod, string> = {
    CASH: t('sale.cash'),
    CARD: t('sale.card'),
    DEBT: t('sale.debt'),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('discount.title')}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 max-w-md">
        {METHODS.map((method) => (
          <div key={method} className="flex items-center justify-between gap-3">
            <span className="text-sm">{methodLabel[method]}</span>
            <div className="flex items-center gap-2">
              <input
                value={percents[method] ?? ''}
                onChange={(e) => setPercents((prev) => ({ ...prev, [method]: e.target.value }))}
                placeholder={t('discount.percent')}
                className={inputCls}
              />
              <button onClick={() => save.mutate(method)} className={primaryBtnCls}>
                {t('app.save')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
