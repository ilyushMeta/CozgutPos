import { describe, it, expect, vi } from 'vitest';
import { DiscountsService } from './discounts.service.js';

function makePrisma() {
  const rows: Record<string, any> = {};
  return {
    paymentDiscount: {
      findMany: vi.fn(async () => Object.values(rows)),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        rows[where.method] = rows[where.method] ? { ...rows[where.method], ...update } : create;
        return rows[where.method];
      }),
    },
  } as any;
}

describe('DiscountsService (SPEC §5.11)', () => {
  it('upsert() creates a row for a method with no existing discount', async () => {
    const prisma = makePrisma();
    const svc = new DiscountsService(prisma);
    const row = await svc.upsert('CASH', 5);
    expect(row).toMatchObject({ method: 'CASH', percent: '5.00' });
  });

  it('upsert() updates the existing row for that method rather than duplicating', async () => {
    const prisma = makePrisma();
    const svc = new DiscountsService(prisma);
    await svc.upsert('CARD', 2);
    const updated = await svc.upsert('CARD', 3.5);
    expect(updated.percent).toBe('3.50');
    expect(await svc.findAll()).toHaveLength(1);
  });
});
