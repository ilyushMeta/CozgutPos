import { Body, Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common';
import { stockBatchUpdateSchema, Role, type StockBatchUpdateInput } from '@cozgut/shared';
import { StockBatchesService } from './stock-batches.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('stock-batches')
export class StockBatchesController {
  constructor(private readonly stockBatches: StockBatchesService) {}

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(stockBatchUpdateSchema)) body: StockBatchUpdateInput,
  ) {
    return this.stockBatches.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockBatches.remove(id);
  }
}
