import { describe, it, expect, vi } from 'vitest';
import { ReportTablesService } from './report-tables.service.js';

function makePrisma() {
  return {
    saleLine: { findMany: vi.fn(async () => []) },
    sale: { findMany: vi.fn(async () => []) },
    loginAudit: { findMany: vi.fn(async () => []) },
    debtPayment: { findMany: vi.fn(async () => []) },
    supplierDebtMove: { findMany: vi.fn(async () => []) },
  } as any;
}

describe('ReportTablesService (SPEC §5.13)', () => {
  it('soldItems: builds search/category/receiptNo/paymentMethod/date filters', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);

    await svc.soldItems({
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
      search: 'Çörek',
      category: 'Azyk',
      receiptNo: 42,
      paymentMethod: 'CARD',
    });

    const call = prisma.saleLine.findMany.mock.calls[0][0];
    expect(call.where.categoryNameSnapshot).toEqual({ contains: 'Azyk' });
    expect(call.where.OR).toEqual([
      { productNameSnapshot: { contains: 'Çörek' } },
      { product: { code: { contains: 'Çörek' } } },
    ]);
    expect(call.where.sale.receiptNo).toBe(42);
    expect(call.where.sale.paidCard).toEqual({ gt: 0 });
    expect(call.where.sale.datetime.gte).toBeInstanceOf(Date);
    expect(call.where.sale.datetime.lte).toBeInstanceOf(Date);
  });

  it('soldItems: omits filter keys entirely when not provided (no accidental over-filtering)', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);

    await svc.soldItems({});

    const call = prisma.saleLine.findMany.mock.calls[0][0];
    expect(call.where.categoryNameSnapshot).toBeUndefined();
    expect(call.where.OR).toBeUndefined();
    expect(call.where.sale.receiptNo).toBeUndefined();
    expect(call.where.sale.paidCard).toBeUndefined();
    expect(call.where.sale.datetime).toBeUndefined();
  });

  it('soldItems: maps each PaymentMethod to its own Sale field', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);

    await svc.soldItems({ paymentMethod: 'CASH' });
    expect(prisma.saleLine.findMany.mock.calls[0][0].where.sale.paidCash).toEqual({ gt: 0 });

    await svc.soldItems({ paymentMethod: 'DEBT' });
    expect(prisma.saleLine.findMany.mock.calls[1][0].where.sale.paidDebt).toEqual({ gt: 0 });
  });

  it('receipts: filters by receiptNo and date range, includes cashier+debtor', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);

    await svc.receipts({ receiptNo: 7, from: new Date('2026-01-01'), to: new Date('2026-01-02') });

    const call = prisma.sale.findMany.mock.calls[0][0];
    expect(call.where.receiptNo).toBe(7);
    expect(call.where.datetime.gte).toBeInstanceOf(Date);
    expect(call.include).toEqual({ cashier: true, debtor: true });
  });

  it('loginAudit: date-range filters on `at`, joins user', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);

    await svc.loginAudit({ from: new Date('2026-01-01') });

    const call = prisma.loginAudit.findMany.mock.calls[0][0];
    expect(call.where.at.gte).toBeInstanceOf(Date);
    expect(call.include).toEqual({ user: true });
  });

  it('loginAudit: no filter when no range given (undefined where, not an empty-object over-match)', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);
    await svc.loginAudit({});
    expect(prisma.loginAudit.findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it('debtPayments: date-range filters on `datetime`, joins debtor', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);
    await svc.debtPayments({ to: new Date('2026-01-31') });
    const call = prisma.debtPayment.findMany.mock.calls[0][0];
    expect(call.where.datetime.lte).toBeInstanceOf(Date);
    expect(call.include).toEqual({ debtor: true });
  });

  it('supplierDebtMoves: date-range filters on `txDate`, joins supplier', async () => {
    const prisma = makePrisma();
    const svc = new ReportTablesService(prisma);
    await svc.supplierDebtMoves({ from: new Date('2026-01-01') });
    const call = prisma.supplierDebtMove.findMany.mock.calls[0][0];
    expect(call.where.txDate.gte).toBeInstanceOf(Date);
    expect(call.include).toEqual({ supplier: true });
  });
});
