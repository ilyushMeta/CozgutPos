import { Module } from '@nestjs/common';
import { SalesService } from './sales.service.js';
import { SalesValidationService } from './sales-validation.service.js';
import { SalesController } from './sales.controller.js';
import { FifoModule } from '../fifo/fifo.module.js';
import { CashModule } from '../cash/cash.module.js';
import { CodesModule } from '../codes/codes.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PrintingModule } from '../printing/printing.module.js';
import { DebtorsModule } from '../debtors/debtors.module.js';
import { SmsModule } from '../sms/sms.module.js';

@Module({
  imports: [
    FifoModule,
    CashModule,
    CodesModule,
    SettingsModule,
    PrintingModule,
    DebtorsModule,
    SmsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesValidationService],
  exports: [SalesService],
})
export class SalesModule {}
