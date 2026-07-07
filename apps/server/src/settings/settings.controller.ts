import { Body, Controller, Get, Put, UsePipes } from '@nestjs/common';
import { settingSchema, Role, type SettingInput } from '@cozgut/shared';
import { SettingsService } from './settings.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Any authenticated user can read settings (client needs shop header, language…).
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  // Only admins may change settings.
  @Roles(Role.ADMIN)
  @Put()
  @UsePipes(new ZodValidationPipe(settingSchema))
  set(@Body() body: SettingInput) {
    return this.settings.set(body.key, body.value);
  }
}
