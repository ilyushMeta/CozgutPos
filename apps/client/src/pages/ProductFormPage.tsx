import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductInput, UnitPackInput, StockBatchUpdateInput } from '@cozgut/shared';
import {
  createProduct,
  createUnitPack,
  deleteStockBatch,
  deleteUnitPack,
  generateProductCode,
  getProduct,
  openLabelPdf,
  listCategories,
  updateProduct,
  updateStockBatch,
} from '../api';

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

/** Raw string form values (HTML-input-friendly); converted to ProductInput on submit. */
interface ProductFormValues {
  name: string;
  code: string;
  categoryId: string;
  isScaleItem: boolean;
  lowStockThreshold: string;
  expiryDate: string;
  discountPercent: string;
  secondPrice: string;
}

function toProductInput(v: ProductFormValues): ProductInput {
  return {
    name: v.name,
    code: v.code.trim() || undefined,
    categoryId: v.categoryId ? Number(v.categoryId) : null,
    isScaleItem: v.isScaleItem,
    lowStockThreshold: v.lowStockThreshold ? Number(v.lowStockThreshold) : 0,
    expiryDate: v.expiryDate ? new Date(v.expiryDate) : null,
    discountPercent: v.discountPercent ? Number(v.discountPercent) : 0,
    secondPrice: v.secondPrice ? Number(v.secondPrice) : null,
  };
}

const EMPTY_FORM: ProductFormValues = {
  name: '',
  code: '',
  categoryId: '',
  isScaleItem: false,
  lowStockThreshold: '0',
  expiryDate: '',
  discountPercent: '0',
  secondPrice: '',
};

export function ProductFormPage() {
  const { id } = useParams();
  const productId = id ? Number(id) : undefined;
  const isEdit = productId !== undefined;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId!),
    enabled: isEdit,
  });

  const { register, handleSubmit, setValue, reset } = useForm<ProductFormValues>({
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!product) return;
    reset({
      name: product.name,
      code: product.code,
      categoryId: product.categoryId ? String(product.categoryId) : '',
      isScaleItem: product.isScaleItem,
      lowStockThreshold: String(product.lowStockThreshold ?? 0),
      expiryDate: product.expiryDate ? String(product.expiryDate).slice(0, 10) : '',
      discountPercent: String(product.discountPercent ?? 0),
      secondPrice: product.secondPrice != null ? String(product.secondPrice) : '',
    });
  }, [product, reset]);

  const save = useMutation({
    mutationFn: (values: ProductFormValues) =>
      isEdit
        ? updateProduct(productId!, toProductInput(values))
        : createProduct(toProductInput(values)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['product', productId] });
      else navigate(`/products/${saved.id}`);
    },
  });

  async function onGenerateCode() {
    const { code } = await generateProductCode();
    setValue('code', code);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">
        {isEdit ? t('product.editTitle') : t('product.addNew')}
      </h1>

      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        className="space-y-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <Field label={t('product.name')}>
          <input {...register('name', { required: true })} className={inputCls} />
        </Field>

        <Field label={t('product.code')}>
          <div className="flex gap-2">
            <input {...register('code')} className={inputCls} />
            <button type="button" onClick={onGenerateCode} className={secondaryBtnCls}>
              {t('product.generateCode')}
            </button>
          </div>
        </Field>

        <Field label={t('product.category')}>
          <select {...register('categoryId')} className={inputCls}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('product.lowStockThreshold')}>
            <input
              type="number"
              step="0.001"
              {...register('lowStockThreshold')}
              className={inputCls}
            />
          </Field>
          <Field label={t('product.discount')}>
            <input
              type="number"
              step="0.01"
              {...register('discountPercent')}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('product.expiry')}>
            <input type="date" {...register('expiryDate')} className={inputCls} />
          </Field>
          <Field label={t('product.secondPrice')}>
            <input type="number" step="0.01" {...register('secondPrice')} className={inputCls} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isScaleItem')} />
          {t('product.scaleItem')}
        </label>

        <div className="flex gap-2 pt-2">
          <button type="submit" className={primaryBtnCls}>
            {t('app.save')}
          </button>
          <button type="button" onClick={() => navigate('/products')} className={secondaryBtnCls}>
            {t('app.cancel')}
          </button>
        </div>
      </form>

      {isEdit && productId !== undefined && (
        <div className="mt-6 space-y-6">
          <UnitPacksSection productId={productId} unitPacks={product?.unitPacks ?? []} />
          <BatchesSection productId={productId} batches={product?.batches ?? []} />
          <LabelPrintSection productId={productId} />
        </div>
      )}
    </div>
  );
}

// ── Unit packs (SPEC §6.7) ────────────────────────────────────────────────────

function UnitPacksSection({ productId, unitPacks }: { productId: number; unitPacks: any[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm<{
    name: string;
    qtyInside: string;
    buyPrice: string;
    sellPrice: string;
  }>({ defaultValues: { name: '', qtyInside: '', buyPrice: '', sellPrice: '' } });

  const add = useMutation({
    mutationFn: (v: { name: string; qtyInside: string; buyPrice: string; sellPrice: string }) =>
      createUnitPack(productId, {
        name: v.name,
        qtyInside: Number(v.qtyInside),
        buyPrice: Number(v.buyPrice),
        sellPrice: Number(v.sellPrice),
      } satisfies UnitPackInput),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ['product', productId] });
    },
  });

  const remove = useMutation({
    mutationFn: (packId: number) => deleteUnitPack(packId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product', productId] }),
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="font-medium mb-3">{t('product.unitPacks')}</h2>

      {unitPacks.length > 0 && (
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('product.name')}</th>
              <th className="py-1">{t('product.qtyInside')}</th>
              <th className="py-1">{t('product.buyPrice')}</th>
              <th className="py-1">{t('product.sellPrice')}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {unitPacks.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{p.name}</td>
                <td className="py-1">{p.qtyInside}</td>
                <td className="py-1">{p.buyPrice}</td>
                <td className="py-1">{p.sellPrice}</td>
                <td className="py-1 text-right">
                  <button
                    onClick={() => remove.mutate(p.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    {t('app.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        onSubmit={handleSubmit((v) => add.mutate(v))}
        className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end"
      >
        <input
          placeholder={t('product.name')}
          {...register('name', { required: true })}
          className={inputCls}
        />
        <input
          placeholder={t('product.qtyInside')}
          type="number"
          step="0.001"
          {...register('qtyInside', { required: true })}
          className={inputCls}
        />
        <input
          placeholder={t('product.buyPrice')}
          type="number"
          step="0.01"
          {...register('buyPrice', { required: true })}
          className={inputCls}
        />
        <input
          placeholder={t('product.sellPrice')}
          type="number"
          step="0.01"
          {...register('sellPrice', { required: true })}
          className={inputCls}
        />
        <button type="submit" className={secondaryBtnCls}>
          {t('product.addUnitPack')}
        </button>
      </form>
    </div>
  );
}

// ── Batches (SPEC §5.4 "edit ... batch fields") ──────────────────────────────

function BatchRow({ batch, productId }: { batch: any; productId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const untouched = String(batch.qtyRemaining) === String(batch.qtyInitial);
  const { register, handleSubmit } = useForm<{ buyPrice: string; sellPrice: string }>({
    defaultValues: { buyPrice: String(batch.buyPrice), sellPrice: String(batch.sellPrice) },
  });

  const save = useMutation({
    mutationFn: (v: { buyPrice: string; sellPrice: string }) =>
      updateStockBatch(batch.id, {
        buyPrice: Number(v.buyPrice),
        sellPrice: Number(v.sellPrice),
        currency: batch.currency,
      } satisfies StockBatchUpdateInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product', productId] }),
  });

  const remove = useMutation({
    mutationFn: () => deleteStockBatch(batch.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product', productId] }),
  });

  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <td className="py-1">{new Date(batch.receivedAt).toLocaleDateString()}</td>
      <td className="py-1">{batch.qtyRemaining}</td>
      <td className="py-1">
        <input
          {...register('buyPrice')}
          className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-transparent px-1.5 py-0.5 text-sm"
        />
      </td>
      <td className="py-1">
        <input
          {...register('sellPrice')}
          className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-transparent px-1.5 py-0.5 text-sm"
        />
      </td>
      <td className="py-1">{batch.currency}</td>
      <td className="py-1 text-right space-x-2">
        <button
          onClick={handleSubmit((v) => save.mutate(v))}
          className="text-blue-600 hover:underline text-xs"
        >
          {t('app.save')}
        </button>
        {untouched && (
          <button
            onClick={() => {
              if (window.confirm(t('common.confirmDelete'))) remove.mutate();
            }}
            className="text-red-600 hover:underline text-xs"
          >
            {t('app.delete')}
          </button>
        )}
      </td>
    </tr>
  );
}

function BatchesSection({ productId, batches }: { productId: number; batches: any[] }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="font-medium mb-3">{t('product.batches')}</h2>
      {batches.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('product.noBatches')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('common.date')}</th>
              <th className="py-1">{t('product.remaining')}</th>
              <th className="py-1">{t('product.buyPrice')}</th>
              <th className="py-1">{t('product.sellPrice')}</th>
              <th className="py-1"></th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <BatchRow key={b.id} batch={b} productId={productId} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Label / QR print (SPEC §5.3, §7.2) ───────────────────────────────────────

function LabelPrintSection({ productId }: { productId: number }) {
  const { t } = useTranslation();
  const [copies, setCopies] = useState(1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
      <h2 className="font-medium">{t('product.printLabel')}</h2>
      <div className="flex items-center gap-2 ml-auto">
        <label className="text-sm text-gray-500 dark:text-gray-400">{t('product.copies')}</label>
        <button
          type="button"
          onClick={() => setCopies((c) => Math.max(1, c - 1))}
          className={secondaryBtnCls}
        >
          −
        </button>
        <span className="w-8 text-center">{copies}</span>
        <button type="button" onClick={() => setCopies((c) => c + 1)} className={secondaryBtnCls}>
          +
        </button>
        <button
          type="button"
          onClick={() => void openLabelPdf(productId, copies)}
          className={primaryBtnCls}
        >
          {t('app.print')}
        </button>
      </div>
    </div>
  );
}
