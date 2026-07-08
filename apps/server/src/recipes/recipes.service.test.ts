import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';

function makeDeps({ recipe = { id: 1, compositeProductId: 5 }, saleLineCount = 0 }: any = {}) {
  const created: any = { product: null, recipe: null, items: [] as any[], deleted: [] as string[] };
  const tx = {
    product: {
      create: vi.fn(async ({ data }: any) => {
        created.product = { id: 5, ...data };
        return created.product;
      }),
      delete: vi.fn(async ({ where }: any) => {
        created.deleted.push(`product:${where.id}`);
        return { id: where.id };
      }),
    },
    recipe: {
      create: vi.fn(async ({ data }: any) => {
        created.recipe = { id: 1, ...data };
        return created.recipe;
      }),
      delete: vi.fn(async ({ where }: any) => {
        created.deleted.push(`recipe:${where.id}`);
        return { id: where.id };
      }),
    },
    recipeItem: {
      createMany: vi.fn(async ({ data }: any) => {
        created.items = data;
        return { count: data.length };
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    recipe: { findUnique: vi.fn(async () => recipe), findMany: vi.fn() },
    saleLine: { count: vi.fn(async () => saleLineCount) },
  };
  const codes = { generateUniqueCompositeCode: vi.fn(async () => '9000') };
  return { prisma, codes, created, tx };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new RecipesService(deps.prisma as any, deps.codes as any);
}

describe('RecipesService.create (SPEC §5.12/§6.6 "Forma-2 döret")', () => {
  it('creates a composite Product, Recipe, and RecipeItems in one transaction', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const result = await svc.create({
      name: 'Kompozit haryt',
      items: [
        { ingredientProductId: 1, qty: 2 },
        { ingredientProductId: 2, qty: 1 },
      ],
    } as any);

    expect(result.product).toMatchObject({
      name: 'Kompozit haryt',
      code: '9000',
      isComposite: true,
    });
    expect(result.recipe).toMatchObject({ compositeProductId: 5 });
    expect(deps.created.items).toEqual([
      { recipeId: 1, ingredientProductId: 1, qty: '2.000' },
      { recipeId: 1, ingredientProductId: 2, qty: '1.000' },
    ]);
  });

  it('auto-generates a composite code when none is supplied', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.create({ name: 'X', items: [{ ingredientProductId: 1, qty: 1 }] } as any);
    expect(deps.codes.generateUniqueCompositeCode).toHaveBeenCalled();
  });
});

describe('RecipesService.remove (guarded)', () => {
  it('deletes the Recipe then the composite Product when there is no sales history', async () => {
    const deps = makeDeps({ saleLineCount: 0 });
    const svc = makeService(deps);
    await svc.remove(1);
    expect(deps.created.deleted).toEqual(['recipe:1', 'product:5']);
  });

  it('refuses to delete a composite with sales history', async () => {
    const deps = makeDeps({ saleLineCount: 3 });
    const svc = makeService(deps);
    await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s on a missing recipe', async () => {
    const deps = makeDeps({ recipe: null });
    const svc = makeService(deps);
    await expect(svc.remove(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
