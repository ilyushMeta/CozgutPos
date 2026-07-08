import { describe, it, expect, vi } from 'vitest';
import { dec } from '@cozgut/shared';
import { DebtSaleService } from './debt-sale.service.js';

function makeTx({ debtor = { id: 1, balance: '0.00', accountCurrency: 'TMT' } }: any = {}) {
  const created: any = { schedules: [] as any[], debtSale: null as any, updatedBalance: null };
  const tx = {
    customer: {
      findUnique: vi.fn(async () => debtor),
      update: vi.fn(async ({ data }: any) => {
        created.updatedBalance = data.balance;
        return { ...debtor, ...data };
      }),
    },
    debtSale: {
      create: vi.fn(async ({ data }: any) => {
        created.debtSale = data;
        return { id: 1, ...data };
      }),
    },
    debtSchedule: {
      createMany: vi.fn(async ({ data }: any) => {
        created.schedules = data;
        return { count: data.length };
      }),
    },
  };
  return { tx, created };
}

describe('DebtSaleService.apply (SPEC §6.5)', () => {
  it('adds the full TMT amount to a TMT-account debtor balance', async () => {
    const { tx, created } = makeTx({ debtor: { id: 1, balance: '50.00', accountCurrency: 'TMT' } });
    const svc = new DebtSaleService();

    const result = await svc.apply(tx as any, {
      debtorId: 1,
      saleId: 10,
      invoiceNo: 101,
      saleDate: new Date('2026-01-10'),
      amountTmt: 100,
      dueDate: null,
      noDueDate: true,
      exchangeRate: 19.6,
    });

    expect(result.newBalance.toFixed(2)).toBe('150.00');
    expect(created.updatedBalance).toBe('150.00');
    expect(created.debtSale.amount).toBe('100.00');
  });

  it('converts to USD account currency using the exchange rate, rounded 2dp', async () => {
    const { tx, created } = makeTx({ debtor: { id: 1, balance: '0.00', accountCurrency: 'USD' } });
    const svc = new DebtSaleService();

    const result = await svc.apply(tx as any, {
      debtorId: 1,
      saleId: 10,
      invoiceNo: 101,
      saleDate: new Date('2026-01-10'),
      amountTmt: 100,
      dueDate: null,
      noDueDate: true,
      exchangeRate: 20,
    });

    expect(result.newBalance.toFixed(2)).toBe('5.00'); // 100 / 20
    expect(created.debtSale.amount).toBe('5.00');
  });

  it('rejects a USD-account debtor when no exchange rate is configured', async () => {
    const { tx } = makeTx({ debtor: { id: 1, balance: '0.00', accountCurrency: 'USD' } });
    const svc = new DebtSaleService();

    await expect(
      svc.apply(tx as any, {
        debtorId: 1,
        saleId: 10,
        invoiceNo: 101,
        saleDate: new Date('2026-01-10'),
        amountTmt: 100,
        dueDate: null,
        noDueDate: true,
        exchangeRate: 0,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('throws when the debtor does not exist', async () => {
    const { tx } = makeTx({ debtor: null });
    const svc = new DebtSaleService();

    await expect(
      svc.apply(tx as any, {
        debtorId: 999,
        saleId: 10,
        invoiceNo: 101,
        saleDate: new Date('2026-01-10'),
        amountTmt: 100,
        dueDate: null,
        noDueDate: true,
        exchangeRate: 20,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('creates N DebtSchedule rows and reports monthsN', async () => {
    const { tx, created } = makeTx();
    const svc = new DebtSaleService();
    const saleDate = new Date('2026-01-10');
    const dueDate = new Date('2026-04-10'); // 3 months

    const result = await svc.apply(tx as any, {
      debtorId: 1,
      saleId: 10,
      invoiceNo: 101,
      saleDate,
      amountTmt: 300,
      dueDate,
      noDueDate: false,
      exchangeRate: 20,
    });

    expect(result.monthsN).toBe(3);
    expect(created.schedules).toHaveLength(3);
    expect(created.schedules.map((r: any) => r.amount)).toEqual(['100.00', '100.00', '100.00']);
    expect(created.debtSale.dueDate).toEqual(dueDate);
  });

  it('sets dueDate=saleDate for the DebtSale row when möhletsiz', async () => {
    const { tx, created } = makeTx();
    const svc = new DebtSaleService();
    const saleDate = new Date('2026-01-10');

    await svc.apply(tx as any, {
      debtorId: 1,
      saleId: 10,
      invoiceNo: 101,
      saleDate,
      amountTmt: 100,
      dueDate: null,
      noDueDate: true,
      exchangeRate: 20,
    });

    expect(created.debtSale.dueDate).toEqual(saleDate);
    expect(dec(created.debtSale.amount).toFixed(2)).toBe('100.00');
  });
});
