import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { dec } from '@cozgut/shared';
import { DebtorsService } from './debtors.service.js';

function makeDeps({
  debtor = {
    id: 1,
    name: 'Aman',
    balance: '100.00',
    accountCurrency: 'TMT',
    phone: '+99361234567',
  },
  schedules = [] as any[],
  exchangeRate = { rate: '20.00' },
}: any = {}) {
  const created: any = {
    customerUpdates: [] as any[],
    payments: [] as any[],
    scheduleUpdates: [] as any[],
    cashMoves: [] as any[],
  };

  const tx = {
    customer: {
      findUnique: vi.fn(async () => debtor),
      update: vi.fn(async ({ data }: any) => {
        created.customerUpdates.push(data);
        return { ...debtor, ...data };
      }),
    },
    debtPayment: {
      create: vi.fn(async ({ data }: any) => {
        created.payments.push(data);
        return { id: 1, ...data };
      }),
    },
    debtSchedule: {
      findMany: vi.fn(async () => schedules),
      update: vi.fn(async ({ where, data }: any) => {
        created.scheduleUpdates.push({ id: where.id, ...data });
        return { id: where.id, ...data };
      }),
    },
    exchangeRate: { findFirst: vi.fn(async () => exchangeRate) },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    customer: {
      findMany: vi.fn(),
      findUnique: vi.fn(async () => debtor),
      create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
      update: vi.fn(async ({ data }: any) => ({ ...debtor, ...data })),
      delete: vi.fn(async () => debtor),
    },
    debtSale: { count: vi.fn(async () => 0) },
    debtPayment: { count: vi.fn(async () => 0) },
    debtSchedule: { count: vi.fn(async () => 0) },
  };

  const codes = { generateUniqueDebtorCode: vi.fn(async () => '1') };
  const cash = {
    recordMove: vi.fn(async (type: string, amount: any, note: string) => {
      created.cashMoves.push({ type, amount: String(amount), note });
    }),
  };
  const printing = {
    printDebtPaymentReceipt: vi.fn(async () => ({
      printed: false,
      reason: 'printer not configured',
    })),
  };
  const sms = { sendSafely: vi.fn(async () => undefined) };

  return { prisma, tx, codes, cash, printing, sms, created };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new DebtorsService(
    deps.prisma as any,
    deps.codes as any,
    deps.cash as any,
    deps.printing as any,
    deps.sms as any,
  );
}

describe('DebtorsService.findAll — overdue computation (SPEC §5.5)', () => {
  it('flags a debtor with a past-due, unpaid schedule row as overdue', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86_400_000);
    const deps = makeDeps();
    deps.prisma.customer.findMany = vi.fn(async () => [
      {
        id: 1,
        name: 'Aman',
        balance: '50.00',
        schedules: [{ amount: '50.00', paid: '0.00', dueDate: past }],
      },
    ]) as any;
    const svc = makeService(deps);

    const [row] = await svc.findAll();
    expect(row.isOverdue).toBe(true);
    expect(row.overdueAmount).toBe('50.00');
    expect(row.nextDueDate).toEqual(past);
  });

  it('does not flag a debtor whose schedule rows are fully paid', async () => {
    const deps = makeDeps();
    deps.prisma.customer.findMany = vi.fn(async () => [
      {
        id: 1,
        name: 'Aman',
        balance: '0.00',
        schedules: [{ amount: '50.00', paid: '50.00', dueDate: new Date('2020-01-01') }],
      },
    ]) as any;
    const svc = makeService(deps);

    const [row] = await svc.findAll();
    expect(row.isOverdue).toBe(false);
    expect(row.overdueAmount).toBe('0.00');
  });
});

describe('DebtorsService.create', () => {
  it('auto-generates a code when none is supplied', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    const created = await svc.create({ name: 'Täze karzçy' } as any);
    expect(deps.codes.generateUniqueDebtorCode).toHaveBeenCalled();
    expect(created.code).toBe('1');
  });
});

describe('DebtorsService.remove (guarded)', () => {
  it('refuses to delete a debtor with debt history', async () => {
    const deps = makeDeps();
    deps.prisma.debtSale.count = vi.fn(async () => 1) as any;
    const svc = makeService(deps);
    await expect(svc.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s on a missing debtor', async () => {
    const deps = makeDeps();
    deps.prisma.customer.findUnique = vi.fn(async () => null) as any;
    const svc = makeService(deps);
    await expect(svc.remove(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DebtorsService.recordPayment (SPEC §5.5/§6.5)', () => {
  it('reduces balance and records a TMT CashMove for a TMT-account debtor', async () => {
    const deps = makeDeps({
      debtor: { id: 1, name: 'Aman', balance: '100.00', accountCurrency: 'TMT', phone: null },
    });
    const svc = makeService(deps);
    const result = await svc.recordPayment(1, { amount: 30 } as any);

    expect(result.newBalance).toBe('70.00');
    expect(deps.created.cashMoves).toEqual([
      { type: 'DEBT_PAYMENT_IN', amount: '30', note: 'Karz tölegi — Aman' },
    ]);
  });

  it('converts a USD-account payment to TMT for the CashMove using the current rate', async () => {
    const deps = makeDeps({
      debtor: { id: 1, name: 'Aman', balance: '100.00', accountCurrency: 'USD', phone: null },
      exchangeRate: { rate: '20.00' },
    });
    const svc = makeService(deps);
    await svc.recordPayment(1, { amount: 5 } as any);

    expect(deps.created.cashMoves).toEqual([
      { type: 'DEBT_PAYMENT_IN', amount: '100', note: 'Karz tölegi — Aman' }, // 5 USD * 20
    ]);
  });

  it('fills open DebtSchedule rows oldest-first, splitting across rows as needed', async () => {
    const schedules = [
      { id: 1, amount: '30.00', paid: '0.00', dueDate: new Date('2026-01-01') },
      { id: 2, amount: '30.00', paid: '0.00', dueDate: new Date('2026-02-01') },
      { id: 3, amount: '30.00', paid: '0.00', dueDate: new Date('2026-03-01') },
    ];
    const deps = makeDeps({ schedules });
    const svc = makeService(deps);
    await svc.recordPayment(1, { amount: 40 } as any);

    expect(deps.created.scheduleUpdates).toEqual([
      { id: 1, paid: '30.00' },
      { id: 2, paid: '10.00' },
    ]);
  });

  it('skips already-fully-paid rows when filling oldest-first', async () => {
    const schedules = [
      { id: 1, amount: '30.00', paid: '30.00', dueDate: new Date('2026-01-01') },
      { id: 2, amount: '30.00', paid: '0.00', dueDate: new Date('2026-02-01') },
    ];
    const deps = makeDeps({ schedules });
    const svc = makeService(deps);
    await svc.recordPayment(1, { amount: 10 } as any);

    expect(deps.created.scheduleUpdates).toEqual([{ id: 2, paid: '10.00' }]);
  });

  it('sends an SMS with the templated confirmation when sendSms is true', async () => {
    const deps = makeDeps({
      debtor: {
        id: 1,
        name: 'Aman',
        balance: '100.00',
        accountCurrency: 'TMT',
        phone: '+99361234567',
      },
    });
    const svc = makeService(deps);
    await svc.recordPayment(1, { amount: 30, sendSms: true } as any);

    expect(deps.sms.sendSafely).toHaveBeenCalledWith(
      '+99361234567',
      expect.stringContaining('Tölendi: 30.00TMT'),
    );
  });

  it('does not send an SMS when sendSms is false', async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    await svc.recordPayment(1, { amount: 30 } as any);
    expect(deps.sms.sendSafely).not.toHaveBeenCalled();
  });
});
