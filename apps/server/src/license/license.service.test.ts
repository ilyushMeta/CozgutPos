import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicenseService } from './license.service.js';

/** Unit tests for licensing logic (SPEC §8) using an in-memory Prisma stub. */
function makePrisma(license: any) {
  const store = { ...license };
  return {
    license: {
      findUnique: vi.fn(async () => (store.id ? store : null)),
      create: vi.fn(async ({ data }: any) => Object.assign(store, data)),
      update: vi.fn(async ({ data }: any) => Object.assign(store, data)),
    },
  } as any;
}

const day = (s: string) => new Date(s + 'T12:00:00');

describe('LicenseService (SPEC §8)', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = null;
  });

  it('UNLIMITED plan is never blocked', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'UNLIMITED',
      remainingDays: 0,
      lastSeenDate: day('2026-01-01'),
    });
    const svc = new LicenseService(prisma);
    const s = await svc.getStatus(day('2030-01-01'));
    expect(s.unlimited).toBe(true);
    expect(s.blocked).toBe(false);
  });

  it('decrements remaining days by elapsed days', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 30,
      lastSeenDate: day('2026-07-01'),
    });
    const svc = new LicenseService(prisma);
    const s = await svc.getStatus(day('2026-07-06')); // 5 days later
    expect(s.remainingDays).toBe(25);
    expect(s.blocked).toBe(false);
  });

  it('blocks when clock rolled back', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 10,
      lastSeenDate: day('2026-07-10'),
    });
    const svc = new LicenseService(prisma);
    const s = await svc.getStatus(day('2026-07-05'));
    expect(s.blocked).toBe(true);
    expect(s.blockReason).toBe('clockRolledBack');
  });

  it('blocks and reports expired at zero days', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 2,
      lastSeenDate: day('2026-07-01'),
    });
    const svc = new LicenseService(prisma);
    const s = await svc.getStatus(day('2026-07-10'));
    expect(s.remainingDays).toBe(0);
    expect(s.blocked).toBe(true);
    expect(s.blockReason).toBe('expired');
  });
});
