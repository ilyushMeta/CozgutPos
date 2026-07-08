import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  supplierUpsertSchema,
  supplierPaymentSchema,
  Role,
  type SupplierUpsertInput,
  type SupplierPaymentInput,
} from '@cozgut/shared';
import { SuppliersService } from './suppliers.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  findAll() {
    return this.suppliers.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.suppliers.findOne(id);
  }

  @Get(':id/moves')
  listMoves(@Param('id', ParseIntPipe) id: number) {
    return this.suppliers.listMoves(id);
  }

  @Roles(Role.ADMIN)
  @Post('generate-code')
  generateCode() {
    return this.suppliers.generateCode();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(supplierUpsertSchema)) body: SupplierUpsertInput) {
    return this.suppliers.create(body);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(supplierUpsertSchema)) body: SupplierUpsertInput,
  ) {
    return this.suppliers.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.suppliers.remove(id);
  }

  @Post(':id/pay')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(supplierPaymentSchema)) body: SupplierPaymentInput,
  ) {
    return this.suppliers.payDebt(id, body);
  }
}
