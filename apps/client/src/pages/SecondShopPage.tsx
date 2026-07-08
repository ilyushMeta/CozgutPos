import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSecondShopSale, fetchSecondShopReport, listProducts } from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls =
  'px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50';
const secondaryBtnCls = 'px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-sm';

let nextKey = 1;

interface CartLine {
  key: number;
  productId: number;
  productName: string;
  productCode: string;
  qty: string;
  unitPrice: string;
}

interface ProductSummary {
  id: number;
  name: string;
  code: string;
}

export function SecondShopPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [message, setMessage] = useState<string | null>(null);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['second-shop-search', search],
    queryFn: () => listProducts(search) as Promise<ProductSummary[]>,
    enabled: search.length > 0,
  });

  const { data: report } = useQuery({
    queryKey: ['second-shop-report'],
    queryFn: () => fetchSecondShopReport(),
  });

  function addProduct(product: ProductSummary) {
    setCart((prev) => [
      ...prev,
      {
        key: nextKey++,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        qty: '1',
        unitPrice: '0',
      },
    ]);
    setSearch('');
  }

  function updateLine(key: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: number) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const total = cart.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);

  const submit = useMutation({
    mutationFn: () =>
      createSecondShopSale({
        lines: cart.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
        })),
        paymentMethod,
      }),
    onSuccess: (result) => {
      setMessage(
        `${t('sale.receiptNo')} #${result.receiptNo} — ${t('sale.total')}: ${result.total}`,
      );
      setCart([]);
      qc.invalidateQueries({ queryKey: ['second-shop-report'] });
    },
    onError: (error: any) => setMessage(error?.response?.data?.code ?? 'error'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('nav.secondShop')}</h1>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="relative mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('sale.scanPlaceholder')}
              className={`${inputCls} w-full text-base py-2`}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-gray-400">{p.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-1">{t('product.name')}</th>
                  <th className="py-1">{t('product.quantity')}</th>
                  <th className="py-1">{t('sale.unitPrice')}</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.key} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1">{line.productName}</td>
                    <td className="py-1">
                      <input
                        value={line.qty}
                        onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                        className={`${inputCls} w-24`}
                      />
                    </td>
                    <td className="py-1">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        {t('sale.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {message && <p className="text-sm mt-3">{message}</p>}
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-semibold mb-3">
              {t('sale.total')}: {total.toFixed(2)}
            </div>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={paymentMethod === 'CASH' ? primaryBtnCls : secondaryBtnCls}
              >
                {t('sale.cash')}
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                className={paymentMethod === 'CARD' ? primaryBtnCls : secondaryBtnCls}
              >
                {t('sale.card')}
              </button>
            </div>
          </div>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || cart.length === 0}
            className={`${primaryBtnCls} w-full`}
          >
            {t('secondShop.sell')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">{t('secondShop.report')}</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('secondShop.total')}: {report?.total ?? '0.00'}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('common.date')}</th>
              <th className="py-1">{t('sale.receiptNo')}</th>
              <th className="py-1">{t('product.name')}</th>
              <th className="py-1">{t('product.quantity')}</th>
              <th className="py-1">{t('sale.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {(report?.lines ?? []).map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{new Date(l.datetime).toLocaleDateString()}</td>
                <td className="py-1">{l.receiptNo}</td>
                <td className="py-1">{l.productName}</td>
                <td className="py-1">{l.qty}</td>
                <td className="py-1">{l.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
