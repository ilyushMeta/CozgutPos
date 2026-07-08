import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NeededProductsService } from './needed-products.service.js';

function makePrisma({ item = { id: 1, name: 'Şeker' } }: { item?: any } = {}) {
  return {
    neededProduct: {
      findMany: vi.fn(async () => [item]),
      create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
      update: vi.fn(async ({ data }: any) => ({ ...item, ...data })),
      delete: vi.fn(async () => item),
      findUnique: vi.fn(async () => item),
    },
  } as any;
}

describe('NeededProductsService (SPEC §4.1 NeededProduct)', () => {
  it('creates an item with the given fields, defaulting qty to 0', async () => {
    const prisma = makePrisma();
    const svc = new NeededProductsService(prisma);
    const created = await svc.create({ name: 'Şeker' } as any);
    expect(created).toMatchObject({ name: 'Şeker', qty: '0.000', code: null, categoryId: null });
  });

  it('updates an existing item', async () => {
    const prisma = makePrisma();
    const svc = new NeededProductsService(prisma);
    const updated = await svc.update(1, { name: 'Şeker', qty: 5 } as any);
    expect(updated).toMatchObject({ name: 'Şeker', qty: '5.000' });
  });

  it('404s when updating a missing item', async () => {
    const prisma = makePrisma({ item: null });
    const svc = new NeededProductsService(prisma);
    await expect(svc.update(99, { name: 'X' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an existing item', async () => {
    const prisma = makePrisma();
    const svc = new NeededProductsService(prisma);
    await svc.remove(1);
    expect(prisma.neededProduct.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('404s when deleting a missing item', async () => {
    const prisma = makePrisma({ item: null });
    const svc = new NeededProductsService(prisma);
    await expect(svc.remove(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
