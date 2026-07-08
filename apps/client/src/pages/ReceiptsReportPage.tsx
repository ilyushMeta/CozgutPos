import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { downloadCsv, fetchReceipts, openFakturPdf, type ReceiptRow } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

export function ReceiptsReportPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  const filters = {
    from: from || undefined,
    to: to || undefined,
    receiptNo: receiptNo ? Number(receiptNo) : undefined,
  };

  const { data = [] } = useQuery({
    queryKey: ['receipts-report', filters],
    queryFn: () => fetchReceipts(filters),
  });

  const columns: ColumnDef<ReceiptRow, any>[] = [
    { header: t('sale.receiptNo'), accessorKey: 'receiptNo' },
    {
      header: t('common.date'),
      cell: ({ row }) => new Date(row.original.datetime).toLocaleString(),
    },
    { header: t('auth.username'), accessorFn: (r) => r.cashier.username },
    { header: t('debt.debtor'), accessorFn: (r) => r.debtor?.name ?? '—' },
    { header: t('sale.total'), accessorKey: 'total' },
    { header: t('sale.cash'), accessorKey: 'paidCash' },
    { header: t('sale.card'), accessorKey: 'paidCard' },
    { header: t('sale.debt'), accessorKey: 'paidDebt' },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <button
          onClick={() => void openFakturPdf(row.original.id)}
          className="text-blue-600 hover:underline text-xs"
        >
          {t('sale.printFaktur')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('reports.receipts')}</h1>
        <button
          onClick={() => void downloadCsv('/reports/receipts', 'cekler.csv', filters as any)}
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
          value={receiptNo}
          onChange={(e) => setReceiptNo(e.target.value)}
          placeholder={t('sale.receiptNo')}
          className={`${inputCls} w-32`}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
