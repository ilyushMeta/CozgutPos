import { Module } from '@nestjs/common';
import { SecondShopService } from './second-shop.service.js';
import { SecondShopController } from './second-shop.controller.js';
import { SalesModule } from '../sales/sales.module.js';
import { FifoModule } from '../fifo/fifo.module.js';
import { CashModule } from '../cash/cash.module.js';
import { CodesModule } from '../codes/codes.module.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SalesModule, FifoModule, CashModule, CodesModule, SettingsModule],
  controllers: [SecondShopController],
  providers: [SecondShopService],
})
export class SecondShopModule {}
