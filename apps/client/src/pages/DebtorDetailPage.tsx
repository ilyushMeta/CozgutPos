import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDebtor, payDebtorDebt, updateDebtor } from '../api';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls =
  'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{label}</span>
      {children}
    </label>
  );
}

interface DebtorFormValues {
  name: string;
  code: string;
  phone: string;
  note: string;
  accountCurrency: 'TMT' | 'USD';
}

export function DebtorDetailPage() {
  const { id } = useParams();
  const debtorId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: debtor } = useQuery({
    queryKey: ['debtor', debtorId],
    queryFn: () => getDebtor(debtorId),
  });

  const { register, handleSubmit, reset } = useForm<DebtorFormValues>({
    defaultValues: { name: '', code: '', phone: '', note: '', accountCurrency: 'TMT' },
  });

  useEffect(() => {
    if (!debtor) return;
    reset({
      name: debtor.name,
      code: debtor.code,
      phone: debtor.phone ?? '',
      note: debtor.note ?? '',
      accountCurrency: debtor.accountCurrency,
    });
  }, [debtor, reset]);

  const save = useMutation({
    mutationFn: (v: DebtorFormValues) =>
      updateDebtor(debtorId, {
        name: v.name,
        code: v.code,
        phone: v.phone.trim() || undefined,
        note: v.note.trim() || undefined,
        accountCurrency: v.accountCurrency,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debtor', debtorId] }),
  });

  if (!debtor) return <p>{t('app.loading')}</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('debt.editTitle')}</h1>
        <button onClick={() => navigate('/customer-debt')} className={secondaryBtnCls}>
          {t('app.back')}
        </button>
      </div>

      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        className="grid grid-cols-2 gap-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <Field label={t('product.name')}>
          <input {...register('name', { required: true })} className={inputCls} />
        </Field>
        <Field label={t('product.code')}>
          <input {...register('code')} className={inputCls} />
        </Field>
        <Field label={t('debt.phone')}>
          <input {...register('phone')} className={inputCls} />
        </Field>
        <Field label={t('debt.currency')}>
          <select {...register('accountCurrency')} className={inputCls}>
            <option value="TMT">TMT</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <div className="col-span-2">
          <Field label={t('debt.note')}>
            <input {...register('note')} className={inputCls} />
          </Field>
        </div>
        <div className="col-span-2">
          <button type="submit" className={primaryBtnCls}>
            {t('app.save')}
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-2xl font-semibold">
          {t('debt.balance')}: {debtor.balance} {debtor.accountCurrency}
        </div>
      </div>

      <PaymentForm debtorId={debtorId} />

      <ScheduleSection schedules={debtor.schedules ?? []} />
      <SalesSection sales={debtor.debtSales ?? []} />
      <PaymentsSection payments={debtor.payments ?? []} currency={debtor.accountCurrency} />
    </div>
  );
}

function PaymentForm({ debtorId }: { debtorId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm<{
    amount: string;
    note: string;
    sendSms: boolean;
  }>({ defaultValues: { amount: '', note: '', sendSms: false } });

  const pay = useMutation({
    mutationFn: (v: { amount: string; note: string; sendSms: boolean }) =>
      payDebtorDebt(debtorId, {
        amount: Number(v.amount),
        note: v.note.trim() || undefined,
        sendSms: v.sendSms,
      }),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ['debtor', debtorId] });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => pay.mutate(v))}
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
    >
      <h2 className="font-medium mb-3">{t('debt.payDebt')}</h2>
      <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-2 items-end">
        <input
          placeholder={t('debt.amount')}
          type="number"
          step="0.01"
          {...register('amount', { required: true })}
          className={inputCls}
        />
        <input placeholder={t('debt.note')} {...register('note')} className={inputCls} />
        <label className="flex items-center gap-1 text-sm whitespace-nowrap">
          <input type="checkbox" {...register('sendSms')} />
          {t('sale.sms')}
        </label>
        <button type="submit" className={primaryBtnCls}>
          {t('debt.payDebt')}
        </button>
      </div>
    </form>
  );
}

function ScheduleSection({ schedules }: { schedules: any[] }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="font-medium mb-3">{t('debt.schedule')}</h2>
      {schedules.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('debt.dueDate')}</th>
              <th className="py-1">{t('debt.amount')}</th>
              <th className="py-1">{t('sale.total')}</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">
                  {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '—'}
                </td>
                <td className="py-1">{s.amount}</td>
                <td className="py-1">{s.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SalesSection({ sales }: { sales: any[] }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="font-medium mb-3">{t('debt.sales')}</h2>
      {sales.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('common.date')}</th>
              <th className="py-1">{t('sale.invoice')}</th>
              <th className="py-1">{t('debt.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{new Date(s.saleDate).toLocaleDateString()}</td>
                <td className="py-1">{s.invoiceNo}</td>
                <td className="py-1">{s.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PaymentsSection({ payments, currency }: { payments: any[]; currency: string }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="font-medium mb-3">{t('debt.payments')}</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('common.date')}</th>
              <th className="py-1">{t('debt.amount')}</th>
              <th className="py-1">{t('debt.note')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{new Date(p.datetime).toLocaleDateString()}</td>
                <td className="py-1">
                  {p.amount} {currency}
                </td>
                <td className="py-1">{p.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
