import { Controller, Post } from '@nestjs/common';
import { Role } from '@cozgut/shared';
import { PluService } from './plu.service.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('plu')
export class PluController {
  constructor(private readonly plu: PluService) {}

  @Roles(Role.ADMIN)
  @Post('export')
  export() {
    return this.plu.export();
  }
}
