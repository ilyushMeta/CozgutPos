import { ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Role, UserErrorCode, type CreateUserInput, type UpdateUserInput } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '@prisma/client';

const BCRYPT_ROUNDS = 10;

/** Admin Users CRUD (SPEC §5.14). No hard delete — Sale.cashierId/LoginAudit.userId
 * reference users by id, so removal would break history; deactivation is the only path. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { username: 'asc' } });
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.findByUsername(input.username);
    if (existing) throw new ConflictException({ code: UserErrorCode.USERNAME_TAKEN });
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: { username: input.username, passwordHash, role: input.role },
    });
  }

  async update(id: number, input: UpdateUserInput, actingUserId: number): Promise<User> {
    const losesActiveAdminStatus =
      input.isActive === false || (input.role && input.role !== Role.ADMIN);
    if (losesActiveAdminStatus) {
      if (input.isActive === false && id === actingUserId) {
        throw new ConflictException({ code: UserErrorCode.CANNOT_DEACTIVATE_SELF });
      }
      await this.assertNotLastActiveAdmin(id);
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
      : undefined;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  }

  private async assertNotLastActiveAdmin(id: number): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (target?.role !== Role.ADMIN || !target.isActive) return;
    const activeAdmins = await this.prisma.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });
    if (activeAdmins <= 1) {
      throw new ConflictException({ code: UserErrorCode.LAST_ACTIVE_ADMIN });
    }
  }
}
