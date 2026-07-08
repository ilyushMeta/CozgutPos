import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupService } from './backup.service.js';

/** Daily backup schedule (SPEC §5.14) — no-ops unless BACKUP_SCHEDULE_ENABLED is set. */
@Injectable()
export class BackupCron {
  constructor(private readonly backup: BackupService) {}

  @Cron('0 2 * * *')
  async runScheduledBackup(): Promise<void> {
    await this.backup.runScheduledBackup();
  }
}
