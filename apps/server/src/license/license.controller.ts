import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { activateLicenseSchema, Role, type ActivateLicenseInput } from '@cozgut/shared';
import { LicenseService } from './license.service.js';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  // Public: the login screen shows remaining days before authentication (SPEC §5.1).
  @Public()
  @Get('status')
  status() {
    return this.license.getStatus();
  }

  @Roles(Role.ADMIN)
  @Post('activate')
  activate(@Body(new ZodValidationPipe(activateLicenseSchema)) body: ActivateLicenseInput) {
    return this.license.activate(body.code);
  }

  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post('rebind')
  async rebind() {
    await this.license.rebind();
    return this.license.getStatus();
  }
}
