import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { depositCash, fetchCashMoves, fetchCashToday, openCashDay, withdrawCash } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

interface MoveRow {
  id: number;
  datetime: string;
  type: string;
  amount: string;
  balanceBefore: string;
  note: string | null;
}

export function CashPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: today } = useQuery({ queryKey: ['cash-today'], queryFn: fetchCashToday });
  const { data: moves = [] } = useQuery({
    queryKey: ['cash-moves'],
    queryFn: () => fetchCashMoves(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash-today'] });
    qc.invalidateQueries({ queryKey: ['cash-moves'] });
  };

  const openDayForm = useForm<{ openingBalance: string }>({
    defaultValues: { openingBalance: '' },
  });
  const openDay = useMutation({
    mutationFn: (v: { openingBalance: string }) =>
      openCashDay({ openingBalance: Number(v.openingBalance) }),
    onSuccess: () => {
      openDayForm.reset();
      invalidate();
    },
  });

  const depositForm = useForm<{ amount: string; note: string }>({
    defaultValues: { amount: '', note: '' },
  });
  const deposit = useMutation({
    mutationFn: (v: { amount: string; note: string }) =>
      depositCash({ amount: Number(v.amount), note: v.note.trim() || undefined }),
    onSuccess: () => {
      depositForm.reset();
      invalidate();
    },
  });

  const withdrawForm = useForm<{ amount: string; reason: string }>({
    defaultValues: { amount: '', reason: '' },
  });
  const withdraw = useMutation({
    mutationFn: (v: { amount: string; reason: string }) =>
      withdrawCash({ amount: Number(v.amount), reason: v.reason }),
    onSuccess: () => {
      withdrawForm.reset();
      invalidate();
    },
  });

  const [showOpenDay, setShowOpenDay] = useState(false);

  const columns: ColumnDef<MoveRow, any>[] = [
    {
      header: t('common.date'),
      cell: ({ row }) => new Date(row.original.datetime).toLocaleString(),
    },
    { header: t('common.result'), accessorKey: 'type' },
    { header: t('debt.amount'), accessorKey: 'amount' },
    { header: t('cash.balance'), accessorKey: 'balanceBefore' },
    { header: t('debt.note'), cell: ({ row }) => row.original.note ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('nav.cashRegister')}</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('cash.openingBalance')}</div>
          <div className="text-xl font-semibold">{today?.openingBalance ?? '—'}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('cash.income')}</div>
          <div className="text-xl font-semibold">{today?.income ?? '—'}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('cash.expense')}</div>
          <div className="text-xl font-semibold">{today?.expense ?? '—'}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('cash.balance')}</div>
          <div className="text-xl font-semibold">{today?.closingBalance ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">{t('cash.openDay')}</h2>
            <button onClick={() => setShowOpenDay((s) => !s)} className="text-sm underline">
              {t('cash.openDay')}
            </button>
          </div>
          {showOpenDay && (
            <form
              onSubmit={openDayForm.handleSubmit((v) => openDay.mutate(v))}
              className="flex gap-2"
            >
              <input
                placeholder={t('cash.openingBalance')}
                type="number"
                step="0.01"
                {...openDayForm.register('openingBalance', { required: true })}
                className={inputCls}
              />
              <button type="submit" className={primaryBtnCls}>
                {t('app.save')}
              </button>
            </form>
          )}
        </div>

        <form
          onSubmit={depositForm.handleSubmit((v) => deposit.mutate(v))}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2"
        >
          <h2 className="font-medium">{t('cash.deposit')}</h2>
          <input
            placeholder={t('debt.amount')}
            type="number"
            step="0.01"
            {...depositForm.register('amount', { required: true })}
            className={inputCls}
          />
          <input
            placeholder={t('debt.note')}
            {...depositForm.register('note')}
            className={inputCls}
          />
          <button type="submit" className={`${primaryBtnCls} w-full`}>
            {t('cash.deposit')}
          </button>
        </form>

        <form
          onSubmit={withdrawForm.handleSubmit((v) => withdraw.mutate(v))}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2"
        >
          <h2 className="font-medium">{t('cash.withdraw')}</h2>
          <input
            placeholder={t('debt.amount')}
            type="number"
            step="0.01"
            {...withdrawForm.register('amount', { required: true })}
            className={inputCls}
          />
          <input
            placeholder={t('cash.reason')}
            {...withdrawForm.register('reason', { required: true })}
            className={inputCls}
          />
          <button type="submit" className={`${primaryBtnCls} w-full`}>
            {t('cash.withdraw')}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="font-medium mb-3">{t('cash.moves')}</h2>
        <DataTable data={moves} columns={columns} />
      </div>
    </div>
  );
}
