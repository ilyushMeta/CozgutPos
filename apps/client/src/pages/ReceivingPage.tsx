import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyMargin,
  PaymentSource,
  type ReceivingInput,
  type ReceivingLineInput,
} from '@cozgut/shared';
import { listCategories, listProducts, listSuppliers, submitReceiving } from '../api';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls =
  'px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

let nextKey = 1;

interface DraftLine {
  key: number;
  mode: 'existing' | 'new';
  productId: string;
  newName: string;
  newCode: string;
  newCategoryId: string;
  qty: string;
  buyPrice: string;
  sellPrice: string;
  currency: 'TMT' | 'USD';
  marginPercent: string;
  isScaleItem: boolean;
}

function emptyLine(): DraftLine {
  return {
    key: nextKey++,
    mode: 'existing',
    productId: '',
    newName: '',
    newCode: '',
    newCategoryId: '',
    qty: '',
    buyPrice: '',
    sellPrice: '',
    currency: 'TMT',
    marginPercent: '',
    isScaleItem: false,
  };
}

function toLineInput(d: DraftLine): ReceivingLineInput {
  return {
    productId: d.mode === 'existing' && d.productId ? Number(d.productId) : undefined,
    newProduct:
      d.mode === 'new'
        ? {
            name: d.newName,
            code: d.newCode.trim() || undefined,
            categoryId: d.newCategoryId ? Number(d.newCategoryId) : undefined,
          }
        : undefined,
    qty: Number(d.qty),
    buyPrice: Number(d.buyPrice),
    sellPrice: Number(d.sellPrice),
    currency: d.currency,
    isScaleItem: d.isScaleItem || undefined,
  } as ReceivingLineInput;
}

export function ReceivingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => listProducts(),
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [paymentSource, setPaymentSource] = useState<'NONE' | 'CASHBOX' | 'SUPPLIER_CREDIT'>(
    'NONE',
  );
  const [supplierId, setSupplierId] = useState('');
  const [result, setResult] = useState<{ invoiceNo: number; total: string } | null>(null);

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function applyMarginTo(key: number) {
    const line = lines.find((l) => l.key === key);
    if (!line || !line.buyPrice || !line.marginPercent) return;
    const sell = applyMargin(Number(line.buyPrice), Number(line.marginPercent));
    updateLine(key, { sellPrice: sell.toFixed(2) });
  }

  const submit = useMutation({
    mutationFn: () => {
      const input: ReceivingInput = {
        lines: lines.map(toLineInput),
        paymentSource: paymentSource as (typeof PaymentSource)[keyof typeof PaymentSource],
        supplierId:
          paymentSource === 'SUPPLIER_CREDIT' && supplierId ? Number(supplierId) : undefined,
      };
      return submitReceiving(input);
    },
    onSuccess: (data) => {
      setResult({ invoiceNo: data.invoiceNo, total: data.total });
      setLines([emptyLine()]);
      setPaymentSource('NONE');
      setSupplierId('');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const total = lines.reduce((sum, l) => {
    const q = Number(l.qty) || 0;
    const p = Number(l.buyPrice) || 0;
    return sum + q * p;
  }, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">{t('receiving.title')}</h1>

      {result && (
        <div className="mb-4 rounded bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 px-4 py-2 text-sm">
          {t('receiving.success')} — {t('receiving.invoiceNo')} #{result.invoiceNo},{' '}
          {t('sale.total')}: {result.total}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1 w-40">{t('product.name')}</th>
              <th className="py-1">{t('product.quantity')}</th>
              <th className="py-1">{t('product.buyPrice')}</th>
              <th className="py-1">{t('receiving.marginPercent')}</th>
              <th className="py-1">{t('product.sellPrice')}</th>
              <th className="py-1">{t('nav.currency')}</th>
              <th className="py-1">{t('product.scaleItem')}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.key}
                className="border-t border-gray-100 dark:border-gray-800 align-top"
              >
                <td className="py-1 pr-2">
                  <div className="flex gap-1 mb-1">
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="radio"
                        checked={line.mode === 'existing'}
                        onChange={() => updateLine(line.key, { mode: 'existing' })}
                      />
                      {t('receiving.existingProduct')}
                    </label>
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="radio"
                        checked={line.mode === 'new'}
                        onChange={() => updateLine(line.key, { mode: 'new' })}
                      />
                      {t('receiving.newProduct')}
                    </label>
                  </div>
                  {line.mode === 'existing' ? (
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input
                        placeholder={t('product.name')}
                        value={line.newName}
                        onChange={(e) => updateLine(line.key, { newName: e.target.value })}
                        className={inputCls}
                      />
                      <select
                        value={line.newCategoryId}
                        onChange={(e) => updateLine(line.key, { newCategoryId: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">{t('product.category')}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    step="0.001"
                    value={line.qty}
                    onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                    className={`${inputCls} w-20`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    value={line.buyPrice}
                    onChange={(e) => updateLine(line.key, { buyPrice: e.target.value })}
                    className={`${inputCls} w-24`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={line.marginPercent}
                      onChange={(e) => updateLine(line.key, { marginPercent: e.target.value })}
                      className={`${inputCls} w-16`}
                    />
                    <button
                      type="button"
                      onClick={() => applyMarginTo(line.key)}
                      className="text-xs px-2 rounded bg-gray-200 dark:bg-gray-700"
                    >
                      {t('receiving.applyMargin')}
                    </button>
                  </div>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    value={line.sellPrice}
                    onChange={(e) => updateLine(line.key, { sellPrice: e.target.value })}
                    className={`${inputCls} w-24`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    value={line.currency}
                    onChange={(e) =>
                      updateLine(line.key, { currency: e.target.value as 'TMT' | 'USD' })
                    }
                    className={inputCls}
                  >
                    <option value="TMT">TMT</option>
                    <option value="USD">USD</option>
                  </select>
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    type="checkbox"
                    checked={line.isScaleItem}
                    onChange={(e) => updateLine(line.key, { isScaleItem: e.target.checked })}
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="text-red-600 hover:underline text-xs"
                  >
                    {t('receiving.removeLine')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className={secondaryBtnCls}
        >
          {t('receiving.addLine')}
        </button>

        <div className="mt-2 text-right text-sm text-gray-500 dark:text-gray-400">
          {t('sale.total')}: {total.toFixed(2)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <h2 className="font-medium mb-3">{t('receiving.paymentSource')}</h2>
        <div className="flex gap-4 mb-3">
          {(['NONE', 'CASHBOX', 'SUPPLIER_CREDIT'] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={paymentSource === opt}
                onChange={() => setPaymentSource(opt)}
              />
              {t(
                `receiving.${opt === 'NONE' ? 'none' : opt === 'CASHBOX' ? 'cashbox' : 'supplierCredit'}`,
              )}
            </label>
          ))}
        </div>
        {paymentSource === 'SUPPLIER_CREDIT' && (
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={`${inputCls} max-w-xs`}
          >
            <option value="">{t('receiving.selectSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="button"
        disabled={submit.isPending}
        onClick={() => submit.mutate()}
        className={primaryBtnCls}
      >
        {t('receiving.submit')}
      </button>
    </div>
  );
}
