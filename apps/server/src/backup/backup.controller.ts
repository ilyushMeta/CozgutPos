import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { restoreBackupSchema, Role, type RestoreBackupInput } from '@cozgut/shared';
import { BackupService } from './backup.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Roles(Role.ADMIN)
@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  list() {
    return this.backup.list();
  }

  @Post('create')
  create() {
    return this.backup.create();
  }

  @Delete(':filename')
  async remove(@Param('filename') filename: string) {
    await this.backup.remove(filename);
    return { ok: true };
  }

  @Post('restore')
  @UseInterceptors(FileInterceptor('file'))
  async restore(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(restoreBackupSchema)) body: RestoreBackupInput,
  ) {
    if (!file) throw new BadRequestException('file is required');
    await this.backup.restore(file.buffer, body.password);
    return { ok: true };
  }
}
