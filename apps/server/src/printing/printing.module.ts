import { Module } from '@nestjs/common';
import { PrintingService } from './printing.service.js';
import { FakturService } from './faktur.service.js';
import { PrintingController } from './printing.controller.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [PrintingController],
  providers: [PrintingService, FakturService],
  exports: [PrintingService],
})
export class PrintingModule {}
