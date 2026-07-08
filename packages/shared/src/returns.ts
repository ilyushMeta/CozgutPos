import { z } from 'zod';

/** Yzyna goýmak (SPEC §5.8/§6.12). */
export const returnInputSchema = z.object({
  saleLineId: z.coerce.number().int().positive(),
  qty: z.coerce.number().positive(),
});
export type ReturnInput = z.infer<typeof returnInputSchema>;

export const ReturnErrorCode = {
  INVALID_RETURN_QTY: 'INVALID_RETURN_QTY',
} as const;
export type ReturnErrorCode = (typeof ReturnErrorCode)[keyof typeof ReturnErrorCode];
