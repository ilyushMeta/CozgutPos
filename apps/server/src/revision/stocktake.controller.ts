import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  stocktakeScanSchema,
  toCsv,
  type CsvColumn,
  type StocktakeScanInput,
} from '@cozgut/shared';
import { StocktakeService } from './stocktake.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

const STOCKTAKE_LINE_COLUMNS: CsvColumn<any>[] = [
  { header: 'Kod', value: (l) => l.product.code },
  { header: 'Ady', value: (l) => l.product.name },
  { header: 'Sistem mukdary', value: (l) => l.systemQty },
  { header: 'Sanalan mukdar', value: (l) => l.countedQty },
  { header: 'Tapawut', value: (l) => l.diff },
];

@Controller('stocktake')
export class StocktakeController {
  constructor(private readonly stocktake: StocktakeService) {}

  @Post('start')
  start() {
    return this.stocktake.start();
  }

  @Post(':id/scan')
  scan(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(stocktakeScanSchema)) body: StocktakeScanInput,
  ) {
    return this.stocktake.scan(id, body.productId, body.countedQty);
  }

  @Post(':id/finish')
  finish(@Param('id', ParseIntPipe) id: number) {
    return this.stocktake.finish(id);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const stocktake = await this.stocktake.findOne(id);
    if (format === 'csv') {
      res
        .status(200)
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="tukelleme-${id}.csv"`)
        .send(toCsv(stocktake.lines, STOCKTAKE_LINE_COLUMNS));
      return;
    }
    res.status(200).json(stocktake);
  }
}
