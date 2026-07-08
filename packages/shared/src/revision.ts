import { z } from 'zod';

/** Rewiz setiri (SPEC §5.9). `revisionId` omitted → server opens/reuses today's StockRevision. */
export const revisionLineInputSchema = z.object({
  revisionId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive(),
  countedQty: z.coerce.number().nonnegative(),
  note: z.string().optional(),
});
export type RevisionLineInput = z.infer<typeof revisionLineInputSchema>;

/** Tükelleme skanirlemek (SPEC §5.9). */
export const stocktakeScanSchema = z.object({
  productId: z.coerce.number().int().positive(),
  countedQty: z.coerce.number().nonnegative(),
});
export type StocktakeScanInput = z.infer<typeof stocktakeScanSchema>;
