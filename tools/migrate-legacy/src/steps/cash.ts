import type { Connection } from 'mysql2/promise';
import { parseLegacyNumber } from '@cozgut/shared';
import { bulkInsert, insertOne } from '../sql-helpers.js';
import {
  nullIfSentinel,
  parseLegacyDate,
  combineDateTime,
  decStr,
  classifyCashMove,
  truncate,
} from '../transform.js';
import type { MigrationReport } from '../types.js';
import { setTableCount } from '../types.js';

const METHOD_MAP: Record<string, string> = { Nagt: 'CASH', Nagt_dal: 'CARD', Karz: 'DEBT' };

/** PaymentDiscount + ExchangeRate ← `tolegskidka` (4 rows: 3 real payment
 * discounts + one row that actually holds the current exchange rate, SPEC's
 * only documented double-duty legacy table). Returns the parsed current rate
 * for use by other steps (e.g. StockBatch.buyRate fallback). */
export async function migratePaymentDiscountsAndRate(
  rows: any[],
  target: Connection,
  report: MigrationReport,
): Promise<import('@cozgut/shared').Decimal> {
  let currentRate = parseLegacyNumber('20'); // sane fallback if the row is ever missing
  let discountsCreated = 0;
  let rateCreated = 0;
  for (const row of rows) {
    const kind = nullIfSentinel(row.tolegGornus);
    if (!kind) continue;
    if (kind === 'Walyuta') {
      currentRate = parseLegacyNumber(row.skidka);
      await insertOne(target, 'exchange_rates', ['rate'], [decStr(currentRate, 2)]);
      rateCreated += 1;
      continue;
    }
    const method = METHOD_MAP[kind];
    if (!method) continue;
    await insertOne(
      target,
      'payment_discounts',
      ['method', 'percent'],
      [method, decStr(parseLegacyNumber(row.skidka), 2)],
    );
    discountsCreated += 1;
  }
  setTableCount(report, 'payment_discounts', rows.length, discountsCreated);
  setTableCount(report, 'exchange_rates', rows.length, rateCreated);
  return currentRate;
}

/** CashRegisterDay ← `abarotkakassa` (daily cash-register ledger). */
export async function migrateCashRegisterDays(
  rows: any[],
  target: Connection,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  const seenDates = new Set<string>();
  for (const row of rows) {
    const date = parseLegacyDate(row.sene);
    if (!date) continue;
    const key = date.toISOString().slice(0, 10);
    if (seenDates.has(key)) continue; // date is UNIQUE in the new schema
    seenDates.add(key);
    insertRows.push([
      date,
      decStr(parseLegacyNumber(row.basdakyGalyndy), 2),
      decStr(parseLegacyNumber(row.girdeji), 2),
      decStr(parseLegacyNumber(row.cykdajy), 2),
      decStr(parseLegacyNumber(row.sonkyGalyndy), 2),
    ]);
  }
  await bulkInsert(
    target,
    'cash_register_days',
    ['date', 'openingBalance', 'income', 'expense', 'closingBalance'],
    insertRows,
  );
  setTableCount(report, 'cash_register_days', rows.length, insertRows.length);
}

/** CashMove ← `kassahereket` (no explicit "kind" column — classified by
 * keyword heuristic, SPEC §5.7/§6.4; counts per guessed type are reported so
 * a human can spot-check the classification). */
export async function migrateCashMoves(
  rows: any[],
  target: Connection,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  for (const row of rows) {
    const datetime = combineDateTime(row.sene, row.sagat) ?? new Date(0);
    const balanceBefore = decStr(parseLegacyNumber(row.basdakyPul), 2);
    const bellik = truncate(nullIfSentinel(row.bellik), 191);
    const income = parseLegacyNumber(row.girdeji);
    const expense = parseLegacyNumber(row.cykdajy);
    if (income.greaterThan(0)) {
      const type = classifyCashMove(bellik, true);
      report.cashMoveCounts[type] = (report.cashMoveCounts[type] ?? 0) + 1;
      insertRows.push([datetime, type, decStr(income, 2), balanceBefore, bellik]);
    }
    if (expense.greaterThan(0)) {
      const type = classifyCashMove(bellik, false);
      report.cashMoveCounts[type] = (report.cashMoveCounts[type] ?? 0) + 1;
      insertRows.push([datetime, type, decStr(expense, 2), balanceBefore, bellik]);
    }
  }
  await bulkInsert(
    target,
    'cash_moves',
    ['datetime', 'type', 'amount', 'balanceBefore', 'note'],
    insertRows,
  );
  setTableCount(report, 'cash_moves', rows.length, insertRows.length);
}
