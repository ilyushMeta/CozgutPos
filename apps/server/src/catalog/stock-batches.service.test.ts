import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StockBatchesService } from './stock-batches.service.js';

function makePrisma(batch: any) {
  return {
    stockBatch: {
      findUnique: vi.fn(async () => batch),
      update: vi.fn(async ({ data }: any) => ({ ...batch, ...data })),
      delete: vi.fn(async () => batch),
    },
  } as any;
}

describe('StockBatchesService (SPEC §5.4 batch fields)', () => {
  it('updates pricing fields', async () => {
    const prisma = makePrisma({ id: 1, qtyInitial: '10', qtyRemaining: '10' });
    const svc = new StockBatchesService(prisma);
    const updated = await svc.update(1, { buyPrice: 4, sellPrice: 6, currency: 'TMT' as any });
    expect(updated.buyPrice).toBe('4.00');
    expect(updated.sellPrice).toBe('6.00');
  });

  it('404s updating a missing batch', async () => {
    const prisma = makePrisma(null);
    const svc = new StockBatchesService(prisma);
    await expect(
      svc.update(99, { buyPrice: 1, sellPrice: 1, currency: 'TMT' as any }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('guarded delete', () => {
    it('deletes an untouched batch (qtyRemaining === qtyInitial)', async () => {
      const prisma = makePrisma({ id: 1, qtyInitial: '10', qtyRemaining: '10' });
      const svc = new StockBatchesService(prisma);
      await svc.remove(1);
      expect(prisma.stockBatch.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('refuses to delete a batch already sold from', async () => {
      const prisma = makePrisma({ id: 1, qtyInitial: '10', qtyRemaining: '4' });
      const svc = new StockBatchesService(prisma);
      await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
