import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SaleErrorCode } from '@cozgut/shared';
import { SalesValidationService } from './sales-validation.service.js';

function makePrisma({
  product = {
    id: 1,
    name: 'Çörek',
    batches: [{ qtyRemaining: '10', buyPrice: '3.00', receivedAt: new Date('2026-01-01') }],
    recipe: null as any,
  },
  pack = null as null | { id: number; qtyInside: string },
  debtor = { id: 1, name: 'Aman' } as any,
  ingredients = [] as any[],
}: { product?: any; pack?: any; debtor?: any; ingredients?: any[] } = {}) {
  return {
    product: {
      findUniqueOrThrow: vi.fn(async () => product),
      findMany: vi.fn(async () => ingredients),
    },
    unitPack: { findUniqueOrThrow: vi.fn(async () => pack) },
    customer: { findUnique: vi.fn(async () => debtor) },
  } as any;
}

const BASE_INPUT = {
  lines: [{ productId: 1, qty: 2, unitPrice: 5 }],
  paidCash: 10,
  paidCard: 0,
  skipStockCheck: false,
  allowBelowCost: false,
} as any;

describe('SalesValidationService (SPEC §6.3)', () => {
  it('rejects an empty cart', async () => {
    const svc = new SalesValidationService(makePrisma());
    await expect(svc.validate({ ...BASE_INPUT, lines: [] })).rejects.toMatchObject({
      response: { code: SaleErrorCode.EMPTY_CART },
    });
  });

  it('rejects zero payment', async () => {
    const svc = new SalesValidationService(makePrisma());
    await expect(svc.validate({ ...BASE_INPUT, paidCash: 0, paidCard: 0 })).rejects.toMatchObject({
      response: { code: SaleErrorCode.NO_PAYMENT },
    });
  });

  it('passes a well-formed sale within stock and above cost', async () => {
    const svc = new SalesValidationService(makePrisma());
    const resolved = await svc.validate(BASE_INPUT);
    expect(resolved[0].baseQty.toFixed(3)).toBe('2.000');
  });

  it('rejects insufficient stock, listing the shortfall', async () => {
    const svc = new SalesValidationService(
      makePrisma({
        product: {
          id: 1,
          name: 'Çörek',
          batches: [{ qtyRemaining: '1', buyPrice: '3.00', receivedAt: new Date() }],
        },
      }),
    );
    await expect(
      svc.validate({ ...BASE_INPUT, lines: [{ productId: 1, qty: 5, unitPrice: 5 }] }),
    ).rejects.toMatchObject({
      response: {
        code: SaleErrorCode.INSUFFICIENT_STOCK,
        shortages: [{ productId: 1, productName: 'Çörek', shortfall: '4.000' }],
      },
    });
  });

  it('bypass #1 (skipStockCheck) allows selling more than remaining', async () => {
    const svc = new SalesValidationService(
      makePrisma({
        product: {
          id: 1,
          name: 'Çörek',
          batches: [{ qtyRemaining: '1', buyPrice: '3.00', receivedAt: new Date() }],
        },
      }),
    );
    await expect(
      svc.validate({
        ...BASE_INPUT,
        lines: [{ productId: 1, qty: 5, unitPrice: 5 }],
        skipStockCheck: true,
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a unit price below the latest batch cost', async () => {
    const svc = new SalesValidationService(makePrisma());
    await expect(
      svc.validate({ ...BASE_INPUT, lines: [{ productId: 1, qty: 1, unitPrice: 2 }] }), // buyPrice=3.00
    ).rejects.toMatchObject({
      response: {
        code: SaleErrorCode.BELOW_COST,
        lines: [{ productId: 1, unitPrice: '2', costBasis: '3.00' }],
      },
    });
  });

  it('bypass #2 (allowBelowCost) allows a below-cost price', async () => {
    const svc = new SalesValidationService(makePrisma());
    await expect(
      svc.validate({
        ...BASE_INPUT,
        lines: [{ productId: 1, qty: 1, unitPrice: 2 }],
        allowBelowCost: true,
      }),
    ).resolves.toBeDefined();
  });

  it('scales stock need and cost basis by pack size when a unit pack is selected', async () => {
    const svc = new SalesValidationService(
      makePrisma({
        product: {
          id: 1,
          name: 'Çörek',
          batches: [{ qtyRemaining: '10', buyPrice: '3.00', receivedAt: new Date() }],
        },
        pack: { id: 9, qtyInside: '5' },
      }),
    );
    // 2 packs * 5 inside = 10 base units needed, exactly matching remaining stock.
    const resolved = await svc.validate({
      ...BASE_INPUT,
      lines: [{ productId: 1, qty: 2, unitPackId: 9, unitPrice: 20 }], // 20 >= 3*5=15 cost basis
    });
    expect(resolved[0].baseQty.toFixed(3)).toBe('10.000');
    expect(resolved[0].costBasis?.toFixed(2)).toBe('15.00');
  });
});

describe('SalesValidationService — debt (SPEC §6.5)', () => {
  it('accepts a debt-only sale (no cash/card) once a debtor is given', async () => {
    const svc = new SalesValidationService(makePrisma());
    await expect(
      svc.validate({ ...BASE_INPUT, paidCash: 0, paidCard: 0, paidDebt: 10, debtorId: 1 }),
    ).resolves.toBeDefined();
  });

  it('rejects a paidDebt with no debtorId', async () => {
    const svc = new SalesValidationService(makePrisma());
    await expect(
      svc.validate({ ...BASE_INPUT, paidCash: 0, paidCard: 0, paidDebt: 10 }),
    ).rejects.toMatchObject({ response: { code: SaleErrorCode.DEBTOR_REQUIRED } });
  });

  it('404s when the given debtorId does not exist', async () => {
    const svc = new SalesValidationService(makePrisma({ debtor: null }));
    await expect(
      svc.validate({ ...BASE_INPUT, paidCash: 0, paidCard: 0, paidDebt: 10, debtorId: 999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SalesValidationService — composite (Önüm) lines (SPEC §6.6)', () => {
  const COMPOSITE_PRODUCT = {
    id: 10,
    name: 'Kompozit haryt',
    isComposite: true,
    category: null,
    recipe: {
      items: [
        { ingredientProductId: 1, qty: '2' }, // 2x product 1 per composite unit
        { ingredientProductId: 2, qty: '1' }, // 1x product 2 per composite unit
      ],
    },
  };
  const INGREDIENT_1 = {
    id: 1,
    batches: [{ qtyRemaining: '20', buyPrice: '3.00', receivedAt: new Date('2026-01-01') }],
  };
  const INGREDIENT_2 = {
    id: 2,
    batches: [{ qtyRemaining: '3', buyPrice: '10.00', receivedAt: new Date('2026-01-01') }],
  };

  it('computes availability as the fewest units any ingredient supports', async () => {
    const svc = new SalesValidationService(
      makePrisma({ product: COMPOSITE_PRODUCT, ingredients: [INGREDIENT_1, INGREDIENT_2] }),
    );
    const resolved = await svc.validate({
      ...BASE_INPUT,
      lines: [{ productId: 10, qty: 2, unitPrice: 30 }],
    });
    // ingredient 1: 20/2=10 units possible; ingredient 2: 3/1=3 units possible -> min=3
    expect(resolved[0].totalRemaining.toFixed(3)).toBe('3.000');
    expect(resolved[0].isComposite).toBe(true);
  });

  it('computes cost basis as the sum of each ingredient qty × latest buyPrice', async () => {
    const svc = new SalesValidationService(
      makePrisma({ product: COMPOSITE_PRODUCT, ingredients: [INGREDIENT_1, INGREDIENT_2] }),
    );
    const resolved = await svc.validate({
      ...BASE_INPUT,
      lines: [{ productId: 10, qty: 1, unitPrice: 30 }],
    });
    // 2*3.00 + 1*10.00 = 16.00
    expect(resolved[0].costBasis?.toFixed(2)).toBe('16.00');
  });

  it('rejects insufficient composite availability', async () => {
    const svc = new SalesValidationService(
      makePrisma({ product: COMPOSITE_PRODUCT, ingredients: [INGREDIENT_1, INGREDIENT_2] }),
    );
    await expect(
      svc.validate({ ...BASE_INPUT, lines: [{ productId: 10, qty: 5, unitPrice: 30 }] }),
    ).rejects.toMatchObject({ response: { code: SaleErrorCode.INSUFFICIENT_STOCK } });
  });
});
