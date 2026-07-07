import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { dec, moneyStr, type StockBatchUpdateInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StockBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Price-only correction (SPEC §5.4) — see doc comment on stockBatchUpdateSchema. */
  async update(id: number, input: StockBatchUpdateInput) {
    await this.ensureExists(id);
    return this.prisma.stockBatch.update({
      where: { id },
      data: {
        buyPrice: moneyStr(input.buyPrice),
        sellPrice: moneyStr(input.sellPrice),
        sellPriceUSD: input.sellPriceUSD != null ? moneyStr(input.sellPriceUSD) : null,
        currency: input.currency,
      },
    });
  }

  /** Guarded delete: only a batch nothing has been sold/returned against yet. */
  async remove(id: number): Promise<void> {
    const batch = await this.ensureExists(id);
    if (!dec(batch.qtyRemaining).equals(dec(batch.qtyInitial))) {
      throw new ConflictException('batch already has sales or returns against it');
    }
    await this.prisma.stockBatch.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const batch = await this.prisma.stockBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('stock batch not found');
    return batch;
  }
}
