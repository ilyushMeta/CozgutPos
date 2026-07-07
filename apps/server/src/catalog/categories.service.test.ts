import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

function makePrisma({ category, productCount }: { category: any; productCount: number }) {
  return {
    category: {
      findUnique: vi.fn(async () => category),
      delete: vi.fn(async () => category),
    },
    product: {
      count: vi.fn(async () => productCount),
    },
  } as any;
}

describe('CategoriesService guarded delete (SPEC §5.4)', () => {
  it('deletes a category with no products', async () => {
    const prisma = makePrisma({ category: { id: 1, name: 'Azyk' }, productCount: 0 });
    const svc = new CategoriesService(prisma);
    await svc.remove(1);
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('refuses to delete a category that still has products', async () => {
    const prisma = makePrisma({ category: { id: 1, name: 'Azyk' }, productCount: 3 });
    const svc = new CategoriesService(prisma);
    await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('404s on a missing category', async () => {
    const prisma = makePrisma({ category: null, productCount: 0 });
    const svc = new CategoriesService(prisma);
    await expect(svc.remove(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
