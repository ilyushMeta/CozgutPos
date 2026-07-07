import { Module } from '@nestjs/common';
import { CashService } from './cash.service.js';

@Module({
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
