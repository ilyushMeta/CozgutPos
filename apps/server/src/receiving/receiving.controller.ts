import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { receivingSchema, Role, type ReceivingInput } from '@cozgut/shared';
import { ReceivingService } from './receiving.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receiving: ReceivingService) {}

  @Roles(Role.ADMIN)
  @Post()
  @UsePipes(new ZodValidationPipe(receivingSchema))
  receive(@Body() body: ReceivingInput) {
    return this.receiving.receive(body);
  }
}
