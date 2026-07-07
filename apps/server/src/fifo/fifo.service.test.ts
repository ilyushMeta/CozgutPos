import { describe, it, expect, vi } from 'vitest';
import { FifoService } from './fifo.service.js';
import { FifoInsufficientStockException } from './fifo.exceptions.js';

function makeTx(orderedBatches: { id: number; qtyRemaining: string; buyPrice: string }[]) {
  const state = new Map(orderedBatches.map((b) => [b.id, { ...b }]));
  return {
    $queryRaw: vi.fn(async () => orderedBatches.map((b) => ({ ...state.get(b.id)! }))),
    stockBatch: {
      update: vi.fn(async ({ where, data }: any) => {
        const b = state.get(where.id)!;
        b.qtyRemaining = data.qtyRemaining;
        return b;
      }),
    },
    _state: state,
  } as any;
}

describe('FifoService.deduct (SPEC §6.2)', () => {
  it('consumes a single batch fully covering the request', async () => {
    const tx = makeTx([{ id: 1, qtyRemaining: '10', buyPrice: '5.00' }]);
    const svc = new FifoService();
    const result = await svc.deduct(tx, 1, 4);

    expect(result.breakdown).toEqual([{ batchId: 1, qty: '4.000', buyPrice: '5.00' }]);
    expect(result.cogs.toFixed(2)).toBe('20.00'); // 4 * 5.00
    expect(tx._state.get(1).qtyRemaining).toBe('6.000');
  });

  it('spans multiple batches, oldest first (FIFO), and sums per-batch COGS', async () => {
    const tx = makeTx([
      { id: 1, qtyRemaining: '3', buyPrice: '2.00' },
      { id: 2, qtyRemaining: '10', buyPrice: '3.00' },
    ]);
    const svc = new FifoService();
    const result = await svc.deduct(tx, 1, 5);

    expect(result.breakdown).toEqual([
      { batchId: 1, qty: '3.000', buyPrice: '2.00' },
      { batchId: 2, qty: '2.000', buyPrice: '3.00' },
    ]);
    expect(result.cogs.toFixed(2)).toBe('12.00'); // 3*2 + 2*3
    expect(tx._state.get(1).qtyRemaining).toBe('0.000');
    expect(tx._state.get(2).qtyRemaining).toBe('8.000');
  });

  it('honors LIFO ordering when the batches are pre-sorted newest-first', async () => {
    // The SQL ORDER BY direction is what actually sorts newest-first for LIFO;
    // here we simulate that result and verify the consumption walks it in order.
    const tx = makeTx([
      { id: 2, qtyRemaining: '10', buyPrice: '3.00' },
      { id: 1, qtyRemaining: '3', buyPrice: '2.00' },
    ]);
    const svc = new FifoService();
    const result = await svc.deduct(tx, 1, 4, 'lifo');

    expect(result.breakdown).toEqual([{ batchId: 2, qty: '4.000', buyPrice: '3.00' }]);
    expect(result.cogs.toFixed(2)).toBe('12.00');
  });

  it('throws FifoInsufficientStockException with the exact shortfall when stock runs out', async () => {
    const tx = makeTx([{ id: 1, qtyRemaining: '3', buyPrice: '2.00' }]);
    const svc = new FifoService();

    await expect(svc.deduct(tx, 42, 5)).rejects.toMatchObject({
      productId: 42,
      shortfall: '2.000',
    });
    await expect(
      svc.deduct(makeTx([{ id: 1, qtyRemaining: '3', buyPrice: '2.00' }]), 42, 5),
    ).rejects.toBeInstanceOf(FifoInsufficientStockException);
  });

  it('never deducts more than a batch has (no negative qtyRemaining)', async () => {
    const tx = makeTx([
      { id: 1, qtyRemaining: '2', buyPrice: '1.00' },
      { id: 2, qtyRemaining: '2', buyPrice: '1.00' },
    ]);
    const svc = new FifoService();
    await svc.deduct(tx, 1, 4);

    expect(Number(tx._state.get(1).qtyRemaining)).toBeGreaterThanOrEqual(0);
    expect(Number(tx._state.get(2).qtyRemaining)).toBeGreaterThanOrEqual(0);
  });
});
