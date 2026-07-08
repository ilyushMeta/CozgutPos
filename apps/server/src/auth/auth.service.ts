import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { AuthResult, AuthUser } from '@cozgut/shared';
import { UsersService } from '../users/users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PluService } from '../plu/plu.service.js';
import type { JwtPayload } from './jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly plu: PluService,
  ) {}

  /** Validate credentials, write LoginAudit, and issue tokens. SPEC §5.1. */
  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByUsername(username);
    if (!user || !user.isActive) throw new UnauthorizedException('invalidCredentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalidCredentials');

    await this.prisma.loginAudit.create({ data: { userId: user.id } });
    void this.plu.exportSafely(); // fire-and-forget (SPEC §5.1/§7.3), never blocks login

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
    };
    return this.issueTokens(authUser);
  }

  /** Forced password change for migrated legacy accounts (SPEC §10 step 4).
   * Re-issues tokens so the mustResetPassword flag in the access token clears immediately. */
  async changePassword(userId: number, newPassword: string): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustResetPassword: false },
    });
    return this.issueTokens({
      id: user.id,
      username: user.username,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
    });
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('invalidToken');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('invalidToken');

    return this.issueTokens({
      id: user.id,
      username: user.username,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
    });
  }

  private async issueTokens(user: AuthUser): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '7d'),
    });
    return { accessToken, refreshToken, user };
  }
}
