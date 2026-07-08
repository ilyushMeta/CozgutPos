import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  type LoginInput,
  type RefreshInput,
  type ChangePasswordInput,
} from '@cozgut/shared';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import { SkipPasswordResetCheck } from './skip-password-reset-check.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { AuthUser } from '@cozgut/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // rate-limit login (SPEC §8)
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput) {
    return this.auth.login(body.username, body.password);
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @SkipPasswordResetCheck()
  @Post('change-password')
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordInput) {
    return this.auth.changePassword(user.id, body.newPassword);
  }
}
