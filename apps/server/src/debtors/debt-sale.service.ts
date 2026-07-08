import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Currency, type Prisma } from '@prisma/client';
import { dec, money, moneyStr, type Numeric } from '@cozgut/shared';
import { splitInstallments } from './installment.js';

type Tx = Prisma.TransactionClient;

export interface ApplyDebtSaleInput {
  debtorId: number;
  saleId: number;
  invoiceNo: number;
  saleDate: Date;
  /** The debt portion of the sale, always in TMT (Sale amounts are TMT-based). */
  amountTmt: Numeric;
  dueDate: Date | null;
  noDueDate: boolean;
  exchangeRate: Numeric;
}

/**
 * Applies the debt portion of a POS sale (SPEC §6.5): converts the amount into
 * the debtor's account currency, updates Customer.balance, records DebtSale,
 * and splits the debt into N monthly DebtSchedule rows. Always called from
 * inside SalesService's own $transaction — never standalone.
 */
@Injectable()
export class DebtSaleService {
  async apply(
    tx: Tx,
    input: ApplyDebtSaleInput,
  ): Promise<{ newBalance: ReturnType<typeof money>; monthsN: number }> {
    const debtor = await tx.customer.findUnique({ where: { id: input.debtorId } });
    if (!debtor) throw new NotFoundException('debtor not found');

    const amountTmt = money(input.amountTmt);
    let amountInDebtorCurrency = amountTmt;
    if (debtor.accountCurrency === Currency.USD) {
      const rate = dec(input.exchangeRate);
      if (rate.lessThanOrEqualTo(0)) {
        throw new BadRequestException('no exchange rate configured');
      }
      amountInDebtorCurrency = money(amountTmt.dividedBy(rate));
    }

    const opening = dec(debtor.balance);
    const closing = money(opening.plus(amountInDebtorCurrency));
    await tx.customer.update({
      where: { id: input.debtorId },
      data: { balance: moneyStr(closing) },
    });

    const dueDate = input.noDueDate ? input.saleDate : (input.dueDate ?? null);
    await tx.debtSale.create({
      data: {
        debtorId: input.debtorId,
        saleId: input.saleId,
        invoiceNo: input.invoiceNo,
        saleDate: input.saleDate,
        dueDate,
        amount: moneyStr(amountInDebtorCurrency),
      },
    });

    const rows = splitInstallments(
      amountInDebtorCurrency,
      input.saleDate,
      input.dueDate ?? null,
      input.noDueDate,
    );
    await tx.debtSchedule.createMany({
      data: rows.map((r) => ({
        debtorId: input.debtorId,
        invoiceNo: input.invoiceNo,
        txDate: input.saleDate,
        dueDate: r.dueDate,
        openingBalance: moneyStr(r.openingBalance),
        amount: moneyStr(r.amount),
        closingBalance: moneyStr(r.closingBalance),
      })),
    });

    return { newBalance: closing, monthsN: rows.length };
  }
}
