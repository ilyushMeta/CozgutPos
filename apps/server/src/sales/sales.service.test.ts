import { describe, it, expect, vi } from 'vitest';
import { qty, dec } from '@cozgut/shared';
import { SalesService } from './sales.service.js';
import { FifoInsufficientStockException } from '../fifo/fifo.exceptions.js';

function makeResolvedLine(overrides: Partial<any> = {}) {
  return {
    productId: 1,
    productName: 'Çörek',
    categoryName: 'Azyk',
    qty: qty(2),
    unitPackId: null,
    unitPrice: '5.00',
    baseQty: qty(2),
    totalRemaining: qty(10),
    costBasis: dec('3.00'),
    ...overrides,
  };
}

function makeDeps({
  resolvedLines = [makeResolvedLine()],
  paymentDiscounts = [] as { method: string; percent: string }[],
  exchangeRate = null as null | { rate: string },
  fifoResult = { breakdown: [{ batchId: 1, qty: '2.000', buyPrice: '2.00' }], cogs: dec('4.00') },
  costingMethod = 'fifo',
}: any = {}) {
  const created: any = { sale: null, lines: [] as any[], cashMoves: [] as any[] };

  const tx = {
    paymentDiscount: { findMany: vi.fn(async () => paymentDiscounts) },
    exchangeRate: { findFirst: vi.fn(async () => exchangeRate) },
    sale: {
      create: vi.fn(async ({ data }: any) => {
        created.sale = { id: 1, ...data };
        return created.sale;
      }),
    },
    saleLine: {
      createMany: vi.fn(async ({ data }: any) => {
        created.lines = data;
        return { count: data.length };
      }),
    },
  };

  const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
  const validation = { validate: vi.fn(async () => resolvedLines) };
  const fifo = { deduct: vi.fn(async () => fifoResult) };
  const cash = {
    recordMove: vi.fn(async (type: string, amount: any, note: string) => {
      created.cashMoves.push({ type, amount: String(amount), note });
    }),
  };
  const codes = { next: vi.fn(async () => 101) };
  const settings = { get: vi.fn(async () => costingMethod) };
  const printing = {
    printReceipt: vi.fn(async () => ({ printed: false, reason: 'printer not configured' })),
  };

  return { prisma, validation, fifo, cash, codes, settings, printing, created, tx };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new SalesService(
    deps.prisma as any,
    deps.validation as any,
    deps.fifo as any,
    deps.cash as any,
    deps.codes as any,
    deps.settings as any,
    deps.printing as any,
  );
}

describe('SalesService.createSale (SPEC §6.3/§6.4/§6.10)', () => {
  it('computes a straightforward cash sale: total, cogs, no change/discount when exact', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const result = await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 10, paidCard: 0 } as any,
      7,
    );

    expect(result.total).toBe('10.00'); // 2 * 5.00
    expect(result.cogsTotal).toBe('4.00');
    expect(result.changeGiven).toBe('0.00');
    expect(result.discount).toBe('0.00');
  });

  it('gives change when cash exceeds the total', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const result = await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 15, paidCard: 0 } as any,
      7,
    );

    expect(result.changeGiven).toBe('5.00');
    expect(result.discount).toBe('0.00');
  });

  it('treats a shortfall as a discount, not negative change (SPEC §6.10)', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const result = await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 8, paidCard: 0 } as any,
      7,
    );

    expect(result.discount).toBe('2.00');
    expect(result.changeGiven).toBe('0.00');
  });

  it('records a cash move for cash paid minus change, not the raw cash handed over', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 15, paidCard: 0 } as any,
      7,
    );

    expect(deps.created.cashMoves).toEqual([
      { type: 'SALE_CASH', amount: '10', note: 'Söwda #101' }, // 15 paid - 5 change
    ]);
  });

  it('does not record a cash move for a card-only sale', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 0, paidCard: 10 } as any,
      7,
    );

    expect(deps.created.cashMoves).toHaveLength(0);
  });

  it('blends PaymentDiscount proportionally by cash/card share and applies it before change', async () => {
    // total=10, half cash / half card, cash discount 10%, card discount 0% -> blended 5%
    // effectiveTotal = 10 * 0.95 = 9.50; due = 9.50 - 5(card) = 4.50; change = 5(cash) - 4.50 = 0.50
    const deps = makeDeps({
      paymentDiscounts: [
        { method: 'CASH', percent: '10' },
        { method: 'CARD', percent: '0' },
      ],
    });
    const svc = makeService(deps);
    const result = await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 5, paidCard: 5 } as any,
      7,
    );

    expect(result.effectiveTotal).toBe('9.50');
    expect(result.changeGiven).toBe('0.50');
  });

  it('sums qty*unitPrice per line into total, independent of FIFO-deducted base qty (unit packs)', async () => {
    const packLine = makeResolvedLine({
      qty: qty(2),
      unitPrice: '20.00',
      baseQty: qty(10),
      unitPackId: 9,
    });
    const deps = makeDeps({
      resolvedLines: [packLine],
      fifoResult: {
        breakdown: [{ batchId: 1, qty: '10.000', buyPrice: '3.00' }],
        cogs: dec('30.00'),
      },
    });
    const svc = makeService(deps);
    const result = await svc.createSale(
      {
        lines: [{ productId: 1, qty: 2, unitPackId: 9, unitPrice: 20 }],
        paidCash: 40,
        paidCard: 0,
      } as any,
      7,
    );

    expect(result.total).toBe('40.00'); // 2 packs * 20.00, NOT 10 * 20
    expect(deps.fifo.deduct).toHaveBeenCalledWith(deps.tx, 1, packLine.baseQty, 'fifo');
    expect(result.lines[0].qty).toBe('2.000'); // stored qty is the entered pack count
  });

  it('sums COGS and totals across multiple lines', async () => {
    const lines = [
      makeResolvedLine({ productId: 1 }),
      makeResolvedLine({ productId: 2, unitPrice: '7.00' }),
    ];
    const deps = makeDeps({ resolvedLines: lines });
    const svc = makeService(deps);
    const result = await svc.createSale(
      {
        lines: [
          { productId: 1, qty: 2, unitPrice: 5 },
          { productId: 2, qty: 2, unitPrice: 7 },
        ],
        paidCash: 24,
        paidCard: 0,
      } as any,
      7,
    );

    expect(result.total).toBe('24.00'); // 2*5 + 2*7
    expect(result.cogsTotal).toBe('8.00'); // 4.00 + 4.00 from the shared fifoResult mock
  });

  it('maps a mid-transaction FIFO race (insufficient stock) to a structured 400', async () => {
    const deps = makeDeps();
    deps.fifo.deduct = vi.fn(async () => {
      throw new FifoInsufficientStockException(1, '1.000');
    });
    const svc = makeService(deps);

    await expect(
      svc.createSale(
        { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paidCash: 10, paidCard: 0 } as any,
        7,
      ),
    ).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_STOCK', shortages: [{ productId: 1, shortfall: '1.000' }] },
    });
  });
});
