import { Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@cozgut/shared';
import { startOfDay, endOfDay } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: startOfDay(from) } : {}),
    ...(to ? { lte: endOfDay(to) } : {}),
  };
}

const PAYMENT_FIELD: Record<PaymentMethod, 'paidCash' | 'paidCard' | 'paidDebt'> = {
  CASH: 'paidCash',
  CARD: 'paidCard',
  DEBT: 'paidDebt',
};

/** Cross-cutting report tables (SPEC §5.13): sold items, receipts, login audit, debt movements. */
@Injectable()
export class ReportTablesService {
  constructor(private readonly prisma: PrismaService) {}

  soldItems(params: {
    from?: Date;
    to?: Date;
    search?: string;
    category?: string;
    receiptNo?: number;
    paymentMethod?: PaymentMethod;
  }) {
    const paymentField = params.paymentMethod ? PAYMENT_FIELD[params.paymentMethod] : undefined;
    return this.prisma.saleLine.findMany({
      where: {
        ...(params.category ? { categoryNameSnapshot: { contains: params.category } } : {}),
        ...(params.search
          ? {
              OR: [
                { productNameSnapshot: { contains: params.search } },
                { product: { code: { contains: params.search } } },
              ],
            }
          : {}),
        sale: {
          ...(params.receiptNo ? { receiptNo: params.receiptNo } : {}),
          ...(dateRange(params.from, params.to)
            ? { datetime: dateRange(params.from, params.to) }
            : {}),
          ...(paymentField ? { [paymentField]: { gt: 0 } } : {}),
        },
      },
      include: { sale: true, product: true },
      orderBy: { id: 'desc' },
    });
  }

  receipts(params: { from?: Date; to?: Date; receiptNo?: number }) {
    return this.prisma.sale.findMany({
      where: {
        ...(params.receiptNo ? { receiptNo: params.receiptNo } : {}),
        ...(dateRange(params.from, params.to)
          ? { datetime: dateRange(params.from, params.to) }
          : {}),
      },
      include: { cashier: true, debtor: true },
      orderBy: { datetime: 'desc' },
    });
  }

  loginAudit(params: { from?: Date; to?: Date }) {
    return this.prisma.loginAudit.findMany({
      where: dateRange(params.from, params.to)
        ? { at: dateRange(params.from, params.to) }
        : undefined,
      include: { user: true },
      orderBy: { at: 'desc' },
    });
  }

  debtPayments(params: { from?: Date; to?: Date }) {
    return this.prisma.debtPayment.findMany({
      where: dateRange(params.from, params.to)
        ? { datetime: dateRange(params.from, params.to) }
        : undefined,
      include: { debtor: true },
      orderBy: { datetime: 'desc' },
    });
  }

  supplierDebtMoves(params: { from?: Date; to?: Date }) {
    return this.prisma.supplierDebtMove.findMany({
      where: dateRange(params.from, params.to)
        ? { txDate: dateRange(params.from, params.to) }
        : undefined,
      include: { supplier: true },
      orderBy: { txDate: 'desc' },
    });
  }
}
