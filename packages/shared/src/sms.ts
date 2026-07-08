import { z } from 'zod';

/** Settings screen "test" button (SPEC §7.4). */
export const smsTestSchema = z.object({
  to: z.string().min(1).max(32),
  message: z.string().min(1).max(500).optional().default('Çözgüt POS — synag habary'),
});
export type SmsTestInput = z.infer<typeof smsTestSchema>;
