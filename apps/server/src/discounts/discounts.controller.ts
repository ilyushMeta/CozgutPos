import { BadRequestException, Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  PaymentMethod,
  Role,
  updateDiscountSchema,
  type UpdateDiscountInput,
} from '@cozgut/shared';
import { DiscountsService } from './discounts.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

const VALID_METHODS = new Set(Object.values(PaymentMethod));

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  findAll() {
    return this.discounts.findAll();
  }

  @Roles(Role.ADMIN)
  @Put(':method')
  update(
    @Param('method') method: string,
    @Body(new ZodValidationPipe(updateDiscountSchema)) body: UpdateDiscountInput,
  ) {
    if (!VALID_METHODS.has(method as PaymentMethod)) {
      throw new BadRequestException('invalid payment method');
    }
    return this.discounts.upsert(method as PaymentMethod, body.percent);
  }
}
