import { Body, Controller, Post } from '@nestjs/common';
import { createSaleSchema, type AuthUser, type CreateSaleInput } from '@cozgut/shared';
import { SalesService } from './sales.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createSaleSchema)) body: CreateSaleInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createSale(body, user.id);
  }
}
