import { z } from 'zod';

/** License activation (SPEC §5.14, §8). */
export const activateLicenseSchema = z.object({
  code: z.string().min(1).max(64),
});
export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;

export const LicenseErrorCode = {
  INVALID_CODE: 'INVALID_CODE',
  CODE_ALREADY_USED: 'CODE_ALREADY_USED',
} as const;
export type LicenseErrorCode = (typeof LicenseErrorCode)[keyof typeof LicenseErrorCode];
