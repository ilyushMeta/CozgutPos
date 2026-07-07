import { Module } from '@nestjs/common';
import { PluService } from './plu.service.js';
import { PluController } from './plu.controller.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [PluController],
  providers: [PluService],
  exports: [PluService],
})
export class PluModule {}
