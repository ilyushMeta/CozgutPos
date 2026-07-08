import { z } from 'zod';

/** DailySummary on-demand rebuild (SPEC §6.13). Omitted range = rebuild every distinct Sale date. */
export const rebuildDailySummarySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type RebuildDailySummaryInput = z.infer<typeof rebuildDailySummarySchema>;

export interface ProfitByMonth {
  month: string; // 'YYYY-MM'
  revenue: string;
  cogs: string;
  profit: string;
}

export interface CategoryBreakdown {
  category: string;
  revenue: string;
  cogs: string;
}

export interface DashboardSummary {
  todayProfit: string;
  periodProfit: string;
  cashBalance: string;
  lowStockCount: number;
}
