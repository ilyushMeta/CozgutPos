import { ForbiddenException, Injectable } from '@nestjs/common';
import { SettingKey } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<{ key: string; value: string }> {
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return { key: row.key, value: row.value };
  }

  /**
   * First-run wizard (SPEC §3): choose Server vs Client(server IP). Runs
   * before anyone has ever logged in, so it can't go through the normal
   * ADMIN-guarded settings PUT — instead it's a one-shot action that always
   * re-checks FIRST_RUN_DONE itself rather than trusting the caller.
   */
  async completeFirstRun(mode: 'SERVER' | 'CLIENT', serverIp?: string): Promise<void> {
    const already = await this.get(SettingKey.FIRST_RUN_DONE);
    if (already === 'true') throw new ForbiddenException('first-run already completed');

    await this.set(SettingKey.SERVER_MODE, mode);
    if (mode === 'CLIENT') await this.set(SettingKey.SERVER_IP, serverIp ?? '');
    await this.set(SettingKey.FIRST_RUN_DONE, 'true');
  }
}
