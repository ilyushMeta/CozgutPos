import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { toCsv, type CsvColumn } from '@cozgut/shared';
import { StockViewsService } from './stock-views.service.js';

/** Sends JSON or (when `?format=csv`) a CSV attachment. Uses full manual `@Res()`
 * mode (no passthrough) since Nest's passthrough response handling re-serializes
 * the handler's return value as JSON, which would corrupt a CSV/binary body. */
function respond(
  res: Response,
  format: string | undefined,
  filename: string,
  rows: unknown[],
  columns: CsvColumn<any>[],
) {
  if (format === 'csv') {
    res
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(toCsv(rows, columns));
  } else {
    res.status(200).json(rows);
  }
}

const AMMAR_COLUMNS: CsvColumn<any>[] = [
  { header: 'Kod', value: (r) => r.product.code },
  { header: 'Ady', value: (r) => r.product.name },
  { header: 'Kategoriýa', value: (r) => r.product.category?.name },
  { header: 'Galyndy', value: (r) => r.qtyRemaining },
  { header: 'Alnan baha', value: (r) => r.buyPrice },
  { header: 'Satlyk baha', value: (r) => r.sellPrice },
  { header: 'Walýuta', value: (r) => r.currency },
  { header: 'Sene', value: (r) => new Date(r.receivedAt).toISOString().slice(0, 10) },
  { header: 'Faktur', value: (r) => r.invoiceNo },
];

const STOCK_LEVEL_COLUMNS: CsvColumn<any>[] = [
  { header: 'Kod', value: (r) => r.code },
  { header: 'Ady', value: (r) => r.name },
  { header: 'Kategoriýa', value: (r) => r.category?.name },
  { header: 'Galyndy', value: (r) => r.remaining.toFixed(3) },
  { header: 'Iň az mukdar', value: (r) => r.lowStockThreshold },
];

const EXPIRING_COLUMNS: CsvColumn<any>[] = [
  { header: 'Kod', value: (r) => r.code },
  { header: 'Ady', value: (r) => r.name },
  { header: 'Kategoriýa', value: (r) => r.category?.name },
  { header: 'Möhlet', value: (r) => new Date(r.expiryDate).toISOString().slice(0, 10) },
];

@Controller('stock')
export class StockViewsController {
  constructor(private readonly stockViews: StockViewsService) {}

  @Get('ammar')
  async ammar(
    @Query('search') search: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.stockViews.ammar(search);
    respond(res, format, 'ammar.csv', rows, AMMAR_COLUMNS);
  }

  @Get('out-of-stock')
  async outOfStock(@Query('format') format: string | undefined, @Res() res: Response) {
    const rows = await this.stockViews.outOfStock();
    respond(res, format, 'gutaran.csv', rows, STOCK_LEVEL_COLUMNS);
  }

  @Get('low-stock')
  async lowStock(@Query('format') format: string | undefined, @Res() res: Response) {
    const rows = await this.stockViews.lowStock();
    respond(res, format, 'azalan.csv', rows, STOCK_LEVEL_COLUMNS);
  }

  @Get('expiring-soon')
  async expiringSoon(
    @Query('days') days: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.stockViews.expiringSoon(
      days ? Number(days) : 30,
      categoryId ? Number(categoryId) : undefined,
    );
    respond(res, format, 'mohleti-azalanlar.csv', rows, EXPIRING_COLUMNS);
  }
}
