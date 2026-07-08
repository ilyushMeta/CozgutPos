import { describe, it, expect, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service.js';

function makePrisma(users: Record<number, any>) {
  return {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== undefined) return users[where.id] ?? null;
        return Object.values(users).find((u: any) => u.username === where.username) ?? null;
      }),
      findMany: vi.fn(async () => Object.values(users)),
      create: vi.fn(async ({ data }: any) => {
        const id = Object.keys(users).length + 1;
        const user = { id, isActive: true, createdAt: new Date(), ...data };
        users[id] = user;
        return user;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        users[where.id] = { ...users[where.id], ...data };
        return users[where.id];
      }),
      count: vi.fn(async ({ where }: any) => {
        return Object.values(users).filter(
          (u: any) => u.role === where.role && u.isActive === where.isActive,
        ).length;
      }),
    },
  } as any;
}

describe('UsersService (SPEC §5.14)', () => {
  it('create() hashes the password and rejects a taken username', async () => {
    const prisma = makePrisma({ 1: { id: 1, username: 'admin', role: 'ADMIN', isActive: true } });
    const svc = new UsersService(prisma);

    const user = await svc.create({
      username: 'kassir',
      password: 'secret1',
      role: 'CASHIER' as any,
    });
    expect(user.username).toBe('kassir');
    expect(user.passwordHash).not.toBe('secret1');

    await expect(
      svc.create({ username: 'admin', password: 'secret1', role: 'CASHIER' as any }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update() blocks an admin from deactivating themselves', async () => {
    const prisma = makePrisma({
      1: { id: 1, username: 'admin', role: 'ADMIN', isActive: true },
      2: { id: 2, username: 'admin2', role: 'ADMIN', isActive: true },
    });
    const svc = new UsersService(prisma);

    await expect(svc.update(1, { isActive: false }, 1)).rejects.toMatchObject({
      response: { code: 'CANNOT_DEACTIVATE_SELF' },
    });
  });

  it('update() blocks deactivating the last active admin (by another admin)', async () => {
    const prisma = makePrisma({
      1: { id: 1, username: 'admin', role: 'ADMIN', isActive: true },
      2: { id: 2, username: 'admin2', role: 'ADMIN', isActive: true },
    });
    const svc = new UsersService(prisma);

    // deactivate admin2 first -> only 1 admin left
    await svc.update(2, { isActive: false }, 1);
    // now deactivating the last one (by a different acting user id, e.g. impossible in practice
    // since acting user would no longer be active, but the guard itself must still hold)
    await expect(svc.update(1, { isActive: false }, 999)).rejects.toMatchObject({
      response: { code: 'LAST_ACTIVE_ADMIN' },
    });
  });

  it('update() blocks demoting the last active admin to CASHIER', async () => {
    const prisma = makePrisma({ 1: { id: 1, username: 'admin', role: 'ADMIN', isActive: true } });
    const svc = new UsersService(prisma);

    await expect(svc.update(1, { role: 'CASHIER' as any }, 999)).rejects.toMatchObject({
      response: { code: 'LAST_ACTIVE_ADMIN' },
    });
  });

  it('update() allows deactivating a non-last admin', async () => {
    const prisma = makePrisma({
      1: { id: 1, username: 'admin', role: 'ADMIN', isActive: true },
      2: { id: 2, username: 'admin2', role: 'ADMIN', isActive: true },
    });
    const svc = new UsersService(prisma);

    const updated = await svc.update(2, { isActive: false }, 1);
    expect(updated.isActive).toBe(false);
  });

  it('update() allows a role/password change that does not touch admin-count safety', async () => {
    const prisma = makePrisma({
      1: { id: 1, username: 'admin', role: 'ADMIN', isActive: true, passwordHash: 'old' },
    });
    const svc = new UsersService(prisma);

    const updated = await svc.update(1, { password: 'newpass1' }, 1);
    expect(updated.passwordHash).not.toBe('old');
    expect(updated.passwordHash).not.toBe('newpass1');
  });
});
