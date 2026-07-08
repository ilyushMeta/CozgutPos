import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { neededProductSchema, type NeededProductInput } from '@cozgut/shared';
import { NeededProductsService } from './needed-products.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('needed-products')
export class NeededProductsController {
  constructor(private readonly neededProducts: NeededProductsService) {}

  @Get()
  findAll() {
    return this.neededProducts.findAll();
  }

  @Post()
  create(@Body(new ZodValidationPipe(neededProductSchema)) body: NeededProductInput) {
    return this.neededProducts.create(body);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(neededProductSchema)) body: NeededProductInput,
  ) {
    return this.neededProducts.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.neededProducts.remove(id);
  }
}
