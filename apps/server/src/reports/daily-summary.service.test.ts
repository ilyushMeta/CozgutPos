import { describe, it, expect, vi } from 'vitest';
import { DailySummaryService } from './daily-summary.service.js';

function makePrisma(
  sales: { total: string; cogsTotal: string; datetime: Date }[],
  distinctDates: Date[] = [],
) {
  const summaries: Record<string, any> = {};
  return {
    sale: {
      aggregate: vi.fn(async ({ where }: any) => {
        const gte: Date = where.datetime.gte;
        const lte: Date = where.datetime.lte;
        const relevant = sales.filter((s) => s.datetime >= gte && s.datetime <= lte);
        if (!relevant.length) return { _sum: { total: null, cogsTotal: null } };
        return {
          _sum: {
            total: relevant.reduce((acc, s) => acc + Number(s.total), 0).toFixed(2),
            cogsTotal: relevant.reduce((acc, s) => acc + Number(s.cogsTotal), 0).toFixed(2),
          },
        };
      }),
    },
    dailySummary: {
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const key = where.date.toISOString();
        summaries[key] = summaries[key] ? { ...summaries[key], ...update } : create;
        return summaries[key];
      }),
    },
    $queryRaw: vi.fn(async () => distinctDates.map((d) => ({ d }))),
  } as any;
}

describe('DailySummaryService (SPEC §6.13)', () => {
  it('rebuilds one date from that date only, revenue-cogs=profit', async () => {
    const day = new Date('2026-01-10T09:00:00');
    const otherDay = new Date('2026-01-11T09:00:00');
    const prisma = makePrisma([
      { total: '100.00', cogsTotal: '60.00', datetime: day },
      { total: '50.00', cogsTotal: '20.00', datetime: day },
      { total: '999.00', cogsTotal: '1.00', datetime: otherDay },
    ]);
    const svc = new DailySummaryService(prisma);

    const summary = await svc.rebuild(day);

    expect(summary.revenue).toBe('150.00');
    expect(summary.cogs).toBe('80.00');
    expect(summary.profit).toBe('70.00');
  });

  it('defaults to zero for a date with no sales', async () => {
    const prisma = makePrisma([]);
    const svc = new DailySummaryService(prisma);
    const summary = await svc.rebuild(new Date('2026-02-01'));
    expect(summary).toMatchObject({ revenue: '0.00', cogs: '0.00', profit: '0.00' });
  });

  it('rebuildRange with an explicit [from,to] rebuilds each date in between', async () => {
    const prisma = makePrisma([
      { total: '10.00', cogsTotal: '5.00', datetime: new Date('2026-01-01T08:00:00') },
      { total: '20.00', cogsTotal: '8.00', datetime: new Date('2026-01-02T08:00:00') },
    ]);
    const svc = new DailySummaryService(prisma);

    const results = await svc.rebuildRange(new Date('2026-01-01'), new Date('2026-01-02'));

    expect(results).toHaveLength(2);
    expect(results[0].revenue).toBe('10.00');
    expect(results[1].revenue).toBe('20.00');
  });

  it('rebuildRange with no range rebuilds every distinct Sale date', async () => {
    const d1 = new Date('2026-03-01');
    const d2 = new Date('2026-03-05');
    const prisma = makePrisma(
      [
        { total: '5.00', cogsTotal: '2.00', datetime: new Date('2026-03-01T08:00:00') },
        { total: '7.00', cogsTotal: '3.00', datetime: new Date('2026-03-05T08:00:00') },
      ],
      [d1, d2],
    );
    const svc = new DailySummaryService(prisma);

    const results = await svc.rebuildRange();

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.map((r: any) => r.revenue)).toEqual(['5.00', '7.00']);
  });
});
