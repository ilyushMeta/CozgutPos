import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  rebuildDailySummarySchema,
  Role,
  type RebuildDailySummaryInput,
  type PaymentMethod,
  type CsvColumn,
} from '@cozgut/shared';
import { DailySummaryService } from './daily-summary.service.js';
import { DashboardService } from './dashboard.service.js';
import { ReportTablesService } from './report-tables.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { respondCsvOrJson } from '../common/csv-response.js';

const SOLD_ITEMS_COLUMNS: CsvColumn<any>[] = [
  { header: 'Söwda nomeri', value: (l) => l.sale.receiptNo },
  { header: 'Sene', value: (l) => new Date(l.sale.datetime).toISOString() },
  { header: 'Ady', value: (l) => l.productNameSnapshot },
  { header: 'Kod', value: (l) => l.product.code },
  { header: 'Kategoriýa', value: (l) => l.categoryNameSnapshot },
  { header: 'Mukdar', value: (l) => l.qty },
  { header: 'Birlik baha', value: (l) => l.unitPrice },
  { header: 'Jemi', value: (l) => l.lineTotal },
];

const RECEIPTS_COLUMNS: CsvColumn<any>[] = [
  { header: 'Söwda nomeri', value: (s) => s.receiptNo },
  { header: 'Sene', value: (s) => new Date(s.datetime).toISOString() },
  { header: 'Kassir', value: (s) => s.cashier.username },
  { header: 'Karzçy', value: (s) => s.debtor?.name },
  { header: 'Jemi', value: (s) => s.total },
  { header: 'Nagt', value: (s) => s.paidCash },
  { header: 'Nagt däl', value: (s) => s.paidCard },
  { header: 'Karz', value: (s) => s.paidDebt },
];

const LOGIN_AUDIT_COLUMNS: CsvColumn<any>[] = [
  { header: 'Ulanyjy', value: (a) => a.user.username },
  { header: 'Sene', value: (a) => new Date(a.at).toISOString() },
];

const DEBT_PAYMENTS_COLUMNS: CsvColumn<any>[] = [
  { header: 'Karzçy', value: (p) => p.debtor.name },
  { header: 'Sene', value: (p) => new Date(p.datetime).toISOString() },
  { header: 'Möçber', value: (p) => p.amount },
  { header: 'Walýuta', value: (p) => p.currency },
  { header: 'Bellik', value: (p) => p.note },
];

const SUPPLIER_DEBT_MOVES_COLUMNS: CsvColumn<any>[] = [
  { header: 'Dükan', value: (m) => m.supplier.name },
  { header: 'Sene', value: (m) => new Date(m.txDate).toISOString() },
  { header: 'Görnüş', value: (m) => m.type },
  { header: 'Möçber', value: (m) => m.amount },
  { header: 'Başdaky galyndy', value: (m) => m.opening },
  { header: 'Soňky galyndy', value: (m) => m.closing },
];

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly dailySummary: DailySummaryService,
    private readonly dashboard: DashboardService,
    private readonly tables: ReportTablesService,
  ) {}

  @Roles(Role.ADMIN)
  @Post('daily-summary/rebuild')
  rebuildDailySummary(
    @Body(new ZodValidationPipe(rebuildDailySummarySchema)) body: RebuildDailySummaryInput,
  ) {
    return this.dailySummary.rebuildRange(body.from, body.to);
  }

  @Get('dashboard')
  dashboardSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.getSummary(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('profit-by-month')
  profitByMonth(@Query('months') months?: string) {
    return this.dashboard.profitByMonth(months ? Number(months) : 12);
  }

  @Get('category-breakdown')
  categoryBreakdown(@Query('from') from?: string, @Query('to') to?: string) {
    const now = new Date();
    return this.dashboard.categoryBreakdown(
      from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to ? new Date(to) : now,
    );
  }

  @Get('sold-items')
  async soldItems(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('search') search: string | undefined,
    @Query('category') category: string | undefined,
    @Query('receiptNo') receiptNo: string | undefined,
    @Query('paymentMethod') paymentMethod: PaymentMethod | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.tables.soldItems({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      search,
      category,
      receiptNo: receiptNo ? Number(receiptNo) : undefined,
      paymentMethod,
    });
    respondCsvOrJson(res, format, 'satylan-harytlar.csv', rows, SOLD_ITEMS_COLUMNS);
  }

  @Get('receipts')
  async receipts(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('receiptNo') receiptNo: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.tables.receipts({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      receiptNo: receiptNo ? Number(receiptNo) : undefined,
    });
    respondCsvOrJson(res, format, 'cekler.csv', rows, RECEIPTS_COLUMNS);
  }

  @Get('login-audit')
  async loginAudit(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.tables.loginAudit({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    respondCsvOrJson(res, format, 'giris-taryhy.csv', rows, LOGIN_AUDIT_COLUMNS);
  }

  @Get('debt-payments')
  async debtPayments(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.tables.debtPayments({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    respondCsvOrJson(res, format, 'karz-tolegleri.csv', rows, DEBT_PAYMENTS_COLUMNS);
  }

  @Get('supplier-debt-moves')
  async supplierDebtMoves(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.tables.supplierDebtMoves({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    respondCsvOrJson(res, format, 'dukan-karz-hereketleri.csv', rows, SUPPLIER_DEBT_MOVES_COLUMNS);
  }
}
