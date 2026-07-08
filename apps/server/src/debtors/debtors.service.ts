import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashMoveType, Currency, Prisma } from '@prisma/client';
import {
  dec,
  money,
  moneyStr,
  sumMoney,
  type DebtorInput,
  type DebtPaymentInput,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodesService } from '../codes/codes.service.js';
import { CashService } from '../cash/cash.service.js';
import { PrintingService } from '../printing/printing.service.js';
import { SmsService } from '../sms/sms.service.js';

type Tx = Prisma.TransactionClient;

/** Debtors (karzçy) — SPEC §5.5. */
@Injectable()
export class DebtorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodesService,
    private readonly cash: CashService,
    private readonly printing: PrintingService,
    private readonly sms: SmsService,
  ) {}

  /** Adds `overdueAmount`/`nextDueDate` per debtor (SPEC §5.5 overdue color rules). */
  async findAll(search?: string) {
    const debtors = await this.prisma.customer.findMany({
      where: search
        ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] }
        : undefined,
      include: { schedules: true },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    return debtors.map(({ schedules, ...debtor }) => {
      const open = schedules.filter((s) => dec(s.amount).greaterThan(s.paid));
      const overdue = open.filter((s) => s.dueDate && s.dueDate < now);
      const nextDueDate =
        open
          .map((s) => s.dueDate)
          .filter((d): d is Date => d != null)
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

      return {
        ...debtor,
        overdueAmount: sumMoney(overdue.map((s) => dec(s.amount).minus(s.paid))).toFixed(2),
        isOverdue: overdue.length > 0,
        nextDueDate,
      };
    });
  }

  async findOne(id: number) {
    const debtor = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        schedules: { orderBy: { dueDate: 'asc' } },
        debtSales: { orderBy: { saleDate: 'desc' } },
        payments: { orderBy: { datetime: 'desc' } },
      },
    });
    if (!debtor) throw new NotFoundException('debtor not found');
    return debtor;
  }

  async generateCode(): Promise<{ code: string }> {
    return { code: await this.codes.generateUniqueDebtorCode() };
  }

  async create(input: DebtorInput) {
    const code = input.code?.trim() || (await this.codes.generateUniqueDebtorCode());
    try {
      return await this.prisma.customer.create({
        data: {
          name: input.name,
          code,
          phone: input.phone ?? null,
          note: input.note ?? null,
          accountCurrency: input.accountCurrency ?? Currency.TMT,
        },
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
  }

  async update(id: number, input: DebtorInput) {
    await this.findOne(id);
    const code = input.code?.trim();
    try {
      return await this.prisma.customer.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone ?? null,
          note: input.note ?? null,
          accountCurrency: input.accountCurrency ?? Currency.TMT,
          ...(code ? { code } : {}),
        },
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
  }

  /** Guarded delete: a debtor with any debt history cannot be removed. */
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const [saleCount, paymentCount, scheduleCount] = await Promise.all([
      this.prisma.debtSale.count({ where: { debtorId: id } }),
      this.prisma.debtPayment.count({ where: { debtorId: id } }),
      this.prisma.debtSchedule.count({ where: { debtorId: id } }),
    ]);
    if (saleCount > 0 || paymentCount > 0 || scheduleCount > 0) {
      throw new ConflictException('debtor has debt history');
    }
    await this.prisma.customer.delete({ where: { id } });
  }

  /**
   * Karz tölemek (SPEC §5.5): amount is entered in the debtor's own account
   * currency, reduces Customer.balance, and fills open DebtSchedule rows
   * oldest-first across all of the debtor's sales. The cashbox always tracks
   * TMT (CashMove has no currency column), so a USD-account payment is
   * converted at the current exchange rate for the CashMove only.
   */
  async recordPayment(id: number, input: DebtPaymentInput) {
    const result = await this.prisma.$transaction(async (tx) => {
      const debtor = await tx.customer.findUnique({ where: { id } });
      if (!debtor) throw new NotFoundException('debtor not found');

      const amount = money(input.amount);
      const opening = dec(debtor.balance);
      const closing = money(opening.minus(amount));
      await tx.customer.update({ where: { id }, data: { balance: moneyStr(closing) } });

      const payment = await tx.debtPayment.create({
        data: {
          debtorId: id,
          amount: moneyStr(amount),
          currency: debtor.accountCurrency,
          note: input.note ?? null,
        },
      });

      let cashAmountTmt = amount;
      if (debtor.accountCurrency === Currency.USD) {
        cashAmountTmt = money(amount.times(await this.getCurrentRate(tx)));
      }
      await this.cash.recordMove(
        CashMoveType.DEBT_PAYMENT_IN,
        cashAmountTmt,
        `Karz tölegi — ${debtor.name}`,
        tx,
      );

      // Oldest-first fill (SPEC §6.5) across every open schedule row, regardless of invoice.
      const openRows = await tx.debtSchedule.findMany({
        where: { debtorId: id },
        orderBy: { dueDate: 'asc' },
      });
      let remaining = amount;
      for (const row of openRows) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const due = dec(row.amount).minus(row.paid);
        if (due.lessThanOrEqualTo(0)) continue;
        const applied = remaining.lessThan(due) ? remaining : due;
        await tx.debtSchedule.update({
          where: { id: row.id },
          data: { paid: moneyStr(dec(row.paid).plus(applied)) },
        });
        remaining = remaining.minus(applied);
      }

      return {
        payment,
        newBalance: closing,
        debtorName: debtor.name,
        phone: debtor.phone,
        accountCurrency: debtor.accountCurrency,
      };
    });

    const currencySuffix = result.accountCurrency === Currency.USD ? '$' : 'TMT';

    const printResult = await this.printing.printDebtPaymentReceipt({
      debtorName: result.debtorName,
      amount: moneyStr(input.amount),
      currency: currencySuffix,
      newBalance: moneyStr(result.newBalance),
      note: input.note,
    });

    if (input.sendSms) {
      await this.sms.sendSafely(
        result.phone,
        `Salam ${result.debtorName}\nTölendi: ${moneyStr(input.amount)}${currencySuffix}\nUmumy hasap: ${moneyStr(result.newBalance)}${currencySuffix}`,
      );
    }

    return { ...result.payment, newBalance: moneyStr(result.newBalance), ...printResult };
  }

  private async getCurrentRate(tx: Tx) {
    const rate = await tx.exchangeRate.findFirst({ orderBy: { effectiveFrom: 'desc' } });
    if (!rate || dec(rate.rate).lessThanOrEqualTo(0)) {
      throw new BadRequestException('no exchange rate configured');
    }
    return dec(rate.rate);
  }

  private mapUniqueError(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('debtor code already exists');
    }
    return e;
  }
}
