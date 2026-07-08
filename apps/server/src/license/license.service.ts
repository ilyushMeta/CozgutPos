import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { hostname, platform, arch, totalmem } from 'node:os';
import { LicenseErrorCode, type LicenseStatus } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { License } from '@prisma/client';

const UNLIMITED_DAYS = 99999;

/** Platform-independent stand-in for the legacy `wmic` motherboard-serial read
 * (SPEC §8) — a soft hardware fingerprint, never a hard machine-id dependency. */
function computeFingerprint(): string {
  return createHash('sha256')
    .update(`${hostname()}|${platform()}|${arch()}|${totalmem()}`)
    .digest('hex');
}

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * License status with anti clock-rollback (SPEC §8).
   * - UNLIMITED plan skips checks.
   * - If system date < lastSeenDate → blocked ("Wagt yza çekilen").
   * - remainingDays decremented by real-date diff; monotonic lastSeenDate.
   * - Hardware fingerprint is a SOFT check: a mismatch never blocks, it only
   *   surfaces `hardwareMismatch: true` for an admin banner (§8 "admin
   *   override tool" = POST /license/rebind).
   */
  async getStatus(now: Date = new Date()): Promise<LicenseStatus> {
    const license = await this.getOrCreateLicense(now);
    const hardwareMismatch = await this.checkHardware(license);

    if (license.plan === 'UNLIMITED') {
      return {
        plan: 'UNLIMITED',
        remainingDays: UNLIMITED_DAYS,
        unlimited: true,
        blocked: false,
        blockReason: null,
        hardwareMismatch,
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
        hardwareMismatch,
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
      hardwareMismatch,
    };
  }

  /** Redeem an ActivationCode, adding its days to remainingDays (SPEC §5.14/§8). */
  async activate(code: string, now: Date = new Date()): Promise<LicenseStatus> {
    const activation = await this.prisma.activationCode.findUnique({ where: { code } });
    if (!activation) throw new ConflictException({ code: LicenseErrorCode.INVALID_CODE });
    if (activation.usedAt)
      throw new ConflictException({ code: LicenseErrorCode.CODE_ALREADY_USED });

    await this.getOrCreateLicense(now);
    await this.prisma.$transaction([
      this.prisma.activationCode.update({ where: { code }, data: { usedAt: now } }),
      this.prisma.license.update({
        where: { id: 1 },
        data: { remainingDays: { increment: activation.days } },
      }),
    ]);
    return this.getStatus(now);
  }

  /** Admin override tool (SPEC §8): accept the current machine as the bound one. */
  async rebind(): Promise<void> {
    await this.getOrCreateLicense(new Date());
    await this.prisma.license.update({
      where: { id: 1 },
      data: { hardwareId: computeFingerprint() },
    });
  }

  private async getOrCreateLicense(now: Date): Promise<License> {
    const existing = await this.prisma.license.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return this.prisma.license.create({
      data: { id: 1, remainingDays: 30, lastSeenDate: startOfDay(now), plan: 'TRIAL' },
    });
  }

  /** Stores the fingerprint on first run; afterwards only reports a mismatch, never blocks. */
  private async checkHardware(license: License): Promise<boolean> {
    const current = computeFingerprint();
    if (!license.hardwareId) {
      await this.prisma.license.update({ where: { id: 1 }, data: { hardwareId: current } });
      return false;
    }
    return license.hardwareId !== current;
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
