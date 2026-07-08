import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, money, moneyStr, startOfDay, endOfDay } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * DailySummary nightly + on-demand rollup (SPEC §5.13, §6.13):
 * revenue = Σ Sale.total, cogs = Σ Sale.cogsTotal, profit = revenue − cogs,
 * across ALL shops (MAIN + SECOND) for that calendar date. Returns already
 * decrement Sale.total/cogsTotal in place, so a rebuild picks up reversals
 * automatically without any Return-specific logic here.
 */
@Injectable()
export class DailySummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async rebuild(date: Date) {
    const day = startOfDay(date);
    const agg = await this.prisma.sale.aggregate({
      _sum: { total: true, cogsTotal: true },
      where: { datetime: { gte: day, lte: endOfDay(date) } },
    });
    const revenue = money(agg._sum.total ?? 0);
    const cogs = money(agg._sum.cogsTotal ?? 0);
    const profit = money(dec(revenue).minus(cogs));
    return this.prisma.dailySummary.upsert({
      where: { date: day },
      update: { revenue: moneyStr(revenue), cogs: moneyStr(cogs), profit: moneyStr(profit) },
      create: {
        date: day,
        revenue: moneyStr(revenue),
        cogs: moneyStr(cogs),
        profit: moneyStr(profit),
      },
    });
  }

  /** Rebuilds an explicit [from,to] range, or every distinct Sale date when omitted. */
  async rebuildRange(from?: Date, to?: Date) {
    const dates = from && to ? this.datesBetween(from, to) : await this.distinctSaleDates();
    const results = [];
    for (const date of dates) {
      results.push(await this.rebuild(date));
    }
    return results;
  }

  private datesBetween(from: Date, to: Date): Date[] {
    const dates: Date[] = [];
    let cursor = startOfDay(from);
    const end = startOfDay(to);
    while (cursor.getTime() <= end.getTime()) {
      dates.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    return dates;
  }

  private async distinctSaleDates(): Promise<Date[]> {
    const rows = await this.prisma.$queryRaw<{ d: Date }[]>(
      Prisma.sql`SELECT DISTINCT DATE(datetime) AS d FROM sales ORDER BY d ASC`,
    );
    return rows.map((r) => new Date(r.d));
  }
}
