import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CashMoveType } from '@prisma/client';
import {
  openDaySchema,
  depositSchema,
  withdrawSchema,
  Role,
  type OpenDayInput,
  type DepositInput,
  type WithdrawInput,
  type CsvColumn,
} from '@cozgut/shared';
import { CashService } from './cash.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { respondCsvOrJson } from '../common/csv-response.js';

const CASH_MOVE_COLUMNS: CsvColumn<any>[] = [
  { header: 'Sene', value: (m) => new Date(m.datetime).toISOString() },
  { header: 'Görnüş', value: (m) => m.type },
  { header: 'Möçber', value: (m) => m.amount },
  { header: 'Öňki galyndy', value: (m) => m.balanceBefore },
  { header: 'Bellik', value: (m) => m.note },
];

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
  async moves(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.cash.getMoves(
      from ? new Date(from) : new Date(0),
      to ? new Date(to) : new Date(),
    );
    respondCsvOrJson(res, format, 'kassa-hereketleri.csv', rows, CASH_MOVE_COLUMNS);
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
