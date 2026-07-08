import { Module } from '@nestjs/common';
import { NeededProductsService } from './needed-products.service.js';
import { NeededProductsController } from './needed-products.controller.js';

@Module({
  controllers: [NeededProductsController],
  providers: [NeededProductsService],
})
export class NeededProductsModule {}
