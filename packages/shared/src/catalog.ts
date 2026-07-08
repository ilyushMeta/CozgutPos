import { z } from 'zod';
import { Currency } from './enums.js';

/** Category CRUD (SPEC §5.4). */
export const categorySchema = z.object({
  name: z.string().min(1).max(191),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** UnitPack CRUD (SPEC §6.7 "Olceg"). */
export const unitPackSchema = z.object({
  name: z.string().min(1).max(64),
  qtyInside: z.coerce.number().positive(),
  buyPrice: z.coerce.number().nonnegative(),
  sellPrice: z.coerce.number().nonnegative(),
});
export type UnitPackInput = z.infer<typeof unitPackSchema>;

/** Product CRUD (SPEC §5.3/§5.4). `code` omitted → server auto-generates (SPEC §6.9). */
export const productSchema = z.object({
  name: z.string().min(1).max(191),
  code: z.string().min(1).max(64).optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  isScaleItem: z.boolean().optional().default(false),
  lowStockThreshold: z.coerce.number().nonnegative().optional().default(0),
  expiryDate: z.coerce.date().nullable().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  secondPrice: z.coerce.number().nonnegative().nullable().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

/**
 * StockBatch pricing correction (SPEC §5.4 "edit product + batch fields").
 * Quantity is intentionally NOT editable here — qty corrections go through
 * Rewiz (Phase 5), which has a proper audit trail; this only fixes prices
 * entered wrong at receiving time (safe to change after sales: SaleLine
 * snapshots its own batchBreakdown/cogs, so past sales are unaffected).
 */
export const stockBatchUpdateSchema = z.object({
  buyPrice: z.coerce.number().nonnegative(),
  sellPrice: z.coerce.number().nonnegative(),
  sellPriceUSD: z.coerce.number().nonnegative().nullable().optional(),
  currency: z.nativeEnum(Currency),
});
export type StockBatchUpdateInput = z.infer<typeof stockBatchUpdateSchema>;
