import { z } from 'zod';

/** Per-payment-method discount % (SPEC §5.11, PaymentDiscount). */
export const updateDiscountSchema = z.object({
  percent: z.coerce.number().min(0).max(100),
});
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
