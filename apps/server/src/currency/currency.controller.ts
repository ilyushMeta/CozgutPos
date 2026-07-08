import { Body, Controller, Get, Post } from '@nestjs/common';
import { addExchangeRateSchema, Role, type AddExchangeRateInput } from '@cozgut/shared';
import { CurrencyService } from './currency.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) {}

  @Get('current')
  current() {
    return this.currency.current();
  }

  @Get('history')
  history() {
    return this.currency.history();
  }

  @Roles(Role.ADMIN)
  @Post()
  add(@Body(new ZodValidationPipe(addExchangeRateSchema)) body: AddExchangeRateInput) {
    return this.currency.add(body.rate);
  }
}
