import { Module } from '@nestjs/common';
import { LabelsService } from './labels.service.js';
import { LabelsController } from './labels.controller.js';

@Module({
  controllers: [LabelsController],
  providers: [LabelsService],
})
export class LabelsModule {}
