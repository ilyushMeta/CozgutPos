import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { CodesModule } from '../codes/codes.module.js';
import { CashModule } from '../cash/cash.module.js';

@Module({
  imports: [CodesModule, CashModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
