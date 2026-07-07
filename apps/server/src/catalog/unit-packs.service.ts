import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { moneyStr, qtyStr, type UnitPackInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UnitPacksService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForProduct(productId: number) {
    return this.prisma.unitPack.findMany({ where: { productId }, orderBy: { name: 'asc' } });
  }

  create(productId: number, input: UnitPackInput) {
    return this.prisma.unitPack.create({ data: { productId, ...this.toData(input) } });
  }

  async update(id: number, input: UnitPackInput) {
    await this.ensureExists(id);
    return this.prisma.unitPack.update({ where: { id }, data: this.toData(input) });
  }

  /** Guarded delete: a pack already used on a sale line cannot be removed. */
  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    const usageCount = await this.prisma.saleLine.count({ where: { unitPackId: id } });
    if (usageCount > 0) throw new ConflictException('unit pack is used on sale lines');
    await this.prisma.unitPack.delete({ where: { id } });
  }

  private toData(input: UnitPackInput) {
    return {
      name: input.name,
      qtyInside: qtyStr(input.qtyInside),
      buyPrice: moneyStr(input.buyPrice),
      sellPrice: moneyStr(input.sellPrice),
    };
  }

  private async ensureExists(id: number): Promise<void> {
    const found = await this.prisma.unitPack.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('unit pack not found');
  }
}
