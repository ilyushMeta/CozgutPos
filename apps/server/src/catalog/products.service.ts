import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { moneyStr, qtyStr, type ProductInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodesService } from '../codes/codes.service.js';
import { PluService } from '../plu/plu.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodesService,
    private readonly plu: PluService,
  ) {}

  findAll(search?: string) {
    return this.prisma.product.findMany({
      where: search
        ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] }
        : undefined,
      include: { category: true, unitPacks: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, unitPacks: true, batches: { orderBy: { receivedAt: 'asc' } } },
    });
    if (!product) throw new NotFoundException('product not found');
    return product;
  }

  async generateCode(): Promise<{ code: string }> {
    return { code: await this.codes.generateUniqueProductCode() };
  }

  async create(input: ProductInput) {
    const code = input.code?.trim() || (await this.codes.generateUniqueProductCode());
    let product;
    try {
      product = await this.prisma.product.create({ data: { ...this.toData(input), code } });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
    // Re-export PLU after a scale-item product is created (SPEC §7.3).
    if (product.isScaleItem) void this.plu.exportSafely();
    return product;
  }

  async update(id: number, input: ProductInput) {
    await this.findOne(id);
    const code = input.code?.trim();
    let product;
    try {
      product = await this.prisma.product.update({
        where: { id },
        data: { ...this.toData(input), ...(code ? { code } : {}) },
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
    if (product.isScaleItem) void this.plu.exportSafely();
    return product;
  }

  /** Guarded delete (SPEC §5.4): a product with stock history cannot be removed. */
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const [batchCount, saleLineCount] = await Promise.all([
      this.prisma.stockBatch.count({ where: { productId: id } }),
      this.prisma.saleLine.count({ where: { productId: id } }),
    ]);
    if (batchCount > 0 || saleLineCount > 0) {
      throw new ConflictException('product has stock batches or sales history');
    }
    await this.prisma.product.delete({ where: { id } });
  }

  private toData(input: ProductInput) {
    return {
      name: input.name,
      categoryId: input.categoryId ?? null,
      isScaleItem: input.isScaleItem ?? false,
      lowStockThreshold: qtyStr(input.lowStockThreshold ?? 0),
      expiryDate: input.expiryDate ?? null,
      discountPercent: moneyStr(input.discountPercent ?? 0),
      secondPrice: input.secondPrice != null ? moneyStr(input.secondPrice) : null,
    };
  }

  private mapUniqueError(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('product code already exists');
    }
    return e;
  }
}
