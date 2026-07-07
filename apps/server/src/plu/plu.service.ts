import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { SettingKey, translit } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

const DEFAULT_TEMPLATE = '{plu}\t{name}\t{price}\t{code}';

/**
 * PLU export for weighing scales (SPEC §7.3, replaces legacy plu.bat). Writes a
 * plain text/CSV file of scale-item products to the configured path and
 * optionally runs a configured command afterward (e.g. to push the file to
 * the scale). The command is only ever the value an ADMIN saved in Settings —
 * never derived from request input — mirroring the legacy plu.bat launch.
 */
@Injectable()
export class PluService {
  private readonly logger = new Logger(PluService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Run the export only if the operator has enabled the scale (Settings). */
  async exportIfEnabled(): Promise<{ path: string; count: number } | null> {
    const enabled = await this.settings.get(SettingKey.SCALE_ENABLED);
    if (enabled !== 'true') return null;
    return this.export();
  }

  /** Same as exportIfEnabled(), but swallows/logs errors — for fire-and-forget triggers. */
  async exportSafely(): Promise<void> {
    try {
      await this.exportIfEnabled();
    } catch (e) {
      this.logger.warn(`PLU export failed: ${(e as Error).message}`);
    }
  }

  async export(): Promise<{ path: string; count: number }> {
    const path = await this.settings.get(SettingKey.SCALE_PLU_PATH);
    if (!path) throw new BadRequestException('scale.pluPath is not configured');
    const template = (await this.settings.get(SettingKey.SCALE_PLU_TEMPLATE)) || DEFAULT_TEMPLATE;

    const products = await this.prisma.product.findMany({
      where: { isScaleItem: true },
      include: { batches: { where: { qtyRemaining: { gt: 0 } }, orderBy: { receivedAt: 'asc' } } },
      orderBy: { id: 'asc' },
    });

    const lines = products.map((p) =>
      template
        .replaceAll('{plu}', String(p.id))
        .replaceAll('{name}', translit(p.name))
        .replaceAll('{price}', String(p.batches[0]?.sellPrice ?? '0'))
        .replaceAll('{code}', p.code),
    );

    await writeFile(path, lines.length ? lines.join('\n') + '\n' : '', 'utf8');

    const command = await this.settings.get(SettingKey.SCALE_COMMAND);
    if (command) {
      exec(command, (err) => {
        if (err) this.logger.warn(`PLU post-export command failed: ${err.message}`);
      });
    }

    return { path, count: products.length };
  }
}
