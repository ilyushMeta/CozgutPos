import { Injectable } from '@nestjs/common';
import { sumQty, qty, qtyStr, moneyStr, type RevisionLineInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';

/** Rewiz (SPEC §5.9): pick a product, compare system vs counted qty, apply the
 * correction via StockAdjustmentService, and keep the RevisionLine as the audit row. */
@Injectable()
export class RevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adjust: StockAdjustmentService,
  ) {}

  async getSystemQty(productId: number) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { batches: true },
    });
    return { productId, systemQty: sumQty(product.batches.map((b) => b.qtyRemaining)).toFixed(3) };
  }

  async createLine(input: RevisionLineInput) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: input.productId },
        include: { batches: true },
      });
      const systemQty = sumQty(product.batches.map((b) => b.qtyRemaining));
      const countedQty = qty(input.countedQty);
      const diff = qty(countedQty.minus(systemQty));

      const revision = input.revisionId
        ? await tx.stockRevision.findUniqueOrThrow({ where: { id: input.revisionId } })
        : await tx.stockRevision.create({ data: {} });

      const latestBatch = product.batches
        .slice()
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];

      const { amount, unitPrice } = await this.adjust.applyAdjustment(
        tx,
        input.productId,
        diff,
        latestBatch?.buyPrice,
      );

      return tx.revisionLine.create({
        data: {
          revisionId: revision.id,
          productId: input.productId,
          systemQty: qtyStr(systemQty),
          countedQty: qtyStr(countedQty),
          diff: qtyStr(diff),
          unitPrice: moneyStr(unitPrice),
          amount: moneyStr(amount),
          sellPriceRef: latestBatch ? moneyStr(latestBatch.sellPrice) : null,
          result: diff.isZero() ? 'match' : diff.lessThan(0) ? 'shortage' : 'surplus',
          note: input.note ?? null,
        },
      });
    });
  }

  findAll() {
    return this.prisma.revisionLine.findMany({
      include: { product: true },
      orderBy: { id: 'desc' },
    });
  }
}
