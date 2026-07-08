import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { returnInputSchema, type ReturnInput } from '@cozgut/shared';
import { ReturnsService } from './returns.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get('search')
  search(
    @Query('receiptNo') receiptNo?: string,
    @Query('saleId') saleId?: string,
    @Query('code') code?: string,
    @Query('date') date?: string,
  ) {
    return this.returns.search({
      receiptNo: receiptNo ? Number(receiptNo) : undefined,
      saleId: saleId ? Number(saleId) : undefined,
      code,
      date: date ? new Date(date) : undefined,
    });
  }

  @Post()
  create(@Body(new ZodValidationPipe(returnInputSchema)) body: ReturnInput) {
    return this.returns.createReturn(body.saleLineId, body.qty);
  }
}
