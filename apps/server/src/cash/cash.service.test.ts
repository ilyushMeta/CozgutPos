import { describe, it, expect, vi } from 'vitest';
import { CashService } from './cash.service.js';

function makePrisma(
  moves: { type: string; amount: string; datetime?: Date }[],
  days: Record<string, { date: Date; openingBalance: string }> = {},
) {
  const incomingTypes = ['SALE_CASH', 'DEPOSIT', 'DEBT_PAYMENT_IN'];
  const outgoingTypes = ['WITHDRAWAL', 'PURCHASE_PAYMENT'];
  return {
    cashMove: {
      aggregate: vi.fn(async ({ where }: any) => {
        const types: string[] = where.type.in;
        const isIncoming = types.every((t) => incomingTypes.includes(t));
        const relevant = moves.filter((m) =>
          (isIncoming ? incomingTypes : outgoingTypes).includes(m.type),
        );
        const sum = relevant.reduce((acc, m) => acc + Number(m.amount), 0);
        return { _sum: { amount: relevant.length ? sum : null } };
      }),
      create: vi.fn(async ({ data }: any) => {
        moves.push({ type: data.type, amount: data.amount, datetime: new Date() });
        return { id: moves.length, ...data };
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const gte = where?.datetime?.gte as Date | undefined;
        const lte = where?.datetime?.lte as Date | undefined;
        return moves.filter((m) => {
          const dt = m.datetime ?? new Date();
          return (!gte || dt >= gte) && (!lte || dt <= lte);
        });
      }),
    },
    cashRegisterDay: {
      findUnique: vi.fn(async ({ where }: any) => days[where.date.toISOString()] ?? null),
      create: vi.fn(async ({ data }: any) => {
        days[data.date.toISOString()] = data;
        return data;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const key = where.date.toISOString();
        days[key] = days[key] ? { ...days[key], ...update } : create;
        return days[key];
      }),
    },
  } as any;
}

describe('CashService (SPEC §6.8 cashbox payment path)', () => {
  it('starts at zero balance with no moves', async () => {
    const prisma = makePrisma([]);
    const svc = new CashService(prisma);
    expect((await svc.getCurrentBalance()).toFixed(2)).toBe('0.00');
  });

  it('nets incoming minus outgoing move types', async () => {
    const prisma = makePrisma([
      { type: 'DEPOSIT', amount: '1000.00' },
      { type: 'SALE_CASH', amount: '250.50' },
      { type: 'PURCHASE_PAYMENT', amount: '300.00' },
      { type: 'WITHDRAWAL', amount: '50.00' },
    ]);
    const svc = new CashService(prisma);
    expect((await svc.getCurrentBalance()).toFixed(2)).toBe('900.50');
  });

  it('recordMove stamps balanceBefore from the prior balance, not the new one', async () => {
    const prisma = makePrisma([{ type: 'DEPOSIT', amount: '500.00' }]);
    const svc = new CashService(prisma);
    const move = await svc.recordMove('PURCHASE_PAYMENT' as any, '120.00', 'Faktur #7');
    expect(move.balanceBefore).toBe('500.00');
    expect((await svc.getCurrentBalance()).toFixed(2)).toBe('380.00');
  });
});

describe('CashService — Kassa day (SPEC §5.7)', () => {
  it('getOrCreateDay defaults opening balance to the current running balance', async () => {
    const prisma = makePrisma([{ type: 'DEPOSIT', amount: '200.00' }]);
    const svc = new CashService(prisma);
    const day = await svc.getOrCreateDay(new Date('2026-01-10'));
    expect(day.openingBalance).toBe('200.00');
  });

  it('getOrCreateDay returns the existing row on a second call without re-defaulting', async () => {
    const prisma = makePrisma([{ type: 'DEPOSIT', amount: '200.00' }]);
    const svc = new CashService(prisma);
    await svc.getOrCreateDay(new Date('2026-01-10'));
    prisma.cashMove.aggregate.mockClear();
    const day = await svc.getOrCreateDay(new Date('2026-01-10'));
    expect(day.openingBalance).toBe('200.00');
    expect(prisma.cashMove.aggregate).not.toHaveBeenCalled();
  });

  it('openDay overrides with an explicitly counted opening balance (PulGoýmak)', async () => {
    const prisma = makePrisma([{ type: 'DEPOSIT', amount: '200.00' }]);
    const svc = new CashService(prisma);
    const day = await svc.openDay(new Date('2026-01-10'), 350);
    expect(day.openingBalance).toBe('350.00');
  });

  it('getDaySummary computes income/expense/closingBalance from that day only', async () => {
    const day10 = new Date('2026-01-10T10:00:00');
    const day11 = new Date('2026-01-11T10:00:00');
    const prisma = makePrisma([
      { type: 'DEPOSIT', amount: '100.00', datetime: day10 },
      { type: 'SALE_CASH', amount: '50.00', datetime: day10 },
      { type: 'WITHDRAWAL', amount: '30.00', datetime: day10 },
      { type: 'DEPOSIT', amount: '999.00', datetime: day11 }, // different day, excluded
    ]);
    const svc = new CashService(prisma);
    await svc.openDay(day10, 500);
    const summary = await svc.getDaySummary(day10);

    expect(summary.openingBalance).toBe('500.00');
    expect(summary.income).toBe('150.00'); // 100 + 50
    expect(summary.expense).toBe('30.00');
    expect(summary.closingBalance).toBe('620.00'); // 500 + 150 - 30
  });
});
