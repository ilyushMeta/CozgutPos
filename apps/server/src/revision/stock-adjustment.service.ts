import { Injectable } from '@nestjs/common';
import { Currency, type Prisma } from '@prisma/client';
import { dec, money, moneyStr, qty, qtyStr, type Numeric } from '@cozgut/shared';
import { FifoService } from '../fifo/fifo.service.js';

type Tx = Prisma.TransactionClient;

/**
 * Applies a counted-vs-system quantity diff to real StockBatch rows (SPEC
 * §5.9, shared by Rewiz and Tükelleme so the correction logic exists once).
 *
 * diff<0 (shortage): consumed oldest-first via FifoService — same engine a
 * sale uses, but no Sale/SaleLine is created — money impact = the resulting
 * COGS (value of the lost stock at cost).
 * diff>0 (surplus): a brand-new StockBatch is created for the "found" stock,
 * priced at unitPriceHint (falls back to the product's latest known buy
 * price when omitted).
 */
@Injectable()
export class StockAdjustmentService {
  constructor(private readonly fifo: FifoService) {}

  async applyAdjustment(
    tx: Tx,
    productId: number,
    diff: Numeric,
    unitPriceHint?: Numeric,
  ): Promise<{ amount: ReturnType<typeof money>; unitPrice: ReturnType<typeof money> }> {
    const d = qty(diff);
    if (d.isZero()) {
      return { amount: dec(0), unitPrice: money(unitPriceHint ?? 0) };
    }

    if (d.lessThan(0)) {
      const shortfall = d.abs();
      const { cogs } = await this.fifo.deduct(tx, productId, shortfall, 'fifo');
      const unitPrice = shortfall.isZero() ? money(0) : money(cogs.dividedBy(shortfall));
      return { amount: cogs, unitPrice };
    }

    const latestBatch = await tx.stockBatch.findFirst({
      where: { productId },
      orderBy: { receivedAt: 'desc' },
    });
    const buyPrice = money(unitPriceHint ?? latestBatch?.buyPrice ?? 0);
    const sellPrice = money(latestBatch?.sellPrice ?? buyPrice);
    await tx.stockBatch.create({
      data: {
        productId,
        qtyInitial: qtyStr(d),
        qtyRemaining: qtyStr(d),
        buyPrice: moneyStr(buyPrice),
        sellPrice: moneyStr(sellPrice),
        currency: Currency.TMT,
        receivedAt: new Date(),
      },
    });
    return { amount: money(d.times(buyPrice)), unitPrice: buyPrice };
  }
}
