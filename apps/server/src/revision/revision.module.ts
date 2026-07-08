import { Module } from '@nestjs/common';
import { RevisionService } from './revision.service.js';
import { RevisionController } from './revision.controller.js';
import { StocktakeService } from './stocktake.service.js';
import { StocktakeController } from './stocktake.controller.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';
import { FifoModule } from '../fifo/fifo.module.js';

@Module({
  imports: [FifoModule],
  controllers: [RevisionController, StocktakeController],
  providers: [RevisionService, StocktakeService, StockAdjustmentService],
})
export class RevisionModule {}
