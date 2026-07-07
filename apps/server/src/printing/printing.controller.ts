import { Body, Controller, Get, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrintingService } from './printing.service.js';
import { FakturService } from './faktur.service.js';

@Controller('sales')
export class PrintingController {
  constructor(
    private readonly printing: PrintingService,
    private readonly faktur: FakturService,
  ) {}

  @Post(':id/print')
  print(@Param('id', ParseIntPipe) id: number, @Body('copies') copies?: string | number) {
    return this.printing.printReceipt(id, copies !== undefined ? Number(copies) : undefined);
  }

  @Get(':id/faktur')
  async getFaktur(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdf = await this.faktur.buildFakturPdf(id);
    res
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="faktur-${id}.pdf"`)
      .send(pdf);
  }
}
