import { Module } from '@nestjs/common';
import { ReceivingService } from './receiving.service.js';
import { ReceivingController } from './receiving.controller.js';
import { CodesModule } from '../codes/codes.module.js';
import { CashModule } from '../cash/cash.module.js';
import { PluModule } from '../plu/plu.module.js';

@Module({
  imports: [CodesModule, CashModule, PluModule],
  controllers: [ReceivingController],
  providers: [ReceivingService],
  exports: [ReceivingService],
})
export class ReceivingModule {}
