import { Injectable } from '@nestjs/common';
import { moneyStr, type PaymentMethod } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Per-payment-method discount % (SPEC §5.11). Seeded with one row per PaymentMethod. */
@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.paymentDiscount.findMany({ orderBy: { method: 'asc' } });
  }

  upsert(method: PaymentMethod, percent: number) {
    return this.prisma.paymentDiscount.upsert({
      where: { method },
      update: { percent: moneyStr(percent) },
      create: { method, percent: moneyStr(percent) },
    });
  }
}
