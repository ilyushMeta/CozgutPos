import { Injectable } from '@nestjs/common';
import { CashMoveType, type Prisma, type CashMove, type CashRegisterDay } from '@prisma/client';
import { dec, money, moneyStr, sumMoney, type Numeric } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

const INCOMING: CashMoveType[] = [
  CashMoveType.SALE_CASH,
  CashMoveType.DEPOSIT,
  CashMoveType.DEBT_PAYMENT_IN,
];
const OUTGOING: CashMoveType[] = [CashMoveType.WITHDRAWAL, CashMoveType.PURCHASE_PAYMENT];

type Tx = PrismaService | Prisma.TransactionClient;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

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

  /**
   * The day's CashRegisterDay row (SPEC §5.7), creating it on first read with
   * the current running balance as its opening balance — i.e. "the drawer
   * already has whatever was left over" until an explicit openDay() call
   * (PulGoýmak) overrides it with a counted amount.
   */
  async getOrCreateDay(date: Date): Promise<CashRegisterDay> {
    const day = startOfDay(date);
    const existing = await this.prisma.cashRegisterDay.findUnique({ where: { date: day } });
    if (existing) return existing;
    const openingBalance = await this.getCurrentBalance();
    return this.prisma.cashRegisterDay.create({
      data: { date: day, openingBalance: moneyStr(openingBalance) },
    });
  }

  /** PulGoýmak — records a counted opening balance for the day (no CashMove: this
   * documents what's physically in the drawer, it isn't new money arriving). */
  async openDay(date: Date, openingBalance: Numeric): Promise<CashRegisterDay> {
    const day = startOfDay(date);
    return this.prisma.cashRegisterDay.upsert({
      where: { date: day },
      update: { openingBalance: moneyStr(openingBalance) },
      create: { date: day, openingBalance: moneyStr(openingBalance) },
    });
  }

  async getMoves(from: Date, to: Date): Promise<CashMove[]> {
    return this.prisma.cashMove.findMany({
      where: { datetime: { gte: from, lte: to } },
      orderBy: { datetime: 'desc' },
    });
  }

  /** Kassa abarotka — a day's opening/income/expense/closing rollup (SPEC §5.7). */
  async getDaySummary(date: Date) {
    const day = await this.getOrCreateDay(date);
    const moves = await this.getMoves(startOfDay(date), endOfDay(date));
    const income = sumMoney(moves.filter((m) => INCOMING.includes(m.type)).map((m) => m.amount));
    const expense = sumMoney(moves.filter((m) => OUTGOING.includes(m.type)).map((m) => m.amount));
    const closingBalance = money(dec(day.openingBalance).plus(income).minus(expense));
    return {
      date: day.date,
      openingBalance: moneyStr(day.openingBalance),
      income: moneyStr(income),
      expense: moneyStr(expense),
      closingBalance: moneyStr(closingBalance),
    };
  }
}
