import { describe, it, expect, vi } from 'vitest';
import { StockViewsService } from './stock-views.service.js';

function batch(qtyRemaining: string) {
  return { qtyRemaining };
}

const PRODUCTS = [
  { id: 1, name: 'Gutaran haryt', code: '1', lowStockThreshold: '10', batches: [batch('0')] },
  {
    id: 2,
    name: 'Azalan haryt (serhet)',
    code: '2',
    lowStockThreshold: '10',
    batches: [batch('10')], // exactly at threshold → low-stock (inclusive)
  },
  {
    id: 3,
    name: 'Köp haryt',
    code: '3',
    lowStockThreshold: '10',
    batches: [batch('5'), batch('20')], // 25 total → above threshold
  },
  {
    id: 4,
    name: 'Iki partiýa gutaran',
    code: '4',
    lowStockThreshold: '5',
    batches: [batch('0'), batch('0')],
  },
];

function makePrisma(expiringMatches: any[] = []) {
  return {
    product: {
      findMany: vi.fn(async (args: any) => {
        if (args?.where?.expiryDate) return expiringMatches;
        return PRODUCTS;
      }),
    },
    stockBatch: { findMany: vi.fn() },
  } as any;
}

describe('StockViewsService (SPEC §5.4)', () => {
  it('out-of-stock: products whose total remaining is exactly zero', async () => {
    const svc = new StockViewsService(makePrisma());
    const result = await svc.outOfStock();
    expect(result.map((p) => p.id)).toEqual([1, 4]);
  });

  it('low-stock: 0 < remaining <= threshold, boundary inclusive', async () => {
    const svc = new StockViewsService(makePrisma());
    const result = await svc.lowStock();
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it('does not classify a healthy-stock product as low or out', async () => {
    const svc = new StockViewsService(makePrisma());
    const out = await svc.outOfStock();
    const low = await svc.lowStock();
    expect(out.find((p) => p.id === 3)).toBeUndefined();
    expect(low.find((p) => p.id === 3)).toBeUndefined();
  });

  it('expiring-soon delegates the date/category filter to the query', async () => {
    const expiring = [{ id: 5, name: 'Möhleti gutarýan', expiryDate: new Date() }];
    const prisma = makePrisma(expiring);
    const svc = new StockViewsService(prisma);
    const result = await svc.expiringSoon(30, 2);
    expect(result).toBe(expiring);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 2 }),
      }),
    );
  });
});
