import { Module } from '@nestjs/common';
import { SmsService } from './sms.service.js';
import { SmsController } from './sms.controller.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
