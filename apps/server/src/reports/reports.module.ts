import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DailySummaryService } from './daily-summary.service.js';
import { DailySummaryCron } from './daily-summary.cron.js';
import { DashboardService } from './dashboard.service.js';
import { ReportTablesService } from './report-tables.service.js';
import { ReportsController } from './reports.controller.js';
import { CashModule } from '../cash/cash.module.js';
import { StockViewsModule } from '../stock-views/stock-views.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), CashModule, StockViewsModule],
  controllers: [ReportsController],
  providers: [DailySummaryService, DailySummaryCron, DashboardService, ReportTablesService],
  exports: [DailySummaryService],
})
export class ReportsModule {}
