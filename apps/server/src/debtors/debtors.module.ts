import { Module } from '@nestjs/common';
import { DebtorsService } from './debtors.service.js';
import { DebtorsController } from './debtors.controller.js';
import { DebtSaleService } from './debt-sale.service.js';
import { CodesModule } from '../codes/codes.module.js';
import { CashModule } from '../cash/cash.module.js';
import { PrintingModule } from '../printing/printing.module.js';
import { SmsModule } from '../sms/sms.module.js';

@Module({
  imports: [CodesModule, CashModule, PrintingModule, SmsModule],
  controllers: [DebtorsController],
  providers: [DebtorsService, DebtSaleService],
  exports: [DebtSaleService],
})
export class DebtorsModule {}
