import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicenseService } from './license.service.js';

/** Unit tests for licensing logic (SPEC §8) using an in-memory Prisma stub. */
function makePrisma(license: any, activationCodes: Record<string, any> = {}) {
  const store = { ...license };
  return {
    license: {
      findUnique: vi.fn(async () => (store.id ? store : null)),
      create: vi.fn(async ({ data }: any) => Object.assign(store, data)),
      update: vi.fn(async ({ data }: any) => {
        if (data.remainingDays?.increment !== undefined) {
          store.remainingDays += data.remainingDays.increment;
          return store;
        }
        return Object.assign(store, data);
      }),
    },
    activationCode: {
      findUnique: vi.fn(async ({ where }: any) => activationCodes[where.code] ?? null),
      update: vi.fn(async ({ where, data }: any) =>
        Object.assign(activationCodes[where.code], data),
      ),
    },
    $transaction: vi.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
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

  it('stores the hardware fingerprint on first status check without flagging a mismatch', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 10,
      lastSeenDate: day('2026-07-01'),
      hardwareId: null,
    });
    const svc = new LicenseService(prisma);
    const s = await svc.getStatus(day('2026-07-01'));
    expect(s.hardwareMismatch).toBe(false);
    expect(prisma.license.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hardwareId: expect.any(String) }),
      }),
    );
  });

  it('flags hardwareMismatch (soft, never blocks) when the stored id differs from this machine', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 10,
      lastSeenDate: day('2026-07-01'),
      hardwareId: 'some-other-machine-hash',
    });
    const svc = new LicenseService(prisma);
    const s = await svc.getStatus(day('2026-07-01'));
    expect(s.hardwareMismatch).toBe(true);
    expect(s.blocked).toBe(false);
  });

  it('rebind() overwrites hardwareId with the current machine fingerprint', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 10,
      lastSeenDate: day('2026-07-01'),
      hardwareId: 'stale-hash',
    });
    const svc = new LicenseService(prisma);
    await svc.rebind();
    const s = await svc.getStatus(day('2026-07-01'));
    expect(s.hardwareMismatch).toBe(false);
  });

  it("activate() adds the code's days to remainingDays and marks it used", async () => {
    prisma = makePrisma(
      { id: 1, plan: 'TRIAL', remainingDays: 5, lastSeenDate: day('2026-07-01') },
      { PROMO30: { code: 'PROMO30', days: 30, usedAt: null } },
    );
    const svc = new LicenseService(prisma);

    const status = await svc.activate('PROMO30', day('2026-07-01'));

    expect(status.remainingDays).toBe(35);
    expect(prisma.activationCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
    );
  });

  it('activate() rejects an unknown code', async () => {
    prisma = makePrisma({
      id: 1,
      plan: 'TRIAL',
      remainingDays: 5,
      lastSeenDate: day('2026-07-01'),
    });
    const svc = new LicenseService(prisma);
    await expect(svc.activate('NOPE')).rejects.toMatchObject({
      response: { code: 'INVALID_CODE' },
    });
  });

  it('activate() rejects a code that was already used', async () => {
    prisma = makePrisma(
      { id: 1, plan: 'TRIAL', remainingDays: 5, lastSeenDate: day('2026-07-01') },
      { USED1: { code: 'USED1', days: 10, usedAt: new Date('2026-01-01') } },
    );
    const svc = new LicenseService(prisma);
    await expect(svc.activate('USED1')).rejects.toMatchObject({
      response: { code: 'CODE_ALREADY_USED' },
    });
  });
});
