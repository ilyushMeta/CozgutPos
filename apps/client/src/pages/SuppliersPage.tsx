import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { createSupplier, generateSupplierCode, listSuppliers } from '../api';
import { DataTable } from '../components/DataTable';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls =
  'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

interface SupplierRow {
  id: number;
  code: string;
  name: string;
  balance: string;
}

interface SupplierFormValues {
  name: string;
  code: string;
  phone: string;
  note: string;
}

const EMPTY_FORM: SupplierFormValues = { name: '', code: '', phone: '', note: '' };

export function SuppliersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data = [] } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const { register, handleSubmit, setValue, reset } = useForm<SupplierFormValues>({
    defaultValues: EMPTY_FORM,
  });

  const create = useMutation({
    mutationFn: (v: SupplierFormValues) =>
      createSupplier({
        name: v.name,
        code: v.code.trim() || undefined,
        phone: v.phone.trim() || undefined,
        note: v.note.trim() || undefined,
      }),
    onSuccess: () => {
      reset(EMPTY_FORM);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  async function onGenerateCode() {
    const { code } = await generateSupplierCode();
    setValue('code', code);
  }

  const columns: ColumnDef<SupplierRow, any>[] = [
    { header: t('product.code'), accessorKey: 'code' },
    { header: t('product.name'), accessorKey: 'name' },
    { header: t('debt.balance'), accessorKey: 'balance' },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/supplier-debt/${row.original.id}`)}
          className="text-blue-600 hover:underline text-sm"
        >
          {t('debt.detail')}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('nav.supplierDebt')}</h1>
        <button onClick={() => setShowForm((s) => !s)} className={primaryBtnCls}>
          {t('supplier.addNew')}
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
          <input placeholder={t('debt.note')} {...register('note')} className={inputCls} />
          <div className="col-span-2">
            <button type="submit" className={primaryBtnCls}>
              {t('app.save')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}
