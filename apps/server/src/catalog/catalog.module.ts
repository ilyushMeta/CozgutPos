import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { UnitPacksService } from './unit-packs.service.js';
import { UnitPacksController } from './unit-packs.controller.js';
import { StockBatchesService } from './stock-batches.service.js';
import { StockBatchesController } from './stock-batches.controller.js';
import { CodesModule } from '../codes/codes.module.js';
import { PluModule } from '../plu/plu.module.js';

@Module({
  imports: [CodesModule, PluModule],
  controllers: [
    CategoriesController,
    ProductsController,
    UnitPacksController,
    StockBatchesController,
  ],
  providers: [CategoriesService, ProductsService, UnitPacksService, StockBatchesService],
  exports: [CategoriesService, ProductsService, UnitPacksService, StockBatchesService],
})
export class CatalogModule {}
