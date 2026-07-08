import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { downloadCsv, fetchLoginAudit, type LoginAuditRow } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

export function LoginAuditPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = { from: from || undefined, to: to || undefined };

  const { data = [] } = useQuery({
    queryKey: ['login-audit', filters],
    queryFn: () => fetchLoginAudit(filters),
  });

  const columns: ColumnDef<LoginAuditRow, any>[] = [
    { header: t('auth.username'), accessorFn: (r) => r.user.username },
    { header: t('common.date'), cell: ({ row }) => new Date(row.original.at).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('reports.loginAudit')}</h1>
        <button
          onClick={() => void downloadCsv('/reports/login-audit', 'giris-taryhy.csv', filters)}
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
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
