import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { dec } from '@cozgut/shared';
import { StocktakeService } from './stocktake.service.js';

function makeProduct(id: number, batches: any[] = []) {
  return { id, batches };
}

function makeDeps({
  stocktake = { id: 1, status: 'OPEN', lines: [] as any[] },
  products = {
    1: makeProduct(1, [
      {
        qtyRemaining: dec('10.000'),
        buyPrice: dec('3.00'),
        sellPrice: dec('5.00'),
        receivedAt: new Date('2026-01-01'),
      },
    ]),
  } as Record<number, any>,
  existingLine = null as any,
}: any = {}) {
  const created: any = {
    lines: [] as any[],
    revisionLines: [] as any[],
    statusUpdates: [] as any[],
  };

  const tx = {
    stocktake: {
      findUniqueOrThrow: vi.fn(async () => stocktake),
      update: vi.fn(async ({ data }: any) => {
        created.statusUpdates.push(data);
        return { ...stocktake, ...data };
      }),
    },
    product: { findUniqueOrThrow: vi.fn(async ({ where }: any) => products[where.id]) },
    stockRevision: { create: vi.fn(async ({ data }: any) => ({ id: 99, ...data })) },
    revisionLine: {
      create: vi.fn(async ({ data }: any) => {
        created.revisionLines.push(data);
        return { id: created.revisionLines.length, ...data };
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    stocktake: {
      create: vi.fn(async () => ({ id: 1, status: 'OPEN' })),
      findUniqueOrThrow: vi.fn(async () => stocktake),
    },
    product: { findUniqueOrThrow: vi.fn(async ({ where }: any) => products[where.id]) },
    stocktakeLine: {
      findFirst: vi.fn(async () => existingLine),
      create: vi.fn(async ({ data }: any) => {
        created.lines.push(data);
        return { id: created.lines.length, ...data };
      }),
      update: vi.fn(async ({ data }: any) => {
        created.lines.push(data);
        return { id: 1, ...data };
      }),
    },
  };

  const adjust = {
    applyAdjustment: vi.fn(async () => ({ amount: dec('15.00'), unitPrice: dec('3.00') })),
  };
  return { prisma, adjust, created, tx };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new StocktakeService(deps.prisma as any, deps.adjust as any);
}

describe('StocktakeService.scan (SPEC §5.9)', () => {
  it('records systemQty/diff for a new line', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.scan(1, 1, 7);
    expect(deps.created.lines[0]).toMatchObject({
      systemQty: '10.000',
      countedQty: '7.000',
      diff: '-3.000',
    });
  });

  it('updates an existing line on a re-scan of the same product', async () => {
    const deps = makeDeps({ existingLine: { id: 5 } });
    const svc = makeService(deps);
    await svc.scan(1, 1, 12);
    expect(deps.prisma.stocktakeLine.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } }),
    );
  });

  it('rejects scanning into an already-finished session', async () => {
    const deps = makeDeps({ stocktake: { id: 1, status: 'FINISHED' } });
    const svc = makeService(deps);
    await expect(svc.scan(1, 1, 5)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('StocktakeService.finish (SPEC §5.9)', () => {
  it('applies adjustments only for lines with a nonzero diff, and marks the session FINISHED', async () => {
    const deps = makeDeps({
      stocktake: {
        id: 1,
        status: 'OPEN',
        lines: [
          { productId: 1, systemQty: '10.000', countedQty: '7.000', diff: '-3.000' },
          { productId: 1, systemQty: '5.000', countedQty: '5.000', diff: '0.000' },
        ],
      },
    });
    const svc = makeService(deps);
    await svc.finish(1);

    expect(deps.adjust.applyAdjustment).toHaveBeenCalledTimes(1); // skips the zero-diff line
    expect(deps.created.revisionLines).toHaveLength(1);
    expect(deps.created.revisionLines[0]).toMatchObject({ result: 'shortage', diff: '-3.000' });
    expect(deps.created.statusUpdates[0]).toMatchObject({ status: 'FINISHED' });
  });

  it('rejects finishing an already-finished session', async () => {
    const deps = makeDeps({ stocktake: { id: 1, status: 'FINISHED', lines: [] } });
    const svc = makeService(deps);
    await expect(svc.finish(1)).rejects.toBeInstanceOf(BadRequestException);
  });
});
