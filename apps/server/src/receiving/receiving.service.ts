import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Currency, SupplierMoveType, CashMoveType, type Prisma } from '@prisma/client';
import {
  dec,
  money,
  moneyStr,
  qty,
  qtyStr,
  sumMoney,
  PaymentSource,
  type ReceivingInput,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodesService } from '../codes/codes.service.js';
import { CashService } from '../cash/cash.service.js';
import { PluService } from '../plu/plu.service.js';

type Tx = Prisma.TransactionClient;

/**
 * Haryt goş (goods receiving) — SPEC §5.3 + §6.8.
 *
 * `buyPrice`/`sellPrice` are always stored in TMT (schema comment on StockBatch).
 * When a line's currency is USD, the admin enters USD amounts; we convert them
 * to TMT using the current ExchangeRate and keep the USD sell price in
 * `sellPriceUSD` plus the rate snapshot in `buyRate` for reporting.
 *
 * Funding is mutually exclusive per invoice (see PaymentSource doc comment in
 * packages/shared/src/enums.ts for the legacy-schema evidence behind this).
 */
@Injectable()
export class ReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodesService,
    private readonly cash: CashService,
    private readonly plu: PluService,
  ) {}

  async receive(input: ReceivingInput) {
    const invoiceNo = await this.codes.next('invoice');
    const receivedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      let scaleItemsTouched = false;
      const lineTotals: import('decimal.js').Decimal[] = [];
      const batches = [];

      for (const line of input.lines) {
        const productId = line.productId ?? (await this.createProduct(tx, line.newProduct!));

        // expiryDate/isScaleItem/lowStockThreshold live on Product, not StockBatch
        // (SPEC §4.1 Product model note: "mohlet/azalanSan" move to the product row).
        if (
          line.isScaleItem !== undefined ||
          line.lowStockThreshold !== undefined ||
          line.expiryDate !== undefined
        ) {
          await tx.product.update({
            where: { id: productId },
            data: {
              ...(line.isScaleItem !== undefined ? { isScaleItem: line.isScaleItem } : {}),
              ...(line.lowStockThreshold !== undefined
                ? { lowStockThreshold: qtyStr(line.lowStockThreshold) }
                : {}),
              ...(line.expiryDate !== undefined ? { expiryDate: line.expiryDate } : {}),
            },
          });
        }

        const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
        if (product.isScaleItem || line.isScaleItem) scaleItemsTouched = true;

        let buyPriceTmt = money(line.buyPrice);
        let sellPriceTmt = money(line.sellPrice);
        let sellPriceUSD = line.sellPriceUSD != null ? money(line.sellPriceUSD) : null;
        let buyRate: import('decimal.js').Decimal | null = null;

        if (line.currency === Currency.USD) {
          buyRate = await this.getCurrentRate(tx);
          sellPriceUSD = sellPriceUSD ?? money(line.sellPrice);
          buyPriceTmt = money(dec(line.buyPrice).times(buyRate));
          sellPriceTmt = money(dec(line.sellPrice).times(buyRate));
        }

        const lineQty = qty(line.qty);
        lineTotals.push(money(lineQty.times(buyPriceTmt)));

        const batch = await tx.stockBatch.create({
          data: {
            productId,
            qtyInitial: qtyStr(lineQty),
            qtyRemaining: qtyStr(lineQty),
            buyPrice: moneyStr(buyPriceTmt),
            sellPrice: moneyStr(sellPriceTmt),
            sellPriceUSD: sellPriceUSD != null ? moneyStr(sellPriceUSD) : null,
            currency: line.currency,
            buyRate: buyRate != null ? moneyStr(buyRate) : null,
            receivedAt,
            invoiceNo,
          },
        });
        batches.push(batch);
      }

      const invoiceTotal = sumMoney(lineTotals);

      if (input.paymentSource === PaymentSource.CASHBOX) {
        await this.cash.recordMove(
          CashMoveType.PURCHASE_PAYMENT,
          invoiceTotal,
          `Faktur #${invoiceNo}`,
          tx,
        );
      } else if (input.paymentSource === PaymentSource.SUPPLIER_CREDIT) {
        await this.applySupplierCredit(tx, input.supplierId!, invoiceNo, invoiceTotal);
      }

      return {
        invoiceNo,
        total: invoiceTotal.toFixed(2),
        batches,
        scaleItemsTouched,
      };
    });

    // Re-export PLU after commit, never inside the transaction (SPEC §7.3).
    if (result.scaleItemsTouched) void this.plu.exportSafely();
    return result;
  }

  private async createProduct(
    tx: Tx,
    newProduct: NonNullable<ReceivingInput['lines'][number]['newProduct']>,
  ): Promise<number> {
    const code = newProduct.code?.trim() || (await this.codes.generateUniqueProductCode());
    const product = await tx.product.create({
      data: { name: newProduct.name, code, categoryId: newProduct.categoryId ?? null },
    });
    return product.id;
  }

  private async applySupplierCredit(
    tx: Tx,
    supplierId: number,
    invoiceNo: number,
    invoiceTotal: import('decimal.js').Decimal,
  ): Promise<void> {
    const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('supplier not found');

    const opening = dec(supplier.balance);
    const closing = money(opening.plus(invoiceTotal));

    await tx.supplier.update({ where: { id: supplierId }, data: { balance: moneyStr(closing) } });
    await tx.supplierDebtMove.create({
      data: {
        supplierId,
        invoiceNo,
        type: SupplierMoveType.PURCHASE,
        amount: moneyStr(invoiceTotal),
        opening: moneyStr(opening),
        closing: moneyStr(closing),
      },
    });
  }

  private async getCurrentRate(tx: Tx): Promise<import('decimal.js').Decimal> {
    const rate = await tx.exchangeRate.findFirst({ orderBy: { effectiveFrom: 'desc' } });
    if (!rate) throw new BadRequestException('no exchange rate configured');
    return dec(rate.rate);
  }
}
