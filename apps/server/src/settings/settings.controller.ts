import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  settingSchema,
  firstRunSchema,
  Role,
  SettingKey,
  type SettingInput,
  type FirstRunInput,
} from '@cozgut/shared';
import { SettingsService } from './settings.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Public: the first-run wizard (SPEC §3) must know this before anyone is
  // logged in — unlike the rest of Settings, which is only meaningful once
  // authenticated (shop header, language…).
  @Public()
  @Get('first-run-status')
  async firstRunStatus() {
    const value = await this.settings.get(SettingKey.FIRST_RUN_DONE);
    return { done: value === 'true' };
  }

  // Public one-shot action — see SettingsService.completeFirstRun doc comment
  // for why the normal ADMIN-guarded PUT below can't be used here.
  @Public()
  @Post('first-run')
  async completeFirstRun(@Body(new ZodValidationPipe(firstRunSchema)) body: FirstRunInput) {
    await this.settings.completeFirstRun(body.mode, body.serverIp);
    return { done: true };
  }

  // Any authenticated user can read settings (client needs shop header, language…).
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  // Only admins may change settings.
  @Roles(Role.ADMIN)
  @Put()
  set(@Body(new ZodValidationPipe(settingSchema)) body: SettingInput) {
    return this.settings.set(body.key, body.value);
  }
}
