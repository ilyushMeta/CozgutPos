import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';

function makeDeps({
  supplier = { id: 1, name: 'Ata dükan', code: '1', balance: '100.00' },
  moveCount = 0,
}: any = {}) {
  const created: any = { supplierUpdates: [] as any[], moves: [] as any[], cashMoves: [] as any[] };

  const tx = {
    supplier: {
      findUnique: vi.fn(async () => supplier),
      update: vi.fn(async ({ data }: any) => {
        created.supplierUpdates.push(data);
        return { ...supplier, ...data };
      }),
    },
    supplierDebtMove: {
      create: vi.fn(async ({ data }: any) => {
        created.moves.push(data);
        return { id: 1, ...data };
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    supplier: {
      findMany: vi.fn(async () => [supplier]),
      findUnique: vi.fn(async () => supplier),
      create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
      update: vi.fn(async ({ data }: any) => ({ ...supplier, ...data })),
      delete: vi.fn(async () => supplier),
    },
    supplierDebtMove: {
      count: vi.fn(async () => moveCount),
      findMany: vi.fn(async () => []),
    },
  };

  const codes = { generateUniqueSupplierCode: vi.fn(async () => '2') };
  const cash = {
    recordMove: vi.fn(async (type: string, amount: any, note: string) => {
      created.cashMoves.push({ type, amount: String(amount), note });
    }),
  };

  return { prisma, tx, codes, cash, created };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new SuppliersService(deps.prisma as any, deps.codes as any, deps.cash as any);
}

describe('SuppliersService.create', () => {
  it('auto-generates a code when none is supplied', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const created = await svc.create({ name: 'Täze dükan' } as any);
    expect(deps.codes.generateUniqueSupplierCode).toHaveBeenCalled();
    expect(created.code).toBe('2');
  });
});

describe('SuppliersService.remove (guarded)', () => {
  it('refuses to delete a supplier with move history', async () => {
    const deps = makeDeps({ moveCount: 3 });
    const svc = makeService(deps);
    await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s on a missing supplier', async () => {
    const deps = makeDeps();
    deps.prisma.supplier.findUnique = vi.fn(async () => null) as any;
    const svc = makeService(deps);
    await expect(svc.remove(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a supplier with no history', async () => {
    const deps = makeDeps({ moveCount: 0 });
    const svc = makeService(deps);
    await svc.remove(1);
    expect(deps.prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe('SuppliersService.payDebt (SPEC §5.6)', () => {
  it('reduces balance, records a PAYMENT ledger row, and a cashbox outflow', async () => {
    const deps = makeDeps({ supplier: { id: 1, name: 'Ata dükan', balance: '100.00' } });
    const svc = makeService(deps);
    const move = await svc.payDebt(1, { amount: 40 } as any);

    expect(move.closing).toBe('60.00');
    expect(move.opening).toBe('100.00');
    expect(move.type).toBe('PAYMENT');
    expect(deps.created.supplierUpdates).toEqual([{ balance: '60.00' }]);
    expect(deps.created.cashMoves).toEqual([
      { type: 'PURCHASE_PAYMENT', amount: '40', note: 'Dükan karzy — Ata dükan' },
    ]);
  });

  it('throws when the supplier does not exist', async () => {
    const deps = makeDeps();
    deps.tx.supplier.findUnique = vi.fn(async () => null) as any;
    const svc = makeService(deps);
    await expect(svc.payDebt(999, { amount: 10 } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
