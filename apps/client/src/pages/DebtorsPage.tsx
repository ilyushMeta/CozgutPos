import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { createDebtor, generateDebtorCode, listDebtors } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls =
  'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

interface DebtorRow {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  accountCurrency: 'TMT' | 'USD';
  balance: string;
  overdueAmount: string;
  isOverdue: boolean;
}

interface DebtorFormValues {
  name: string;
  code: string;
  phone: string;
  note: string;
  accountCurrency: 'TMT' | 'USD';
}

const EMPTY_FORM: DebtorFormValues = {
  name: '',
  code: '',
  phone: '',
  note: '',
  accountCurrency: 'TMT',
};

export function DebtorsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ['debtors', search],
    queryFn: () => listDebtors(search || undefined),
  });

  const { register, handleSubmit, setValue, reset } = useForm<DebtorFormValues>({
    defaultValues: EMPTY_FORM,
  });

  const create = useMutation({
    mutationFn: (v: DebtorFormValues) =>
      createDebtor({
        name: v.name,
        code: v.code.trim() || undefined,
        phone: v.phone.trim() || undefined,
        note: v.note.trim() || undefined,
        accountCurrency: v.accountCurrency,
      }),
    onSuccess: () => {
      reset(EMPTY_FORM);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['debtors'] });
    },
  });

  async function onGenerateCode() {
    const { code } = await generateDebtorCode();
    setValue('code', code);
  }

  const columns: ColumnDef<DebtorRow, any>[] = [
    { header: t('product.code'), accessorKey: 'code' },
    { header: t('product.name'), accessorKey: 'name' },
    { header: t('debt.phone'), cell: ({ row }) => row.original.phone ?? '—' },
    {
      header: t('debt.balance'),
      cell: ({ row }) => `${row.original.balance} ${row.original.accountCurrency}`,
    },
    {
      header: t('debt.overdue'),
      cell: ({ row }) => (row.original.isOverdue ? row.original.overdueAmount : '—'),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/customer-debt/${row.original.id}`)}
          className="text-blue-600 hover:underline text-sm"
        >
          {t('debt.detail')}
        </button>
      ),
    },
  ];

  const overdueNames = data.filter((d) => d.isOverdue).map((d) => d.name);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('nav.customerDebt')}</h1>
        <button onClick={() => setShowForm((s) => !s)} className={primaryBtnCls}>
          {t('debt.addNew')}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((v) => create.mutate(v))}
          className="grid grid-cols-2 gap-3 mb-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
        >
          <input
            placeholder={t('product.name')}
            {...register('name', { required: true })}
            className={inputCls}
          />
          <div className="flex gap-2">
            <input placeholder={t('product.code')} {...register('code')} className={inputCls} />
            <button type="button" onClick={onGenerateCode} className={secondaryBtnCls}>
              {t('product.generateCode')}
            </button>
          </div>
          <input placeholder={t('debt.phone')} {...register('phone')} className={inputCls} />
          <select {...register('accountCurrency')} className={inputCls}>
            <option value="TMT">TMT</option>
            <option value="USD">USD</option>
          </select>
          <input
            placeholder={t('debt.note')}
            {...register('note')}
            className={`${inputCls} col-span-2`}
          />
          <div className="col-span-2 flex gap-2">
            <button type="submit" className={primaryBtnCls}>
              {t('app.save')}
            </button>
          </div>
        </form>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('debt.searchPlaceholder')}
        className={`${inputCls} mb-4 max-w-sm`}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable
          data={data}
          columns={columns}
          rowClassName={(row) => (row.isOverdue ? 'bg-red-50 dark:bg-red-950/40' : '')}
        />
      </div>
      {overdueNames.length > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
          {t('reports.overdueDebtors')}: {overdueNames.join(', ')}
        </p>
      )}
    </div>
  );
}
