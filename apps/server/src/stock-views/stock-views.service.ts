import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { dec, qty } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

function sumRemaining(batches: { qtyRemaining: Prisma.Decimal }[]) {
  return qty(batches.reduce((acc, b) => acc.plus(dec(b.qtyRemaining)), dec(0)));
}

/** Stock views (SPEC §5.4): Ammar, out-of-stock, low-stock, expiring-soon. */
@Injectable()
export class StockViewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ammar: every batch, newest search first, joined with product/category. */
  ammar(search?: string) {
    return this.prisma.stockBatch.findMany({
      where: search
        ? {
            product: {
              OR: [{ name: { contains: search } }, { code: { contains: search } }],
            },
          }
        : undefined,
      include: { product: { include: { category: true } } },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async outOfStock() {
    const products = await this.productsWithBatches();
    return products
      .map((p) => ({ ...p, remaining: sumRemaining(p.batches) }))
      .filter((p) => p.remaining.isZero());
  }

  async lowStock() {
    const products = await this.productsWithBatches();
    return products
      .map((p) => ({ ...p, remaining: sumRemaining(p.batches) }))
      .filter(
        (p) =>
          p.remaining.greaterThan(0) && p.remaining.lessThanOrEqualTo(dec(p.lowStockThreshold)),
      );
  }

  expiringSoon(days: number, categoryId?: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return this.prisma.product.findMany({
      where: {
        expiryDate: { not: null, lte: cutoff },
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  private productsWithBatches() {
    return this.prisma.product.findMany({
      include: { category: true, batches: true },
    });
  }
}
