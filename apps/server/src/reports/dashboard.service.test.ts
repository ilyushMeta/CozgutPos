import { describe, it, expect, vi } from 'vitest';
import { dec } from '@cozgut/shared';
import { DashboardService } from './dashboard.service.js';

function makeDeps({
  sales = [] as { total: string; cogsTotal: string; datetime: Date }[],
  dailySummaries = [] as { date: Date; revenue: string; cogs: string }[],
  saleLineGroups = [] as { categoryNameSnapshot: string | null; lineTotal: string; cogs: string }[],
  cashBalance = dec(0),
  lowStock = [] as unknown[],
}) {
  const prisma = {
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
      findMany: vi.fn(async ({ where }: any) => {
        const gte: Date = where.date.gte;
        return dailySummaries.filter((d) => d.date >= gte);
      }),
    },
    saleLine: {
      groupBy: vi.fn(async () =>
        saleLineGroups.map((g) => ({
          categoryNameSnapshot: g.categoryNameSnapshot,
          _sum: { lineTotal: g.lineTotal, cogs: g.cogs },
        })),
      ),
    },
  } as any;
  const cash = { getCurrentBalance: vi.fn(async () => cashBalance) } as any;
  const stockViews = { lowStock: vi.fn(async () => lowStock) } as any;
  return { prisma, cash, stockViews };
}

describe('DashboardService (SPEC §5.13)', () => {
  it('computes today/period profit live from Sale, not DailySummary', async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
    const deps = makeDeps({
      sales: [{ total: '100.00', cogsTotal: '40.00', datetime: today }],
      cashBalance: dec('250.00'),
      lowStock: [{}, {}],
    });
    const svc = new DashboardService(deps.prisma, deps.cash, deps.stockViews);

    const summary = await svc.getSummary();

    expect(summary.todayProfit).toBe('60.00');
    expect(summary.periodProfit).toBe('60.00'); // same sale falls in the default this-month range
    expect(summary.cashBalance).toBe('250.00');
    expect(summary.lowStockCount).toBe(2);
  });

  it('getSummary respects an explicit from/to period', async () => {
    const deps = makeDeps({
      sales: [
        { total: '10.00', cogsTotal: '4.00', datetime: new Date('2026-01-05T08:00:00') },
        { total: '20.00', cogsTotal: '5.00', datetime: new Date('2026-02-01T08:00:00') },
      ],
    });
    const svc = new DashboardService(deps.prisma, deps.cash, deps.stockViews);

    const summary = await svc.getSummary(new Date('2026-01-01'), new Date('2026-01-31'));

    expect(summary.periodProfit).toBe('6.00'); // only the January sale
  });

  it('profitByMonth fills every month in range, aggregating DailySummary rows into the current month bucket', async () => {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const deps = makeDeps({
      dailySummaries: [
        { date: new Date(now.getFullYear(), now.getMonth(), 3), revenue: '100.00', cogs: '40.00' },
        { date: new Date(now.getFullYear(), now.getMonth(), 20), revenue: '50.00', cogs: '10.00' },
      ],
    });
    const svc = new DashboardService(deps.prisma, deps.cash, deps.stockViews);

    const result = await svc.profitByMonth(3);

    expect(result).toHaveLength(3);
    const currentBucket = result.find((r) => r.month === thisMonthKey);
    expect(currentBucket).toMatchObject({ revenue: '150.00', cogs: '50.00', profit: '100.00' });
    // the two earlier months exist as zero-filled buckets, not omitted
    expect(result.filter((r) => r.revenue === '0.00')).toHaveLength(2);
  });

  it('categoryBreakdown sums SaleLine revenue/cogs per category, sorted by revenue desc', async () => {
    const deps = makeDeps({
      saleLineGroups: [
        { categoryNameSnapshot: 'Azyk', lineTotal: '50.00', cogs: '20.00' },
        { categoryNameSnapshot: 'Içgi', lineTotal: '200.00', cogs: '80.00' },
        { categoryNameSnapshot: null, lineTotal: '10.00', cogs: '5.00' },
      ],
    });
    const svc = new DashboardService(deps.prisma, deps.cash, deps.stockViews);

    const result = await svc.categoryBreakdown(new Date('2026-01-01'), new Date('2026-01-31'));

    expect(result[0]).toMatchObject({ category: 'Içgi', revenue: '200.00' });
    expect(result[1]).toMatchObject({ category: 'Azyk', revenue: '50.00' });
    expect(result[2]).toMatchObject({ category: '—', revenue: '10.00' });
  });
});
