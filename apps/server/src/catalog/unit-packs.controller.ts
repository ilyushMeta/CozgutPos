import { Body, Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common';
import { unitPackSchema, Role, type UnitPackInput } from '@cozgut/shared';
import { UnitPacksService } from './unit-packs.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('unit-packs')
export class UnitPacksController {
  constructor(private readonly unitPacks: UnitPacksService) {}

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(unitPackSchema)) body: UnitPackInput,
  ) {
    return this.unitPacks.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unitPacks.remove(id);
  }
}
