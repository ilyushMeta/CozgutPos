import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailySummaryService } from './daily-summary.service.js';

/** Nightly DailySummary rollup for "yesterday" (SPEC §6.13) — runs once the day has fully closed. */
@Injectable()
export class DailySummaryCron {
  private readonly logger = new Logger(DailySummaryCron.name);

  constructor(private readonly dailySummary: DailySummaryService) {}

  @Cron('10 0 * * *')
  async rebuildYesterday(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await this.dailySummary.rebuild(yesterday);
    this.logger.log(`DailySummary rebuilt for ${yesterday.toISOString().slice(0, 10)}`);
  }
}
