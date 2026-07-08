import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReturn, searchSoldLines } from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

export function ReturnsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [term, setTerm] = useState('');
  const [qtyByLine, setQtyByLine] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const isReceiptNo = /^\d+$/.test(term.trim());
  const { data: lines = [] } = useQuery({
    queryKey: ['returns-search', term],
    queryFn: () =>
      searchSoldLines(
        isReceiptNo ? { receiptNo: Number(term.trim()) } : { code: term.trim() || undefined },
      ),
    enabled: term.trim().length > 0,
  });

  const submit = useMutation({
    mutationFn: (saleLineId: number) =>
      createReturn({ saleLineId, qty: Number(qtyByLine[saleLineId] || 0) }),
    onSuccess: () => {
      setMessage(t('returns.success'));
      qc.invalidateQueries({ queryKey: ['returns-search'] });
    },
    onError: (error: any) => setMessage(error?.response?.data?.code ?? 'error'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('nav.returns')}</h1>

      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t('returns.searchPlaceholder')}
        className={`${inputCls} w-full max-w-md`}
      />

      {message && <p className="text-sm">{message}</p>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('sale.receiptNo')}</th>
              <th className="py-1">{t('common.date')}</th>
              <th className="py-1">{t('product.name')}</th>
              <th className="py-1">{t('product.code')}</th>
              <th className="py-1">{t('product.quantity')}</th>
              <th className="py-1">{t('returns.returnable')}</th>
              <th className="py-1">{t('returns.returnQty')}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.saleLineId} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{line.receiptNo}</td>
                <td className="py-1">{new Date(line.datetime).toLocaleDateString()}</td>
                <td className="py-1">{line.productName}</td>
                <td className="py-1 text-gray-400">{line.productCode}</td>
                <td className="py-1">{line.qty}</td>
                <td className="py-1">{line.returnable}</td>
                <td className="py-1">
                  <input
                    value={qtyByLine[line.saleLineId] ?? ''}
                    onChange={(e) =>
                      setQtyByLine((prev) => ({ ...prev, [line.saleLineId]: e.target.value }))
                    }
                    className={`${inputCls} w-20`}
                  />
                </td>
                <td className="py-1">
                  <button
                    onClick={() => submit.mutate(line.saleLineId)}
                    disabled={Number(line.returnable) <= 0}
                    className={primaryBtnCls}
                  >
                    {t('returns.submit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines.length === 0 && term.trim().length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">{t('common.noResults')}</p>
        )}
      </div>
    </div>
  );
}
