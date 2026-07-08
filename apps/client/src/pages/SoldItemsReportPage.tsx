import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { downloadCsv, fetchSoldItems, type SoldItemRow } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

export function SoldItemsReportPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const filters = {
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    category: category || undefined,
    receiptNo: receiptNo ? Number(receiptNo) : undefined,
    paymentMethod: (paymentMethod || undefined) as any,
  };

  const { data = [] } = useQuery({
    queryKey: ['sold-items-report', filters],
    queryFn: () => fetchSoldItems(filters),
  });

  const columns: ColumnDef<SoldItemRow, any>[] = [
    { header: t('sale.receiptNo'), accessorFn: (r) => r.sale.receiptNo },
    {
      header: t('common.date'),
      cell: ({ row }) => new Date(row.original.sale.datetime).toLocaleString(),
    },
    { header: t('product.name'), accessorKey: 'productNameSnapshot' },
    { header: t('product.code'), accessorFn: (r) => r.product.code },
    { header: t('product.category'), accessorFn: (r) => r.categoryNameSnapshot ?? '—' },
    { header: t('product.quantity'), accessorKey: 'qty' },
    { header: t('sale.unitPrice'), accessorKey: 'unitPrice' },
    { header: t('sale.lineTotal'), accessorKey: 'lineTotal' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('reports.soldItems')}</h1>
        <button
          onClick={() =>
            void downloadCsv('/reports/sold-items', 'satylan-harytlar.csv', filters as any)
          }
          className={secondaryBtnCls}
        >
          {t('app.export')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputCls}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputCls}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('reports.search')}
          className={inputCls}
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t('product.category')}
          className={inputCls}
        />
        <input
          value={receiptNo}
          onChange={(e) => setReceiptNo(e.target.value)}
          placeholder={t('sale.receiptNo')}
          className={`${inputCls} w-32`}
        />
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className={inputCls}
        >
          <option value="">{t('reports.paymentMethod')}</option>
          <option value="CASH">{t('sale.cash')}</option>
          <option value="CARD">{t('sale.card')}</option>
          <option value="DEBT">{t('sale.debt')}</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
