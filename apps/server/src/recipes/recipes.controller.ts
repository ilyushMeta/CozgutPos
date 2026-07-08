import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { recipeInputSchema, Role, type RecipeInput } from '@cozgut/shared';
import { RecipesService } from './recipes.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  findAll() {
    return this.recipes.findAll();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(recipeInputSchema)) body: RecipeInput) {
    return this.recipes.create(body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.recipes.remove(id);
  }
}
