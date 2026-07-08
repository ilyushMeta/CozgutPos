import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import { RecipesController } from './recipes.controller.js';
import { CodesModule } from '../codes/codes.module.js';

@Module({
  imports: [CodesModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
