import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SaleErrorCode } from '@cozgut/shared';
import { SalesValidationService } from './sales-validation.service.js';

function makePrisma({
  product = {
    id: 1,
    name: 'Çörek',
    batches: [{ qtyRemaining: '10', buyPrice: '3.00', receivedAt: new Date('2026-01-01') }],
  },
  pack = null as null | { id: number; qtyInside: string },
}: { product?: any; pack?: any } = {}) {
  return {
    product: { findUniqueOrThrow: vi.fn(async () => product) },
    unitPack: { findUniqueOrThrow: vi.fn(async () => pack) },
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
