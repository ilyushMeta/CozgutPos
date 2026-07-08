import { describe, it, expect, vi } from 'vitest';
import { CodesService } from './codes.service.js';

/** In-memory Prisma stub mirroring the real atomic-increment semantics. */
function makePrisma(
  initial: Record<string, number> = {},
  existingCodes: string[] = [],
  existingDebtorCodes: string[] = [],
  existingSupplierCodes: string[] = [],
) {
  const seqs = { ...initial };
  const products = new Set(existingCodes);
  const debtors = new Set(existingDebtorCodes);
  const suppliers = new Set(existingSupplierCodes);
  return {
    codeSequence: {
      upsert: vi.fn(async ({ where, create }: any) => {
        if (!(where.pool in seqs)) seqs[where.pool] = create.next;
        return { pool: where.pool, next: seqs[where.pool] };
      }),
      update: vi.fn(async ({ where }: any) => {
        seqs[where.pool] += 1;
        return { pool: where.pool, next: seqs[where.pool] };
      }),
    },
    product: {
      findUnique: vi.fn(async ({ where }: any) =>
        products.has(where.code) ? { id: 1, code: where.code } : null,
      ),
    },
    customer: {
      findUnique: vi.fn(async ({ where }: any) =>
        debtors.has(where.code) ? { id: 1, code: where.code } : null,
      ),
    },
    supplier: {
      findUnique: vi.fn(async ({ where }: any) =>
        suppliers.has(where.code) ? { id: 1, code: where.code } : null,
      ),
    },
  } as any;
}

describe('CodesService (SPEC §6.9)', () => {
  it('returns sequential values starting at the seeded next', async () => {
    const prisma = makePrisma({ product: 3000 });
    const svc = new CodesService(prisma);
    expect(await svc.next('product')).toBe(3000);
    expect(await svc.next('product')).toBe(3001);
    expect(await svc.next('product')).toBe(3002);
  });

  it('creates the sequence row on first use for an unseeded pool', async () => {
    const prisma = makePrisma({});
    const svc = new CodesService(prisma);
    expect(await svc.next('invoice')).toBe(1);
    expect(await svc.next('invoice')).toBe(2);
  });

  it('keeps pools independent', async () => {
    const prisma = makePrisma({ product: 3000, supplier: 1 });
    const svc = new CodesService(prisma);
    expect(await svc.next('supplier')).toBe(1);
    expect(await svc.next('product')).toBe(3000);
    expect(await svc.next('supplier')).toBe(2);
  });

  it('generateUniqueProductCode skips codes already taken (never reuse)', async () => {
    const prisma = makePrisma({ product: 3000 }, ['3000', '3001']);
    const svc = new CodesService(prisma);
    const code = await svc.generateUniqueProductCode();
    expect(code).toBe('3002');
  });

  it('generateUniqueDebtorCode skips codes already taken', async () => {
    const prisma = makePrisma({ debtor: 1 }, [], ['1']);
    const svc = new CodesService(prisma);
    const code = await svc.generateUniqueDebtorCode();
    expect(code).toBe('2');
  });

  it('generateUniqueSupplierCode skips codes already taken', async () => {
    const prisma = makePrisma({ supplier: 1 }, [], [], ['1', '2']);
    const svc = new CodesService(prisma);
    const code = await svc.generateUniqueSupplierCode();
    expect(code).toBe('3');
  });
});
