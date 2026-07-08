import { z } from 'zod';

/** Kassa gün açyş (SPEC §5.7 "PulGoýmak"). */
export const openDaySchema = z.object({
  openingBalance: z.coerce.number().nonnegative(),
});
export type OpenDayInput = z.infer<typeof openDaySchema>;

export const depositSchema = z.object({
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});
export type DepositInput = z.infer<typeof depositSchema>;

/** Pul almak (SPEC §5.7) — reason is required, mirroring legacy's PulAlmak prompt. */
export const withdrawSchema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().min(1),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;
