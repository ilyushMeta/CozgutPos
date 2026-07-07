import { Injectable } from '@nestjs/common';
import type { LicenseStatus } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';

const UNLIMITED_DAYS = 99999;

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * License status with anti clock-rollback (SPEC §8).
   * - UNLIMITED plan skips checks.
   * - If system date < lastSeenDate → blocked ("Wagt yza çekilen").
   * - remainingDays decremented by real-date diff; monotonic lastSeenDate.
   */
  async getStatus(now: Date = new Date()): Promise<LicenseStatus> {
    let license = await this.prisma.license.findUnique({ where: { id: 1 } });
    if (!license) {
      // Bootstrap a trial license on first run.
      license = await this.prisma.license.create({
        data: { id: 1, remainingDays: 30, lastSeenDate: startOfDay(now), plan: 'TRIAL' },
      });
    }

    if (license.plan === 'UNLIMITED') {
      return {
        plan: 'UNLIMITED',
        remainingDays: UNLIMITED_DAYS,
        unlimited: true,
        blocked: false,
        blockReason: null,
      };
    }

    const today = startOfDay(now);
    const lastSeen = startOfDay(license.lastSeenDate);

    // Clock-rollback guard.
    if (today.getTime() < lastSeen.getTime()) {
      return {
        plan: license.plan,
        remainingDays: license.remainingDays,
        unlimited: false,
        blocked: true,
        blockReason: 'clockRolledBack',
      };
    }

    // Decrement by whole days elapsed since last seen.
    const elapsedDays = Math.floor((today.getTime() - lastSeen.getTime()) / 86_400_000);
    let remaining = license.remainingDays;
    if (elapsedDays > 0) {
      remaining = Math.max(0, license.remainingDays - elapsedDays);
      await this.prisma.license.update({
        where: { id: 1 },
        data: { remainingDays: remaining, lastSeenDate: today },
      });
    }

    const blocked = remaining <= 0;
    return {
      plan: license.plan,
      remainingDays: remaining,
      unlimited: false,
      blocked,
      blockReason: blocked ? 'expired' : null,
    };
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
