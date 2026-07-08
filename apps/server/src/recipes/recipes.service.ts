import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { qtyStr, type RecipeInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CodesService } from '../codes/codes.service.js';

/** Önüm / kompozit haryt (SPEC §5.12/§6.6 "Forma-2 döret"). */
@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodesService,
  ) {}

  async create(input: RecipeInput) {
    const code = input.code?.trim() || (await this.codes.generateUniqueCompositeCode());
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { name: input.name, code, isComposite: true },
      });
      const recipe = await tx.recipe.create({ data: { compositeProductId: product.id } });
      await tx.recipeItem.createMany({
        data: input.items.map((item) => ({
          recipeId: recipe.id,
          ingredientProductId: item.ingredientProductId,
          qty: qtyStr(item.qty),
        })),
      });
      return { product, recipe };
    });
  }

  findAll() {
    return this.prisma.recipe.findMany({
      include: { compositeProduct: true, items: { include: { ingredient: true } } },
      orderBy: { id: 'desc' },
    });
  }

  /** Guarded delete: a composite with sales history cannot be removed. */
  async remove(id: number): Promise<void> {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException('recipe not found');

    const saleLineCount = await this.prisma.saleLine.count({
      where: { productId: recipe.compositeProductId },
    });
    if (saleLineCount > 0) {
      throw new ConflictException('composite product has sales history');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.delete({ where: { id } }); // cascades RecipeItems
      await tx.product.delete({ where: { id: recipe.compositeProductId } });
    });
  }
}
