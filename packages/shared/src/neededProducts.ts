import { z } from 'zod';

/** Gerekli harytlar (SPEC §4.1 NeededProduct). */
export const neededProductSchema = z.object({
  name: z.string().min(1).max(191),
  code: z.string().max(64).optional(),
  qty: z.coerce.number().nonnegative().default(0),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
});
export type NeededProductInput = z.infer<typeof neededProductSchema>;
