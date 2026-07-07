import { Injectable } from '@nestjs/common';
import { CashMoveType, type Prisma, type CashMove } from '@prisma/client';
import { dec, money, moneyStr, type Numeric } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

const INCOMING: CashMoveType[] = [
  CashMoveType.SALE_CASH,
  CashMoveType.DEPOSIT,
  CashMoveType.DEBT_PAYMENT_IN,
];
const OUTGOING: CashMoveType[] = [CashMoveType.WITHDRAWAL, CashMoveType.PURCHASE_PAYMENT];

type Tx = PrismaService | Prisma.TransactionClient;

/**
 * Minimal cash-register balance tracking (SPEC §6.8's cashbox-payment path).
 * Phase 5 ("Kassa") will layer day-open/close on top of this — not duplicate it.
 * Every method accepts an optional Prisma transaction client so callers (e.g.
 * Receiving, SPEC §6.4-style atomic sale later) can compose it into their own
 * `$transaction`.
 */
@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentBalance(tx: Tx = this.prisma): Promise<import('decimal.js').Decimal> {
    const [incoming, outgoing] = await Promise.all([
      tx.cashMove.aggregate({ _sum: { amount: true }, where: { type: { in: INCOMING } } }),
      tx.cashMove.aggregate({ _sum: { amount: true }, where: { type: { in: OUTGOING } } }),
    ]);
    return money(dec(incoming._sum.amount ?? 0).minus(dec(outgoing._sum.amount ?? 0)));
  }

  /** Record a cash move, stamping `balanceBefore` from the current computed balance. */
  async recordMove(
    type: CashMoveType,
    amount: Numeric,
    note: string | undefined,
    tx: Tx = this.prisma,
  ): Promise<CashMove> {
    const balanceBefore = await this.getCurrentBalance(tx);
    return tx.cashMove.create({
      data: { type, amount: moneyStr(amount), balanceBefore: moneyStr(balanceBefore), note },
    });
  }
}
