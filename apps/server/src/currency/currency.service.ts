import { Injectable } from '@nestjs/common';
import { moneyStr } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Walýuta — append-only exchange rate history (SPEC §5.11). Never mutates old rows. */
@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  current() {
    return this.prisma.exchangeRate.findFirst({ orderBy: { effectiveFrom: 'desc' } });
  }

  history() {
    return this.prisma.exchangeRate.findMany({ orderBy: { effectiveFrom: 'desc' } });
  }

  add(rate: number) {
    return this.prisma.exchangeRate.create({ data: { rate: moneyStr(rate) } });
  }
}
