import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { AuthResult, AuthUser } from '@cozgut/shared';
import { UsersService } from '../users/users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Validate credentials, write LoginAudit, and issue tokens. SPEC §5.1. */
  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByUsername(username);
    if (!user || !user.isActive) throw new UnauthorizedException('invalidCredentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalidCredentials');

    await this.prisma.loginAudit.create({ data: { userId: user.id } });

    const authUser: AuthUser = { id: user.id, username: user.username, role: user.role };
    return this.issueTokens(authUser);
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

    return this.issueTokens({ id: user.id, username: user.username, role: user.role });
  }

  private async issueTokens(user: AuthUser): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
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
