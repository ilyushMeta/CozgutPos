import { describe, it, expect, vi } from 'vitest';
import { CurrencyService } from './currency.service.js';

function makePrisma(rows: { rate: string; effectiveFrom: Date }[] = []) {
  return {
    exchangeRate: {
      findFirst: vi.fn(
        async () => [...rows].sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0] ?? null,
      ),
      findMany: vi.fn(async () => [...rows].sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)),
      create: vi.fn(async ({ data }: any) => {
        const row = { rate: data.rate, effectiveFrom: new Date() };
        rows.push(row);
        return row;
      }),
    },
  } as any;
}

describe('CurrencyService (SPEC §5.11) — append-only rate history', () => {
  it('current() returns the most recently added rate', async () => {
    const prisma = makePrisma([
      { rate: '19.50', effectiveFrom: new Date('2026-01-01') },
      { rate: '19.60', effectiveFrom: new Date('2026-02-01') },
    ]);
    const svc = new CurrencyService(prisma);
    expect((await svc.current())?.rate).toBe('19.60');
  });

  it('add() appends a new row rather than mutating the previous one', async () => {
    const prisma = makePrisma([{ rate: '19.50', effectiveFrom: new Date('2026-01-01') }]);
    const svc = new CurrencyService(prisma);

    await svc.add(19.75);

    const history = await svc.history();
    expect(history).toHaveLength(2);
    expect(history.map((h: any) => h.rate)).toContain('19.50');
    expect(history.map((h: any) => h.rate)).toContain('19.75');
  });
});
