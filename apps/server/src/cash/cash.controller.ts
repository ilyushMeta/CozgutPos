import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CashMoveType } from '@prisma/client';
import {
  openDaySchema,
  depositSchema,
  withdrawSchema,
  Role,
  type OpenDayInput,
  type DepositInput,
  type WithdrawInput,
} from '@cozgut/shared';
import { CashService } from './cash.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('today')
  today() {
    return this.cash.getDaySummary(new Date());
  }

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.cash.getDaySummary(date ? new Date(date) : new Date());
  }

  @Get('moves')
  moves(@Query('from') from?: string, @Query('to') to?: string) {
    return this.cash.getMoves(from ? new Date(from) : new Date(0), to ? new Date(to) : new Date());
  }

  @Roles(Role.ADMIN)
  @Post('open')
  open(@Body(new ZodValidationPipe(openDaySchema)) body: OpenDayInput) {
    return this.cash.openDay(new Date(), body.openingBalance);
  }

  @Post('deposit')
  deposit(@Body(new ZodValidationPipe(depositSchema)) body: DepositInput) {
    return this.cash.recordMove(CashMoveType.DEPOSIT, body.amount, body.note);
  }

  @Post('withdraw')
  withdraw(@Body(new ZodValidationPipe(withdrawSchema)) body: WithdrawInput) {
    return this.cash.recordMove(CashMoveType.WITHDRAWAL, body.amount, body.reason);
  }
}
