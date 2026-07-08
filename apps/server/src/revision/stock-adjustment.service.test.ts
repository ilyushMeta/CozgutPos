import { describe, it, expect, vi } from 'vitest';
import { dec } from '@cozgut/shared';
import { StockAdjustmentService } from './stock-adjustment.service.js';

describe('StockAdjustmentService.applyAdjustment (SPEC §5.9)', () => {
  it('is a no-op for a zero diff', async () => {
    const fifo = { deduct: vi.fn() };
    const tx = { stockBatch: { create: vi.fn(), findFirst: vi.fn() } };
    const svc = new StockAdjustmentService(fifo as any);

    const result = await svc.applyAdjustment(tx as any, 1, 0, '5.00');

    expect(result.amount.toFixed(2)).toBe('0.00');
    expect(fifo.deduct).not.toHaveBeenCalled();
    expect(tx.stockBatch.create).not.toHaveBeenCalled();
  });

  it('consumes a shortage oldest-first via FifoService, valuing it at cost', async () => {
    const fifo = {
      deduct: vi.fn(async () => ({
        breakdown: [{ batchId: 1, qty: '3.000', buyPrice: '2.00' }],
        cogs: dec('6.00'),
      })),
    };
    const tx = { stockBatch: { create: vi.fn(), findFirst: vi.fn() } };
    const svc = new StockAdjustmentService(fifo as any);

    const result = await svc.applyAdjustment(tx as any, 1, -3, '5.00');

    expect(fifo.deduct).toHaveBeenCalledWith(tx, 1, expect.anything(), 'fifo');
    expect(result.amount.toFixed(2)).toBe('6.00');
    expect(result.unitPrice.toFixed(2)).toBe('2.00'); // 6.00 / 3
  });

  it('creates a new StockBatch for a surplus, priced at the given hint', async () => {
    const fifo = { deduct: vi.fn() };
    const created: any[] = [];
    const tx = {
      stockBatch: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => {
          created.push(data);
          return { id: 1, ...data };
        }),
      },
    };
    const svc = new StockAdjustmentService(fifo as any);

    const result = await svc.applyAdjustment(tx as any, 1, 5, '4.00');

    expect(created).toEqual([
      expect.objectContaining({
        productId: 1,
        qtyInitial: '5.000',
        qtyRemaining: '5.000',
        buyPrice: '4.00',
        sellPrice: '4.00',
        currency: 'TMT',
      }),
    ]);
    expect(result.amount.toFixed(2)).toBe('20.00'); // 5 * 4.00
    expect(result.unitPrice.toFixed(2)).toBe('4.00');
  });

  it('falls back to the latest batch buyPrice/sellPrice when no hint is given', async () => {
    const fifo = { deduct: vi.fn() };
    const created: any[] = [];
    const tx = {
      stockBatch: {
        findFirst: vi.fn(async () => ({ buyPrice: '3.50', sellPrice: '5.50' })),
        create: vi.fn(async ({ data }: any) => {
          created.push(data);
          return { id: 1, ...data };
        }),
      },
    };
    const svc = new StockAdjustmentService(fifo as any);

    await svc.applyAdjustment(tx as any, 1, 2);

    expect(created[0]).toMatchObject({ buyPrice: '3.50', sellPrice: '5.50' });
  });
});
