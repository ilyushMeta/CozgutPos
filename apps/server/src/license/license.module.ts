import { Module } from '@nestjs/common';
import { LicenseService } from './license.service.js';
import { LicenseController } from './license.controller.js';

@Module({
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
