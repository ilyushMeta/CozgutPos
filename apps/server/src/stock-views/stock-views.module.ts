import { Module } from '@nestjs/common';
import { StockViewsService } from './stock-views.service.js';
import { StockViewsController } from './stock-views.controller.js';

@Module({
  controllers: [StockViewsController],
  providers: [StockViewsService],
})
export class StockViewsModule {}
