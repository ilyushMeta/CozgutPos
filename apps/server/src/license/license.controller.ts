import { Controller, Get } from '@nestjs/common';
import { LicenseService } from './license.service.js';
import { Public } from '../auth/public.decorator.js';

@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  // Public: the login screen shows remaining days before authentication (SPEC §5.1).
  @Public()
  @Get('status')
  status() {
    return this.license.getStatus();
  }
}
