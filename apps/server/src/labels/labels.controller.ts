import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LabelsService } from './labels.service.js';

@Controller('products')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get(':id/label')
  async label(
    @Param('id', ParseIntPipe) id: number,
    @Query('copies') copies: string | undefined,
    @Res() res: Response,
  ) {
    const pdf = await this.labels.buildLabelPdf(id, copies ? Number(copies) : 1);
    res
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="label-${id}.pdf"`)
      .send(pdf);
  }
}
