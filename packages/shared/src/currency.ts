import { z } from 'zod';

/** Walýuta — append-only exchange rate history (SPEC §5.11, ExchangeRate). */
export const addExchangeRateSchema = z.object({
  rate: z.coerce.number().positive(),
});
export type AddExchangeRateInput = z.infer<typeof addExchangeRateSchema>;
