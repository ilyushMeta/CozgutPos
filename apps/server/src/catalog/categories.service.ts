import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(input: CategoryInput) {
    return this.prisma.category.create({ data: input });
  }

  async update(id: number, input: CategoryInput) {
    await this.ensureExists(id);
    return this.prisma.category.update({ where: { id }, data: input });
  }

  /** Guarded delete (SPEC §5.4): a category still holding products cannot be removed. */
  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException(`category has ${productCount} product(s)`);
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: number): Promise<void> {
    const found = await this.prisma.category.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('category not found');
  }
}
