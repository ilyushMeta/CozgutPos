import { BadRequestException, Injectable } from '@nestjs/common';
import { StocktakeStatus } from '@prisma/client';
import { dec, moneyStr, qty, qtyStr, sumQty, type Numeric } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';

/**
 * Tükelleme (SPEC §5.9): a counting session. Scanning records each product's
 * counted-vs-system diff into a StocktakeLine; finishing applies every
 * nonzero diff via the same StockAdjustmentService Rewiz uses, writing the
 * corrections as RevisionLine rows ("creates revision entries").
 */
@Injectable()
export class StocktakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adjust: StockAdjustmentService,
  ) {}

  start() {
    return this.prisma.stocktake.create({ data: {} });
  }

  async scan(stocktakeId: number, productId: number, countedQtyInput: Numeric) {
    const stocktake = await this.prisma.stocktake.findUniqueOrThrow({
      where: { id: stocktakeId },
    });
    if (stocktake.status !== StocktakeStatus.OPEN) {
      throw new BadRequestException('stocktake already finished');
    }

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { batches: true },
    });
    const systemQty = sumQty(product.batches.map((b) => b.qtyRemaining));
    const countedQty = qty(countedQtyInput);
    const diff = qty(countedQty.minus(systemQty));

    const existing = await this.prisma.stocktakeLine.findFirst({
      where: { stocktakeId, productId },
    });
    const data = {
      countedQty: qtyStr(countedQty),
      systemQty: qtyStr(systemQty),
      diff: qtyStr(diff),
    };
    if (existing) {
      return this.prisma.stocktakeLine.update({ where: { id: existing.id }, data });
    }
    return this.prisma.stocktakeLine.create({ data: { stocktakeId, productId, ...data } });
  }

  async finish(stocktakeId: number) {
    return this.prisma.$transaction(async (tx) => {
      const stocktake = await tx.stocktake.findUniqueOrThrow({
        where: { id: stocktakeId },
        include: { lines: true },
      });
      if (stocktake.status !== StocktakeStatus.OPEN) {
        throw new BadRequestException('stocktake already finished');
      }

      const revision = await tx.stockRevision.create({
        data: { note: `Tükelleme #${stocktakeId}` },
      });

      for (const line of stocktake.lines) {
        const diff = dec(line.diff);
        if (diff.isZero()) continue;

        const product = await tx.product.findUniqueOrThrow({
          where: { id: line.productId },
          include: { batches: true },
        });
        const latestBatch = product.batches
          .slice()
          .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];

        const { amount, unitPrice } = await this.adjust.applyAdjustment(
          tx,
          line.productId,
          diff,
          latestBatch?.buyPrice,
        );

        await tx.revisionLine.create({
          data: {
            revisionId: revision.id,
            productId: line.productId,
            systemQty: line.systemQty,
            countedQty: line.countedQty,
            diff: line.diff,
            unitPrice: moneyStr(unitPrice),
            amount: moneyStr(amount),
            sellPriceRef: latestBatch ? moneyStr(latestBatch.sellPrice) : null,
            result: diff.lessThan(0) ? 'shortage' : 'surplus',
            note: `Tükelleme #${stocktakeId}`,
          },
        });
      }

      return tx.stocktake.update({
        where: { id: stocktakeId },
        data: { status: StocktakeStatus.FINISHED, finishedAt: new Date() },
      });
    });
  }

  findOne(id: number) {
    return this.prisma.stocktake.findUniqueOrThrow({
      where: { id },
      include: { lines: { include: { product: true } } },
    });
  }
}
