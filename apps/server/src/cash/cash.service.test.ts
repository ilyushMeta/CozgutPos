import { describe, it, expect, vi } from 'vitest';
import { CashService } from './cash.service.js';

function makePrisma(moves: { type: string; amount: string }[]) {
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
        moves.push({ type: data.type, amount: data.amount });
        return { id: moves.length, ...data };
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
