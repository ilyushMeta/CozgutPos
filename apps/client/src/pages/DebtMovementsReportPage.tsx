import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  downloadCsv,
  fetchDebtPaymentsReport,
  fetchSupplierDebtMovesReport,
  type DebtPaymentRow,
  type SupplierDebtMoveRow,
} from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

type Tab = 'customer' | 'supplier';

export function DebtMovementsReportPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('customer');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filters = { from: from || undefined, to: to || undefined };

  const { data: customerPayments = [] } = useQuery({
    queryKey: ['debt-payments-report', filters],
    queryFn: () => fetchDebtPaymentsReport(filters),
    enabled: tab === 'customer',
  });
  const { data: supplierMoves = [] } = useQuery({
    queryKey: ['supplier-debt-moves-report', filters],
    queryFn: () => fetchSupplierDebtMovesReport(filters),
    enabled: tab === 'supplier',
  });

  const customerColumns: ColumnDef<DebtPaymentRow, any>[] = [
    { header: t('debt.debtor'), accessorFn: (r) => r.debtor.name },
    {
      header: t('common.date'),
      cell: ({ row }) => new Date(row.original.datetime).toLocaleString(),
    },
    { header: t('debt.amount'), accessorKey: 'amount' },
    { header: t('debt.currency'), accessorKey: 'currency' },
    { header: t('debt.note'), cell: ({ row }) => row.original.note ?? '—' },
  ];

  const supplierColumns: ColumnDef<SupplierDebtMoveRow, any>[] = [
    { header: t('debt.supplier'), accessorFn: (r) => r.supplier.name },
    { header: t('common.date'), cell: ({ row }) => new Date(row.original.txDate).toLocaleString() },
    { header: t('common.result'), accessorKey: 'type' },
    { header: t('debt.amount'), accessorKey: 'amount' },
    { header: t('debt.balance'), accessorKey: 'closing' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('reports.debtMovements')}</h1>
        <button
          onClick={() =>
            void downloadCsv(
              tab === 'customer' ? '/reports/debt-payments' : '/reports/supplier-debt-moves',
              tab === 'customer' ? 'karz-tolegleri.csv' : 'dukan-karz-hereketleri.csv',
              filters,
            )
          }
          className={secondaryBtnCls}
        >
          {t('app.export')}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('customer')}
          className={tab === 'customer' ? primaryBtnCls : secondaryBtnCls}
        >
          {t('reports.customerPayments')}
        </button>
        <button
          onClick={() => setTab('supplier')}
          className={tab === 'supplier' ? primaryBtnCls : secondaryBtnCls}
        >
          {t('reports.supplierMoves')}
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
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        {tab === 'customer' ? (
          <DataTable data={customerPayments} columns={customerColumns} />
        ) : (
          <DataTable data={supplierMoves} columns={supplierColumns} />
        )}
      </div>
    </div>
  );
}
