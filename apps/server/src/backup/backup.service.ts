import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { SettingKey, type BackupFileInfo } from '@cozgut/shared';
import { SettingsService } from '../settings/settings.service.js';
import { encryptBackup, decryptBackup } from './backup-crypto.js';
import { parseDatabaseUrl, type DbConnInfo } from './db-url.js';

const DEFAULT_RETENTION_DAYS = 30;
const EXTENSION = '.sql.gz.enc';

function runCapture(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  stdin?: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString()}`));
      else resolve(Buffer.concat(out));
    });
    if (stdin) child.stdin.end(stdin);
  });
}

/**
 * Ätiýaçlyk nusga (SPEC §5.14): mysqldump → gzip → AES-256-GCM (backup-crypto.ts),
 * with folder/password/retention read from Settings. The mysqldump/mysql CLI
 * invocations are isolated in dumpDatabase()/restoreDatabase() so the
 * orchestration logic (settings validation, retention, filename safety) can
 * be unit-tested without a real MySQL install.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly settings: SettingsService) {}

  async create(): Promise<BackupFileInfo> {
    const folder = await this.requireFolder();
    const password = await this.requirePassword();
    const db = this.dbConnInfo();

    await mkdir(folder, { recursive: true });
    const sqlDump = await this.dumpDatabase(db);
    const encrypted = await encryptBackup(sqlDump, password);

    const filename = `cozgut-backup-${new Date().toISOString().replace(/[:.]/g, '-')}${EXTENSION}`;
    await writeFile(join(folder, filename), encrypted);

    await this.enforceRetention(folder);
    return this.fileInfo(folder, filename);
  }

  async list(): Promise<BackupFileInfo[]> {
    const folder = await this.settings.get(SettingKey.BACKUP_FOLDER);
    if (!folder) return [];
    const files = await readdir(folder).catch(() => []);
    const infos = await Promise.all(
      files.filter((f) => f.endsWith(EXTENSION)).map((f) => this.fileInfo(folder, f)),
    );
    return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async remove(filename: string): Promise<void> {
    const folder = await this.requireFolder();
    this.assertSafeFilename(filename);
    await unlink(join(folder, filename));
  }

  async restore(fileBuffer: Buffer, password: string): Promise<void> {
    const sqlDump = await decryptBackup(fileBuffer, password);
    await this.restoreDatabase(this.dbConnInfo(), sqlDump);
  }

  /** Cron entry point (SPEC §5.14 daily schedule) — no-ops unless the operator enabled it. */
  async runScheduledBackup(): Promise<void> {
    const enabled = await this.settings.get(SettingKey.BACKUP_SCHEDULE_ENABLED);
    if (enabled !== 'true') return;
    try {
      const info = await this.create();
      this.logger.log(`Scheduled backup created: ${info.filename}`);
    } catch (e) {
      this.logger.warn(`Scheduled backup failed: ${(e as Error).message}`);
    }
  }

  private dbConnInfo(): DbConnInfo {
    return parseDatabaseUrl(process.env.DATABASE_URL ?? '');
  }

  private dumpDatabase(db: DbConnInfo): Promise<Buffer> {
    return runCapture(
      'mysqldump',
      ['-h', db.host, '-P', db.port, '-u', db.user, '--single-transaction', db.database],
      { ...process.env, MYSQL_PWD: db.password },
    );
  }

  private async restoreDatabase(db: DbConnInfo, sql: Buffer): Promise<void> {
    const env = { ...process.env, MYSQL_PWD: db.password };
    await runCapture(
      'mysql',
      [
        '-h',
        db.host,
        '-P',
        db.port,
        '-u',
        db.user,
        '-e',
        `CREATE DATABASE IF NOT EXISTS \`${db.database}\``,
      ],
      env,
    );
    await runCapture('mysql', ['-h', db.host, '-P', db.port, '-u', db.user, db.database], env, sql);
  }

  private async enforceRetention(folder: string): Promise<void> {
    const retentionSetting = await this.settings.get(SettingKey.BACKUP_RETENTION_DAYS);
    const retentionDays = retentionSetting ? Number(retentionSetting) : DEFAULT_RETENTION_DAYS;
    const cutoff = Date.now() - retentionDays * 86_400_000;
    const files = await this.list();
    for (const f of files) {
      if (new Date(f.createdAt).getTime() < cutoff) {
        await unlink(join(folder, f.filename)).catch(() => undefined);
      }
    }
  }

  private async fileInfo(folder: string, filename: string): Promise<BackupFileInfo> {
    const stats = await stat(join(folder, filename));
    return { filename, sizeBytes: stats.size, createdAt: stats.birthtime.toISOString() };
  }

  private assertSafeFilename(filename: string): void {
    if (filename !== basename(filename) || !filename.endsWith(EXTENSION)) {
      throw new BadRequestException('invalid filename');
    }
  }

  private async requireFolder(): Promise<string> {
    const folder = await this.settings.get(SettingKey.BACKUP_FOLDER);
    if (!folder) throw new BadRequestException('backup.folder is not configured');
    return folder;
  }

  private async requirePassword(): Promise<string> {
    const password = await this.settings.get(SettingKey.BACKUP_PASSWORD);
    if (!password) throw new BadRequestException('backup.password is not configured');
    return password;
  }
}
