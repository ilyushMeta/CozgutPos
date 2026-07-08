import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMoveType, PaymentMethod, ShopId, type Prisma } from '@prisma/client';
import {
  dec,
  money,
  moneyStr,
  qtyStr,
  sumMoney,
  SaleErrorCode,
  SettingKey,
  type CreateSaleInput,
  type Numeric,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CashService } from '../cash/cash.service.js';
import { CodesService } from '../codes/codes.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { FifoService } from '../fifo/fifo.service.js';
import { FifoInsufficientStockException } from '../fifo/fifo.exceptions.js';
import { PrintingService } from '../printing/printing.service.js';
import { DebtSaleService } from '../debtors/debt-sale.service.js';
import { SmsService } from '../sms/sms.service.js';
import { SalesValidationService, type ResolvedLine } from './sales-validation.service.js';

type Tx = Prisma.TransactionClient;

/** Atomic sale transaction (SPEC §6.3–§6.4/§6.5). */
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: SalesValidationService,
    private readonly fifo: FifoService,
    private readonly cash: CashService,
    private readonly codes: CodesService,
    private readonly settings: SettingsService,
    private readonly printing: PrintingService,
    private readonly debtSale: DebtSaleService,
    private readonly sms: SmsService,
  ) {}

  async createSale(input: CreateSaleInput, cashierId: number) {
    const resolved = await this.validation.validate(input);
    const costingMethod =
      (await this.settings.get(SettingKey.COSTING_METHOD)) === 'lifo' ? 'lifo' : 'fifo';
    const receiptNo = await this.codes.next('receipt');
    const saleDate = new Date();

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const { saleLinesData, cogsTotal, total } = await this.deductAndBuildLines(
          tx,
          resolved,
          receiptNo,
          costingMethod,
        );

        const { changeGiven, discount, effectiveTotal } = await this.computeChangeAndDiscount(
          tx,
          total,
          input.paidCash,
          input.paidCard,
          input.paidDebt,
        );

        const exchangeRate = await tx.exchangeRate.findFirst({
          orderBy: { effectiveFrom: 'desc' },
        });

        const sale = await tx.sale.create({
          data: {
            receiptNo,
            cashierId,
            datetime: saleDate,
            total: moneyStr(total),
            paidCash: moneyStr(input.paidCash),
            paidCard: moneyStr(input.paidCard),
            paidDebt: moneyStr(input.paidDebt),
            debtorId: input.debtorId ?? null,
            changeGiven: moneyStr(changeGiven),
            discount: moneyStr(discount),
            exchangeRate: exchangeRate ? moneyStr(exchangeRate.rate) : '0.00',
            cogsTotal: moneyStr(cogsTotal),
            shopId: ShopId.MAIN,
          },
        });

        await tx.saleLine.createMany({
          data: saleLinesData.map((line) => ({ ...line, saleId: sale.id })),
        });

        if (dec(input.paidCash).greaterThan(0)) {
          const cashKept = dec(input.paidCash).minus(changeGiven); // SPEC §6.4: cash paid − change
          await this.cash.recordMove(CashMoveType.SALE_CASH, cashKept, `Söwda #${receiptNo}`, tx);
        }

        let debtResult: { newBalance: ReturnType<typeof money>; monthsN: number } | null = null;
        if (dec(input.paidDebt).greaterThan(0)) {
          debtResult = await this.debtSale.apply(tx, {
            debtorId: input.debtorId!,
            saleId: sale.id,
            invoiceNo: receiptNo,
            saleDate,
            amountTmt: input.paidDebt,
            dueDate: input.dueDate ?? null,
            noDueDate: input.noDueDate,
            exchangeRate: exchangeRate ? exchangeRate.rate : 0,
          });
        }

        return {
          id: sale.id,
          receiptNo,
          total: moneyStr(total),
          effectiveTotal: moneyStr(effectiveTotal),
          changeGiven: moneyStr(changeGiven),
          discount: moneyStr(discount),
          cogsTotal: moneyStr(cogsTotal),
          lines: saleLinesData,
          debtorNewBalance: debtResult ? moneyStr(debtResult.newBalance) : null,
        };
      });
    } catch (e) {
      if (e instanceof FifoInsufficientStockException) {
        throw new BadRequestException({
          code: SaleErrorCode.INSUFFICIENT_STOCK,
          shortages: [{ productId: e.productId, shortfall: e.shortfall }],
        });
      }
      throw e;
    }

    // After commit only (SPEC §6.4) — a print/SMS failure must never affect
    // the already-committed sale; the client shows a toast from `printed:false`.
    const printResult = await this.printing.printReceipt(result.id, input.printCopies);
    if (dec(input.paidDebt).greaterThan(0) && input.sendSms) {
      await this.sendDebtSaleSms(input, result);
    }
    return { ...result, ...printResult };
  }

  /** SPEC §6.5 SMS template, sent fire-and-forget after commit. */
  private async sendDebtSaleSms(
    input: CreateSaleInput,
    result: { total: string; debtorNewBalance: string | null },
  ): Promise<void> {
    const debtor = await this.prisma.customer.findUnique({ where: { id: input.debtorId! } });
    if (!debtor) return;
    const currencySuffix = debtor.accountCurrency === 'USD' ? '$' : 'TMT';
    const message =
      `Salam ${debtor.name}\n` +
      `Sowda=${result.total}\n` +
      `Nagt=${moneyStr(input.paidCash)}\n` +
      `Kart=${moneyStr(input.paidCard)}\n` +
      `Karz=${moneyStr(input.paidDebt)}\n` +
      `Umumy hasap=${result.debtorNewBalance}${currencySuffix}`;
    await this.sms.sendSafely(debtor.phone, message);
  }

  private async deductAndBuildLines(
    tx: Tx,
    resolved: ResolvedLine[],
    receiptNo: number,
    costingMethod: 'fifo' | 'lifo',
  ) {
    let cogsTotal = dec(0);
    const lineTotals = [];
    const saleLinesData = [];

    for (const line of resolved) {
      const { breakdown, cogs } = await this.fifo.deduct(
        tx,
        line.productId,
        line.baseQty,
        costingMethod,
      );
      cogsTotal = cogsTotal.plus(cogs);

      const lineTotal = money(line.qty.times(dec(line.unitPrice)));
      lineTotals.push(lineTotal);

      saleLinesData.push({
        productId: line.productId,
        batchBreakdown: breakdown,
        qty: qtyStr(line.qty),
        unitPackId: line.unitPackId,
        unitPrice: moneyStr(line.unitPrice),
        lineTotal: moneyStr(lineTotal),
        cogs: moneyStr(cogs),
        productNameSnapshot: line.productName,
        categoryNameSnapshot: line.categoryName,
      });
    }

    return { saleLinesData, cogsTotal: money(cogsTotal), total: sumMoney(lineTotals), receiptNo };
  }

  /**
   * SPEC §6.10 change/discount + §5.2 per-method PaymentDiscount, blended by
   * how much of the total each method actually paid (currently all
   * PaymentDiscount rows are 0 — Faza 6 adds the settings UI to change them —
   * so this is inert today but ready once that lands).
   */
  private async computeChangeAndDiscount(
    tx: Tx,
    total: ReturnType<typeof money>,
    paidCash: Numeric,
    paidCard: Numeric,
    paidDebt: Numeric,
  ) {
    const cash = dec(paidCash);
    const card = dec(paidCard);
    const debt = dec(paidDebt);
    const paidTotal = cash.plus(card).plus(debt);

    const discounts = await tx.paymentDiscount.findMany();
    const pct = (method: PaymentMethod) =>
      dec(discounts.find((d) => d.method === method)?.percent ?? 0);
    const blendedPct = paidTotal.isZero()
      ? dec(0)
      : pct(PaymentMethod.CASH)
          .times(cash)
          .plus(pct(PaymentMethod.CARD).times(card))
          .plus(pct(PaymentMethod.DEBT).times(debt))
          .dividedBy(paidTotal);

    const effectiveTotal = money(total.times(dec(1).minus(blendedPct.dividedBy(100))));
    const due = effectiveTotal.minus(card).minus(debt);
    const change = cash.minus(due);

    return change.isNegative()
      ? { changeGiven: dec(0), discount: change.abs(), effectiveTotal }
      : { changeGiven: change, discount: dec(0), effectiveTotal };
  }
}
