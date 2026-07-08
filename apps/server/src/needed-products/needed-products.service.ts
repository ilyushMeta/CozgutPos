import { Injectable, NotFoundException } from '@nestjs/common';
import { qtyStr, type NeededProductInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Gerekli harytlar (SPEC §4.1 NeededProduct) — plain CRUD. */
@Injectable()
export class NeededProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.neededProduct.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: NeededProductInput) {
    return this.prisma.neededProduct.create({
      data: {
        name: input.name,
        code: input.code ?? null,
        qty: qtyStr(input.qty ?? 0),
        categoryId: input.categoryId ?? null,
      },
    });
  }

  async update(id: number, input: NeededProductInput) {
    await this.ensureExists(id);
    return this.prisma.neededProduct.update({
      where: { id },
      data: {
        name: input.name,
        code: input.code ?? null,
        qty: qtyStr(input.qty ?? 0),
        categoryId: input.categoryId ?? null,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.neededProduct.delete({ where: { id } });
  }

  private async ensureExists(id: number): Promise<void> {
    const found = await this.prisma.neededProduct.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('needed product not found');
  }
}
