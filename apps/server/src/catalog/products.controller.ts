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
  productSchema,
  unitPackSchema,
  Role,
  type ProductInput,
  type UnitPackInput,
} from '@cozgut/shared';
import { ProductsService } from './products.service.js';
import { UnitPacksService } from './unit-packs.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly unitPacks: UnitPacksService,
  ) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.products.findAll(search);
  }

  @Roles(Role.ADMIN)
  @Post('generate-code')
  generateCode() {
    return this.products.generateCode();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(productSchema)) body: ProductInput) {
    return this.products.create(body);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(productSchema)) body: ProductInput,
  ) {
    return this.products.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.products.remove(id);
  }

  @Get(':id/unit-packs')
  findUnitPacks(@Param('id', ParseIntPipe) id: number) {
    return this.unitPacks.findAllForProduct(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/unit-packs')
  createUnitPack(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(unitPackSchema)) body: UnitPackInput,
  ) {
    return this.unitPacks.create(id, body);
  }
}
