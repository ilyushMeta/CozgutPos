import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMoveType, Prisma, SupplierMoveType } from '@prisma/client';
import {
  dec,
  money,
  moneyStr,
  type SupplierUpsertInput,
  type SupplierPaymentInput,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodesService } from '../codes/codes.service.js';
import { CashService } from '../cash/cash.service.js';

/** Suppliers (karz dükan) — SPEC §5.6. */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodesService,
    private readonly cash: CashService,
  ) {}

  /** Picklist for Haryt goş (Phase 2) — kept lean intentionally. */
  findAll() {
    return this.prisma.supplier.findMany({
      select: { id: true, code: true, name: true, balance: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('supplier not found');
    return supplier;
  }

  async generateCode(): Promise<{ code: string }> {
    return { code: await this.codes.generateUniqueSupplierCode() };
  }

  async create(input: SupplierUpsertInput) {
    const code = input.code?.trim() || (await this.codes.generateUniqueSupplierCode());
    try {
      return await this.prisma.supplier.create({
        data: { name: input.name, code, phone: input.phone ?? null, note: input.note ?? null },
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
  }

  async update(id: number, input: SupplierUpsertInput) {
    await this.findOne(id);
    const code = input.code?.trim();
    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone ?? null,
          note: input.note ?? null,
          ...(code ? { code } : {}),
        },
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
  }

  /** Guarded delete: a supplier with any purchase/payment history cannot be removed. */
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const moveCount = await this.prisma.supplierDebtMove.count({ where: { supplierId: id } });
    if (moveCount > 0) throw new ConflictException('supplier has debt history');
    await this.prisma.supplier.delete({ where: { id } });
  }

  listMoves(supplierId: number) {
    return this.prisma.supplierDebtMove.findMany({
      where: { supplierId },
      orderBy: { txDate: 'desc' },
    });
  }

  /**
   * Dükan karz tölemek (SPEC §5.6): pays a supplier from the cashbox —
   * mirrors ReceivingService.applySupplierCredit's opening/closing ledger
   * pattern, in reverse (PAYMENT instead of PURCHASE).
   */
  async payDebt(supplierId: number, input: SupplierPaymentInput) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new NotFoundException('supplier not found');

      const amount = money(input.amount);
      const opening = dec(supplier.balance);
      const closing = money(opening.minus(amount));

      await tx.supplier.update({ where: { id: supplierId }, data: { balance: moneyStr(closing) } });
      const move = await tx.supplierDebtMove.create({
        data: {
          supplierId,
          type: SupplierMoveType.PAYMENT,
          amount: moneyStr(amount),
          opening: moneyStr(opening),
          closing: moneyStr(closing),
          note: input.note ?? null,
        },
      });
      await this.cash.recordMove(
        CashMoveType.PURCHASE_PAYMENT,
        amount,
        `Dükan karzy — ${supplier.name}`,
        tx,
      );

      return move;
    });
  }

  private mapUniqueError(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('supplier code already exists');
    }
    return e;
  }
}
