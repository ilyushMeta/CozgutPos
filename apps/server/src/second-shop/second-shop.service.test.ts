import { describe, it, expect, vi } from 'vitest';
import { dec } from '@cozgut/shared';
import { SecondShopService } from './second-shop.service.js';
import { FifoInsufficientStockException } from '../fifo/fifo.exceptions.js';

function makeResolvedLine(overrides: Partial<any> = {}) {
  return {
    productId: 1,
    productName: 'Çörek',
    categoryName: 'Azyk',
    qty: dec(2),
    unitPackId: null,
    unitPrice: '5.00',
    baseQty: dec(2),
    totalRemaining: dec(10),
    costBasis: dec('3.00'),
    ...overrides,
  };
}

function makeDeps({
  resolvedLines = [makeResolvedLine()],
  fifoResult = { breakdown: [{ batchId: 1, qty: '2.000', buyPrice: '2.00' }], cogs: dec('4.00') },
}: any = {}) {
  const created: any = { sale: null, lines: [] as any[], cashMoves: [] as any[] };
  const tx = {
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
  const validation = { resolveLines: vi.fn(async () => resolvedLines) };
  const fifo = { deduct: vi.fn(async () => fifoResult) };
  const cash = {
    recordMove: vi.fn(async (type: string, amount: any, note: string) => {
      created.cashMoves.push({ type, amount: String(amount), note });
    }),
  };
  const codes = { next: vi.fn(async () => 501) };
  const settings = { get: vi.fn(async () => 'fifo') };

  return { prisma, validation, fifo, cash, codes, settings, created, tx };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new SecondShopService(
    deps.prisma as any,
    deps.validation as any,
    deps.fifo as any,
    deps.cash as any,
    deps.codes as any,
    deps.settings as any,
  );
}

describe('SecondShopService.createSale (SPEC §5.10/§6.11)', () => {
  it('creates a SECOND-shop Sale with its own receipt sequence', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const result = await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paymentMethod: 'CASH' } as any,
      7,
    );

    expect(deps.codes.next).toHaveBeenCalledWith('receipt-second');
    expect(result.receiptNo).toBe(501);
    expect(result.total).toBe('10.00');
    expect(deps.created.sale.shopId).toBe('SECOND');
  });

  it('records a CashMove for a CASH sale but not for a CARD sale', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paymentMethod: 'CASH' } as any,
      7,
    );
    expect(deps.created.cashMoves).toEqual([
      { type: 'SALE_CASH', amount: '10', note: 'Ikinji dükan #501' },
    ]);

    const deps2 = makeDeps();
    const svc2 = makeService(deps2);
    await svc2.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paymentMethod: 'CARD' } as any,
      7,
    );
    expect(deps2.created.cashMoves).toHaveLength(0);
    expect(deps2.created.sale.paidCard).toBe('10.00');
  });

  it('deducts FIFO from MAIN stock via the shared FifoService', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createSale(
      { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paymentMethod: 'CASH' } as any,
      7,
    );
    expect(deps.fifo.deduct).toHaveBeenCalledWith(deps.tx, 1, dec(2), 'fifo');
  });

  it('rejects an empty cart', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await expect(
      svc.createSale({ lines: [], paymentMethod: 'CASH' } as any, 7),
    ).rejects.toMatchObject({
      response: { code: 'EMPTY_CART' },
    });
  });

  it('maps insufficient stock to a structured 400', async () => {
    const deps = makeDeps();
    deps.fifo.deduct = vi.fn(async () => {
      throw new FifoInsufficientStockException(1, '1.000');
    });
    const svc = makeService(deps);
    await expect(
      svc.createSale(
        { lines: [{ productId: 1, qty: 2, unitPrice: 5 }], paymentMethod: 'CASH' } as any,
        7,
      ),
    ).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_STOCK', shortages: [{ productId: 1, shortfall: '1.000' }] },
    });
  });
});
