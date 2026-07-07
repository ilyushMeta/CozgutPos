import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseQtyInput } from '@cozgut/shared';
import { useAuthStore } from '../store/auth';
import { createSale, listProducts, openFakturPdf, priceCheck } from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm';
const primaryBtnCls =
  'px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50';
const secondaryBtnCls = 'px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-sm';

let nextKey = 1;

interface CartLine {
  key: number;
  productId: number;
  productName: string;
  productCode: string;
  qty: string;
  unitPrice: string;
  unitPackId?: number;
  unitPackName?: string;
}

interface ProductSummary {
  id: number;
  name: string;
  code: string;
  discountPercent: string;
  unitPacks: { id: number; name: string; qtyInside: string; sellPrice: string }[];
}

function lineTotalOf(line: CartLine): number {
  const qty = parseQtyInput(line.qty);
  const price = Number(line.unitPrice) || 0;
  return qty ? qty.times(price).toNumber() : 0;
}

function formatSaleError(t: (key: string, opts?: any) => string, error: any): string[] {
  const body = error?.response?.data;
  if (!body?.code) return [error?.message ?? 'error'];
  switch (body.code) {
    case 'EMPTY_CART':
      return [t('sale.emptyCart')];
    case 'NO_PAYMENT':
      return [t('sale.selectPayment')];
    case 'INSUFFICIENT_STOCK':
      return (body.shortages ?? []).map(
        (s: any) => `${s.productName}: ${t('sale.shortage', { count: Number(s.shortfall) })}`,
      );
    case 'BELOW_COST':
      return (body.lines ?? []).map((l: any) =>
        t('sale.belowCostError', { name: l.productName, price: l.unitPrice, cost: l.costBasis }),
      );
    default:
      return [body.code];
  }
}

export function SalePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [paidCash, setPaidCash] = useState('');
  const [paidCard, setPaidCard] = useState('');
  const [skipStockCheck, setSkipStockCheck] = useState(false);
  const [allowBelowCost, setAllowBelowCost] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastReceipt, setLastReceipt] = useState<{
    receiptNo: number;
    total: string;
    printed: boolean;
  } | null>(null);
  const [priceCheckProduct, setPriceCheckProduct] = useState<ProductSummary | null>(null);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['pos-search', search],
    queryFn: () => listProducts(search) as Promise<ProductSummary[]>,
    enabled: search.length > 0,
  });

  async function addProduct(product: ProductSummary, unitPackId?: number) {
    const pc = await priceCheck(product.id);
    let unitPrice: number;
    const qty = '1';
    let unitPackName: string | undefined;

    if (unitPackId) {
      const pack = product.unitPacks.find((p) => p.id === unitPackId);
      unitPrice = Number(pack?.sellPrice ?? 0);
      unitPackName = pack?.name;
    } else {
      const raw = Number(pc.currentSellPrice ?? 0);
      unitPrice = raw * (1 - Number(product.discountPercent ?? 0) / 100);
    }

    setCart((prev) => [
      ...prev,
      {
        key: nextKey++,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        qty,
        unitPrice: unitPrice.toFixed(2),
        unitPackId,
        unitPackName,
      },
    ]);
    setSearch('');
  }

  function updateLine(key: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function setLineTotal(key: number, totalStr: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const total = Number(totalStr);
        const price = Number(l.unitPrice) || 0;
        if (!Number.isFinite(total) || price <= 0) return l;
        return { ...l, qty: (total / price).toFixed(3) };
      }),
    );
  }

  function removeLine(key: number) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const total = cart.reduce((sum, l) => sum + lineTotalOf(l), 0);
  const cash = Number(paidCash) || 0;
  const card = Number(paidCard) || 0;
  const due = total - card;
  const change = cash - due;
  const displayChange = change >= 0 ? change : 0;
  const displayDiscount = change < 0 ? -change : 0;

  const submit = useMutation({
    mutationFn: () =>
      createSale({
        lines: cart.map((l) => ({
          productId: l.productId,
          qty: parseQtyInput(l.qty)?.toNumber() ?? Number(l.qty),
          unitPackId: l.unitPackId,
          unitPrice: Number(l.unitPrice),
        })),
        paidCash: cash,
        paidCard: card,
        skipStockCheck,
        allowBelowCost,
      } as any),
    onSuccess: (result) => {
      setLastReceipt({ receiptNo: result.receiptNo, total: result.total, printed: result.printed });
      setCart([]);
      setPaidCash('');
      setPaidCard('');
      setErrors([]);
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => setErrors(formatSaleError(t, error)),
  });

  // Global barcode-wedge capture (SPEC §7.2): only when focus isn't already in
  // a text field, so manual typing (e.g. into the cash amount) is untouched.
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  useEffect(() => {
    function isTextInput(el: EventTarget | null): boolean {
      const tag = (el as HTMLElement | null)?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTextInput(document.activeElement)) return;
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 100) bufferRef.current = '';
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= 3) void handleScan(code);
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleScan(code: string) {
    const matches = (await listProducts(code)) as ProductSummary[];
    const exact = matches.find((p) => p.code === code);
    if (exact) await addProduct(exact);
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="relative mb-4">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions.length > 0) void addProduct(suggestions[0]);
            }}
            placeholder={t('sale.scanPlaceholder')}
            className={`${inputCls} w-full text-base py-2`}
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
              {suggestions.map((p) => (
                <div
                  key={p.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <button
                    onClick={() => void addProduct(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-gray-400">{p.code}</span>
                  </button>
                  {p.unitPacks.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-3 pb-2">
                      {p.unitPacks.map((pack) => (
                        <button
                          key={pack.id}
                          onClick={() => void addProduct(p, pack.id)}
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          {pack.name} ({pack.sellPrice})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-1 w-8">{t('sale.lineNo')}</th>
                <th className="py-1">{t('product.name')}</th>
                <th className="py-1">{t('product.quantity')}</th>
                <th className="py-1">{t('sale.unitPrice')}</th>
                <th className="py-1">{t('sale.lineTotal')}</th>
                <th className="py-1">{t('product.code')}</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((line, i) => (
                <tr key={line.key} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">
                    {line.productName}
                    {line.unitPackName && (
                      <span className="text-gray-400 text-xs"> ({line.unitPackName})</span>
                    )}
                  </td>
                  <td className="py-1">
                    <input
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                      className={`${inputCls} w-20`}
                    />
                  </td>
                  <td className="py-1">
                    <input
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      className={`${inputCls} w-24`}
                    />
                  </td>
                  <td className="py-1">
                    <input
                      value={lineTotalOf(line).toFixed(2)}
                      onChange={(e) => setLineTotal(line.key, e.target.value)}
                      className={`${inputCls} w-24`}
                    />
                  </td>
                  <td className="py-1 text-gray-400">{line.productCode}</td>
                  <td className="py-1">
                    <button
                      onClick={() => removeLine(line.key)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      {t('sale.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 px-4 py-2 text-sm space-y-1">
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        {lastReceipt && (
          <div className="mb-4 rounded bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 px-4 py-2 text-sm flex items-center justify-between">
            <span>
              {t('sale.lastReceipt')} #{lastReceipt.receiptNo} — {t('sale.total')}:{' '}
              {lastReceipt.total}
              {!lastReceipt.printed && ` — ${t('sale.printFailed')}`}
            </span>
            <button
              onClick={() => void openFakturPdf(lastReceipt.receiptNo)}
              className="underline text-xs"
            >
              {t('sale.printFaktur')}
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="flex gap-4 mb-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={skipStockCheck}
                onChange={(e) => setSkipStockCheck(e.target.checked)}
              />
              {t('sale.skipStockCheck')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowBelowCost}
                onChange={(e) => setAllowBelowCost(e.target.checked)}
              />
              {t('sale.allowBelowCost')}
            </label>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-semibold mb-3">
            {t('sale.total')}: {total.toFixed(2)}
          </div>
          <label className="block text-sm mb-1">{t('sale.cash')}</label>
          <input
            value={paidCash}
            onChange={(e) => setPaidCash(e.target.value)}
            className={`${inputCls} w-full mb-3`}
          />
          <label className="block text-sm mb-1">{t('sale.card')}</label>
          <input
            value={paidCard}
            onChange={(e) => setPaidCard(e.target.value)}
            className={`${inputCls} w-full mb-3`}
          />
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {displayDiscount > 0
              ? `${t('sale.discountLabel')}: ${displayDiscount.toFixed(2)} (${((displayDiscount / total) * 100 || 0).toFixed(2)}%)`
              : `${t('sale.change')}: ${displayChange.toFixed(2)}`}
          </div>
        </div>

        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || cart.length === 0}
          className={`${primaryBtnCls} w-full`}
        >
          {t('sale.finishSale')}
        </button>
        <button onClick={() => setCart([])} className={`${secondaryBtnCls} w-full`}>
          {t('sale.clearCart')}
        </button>
        <PriceCheckLauncher onPick={setPriceCheckProduct} />
      </div>

      {priceCheckProduct && (
        <PriceCheckModal product={priceCheckProduct} onClose={() => setPriceCheckProduct(null)} />
      )}
    </div>
  );
}

function PriceCheckLauncher({ onPick }: { onPick: (p: ProductSummary) => void }) {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useQuery({
    queryKey: ['pos-price-check-search', term],
    queryFn: () => listProducts(term) as Promise<ProductSummary[]>,
    enabled: open && term.length > 0,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <button onClick={() => setOpen((o) => !o)} className={`${secondaryBtnCls} w-full`}>
        {t('sale.priceCheck')}
      </button>
      {open && (
        <div className="mt-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('product.searchPlaceholder')}
            className={`${inputCls} w-full mb-2`}
          />
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onPick(p);
                setOpen(false);
                setTerm('');
              }}
              className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {p.name} ({p.code})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceCheckModal({ product, onClose }: { product: ProductSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['price-check', product.id],
    queryFn: () => priceCheck(product.id),
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-3">{t('sale.priceCheck')}</h2>
        <div className="space-y-1 text-sm">
          <div>
            {t('product.name')}: {product.name}
          </div>
          <div>
            {t('product.code')}: {product.code}
          </div>
          {data && (
            <>
              <div>
                {t('product.remaining')}: {data.remaining}
              </div>
              <div>
                {t('product.sellPrice')}: {data.currentSellPrice ?? '—'}
              </div>
              <div>
                {t('cash.balance')}: {data.cashBalance}
              </div>
            </>
          )}
        </div>
        <button onClick={onClose} className={`${secondaryBtnCls} w-full mt-4`}>
          {t('app.close')}
        </button>
      </div>
    </div>
  );
}
