import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMoveType, ShopId } from '@prisma/client';
import {
  dec,
  money,
  moneyStr,
  qtyStr,
  sumMoney,
  SaleErrorCode,
  SettingKey,
  type SecondShopSaleInput,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalesValidationService } from '../sales/sales-validation.service.js';
import { FifoService } from '../fifo/fifo.service.js';
import { FifoInsufficientStockException } from '../fifo/fifo.exceptions.js';
import { CashService } from '../cash/cash.service.js';
import { CodesService } from '../codes/codes.service.js';
import { SettingsService } from '../settings/settings.service.js';

/**
 * Ikinji dükan (SPEC §5.10/§6.11): a simplified sale — same FIFO deduction
 * from MAIN stock, its own receipt sequence, one payment method (no debt,
 * no discount blending, no admin bypass flags — those are POS-specific).
 */
@Injectable()
export class SecondShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: SalesValidationService,
    private readonly fifo: FifoService,
    private readonly cash: CashService,
    private readonly codes: CodesService,
    private readonly settings: SettingsService,
  ) {}

  async createSale(input: SecondShopSaleInput, cashierId: number) {
    if (input.lines.length === 0) {
      throw new BadRequestException({ code: SaleErrorCode.EMPTY_CART });
    }
    const resolved = await this.validation.resolveLines(input.lines);
    const costingMethod =
      (await this.settings.get(SettingKey.COSTING_METHOD)) === 'lifo' ? 'lifo' : 'fifo';
    const receiptNo = await this.codes.next('receipt-second');

    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const total = sumMoney(lineTotals);
        const sale = await tx.sale.create({
          data: {
            receiptNo,
            cashierId,
            total: moneyStr(total),
            paidCash: input.paymentMethod === 'CASH' ? moneyStr(total) : '0.00',
            paidCard: input.paymentMethod === 'CARD' ? moneyStr(total) : '0.00',
            cogsTotal: moneyStr(money(cogsTotal)),
            shopId: ShopId.SECOND,
          },
        });

        await tx.saleLine.createMany({
          data: saleLinesData.map((line) => ({ ...line, saleId: sale.id })),
        });

        if (input.paymentMethod === 'CASH') {
          await this.cash.recordMove(
            CashMoveType.SALE_CASH,
            total,
            `Ikinji dükan #${receiptNo}`,
            tx,
          );
        }

        return {
          id: sale.id,
          receiptNo,
          total: moneyStr(total),
          cogsTotal: moneyStr(money(cogsTotal)),
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
  }

  /** "Ikinji dükana giden harytlar" (SPEC §5.10) period report. */
  async periodReport(from: Date, to: Date) {
    const lines = await this.prisma.saleLine.findMany({
      where: { sale: { shopId: ShopId.SECOND, datetime: { gte: from, lte: to } } },
      include: { sale: true },
      orderBy: { id: 'desc' },
    });
    return {
      lines: lines.map((l) => ({
        id: l.id,
        saleId: l.saleId,
        receiptNo: l.sale.receiptNo,
        datetime: l.sale.datetime,
        productName: l.productNameSnapshot,
        qty: l.qty.toFixed(3),
        unitPrice: l.unitPrice.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2),
      })),
      total: sumMoney(lines.map((l) => l.lineTotal)).toFixed(2),
    };
  }
}
