import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  debtorSchema,
  debtPaymentSchema,
  Role,
  type DebtorInput,
  type DebtPaymentInput,
} from '@cozgut/shared';
import { DebtorsService } from './debtors.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('debtors')
export class DebtorsController {
  constructor(private readonly debtors: DebtorsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.debtors.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.debtors.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post('generate-code')
  generateCode() {
    return this.debtors.generateCode();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(debtorSchema)) body: DebtorInput) {
    return this.debtors.create(body);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(debtorSchema)) body: DebtorInput,
  ) {
    return this.debtors.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.debtors.remove(id);
  }

  @Post(':id/pay')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(debtPaymentSchema)) body: DebtPaymentInput,
  ) {
    return this.debtors.recordPayment(id, body);
  }
}
