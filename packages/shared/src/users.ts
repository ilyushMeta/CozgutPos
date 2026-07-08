import { z } from 'zod';
import { Role } from './enums.js';

/** Admin Users CRUD (SPEC §5.14). No hard delete — see UsersService.update. */
export const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
  role: z.nativeEnum(Role),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(128).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const UserErrorCode = {
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  CANNOT_DEACTIVATE_SELF: 'CANNOT_DEACTIVATE_SELF',
  LAST_ACTIVE_ADMIN: 'LAST_ACTIVE_ADMIN',
} as const;
export type UserErrorCode = (typeof UserErrorCode)[keyof typeof UserErrorCode];
