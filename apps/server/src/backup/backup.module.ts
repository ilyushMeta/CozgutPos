import { Module } from '@nestjs/common';
import { BackupService } from './backup.service.js';
import { BackupController } from './backup.controller.js';
import { BackupCron } from './backup.cron.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [BackupController],
  providers: [BackupService, BackupCron],
})
export class BackupModule {}
