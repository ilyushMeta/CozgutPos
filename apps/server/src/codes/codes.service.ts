import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Internal code generator (SPEC §6.9, legacy funTazeKod). Separate sequences per
 * pool ('product' | 'composite' | 'debtor' | 'supplier' | 'invoice'); codes are
 * never reused. `next()` is a single atomic UPDATE, so it stays correct even if
 * two admins receive goods at the same time.
 */
@Injectable()
export class CodesService {
  constructor(private readonly prisma: PrismaService) {}

  async next(pool: string): Promise<number> {
    await this.prisma.codeSequence.upsert({
      where: { pool },
      update: {},
      create: { pool, next: 1 },
    });
    const row = await this.prisma.codeSequence.update({
      where: { pool },
      data: { next: { increment: 1 } },
    });
    return row.next - 1;
  }

  /** Next product code, skipping any value that collides with an existing/manual code. */
  async generateUniqueProductCode(): Promise<string> {
    for (;;) {
      const candidate = String(await this.next('product'));
      const exists = await this.prisma.product.findUnique({ where: { code: candidate } });
      if (!exists) return candidate;
    }
  }
}
