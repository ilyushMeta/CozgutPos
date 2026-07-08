import { Injectable } from '@nestjs/common';
import {
  dec,
  money,
  moneyStr,
  startOfDay,
  endOfDay,
  type DashboardSummary,
  type ProfitByMonth,
  type CategoryBreakdown,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CashService } from '../cash/cash.service.js';
import { StockViewsService } from '../stock-views/stock-views.service.js';

/**
 * Dashboard tiles + charts (SPEC §5.13). Today/period profit are computed
 * LIVE from Sale (not DailySummary) — the nightly job only ever rebuilds
 * *yesterday*, so "today" would read zero for hours if it depended on
 * DailySummary. DailySummary only backs the 12-month chart, where a lag of
 * at most one un-rebuilt day is fine.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cash: CashService,
    private readonly stockViews: StockViewsService,
  ) {}

  async getSummary(from?: Date, to?: Date): Promise<DashboardSummary> {
    const now = new Date();
    const periodFrom = from ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodTo = to ?? now;

    const [todayProfit, periodProfit, cashBalance, lowStock] = await Promise.all([
      this.profitBetween(startOfDay(now), endOfDay(now)),
      this.profitBetween(startOfDay(periodFrom), endOfDay(periodTo)),
      this.cash.getCurrentBalance(),
      this.stockViews.lowStock(),
    ]);

    return {
      todayProfit: moneyStr(todayProfit),
      periodProfit: moneyStr(periodProfit),
      cashBalance: moneyStr(cashBalance),
      lowStockCount: lowStock.length,
    };
  }

  /** Last N months of DailySummary, aggregated in JS (small row count — no raw SQL needed). */
  async profitByMonth(months: number): Promise<ProfitByMonth[]> {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const rows = await this.prisma.dailySummary.findMany({
      where: { date: { gte: from } },
      orderBy: { date: 'asc' },
    });

    const buckets = new Map<
      string,
      { revenue: ReturnType<typeof dec>; cogs: ReturnType<typeof dec> }
    >();
    for (let i = 0; i < months; i++) {
      const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
      buckets.set(this.monthKey(d), { revenue: dec(0), cogs: dec(0) });
    }
    for (const row of rows) {
      const key = this.monthKey(row.date);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.revenue = bucket.revenue.plus(dec(row.revenue));
      bucket.cogs = bucket.cogs.plus(dec(row.cogs));
    }

    return Array.from(buckets.entries()).map(([month, b]) => ({
      month,
      revenue: moneyStr(b.revenue),
      cogs: moneyStr(b.cogs),
      profit: moneyStr(dec(b.revenue).minus(b.cogs)),
    }));
  }

  async categoryBreakdown(from: Date, to: Date): Promise<CategoryBreakdown[]> {
    const rows = await this.prisma.saleLine.groupBy({
      by: ['categoryNameSnapshot'],
      _sum: { lineTotal: true, cogs: true },
      where: { sale: { datetime: { gte: startOfDay(from), lte: endOfDay(to) } } },
    });
    return rows
      .map((r) => ({
        category: r.categoryNameSnapshot ?? '—',
        revenue: moneyStr(r._sum.lineTotal ?? 0),
        cogs: moneyStr(r._sum.cogs ?? 0),
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue));
  }

  private async profitBetween(gte: Date, lte: Date) {
    const agg = await this.prisma.sale.aggregate({
      _sum: { total: true, cogsTotal: true },
      where: { datetime: { gte, lte } },
    });
    return money(dec(agg._sum.total ?? 0).minus(dec(agg._sum.cogsTotal ?? 0)));
  }

  private monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
