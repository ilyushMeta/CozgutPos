import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { secondShopSaleSchema, type AuthUser, type SecondShopSaleInput } from '@cozgut/shared';
import { SecondShopService } from './second-shop.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('second-shop')
export class SecondShopController {
  constructor(private readonly secondShop: SecondShopService) {}

  @Post('sales')
  create(
    @Body(new ZodValidationPipe(secondShopSaleSchema)) body: SecondShopSaleInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.secondShop.createSale(body, user.id);
  }

  @Get('sales')
  report(@Query('from') from?: string, @Query('to') to?: string) {
    return this.secondShop.periodReport(
      from ? new Date(from) : new Date(0),
      to ? new Date(to) : new Date(),
    );
  }
}
