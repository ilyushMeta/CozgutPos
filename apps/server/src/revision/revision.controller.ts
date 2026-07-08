import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { revisionLineInputSchema, type RevisionLineInput } from '@cozgut/shared';
import { RevisionService } from './revision.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('revision')
export class RevisionController {
  constructor(private readonly revision: RevisionService) {}

  @Get(':productId/system-qty')
  systemQty(@Param('productId', ParseIntPipe) productId: number) {
    return this.revision.getSystemQty(productId);
  }

  @Post('lines')
  createLine(@Body(new ZodValidationPipe(revisionLineInputSchema)) body: RevisionLineInput) {
    return this.revision.createLine(body);
  }

  @Get()
  findAll() {
    return this.revision.findAll();
  }
}
