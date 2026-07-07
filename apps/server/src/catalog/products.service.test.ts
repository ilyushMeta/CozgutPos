import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';

function makePrisma({
  product,
  batchCount = 0,
  saleLineCount = 0,
}: {
  product: any;
  batchCount?: number;
  saleLineCount?: number;
}) {
  return {
    product: {
      findUnique: vi.fn(async () => product),
      create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
      delete: vi.fn(async () => product),
    },
    stockBatch: { count: vi.fn(async () => batchCount) },
    saleLine: { count: vi.fn(async () => saleLineCount) },
  } as any;
}

function makeCodes(nextCode = '3005') {
  return { generateUniqueProductCode: vi.fn(async () => nextCode) } as any;
}

function makePlu() {
  return { exportSafely: vi.fn(async () => undefined) } as any;
}

describe('ProductsService', () => {
  it('auto-generates a code when none is supplied', async () => {
    const prisma = makePrisma({ product: null });
    const codes = makeCodes('3005');
    const svc = new ProductsService(prisma, codes, makePlu());
    const created = await svc.create({ name: 'Täze haryt' } as any);
    expect(codes.generateUniqueProductCode).toHaveBeenCalled();
    expect(created.code).toBe('3005');
  });

  it('uses the manually supplied code without generating one', async () => {
    const prisma = makePrisma({ product: null });
    const codes = makeCodes();
    const svc = new ProductsService(prisma, codes, makePlu());
    const created = await svc.create({ name: 'Barkod haryt', code: '4600123456789' } as any);
    expect(codes.generateUniqueProductCode).not.toHaveBeenCalled();
    expect(created.code).toBe('4600123456789');
  });

  describe('PLU re-export on scale-item save (SPEC §7.3)', () => {
    it('triggers PLU export when the saved product is a scale item', async () => {
      const prisma = makePrisma({ product: null });
      const plu = makePlu();
      const svc = new ProductsService(prisma, makeCodes(), plu);
      await svc.create({ name: 'Terezi haryt', isScaleItem: true } as any);
      expect(plu.exportSafely).toHaveBeenCalledTimes(1);
    });

    it('does not trigger PLU export for a non-scale-item product', async () => {
      const prisma = makePrisma({ product: null });
      const plu = makePlu();
      const svc = new ProductsService(prisma, makeCodes(), plu);
      await svc.create({ name: 'Adaty haryt' } as any);
      expect(plu.exportSafely).not.toHaveBeenCalled();
    });
  });

  describe('guarded delete (SPEC §5.4)', () => {
    it('deletes a product with no batches or sales', async () => {
      const prisma = makePrisma({ product: { id: 1 }, batchCount: 0, saleLineCount: 0 });
      const svc = new ProductsService(prisma, makeCodes(), makePlu());
      await svc.remove(1);
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('refuses to delete a product with stock batches', async () => {
      const prisma = makePrisma({ product: { id: 1 }, batchCount: 2 });
      const svc = new ProductsService(prisma, makeCodes(), makePlu());
      await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to delete a product with sales history', async () => {
      const prisma = makePrisma({ product: { id: 1 }, saleLineCount: 5 });
      const svc = new ProductsService(prisma, makeCodes(), makePlu());
      await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s on a missing product', async () => {
      const prisma = makePrisma({ product: null });
      const svc = new ProductsService(prisma, makeCodes(), makePlu());
      await expect(svc.remove(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
