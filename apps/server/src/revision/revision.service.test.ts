import { describe, it, expect, vi } from 'vitest';
import { dec } from '@cozgut/shared';
import { RevisionService } from './revision.service.js';

function makeProduct(batches: any[] = []) {
  return { id: 1, batches };
}

function makeDeps({
  product = makeProduct([
    {
      qtyRemaining: dec('10.000'),
      buyPrice: dec('3.00'),
      sellPrice: dec('5.00'),
      receivedAt: new Date('2026-01-01'),
    },
  ]),
  adjustResult = { amount: dec('0.00'), unitPrice: dec('3.00') },
}: any = {}) {
  const created: any = { lines: [] as any[], revisions: [] as any[] };
  const tx = {
    product: { findUniqueOrThrow: vi.fn(async () => product) },
    stockRevision: {
      create: vi.fn(async () => {
        const row = { id: created.revisions.length + 1 };
        created.revisions.push(row);
        return row;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => ({ id: where.id })),
    },
    revisionLine: {
      create: vi.fn(async ({ data }: any) => {
        created.lines.push(data);
        return { id: created.lines.length, ...data };
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    revisionLine: { findMany: vi.fn() },
  };
  const adjust = { applyAdjustment: vi.fn(async () => adjustResult) };
  return { prisma, adjust, created, tx };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new RevisionService(deps.prisma as any, deps.adjust as any);
}

describe('RevisionService.createLine (SPEC §5.9)', () => {
  it('computes system qty from batches and diff against the counted qty', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createLine({ productId: 1, countedQty: 7 } as any);

    expect(deps.created.lines[0]).toMatchObject({
      systemQty: '10.000',
      countedQty: '7.000',
      diff: '-3.000',
      result: 'shortage',
    });
    expect(deps.adjust.applyAdjustment).toHaveBeenCalledWith(
      deps.tx,
      1,
      expect.anything(),
      dec('3.00'),
    );
  });

  it('marks a surplus when counted exceeds system qty', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createLine({ productId: 1, countedQty: 15 } as any);
    expect(deps.created.lines[0]).toMatchObject({ diff: '5.000', result: 'surplus' });
  });

  it('marks a match with zero diff when counted equals system', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createLine({ productId: 1, countedQty: 10 } as any);
    expect(deps.created.lines[0]).toMatchObject({ diff: '0.000', result: 'match' });
  });

  it('creates a new StockRevision when no revisionId is given', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createLine({ productId: 1, countedQty: 10 } as any);
    expect(deps.tx.stockRevision.create).toHaveBeenCalled();
    expect(deps.created.lines[0].revisionId).toBe(1);
  });

  it('reuses an existing StockRevision when revisionId is given ("Ammary boşatmak" flow)', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.createLine({ productId: 1, revisionId: 42, countedQty: 0 } as any);
    expect(deps.tx.stockRevision.create).not.toHaveBeenCalled();
    expect(deps.created.lines[0].revisionId).toBe(42);
  });
});
