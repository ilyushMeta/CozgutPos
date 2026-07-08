import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { dec, money, moneyStr, qty, qtyStr, ReturnErrorCode, type Numeric } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

interface BatchBreakdownEntry {
  batchId: number;
  qty: string;
  buyPrice: string;
}

interface CompositeBreakdown {
  composite: true;
  ingredients: { ingredientProductId: number; breakdown: BatchBreakdownEntry[] }[];
}

type Chunk = { batchId: number; take: ReturnType<typeof dec>; buyPrice: ReturnType<typeof dec> };

function isCompositeBreakdown(
  b: BatchBreakdownEntry[] | CompositeBreakdown | null | undefined,
): b is CompositeBreakdown {
  return !!b && !Array.isArray(b) && b.composite === true;
}

/** Walks a batch breakdown FIFO-order and carves out up to `target` qty as restock chunks. */
function buildChunks(breakdown: BatchBreakdownEntry[], target: ReturnType<typeof dec>): Chunk[] {
  const chunks: Chunk[] = [];
  let remaining = target;
  for (const b of breakdown) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const available = dec(b.qty);
    const take = remaining.lessThan(available) ? remaining : available;
    if (take.lessThanOrEqualTo(0)) continue;
    chunks.push({ batchId: b.batchId, take, buyPrice: dec(b.buyPrice) });
    remaining = remaining.minus(take);
  }
  return chunks;
}

/**
 * Ingredient qty consumed per composite unit sold (SPEC §6.6). A composite
 * return's Return rows record restocked *ingredient* qty, which is not
 * directly comparable to the line's *composite* qty — this ratio converts
 * between the two so "already returned" can be computed in composite units.
 */
function compositeRatio(
  cb: CompositeBreakdown,
  lineQty: ReturnType<typeof dec>,
): ReturnType<typeof dec> {
  const totalIngredientQty = cb.ingredients.reduce(
    (acc, ing) => acc.plus(ing.breakdown.reduce((a, b) => a.plus(dec(b.qty)), dec(0))),
    dec(0),
  );
  return lineQty.isZero() ? dec(0) : totalIngredientQty.dividedBy(lineQty);
}

/** Converts a raw Return.qty sum (ingredient units for composites) into line (sold-product) units. */
function toLineUnits(
  sumRaw: ReturnType<typeof dec>,
  rawBreakdown: BatchBreakdownEntry[] | CompositeBreakdown | null | undefined,
  lineQty: ReturnType<typeof dec>,
): ReturnType<typeof dec> {
  if (!isCompositeBreakdown(rawBreakdown)) return sumRaw;
  const ratio = compositeRatio(rawBreakdown, lineQty);
  return ratio.isZero() ? dec(0) : sumRaw.dividedBy(ratio);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/**
 * Yzyna goýmak (SPEC §5.8/§6.12). SaleLine itself is never mutated (it stays
 * the original receipt record); only the parent Sale's total/cogsTotal are
 * adjusted so reports that resum Sale rows see the reversal (SPEC §6.13's
 * DailySummary job, built in Phase 6, will pick this up automatically).
 */
@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: { receiptNo?: number; saleId?: number; code?: string; date?: Date }) {
    const saleWhere: Record<string, unknown> = {};
    if (params.receiptNo) saleWhere.receiptNo = params.receiptNo;
    if (params.saleId) saleWhere.id = params.saleId;
    if (params.date) {
      saleWhere.datetime = { gte: startOfDay(params.date), lte: endOfDay(params.date) };
    }

    const lines = await this.prisma.saleLine.findMany({
      where: {
        ...(Object.keys(saleWhere).length ? { sale: saleWhere } : {}),
        ...(params.code ? { product: { code: { contains: params.code } } } : {}),
      },
      include: { sale: true, product: true },
      orderBy: { id: 'desc' },
      take: 50,
    });

    const returnedAgg = await this.prisma.return.groupBy({
      by: ['saleLineId'],
      where: { saleLineId: { in: lines.map((l) => l.id) } },
      _sum: { qty: true },
    });
    const returnedMap = new Map(returnedAgg.map((r) => [r.saleLineId, dec(r._sum.qty ?? 0)]));

    return lines.map((l) => {
      const returnedRaw = returnedMap.get(l.id) ?? dec(0);
      const rawBreakdown = l.batchBreakdown as unknown as
        BatchBreakdownEntry[] | CompositeBreakdown;
      const returned = toLineUnits(returnedRaw, rawBreakdown, dec(l.qty));
      return {
        saleLineId: l.id,
        saleId: l.saleId,
        receiptNo: l.sale.receiptNo,
        datetime: l.sale.datetime,
        productName: l.productNameSnapshot,
        productCode: l.product.code,
        qty: l.qty.toFixed(3),
        unitPrice: l.unitPrice.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2),
        returnable: qty(dec(l.qty).minus(returned)).toFixed(3),
      };
    });
  }

  async createReturn(saleLineId: number, returnQtyInput: Numeric) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.saleLine.findUnique({ where: { id: saleLineId } });
      if (!line) throw new NotFoundException('sale line not found');

      // Composite/Önüm lines (SPEC §6.6) store an ingredients breakdown
      // instead of a flat batch list; Return rows for them record restocked
      // *ingredient* qty, so "already returned" must be converted back to
      // line (composite) units before comparing against line.qty.
      const rawBreakdown = line.batchBreakdown as unknown as
        BatchBreakdownEntry[] | CompositeBreakdown;
      const lineQty = dec(line.qty);

      const alreadyReturnedAgg = await tx.return.aggregate({
        where: { saleLineId },
        _sum: { qty: true },
      });
      const alreadyReturned = toLineUnits(
        dec(alreadyReturnedAgg._sum.qty ?? 0),
        rawBreakdown,
        lineQty,
      );
      const remaining = lineQty.minus(alreadyReturned);
      const returnQty = qty(returnQtyInput);
      if (returnQty.lessThanOrEqualTo(0) || returnQty.greaterThan(remaining)) {
        throw new BadRequestException({
          code: ReturnErrorCode.INVALID_RETURN_QTY,
          remaining: remaining.toFixed(3),
        });
      }

      // Restock into the exact original batch(es), in the order they were
      // consumed (SPEC §6.12 "restock into the same batch(es)").
      const chunks: Chunk[] = isCompositeBreakdown(rawBreakdown)
        ? rawBreakdown.ingredients.flatMap((ing) => {
            const ingredientTotal = ing.breakdown.reduce((acc, b) => acc.plus(dec(b.qty)), dec(0));
            const ingredientTarget = qty(ingredientTotal.times(returnQty).dividedBy(lineQty));
            return buildChunks(ing.breakdown, ingredientTarget);
          })
        : buildChunks(rawBreakdown, returnQty);

      // Revenue is uniform per unit (line.unitPrice); COGS reversal is exact
      // per chunk since batchBreakdown recorded the real cost at sale time.
      const totalRevenue = money(dec(line.unitPrice).times(returnQty));
      let allocatedRevenue = dec(0);
      const returnRows = [];
      for (let i = 0; i < chunks.length; i++) {
        const { batchId, take } = chunks[i];
        const isLast = i === chunks.length - 1;
        const revenueForChunk = isLast
          ? money(totalRevenue.minus(allocatedRevenue))
          : money(dec(line.unitPrice).times(take));
        allocatedRevenue = allocatedRevenue.plus(revenueForChunk);

        const batch = await tx.stockBatch.findUniqueOrThrow({ where: { id: batchId } });
        await tx.stockBatch.update({
          where: { id: batchId },
          data: { qtyRemaining: qtyStr(dec(batch.qtyRemaining).plus(take)) },
        });

        returnRows.push(
          await tx.return.create({
            data: {
              saleLineId,
              qty: qtyStr(take),
              restockedBatchId: batchId,
              moneyAdjustment: moneyStr(revenueForChunk),
            },
          }),
        );
      }

      const cogsReversal = money(
        chunks.reduce((acc, c) => acc.plus(c.take.times(c.buyPrice)), dec(0)),
      );

      const sale = await tx.sale.findUniqueOrThrow({ where: { id: line.saleId } });
      await tx.sale.update({
        where: { id: line.saleId },
        data: {
          total: moneyStr(dec(sale.total).minus(totalRevenue)),
          cogsTotal: moneyStr(dec(sale.cogsTotal).minus(cogsReversal)),
        },
      });

      return {
        returns: returnRows,
        revenueReversal: moneyStr(totalRevenue),
        cogsReversal: moneyStr(cogsReversal),
      };
    });
  }
}
