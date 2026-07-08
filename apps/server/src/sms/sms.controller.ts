import { Body, Controller, Post } from '@nestjs/common';
import { smsTestSchema, Role, type SmsTestInput } from '@cozgut/shared';
import { SmsService } from './sms.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Roles(Role.ADMIN)
  @Post('test')
  test(@Body(new ZodValidationPipe(smsTestSchema)) body: SmsTestInput) {
    return this.sms.send(body.to, body.message);
  }
}
