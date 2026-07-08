import { z } from 'zod';

/** Ikinji dükan satuwy (SPEC §5.10/§6.11) — ýönekeýleşdirilen töleg: bir görnüş, doly mukdar. */
export const secondShopSaleLineSchema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});
export type SecondShopSaleLineInput = z.infer<typeof secondShopSaleLineSchema>;

export const secondShopSaleSchema = z.object({
  lines: z.array(secondShopSaleLineSchema).min(1),
  paymentMethod: z.enum(['CASH', 'CARD']),
});
export type SecondShopSaleInput = z.infer<typeof secondShopSaleSchema>;
