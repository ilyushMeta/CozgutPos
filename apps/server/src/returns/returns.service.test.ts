import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { dec } from '@cozgut/shared';
import { ReturnsService } from './returns.service.js';

function makeLine(overrides: Partial<any> = {}) {
  return {
    id: 1,
    saleId: 10,
    qty: '4.000',
    unitPrice: '5.00',
    lineTotal: '20.00',
    cogs: '12.00',
    batchBreakdown: [
      { batchId: 100, qty: '2.000', buyPrice: '3.00' },
      { batchId: 200, qty: '2.000', buyPrice: '3.00' },
    ],
    ...overrides,
  };
}

function makeDeps({
  line = makeLine(),
  alreadyReturned = 0,
  sale = { id: 10, total: '20.00', cogsTotal: '12.00' },
  batches = { 100: { id: 100, qtyRemaining: '0.000' }, 200: { id: 200, qtyRemaining: '5.000' } },
}: any = {}) {
  const created: any = {
    returns: [] as any[],
    batchUpdates: [] as any[],
    saleUpdates: [] as any[],
  };

  const tx = {
    saleLine: { findUnique: vi.fn(async () => line) },
    return: {
      aggregate: vi.fn(async () => ({ _sum: { qty: alreadyReturned || null } })),
      create: vi.fn(async ({ data }: any) => {
        created.returns.push(data);
        return { id: created.returns.length, ...data };
      }),
    },
    stockBatch: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => batches[where.id]),
      update: vi.fn(async ({ where, data }: any) => {
        created.batchUpdates.push({ id: where.id, ...data });
        batches[where.id] = { ...batches[where.id], ...data };
        return batches[where.id];
      }),
    },
    sale: {
      findUniqueOrThrow: vi.fn(async () => sale),
      update: vi.fn(async ({ data }: any) => {
        created.saleUpdates.push(data);
        return { ...sale, ...data };
      }),
    },
  };

  const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
  return { prisma, tx, created };
}

describe('ReturnsService.createReturn (SPEC §6.12)', () => {
  it('restocks a single-batch line and reverses revenue/cogs proportionally', async () => {
    const deps = makeDeps({
      line: makeLine({
        qty: '4.000',
        unitPrice: '5.00',
        cogs: '12.00',
        batchBreakdown: [{ batchId: 100, qty: '4.000', buyPrice: '3.00' }],
      }),
      batches: { 100: { id: 100, qtyRemaining: '0.000' } },
    });
    const svc = new ReturnsService(deps.prisma as any);

    const result = await svc.createReturn(1, 2);

    expect(result.revenueReversal).toBe('10.00'); // 2 * 5.00
    expect(result.cogsReversal).toBe('6.00'); // 2 * 3.00
    expect(deps.created.batchUpdates).toEqual([{ id: 100, qtyRemaining: '2.000' }]);
    expect(deps.created.saleUpdates).toEqual([{ total: '10.00', cogsTotal: '6.00' }]);
  });

  it('splits the restock across multiple original batches, in consumption order', async () => {
    const deps = makeDeps(); // batchBreakdown: 100(2.000)+200(2.000), returning 3
    const svc = new ReturnsService(deps.prisma as any);

    const result = await svc.createReturn(1, 3);

    expect(deps.created.returns).toHaveLength(2);
    expect(deps.created.returns[0]).toMatchObject({ restockedBatchId: 100, qty: '2.000' });
    expect(deps.created.returns[1]).toMatchObject({ restockedBatchId: 200, qty: '1.000' });
    // exact per-batch cogs (2*3.00 + 1*3.00), revenue split with rounding remainder on last chunk
    expect(result.revenueReversal).toBe('15.00'); // 3 * 5.00
    expect(result.cogsReversal).toBe('9.00'); // 2*3 + 1*3
  });

  it('rejects a return quantity greater than what remains (sold minus already returned)', async () => {
    const deps = makeDeps({ alreadyReturned: 1 }); // line qty=4, already returned 1 -> remaining 3
    const svc = new ReturnsService(deps.prisma as any);

    await expect(svc.createReturn(1, 3.5)).rejects.toMatchObject({
      response: { code: 'INVALID_RETURN_QTY', remaining: '3.000' },
    });
  });

  it('rejects a zero or negative return quantity', async () => {
    const deps = makeDeps();
    const svc = new ReturnsService(deps.prisma as any);
    await expect(svc.createReturn(1, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when the sale line does not exist', async () => {
    const deps = makeDeps({ line: null });
    const svc = new ReturnsService(deps.prisma as any);
    await expect(svc.createReturn(999, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accounts for previously returned qty when computing the remaining allowance', async () => {
    const deps = makeDeps({ alreadyReturned: 2 }); // line qty=4, remaining=2
    const svc = new ReturnsService(deps.prisma as any);
    await expect(svc.createReturn(1, 2)).resolves.toBeDefined();
    await expect(svc.createReturn(1, 2.001)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restocks each ingredient batch for a composite/Önüm line (SPEC §6.6)', async () => {
    // Composite line qty=3: ingredient A consumed 6 (2 per unit) from one batch,
    // ingredient B consumed 3 (1 per unit) from one batch. Returning 1 unit
    // should restock 2 of A and 1 of B.
    const deps = makeDeps({
      line: makeLine({
        qty: '3.000',
        unitPrice: '20.00',
        batchBreakdown: {
          composite: true,
          ingredients: [
            {
              ingredientProductId: 1,
              breakdown: [{ batchId: 300, qty: '6.000', buyPrice: '3.00' }],
            },
            {
              ingredientProductId: 2,
              breakdown: [{ batchId: 400, qty: '3.000', buyPrice: '4.00' }],
            },
          ],
        },
      }),
      sale: { id: 10, total: '60.00', cogsTotal: '30.00' },
      batches: {
        300: { id: 300, qtyRemaining: '10.000' },
        400: { id: 400, qtyRemaining: '5.000' },
      },
    });
    const svc = new ReturnsService(deps.prisma as any);

    const result = await svc.createReturn(1, 1);

    expect(deps.created.returns).toHaveLength(2);
    expect(deps.created.returns[0]).toMatchObject({ restockedBatchId: 300, qty: '2.000' });
    expect(deps.created.returns[1]).toMatchObject({ restockedBatchId: 400, qty: '1.000' });
    expect(deps.created.batchUpdates).toEqual([
      { id: 300, qtyRemaining: '12.000' },
      { id: 400, qtyRemaining: '6.000' },
    ]);
    expect(result.revenueReversal).toBe('20.00'); // 1 * 20.00
    expect(result.cogsReversal).toBe('10.00'); // 2*3.00 + 1*4.00
  });

  it("converts a composite line's already-returned ingredient qty back to composite units", async () => {
    // Same composite line as above (qty=3, ratio 9:3=3), but 3.000 ingredient
    // qty was already restocked by a prior return of 1 composite unit — the
    // remaining allowance must read as 2 (composite units), not 3 or 0.
    const compositeLine = () =>
      makeLine({
        qty: '3.000',
        unitPrice: '20.00',
        batchBreakdown: {
          composite: true,
          ingredients: [
            {
              ingredientProductId: 1,
              breakdown: [{ batchId: 300, qty: '6.000', buyPrice: '3.00' }],
            },
            {
              ingredientProductId: 2,
              breakdown: [{ batchId: 400, qty: '3.000', buyPrice: '4.00' }],
            },
          ],
        },
      });
    const batches = () => ({
      300: { id: 300, qtyRemaining: '12.000' },
      400: { id: 400, qtyRemaining: '6.000' },
    });

    const withinAllowance = makeDeps({
      line: compositeLine(),
      alreadyReturned: 3, // 2 (ingredient A) + 1 (ingredient B) from a prior 1-unit return
      sale: { id: 10, total: '40.00', cogsTotal: '20.00' },
      batches: batches(),
    });
    await expect(
      new ReturnsService(withinAllowance.prisma as any).createReturn(1, 2),
    ).resolves.toBeDefined();

    const overAllowance = makeDeps({
      line: compositeLine(),
      alreadyReturned: 3,
      sale: { id: 10, total: '40.00', cogsTotal: '20.00' },
      batches: batches(),
    });
    await expect(
      new ReturnsService(overAllowance.prisma as any).createReturn(1, 2.001),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_RETURN_QTY', remaining: '2.000' },
    });
  });
});

describe('ReturnsService.search', () => {
  it('computes returnable qty as sold minus already-returned', async () => {
    const prisma = {
      saleLine: {
        findMany: vi.fn(async () => [
          {
            id: 1,
            saleId: 10,
            qty: dec('4.000'),
            unitPrice: dec('5.00'),
            lineTotal: dec('20.00'),
            productNameSnapshot: 'Çörek',
            sale: { receiptNo: 101, datetime: new Date('2026-01-01') },
            product: { code: '1001' },
          },
        ]),
      },
      return: {
        groupBy: vi.fn(async () => [{ saleLineId: 1, _sum: { qty: '1.000' } }]),
      },
    };
    const svc = new ReturnsService(prisma as any);
    const [row] = await svc.search({ receiptNo: 101 });
    expect(row.returnable).toBe('3.000');
  });
});
