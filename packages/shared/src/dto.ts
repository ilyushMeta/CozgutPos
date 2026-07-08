import { z } from 'zod';
import { Role } from './enums.js';

/** Auth DTOs — shared between server validation and client forms. */

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const authUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  role: z.nativeEnum(Role),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResultSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;

/** License status shown on the login screen. SPEC §5.1, §8. */
export const licenseStatusSchema = z.object({
  plan: z.enum(['TRIAL', 'STANDARD', 'UNLIMITED']),
  remainingDays: z.number().int(),
  unlimited: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  hardwareMismatch: z.boolean(),
});
export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

/** Setting upsert DTO. */
export const settingSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string(),
});
export type SettingInput = z.infer<typeof settingSchema>;

/**
 * First-run wizard submission (SPEC §3). Public by necessity — nobody has
 * logged in yet — but the server only accepts it once (see
 * SettingsService.completeFirstRun): it always re-checks FIRST_RUN_DONE
 * itself rather than trusting this flag from the request.
 */
export const firstRunSchema = z
  .object({
    mode: z.enum(['SERVER', 'CLIENT']),
    serverIp: z.string().min(1).optional(),
  })
  .refine((v) => v.mode !== 'CLIENT' || !!v.serverIp, {
    message: 'serverIp is required for CLIENT mode',
    path: ['serverIp'],
  });
export type FirstRunInput = z.infer<typeof firstRunSchema>;
