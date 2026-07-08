import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { categorySchema, Role, type CategoryInput } from '@cozgut/shared';
import { CategoriesService } from './categories.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAll();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(categorySchema)) body: CategoryInput) {
    return this.categories.create(body);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(categorySchema)) body: CategoryInput,
  ) {
    return this.categories.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(id);
  }
}
