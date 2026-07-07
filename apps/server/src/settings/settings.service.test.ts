import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

function makePrisma(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    setting: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.key in store ? { key: where.key, value: store[where.key] } : null,
      ),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        store[where.key] = where.key in store ? update.value : create.value;
        return { key: where.key, value: store[where.key] };
      }),
      findMany: vi.fn(async () => Object.entries(store).map(([key, value]) => ({ key, value }))),
    },
  } as any;
}

describe('SettingsService.completeFirstRun (SPEC §3 first-run wizard)', () => {
  it('writes SERVER mode and marks first-run done', async () => {
    const prisma = makePrisma({ 'app.firstRunDone': 'false' });
    const svc = new SettingsService(prisma);
    await svc.completeFirstRun('SERVER');
    expect(await svc.get('server.mode')).toBe('SERVER');
    expect(await svc.get('app.firstRunDone')).toBe('true');
  });

  it('writes CLIENT mode with the server IP', async () => {
    const prisma = makePrisma({ 'app.firstRunDone': 'false' });
    const svc = new SettingsService(prisma);
    await svc.completeFirstRun('CLIENT', '192.168.1.10');
    expect(await svc.get('server.mode')).toBe('CLIENT');
    expect(await svc.get('server.ip')).toBe('192.168.1.10');
  });

  it('refuses to run again once first-run is already done', async () => {
    const prisma = makePrisma({ 'app.firstRunDone': 'true', 'server.mode': 'SERVER' });
    const svc = new SettingsService(prisma);
    await expect(svc.completeFirstRun('CLIENT', '10.0.0.5')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // Original setting must be untouched.
    expect(await svc.get('server.mode')).toBe('SERVER');
  });
});
