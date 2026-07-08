import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupplier, listSupplierMoves, paySupplierDebt, updateSupplier } from '../api';

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

interface SupplierFormValues {
  name: string;
  code: string;
  phone: string;
  note: string;
}

export function SupplierDetailPage() {
  const { id } = useParams();
  const supplierId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: supplier } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => getSupplier(supplierId),
  });
  const { data: moves = [] } = useQuery({
    queryKey: ['supplier-moves', supplierId],
    queryFn: () => listSupplierMoves(supplierId),
  });

  const { register, handleSubmit, reset } = useForm<SupplierFormValues>({
    defaultValues: { name: '', code: '', phone: '', note: '' },
  });

  useEffect(() => {
    if (!supplier) return;
    reset({
      name: supplier.name,
      code: supplier.code,
      phone: supplier.phone ?? '',
      note: supplier.note ?? '',
    });
  }, [supplier, reset]);

  const save = useMutation({
    mutationFn: (v: SupplierFormValues) =>
      updateSupplier(supplierId, {
        name: v.name,
        code: v.code,
        phone: v.phone.trim() || undefined,
        note: v.note.trim() || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier', supplierId] }),
  });

  const {
    register: registerPay,
    handleSubmit: handlePaySubmit,
    reset: resetPay,
  } = useForm<{
    amount: string;
    note: string;
  }>({ defaultValues: { amount: '', note: '' } });

  const pay = useMutation({
    mutationFn: (v: { amount: string; note: string }) =>
      paySupplierDebt(supplierId, { amount: Number(v.amount), note: v.note.trim() || undefined }),
    onSuccess: () => {
      resetPay();
      qc.invalidateQueries({ queryKey: ['supplier', supplierId] });
      qc.invalidateQueries({ queryKey: ['supplier-moves', supplierId] });
    },
  });

  if (!supplier) return <p>{t('app.loading')}</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('supplier.editTitle')}</h1>
        <button onClick={() => navigate('/supplier-debt')} className={secondaryBtnCls}>
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
        <Field label={t('debt.note')}>
          <input {...register('note')} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <button type="submit" className={primaryBtnCls}>
            {t('app.save')}
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-2xl font-semibold">
          {t('debt.balance')}: {supplier.balance}
        </div>
      </div>

      <form
        onSubmit={handlePaySubmit((v) => pay.mutate(v))}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <h2 className="font-medium mb-3">{t('supplier.payDebt')}</h2>
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <input
            placeholder={t('debt.amount')}
            type="number"
            step="0.01"
            {...registerPay('amount', { required: true })}
            className={inputCls}
          />
          <input placeholder={t('debt.note')} {...registerPay('note')} className={inputCls} />
          <button type="submit" className={primaryBtnCls}>
            {t('supplier.payDebt')}
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="font-medium mb-3">{t('debt.movements')}</h2>
        {moves.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-1">{t('common.date')}</th>
                <th className="py-1">{t('common.result')}</th>
                <th className="py-1">{t('debt.amount')}</th>
                <th className="py-1">{t('debt.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m: any) => (
                <tr key={m.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1">{new Date(m.txDate).toLocaleDateString()}</td>
                  <td className="py-1">{m.type}</td>
                  <td className="py-1">{m.amount}</td>
                  <td className="py-1">{m.closing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
