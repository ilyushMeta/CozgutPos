import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate } from '@nestjs/common';
import type { AuthUser } from '@cozgut/shared';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { SKIP_PASSWORD_RESET_CHECK_KEY } from './skip-password-reset-check.decorator.js';

/** Blocks every route (except @Public and @SkipPasswordResetCheck ones) for a
 * user whose account still needs a forced password change (SPEC §10 step 4). */
@Injectable()
export class MustResetPasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isExempt = this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_RESET_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || isExempt) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user?.mustResetPassword) {
      throw new ForbiddenException('mustResetPassword');
    }
    return true;
  }
}
