import { Module } from '@nestjs/common';
import { FifoService } from './fifo.service.js';

@Module({
  providers: [FifoService],
  exports: [FifoService],
})
export class FifoModule {}
