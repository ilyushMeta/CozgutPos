import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  dec,
  qty,
  sumQty,
  SaleErrorCode,
  type CreateSaleInput,
  type SaleLineInput,
} from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ResolvedLine {
  productId: number;
  productName: string;
  categoryName: string | null;
  qty: ReturnType<typeof qty>;
  unitPackId: number | null;
  unitPrice: string;
  /** Base-unit qty to deduct via FIFO — qty × pack.qtyInside when a pack is selected. */
  baseQty: ReturnType<typeof qty>;
  totalRemaining: ReturnType<typeof qty>;
  /** Cost basis for the below-cost guard: latest batch buyPrice, scaled by pack size. Null if the product has never been received. */
  costBasis: ReturnType<typeof dec> | null;
  /** SPEC §6.6: a composite (Önüm) line deducts its RecipeItems instead of its own batches. */
  isComposite: boolean;
  recipeItems: { ingredientProductId: number; qty: ReturnType<typeof dec> }[] | null;
}

/**
 * Pre-transaction sale checks (SPEC §6.3). These are fast, lock-free reads for
 * a friendly early error — the actual oversell-proof safety net is FifoService's
 * `FOR UPDATE` locking inside the real transaction (SPEC §11).
 */
@Injectable()
export class SalesValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: CreateSaleInput): Promise<ResolvedLine[]> {
    if (input.lines.length === 0) {
      throw new BadRequestException({ code: SaleErrorCode.EMPTY_CART });
    }
    if (
      dec(input.paidCash).lessThanOrEqualTo(0) &&
      dec(input.paidCard).lessThanOrEqualTo(0) &&
      dec(input.paidDebt).lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException({ code: SaleErrorCode.NO_PAYMENT });
    }
    if (dec(input.paidDebt).greaterThan(0)) {
      if (!input.debtorId) {
        throw new BadRequestException({ code: SaleErrorCode.DEBTOR_REQUIRED });
      }
      const debtor = await this.prisma.customer.findUnique({ where: { id: input.debtorId } });
      if (!debtor) throw new NotFoundException('debtor not found');
    }

    const resolved = await this.resolveLines(input.lines);

    if (!input.skipStockCheck) {
      const shortages = resolved
        .filter((l) => l.totalRemaining.lessThan(l.baseQty))
        .map((l) => ({
          productId: l.productId,
          productName: l.productName,
          shortfall: l.baseQty.minus(l.totalRemaining).toFixed(3),
        }));
      if (shortages.length) {
        throw new BadRequestException({ code: SaleErrorCode.INSUFFICIENT_STOCK, shortages });
      }
    }

    if (!input.allowBelowCost) {
      const belowCost = resolved
        .filter((l) => l.costBasis !== null && dec(l.unitPrice).lessThan(l.costBasis))
        .map((l) => ({
          productId: l.productId,
          productName: l.productName,
          unitPrice: l.unitPrice,
          costBasis: l.costBasis!.toFixed(2),
        }));
      if (belowCost.length) {
        throw new BadRequestException({ code: SaleErrorCode.BELOW_COST, lines: belowCost });
      }
    }

    return resolved;
  }

  /** Per-line resolution reused by SalesService so the FIFO deduct amount
   * always matches what validation just checked. */
  async resolveLines(lines: SaleLineInput[]): Promise<ResolvedLine[]> {
    return Promise.all(
      lines.map(async (line): Promise<ResolvedLine> => {
        const product = await this.prisma.product.findUniqueOrThrow({
          where: { id: line.productId },
          include: { batches: true, category: true, recipe: { include: { items: true } } },
        });

        if (product.isComposite && product.recipe) {
          return this.resolveCompositeLine(line, product);
        }

        const pack = line.unitPackId
          ? await this.prisma.unitPack.findUniqueOrThrow({ where: { id: line.unitPackId } })
          : null;

        const baseQty = pack ? qty(line.qty).times(dec(pack.qtyInside)) : qty(line.qty);
        const totalRemaining = sumQty(product.batches.map((b) => b.qtyRemaining));

        const latestBatch = product.batches
          .slice()
          .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];
        const costBasis = latestBatch
          ? dec(latestBatch.buyPrice).times(pack ? dec(pack.qtyInside) : 1)
          : null;

        return {
          productId: line.productId,
          productName: product.name,
          categoryName: product.category?.name ?? null,
          qty: qty(line.qty),
          unitPackId: line.unitPackId ?? null,
          unitPrice: String(line.unitPrice),
          baseQty,
          totalRemaining,
          costBasis,
          isComposite: false,
          recipeItems: null,
        };
      }),
    );
  }

  /**
   * SPEC §6.6: scanning a composite's code loads its RecipeItems into the
   * deduction plan. Availability = the fewest composite units any single
   * ingredient's current stock can support; cost basis = Σ(RecipeItem.qty ×
   * that ingredient's latest buyPrice).
   */
  private async resolveCompositeLine(
    line: SaleLineInput,
    product: {
      id: number;
      name: string;
      category: { name: string } | null;
      recipe: {
        items: { ingredientProductId: number; qty: import('decimal.js').Decimal }[];
      } | null;
    },
  ): Promise<ResolvedLine> {
    const items = product.recipe!.items;
    const ingredients = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.ingredientProductId) } },
      include: { batches: true },
    });
    const ingredientMap = new Map(ingredients.map((p) => [p.id, p]));

    let maxUnits: ReturnType<typeof qty> | null = null;
    let costBasis = dec(0);
    for (const item of items) {
      const ingredient = ingredientMap.get(item.ingredientProductId);
      const remaining = ingredient ? sumQty(ingredient.batches.map((b) => b.qtyRemaining)) : dec(0);
      const perUnit = dec(item.qty);
      const possibleUnits = qty(remaining.dividedBy(perUnit));
      if (maxUnits === null || possibleUnits.lessThan(maxUnits)) maxUnits = possibleUnits;

      const latestBatch = ingredient?.batches
        .slice()
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];
      costBasis = costBasis.plus(perUnit.times(latestBatch ? dec(latestBatch.buyPrice) : dec(0)));
    }

    return {
      productId: line.productId,
      productName: product.name,
      categoryName: product.category?.name ?? null,
      qty: qty(line.qty),
      unitPackId: null,
      unitPrice: String(line.unitPrice),
      baseQty: qty(line.qty),
      totalRemaining: maxUnits ?? qty(0),
      costBasis,
      isComposite: true,
      recipeItems: items.map((i) => ({
        ingredientProductId: i.ingredientProductId,
        qty: dec(i.qty),
      })),
    };
  }
}
