import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service.js';
import { ReturnsController } from './returns.controller.js';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
