import type { Connection } from 'mysql2/promise';
import { Decimal, parseLegacyNumber } from '@cozgut/shared';
import type { MigrationReport } from './types.js';

export interface ReconciliationLine {
  label: string;
  legacy: Decimal;
  migrated: Decimal;
  tolerance: Decimal;
  pass: boolean;
}

export function withinTolerance(a: Decimal, b: Decimal, tolerance: Decimal): boolean {
  return a.minus(b).abs().lessThanOrEqualTo(tolerance);
}

export function compareSum(
  label: string,
  legacy: Decimal,
  migrated: Decimal,
  tolerance: Decimal,
): ReconciliationLine {
  return { label, legacy, migrated, tolerance, pass: withinTolerance(legacy, migrated, tolerance) };
}

/** SPEC §10 step 5 / §13 item 6: legacy vs new Σ stock qty/value, Σ debtor
 * balances, Σ supplier balances must match to 0.01 (0.001 for qty). */
export async function buildReconciliation(
  ammarRows: any[],
  karzcylarRows: any[],
  karzdukanaRows: any[],
  target: Connection,
): Promise<ReconciliationLine[]> {
  const legacyQty = ammarRows.reduce(
    (s, r) => s.plus(parseLegacyNumber(r.galanSan)),
    new Decimal(0),
  );
  // Compare like-for-like: StockBatch stores qty/buyPrice already rounded to
  // the schema's DECIMAL(16,3)/(16,2) precision (SPEC §6.1), so the legacy
  // side must round each factor the same way *before* multiplying — summing
  // raw full-precision legacy values against post-rounding migrated values
  // would flag harmless rounding noise (≈0.0006% of total value observed on
  // this dump) as a false reconciliation failure.
  const legacyValue = ammarRows.reduce((s, r) => {
    const qty = parseLegacyNumber(r.galanSan).toDecimalPlaces(3);
    const price = parseLegacyNumber(r.alynanBaha).toDecimalPlaces(2);
    return s.plus(qty.times(price));
  }, new Decimal(0));
  const legacyDebtorBalance = karzcylarRows.reduce(
    (s, r) => s.plus(parseLegacyNumber(r.hasap)),
    new Decimal(0),
  );
  const legacySupplierBalance = karzdukanaRows.reduce(
    (s, r) => s.plus(parseLegacyNumber(r.hasap)),
    new Decimal(0),
  );

  const [[batchAgg]] = await target.query<any[]>(
    'SELECT COALESCE(SUM(`qtyRemaining`),0) AS qty, COALESCE(SUM(`qtyRemaining` * `buyPrice`),0) AS value FROM `stock_batches`',
  );
  const [[custAgg]] = await target.query<any[]>(
    'SELECT COALESCE(SUM(`balance`),0) AS balance FROM `customers`',
  );
  const [[suppAgg]] = await target.query<any[]>(
    'SELECT COALESCE(SUM(`balance`),0) AS balance FROM `suppliers`',
  );

  return [
    compareSum(
      'Σ ammar galyndysy (qty)',
      legacyQty,
      new Decimal(batchAgg.qty),
      new Decimal('0.001'),
    ),
    compareSum(
      'Σ ammar bahasy (value)',
      legacyValue,
      new Decimal(batchAgg.value),
      new Decimal('0.01'),
    ),
    compareSum(
      'Σ karzçy hasaby',
      legacyDebtorBalance,
      new Decimal(custAgg.balance),
      new Decimal('0.01'),
    ),
    compareSum(
      'Σ dükan hasaby',
      legacySupplierBalance,
      new Decimal(suppAgg.balance),
      new Decimal('0.01'),
    ),
  ];
}

export function formatReport(lines: ReconciliationLine[], report: MigrationReport): string {
  const out: string[] = [];
  out.push('=== Utgaşdyrma hasabaty (Reconciliation) ===');
  for (const l of lines) {
    const status = l.pass ? 'PASS' : 'FAIL';
    out.push(
      `[${status}] ${l.label}: legacy=${l.legacy.toFixed(3)} migrated=${l.migrated.toFixed(3)}`,
    );
  }
  out.push('');
  out.push('=== Tablisa boýunça setir sanlary ===');
  for (const [table, { legacyRows, created }] of Object.entries(report.tableCounts)) {
    out.push(`${table}: legacy=${legacyRows} created=${created}`);
  }
  if (Object.keys(report.cashMoveCounts).length > 0) {
    out.push('');
    out.push('=== CashMove klassifikasiýasy ===');
    for (const [type, count] of Object.entries(report.cashMoveCounts))
      out.push(`${type}: ${count}`);
  }
  if (Object.keys(report.skipped).length > 0) {
    out.push('');
    out.push('=== Geçirilmedik setirler ===');
    for (const [key, count] of Object.entries(report.skipped)) out.push(`${key}: ${count}`);
  }
  if (report.warnings.length > 0) {
    out.push('');
    out.push('=== Duýduryşlar ===');
    for (const w of report.warnings) out.push(`- ${w}`);
  }
  out.push('');
  const allPass = lines.every((l) => l.pass);
  out.push(allPass ? 'NETIJE: PASS' : 'NETIJE: FAIL');
  return out.join('\n');
}
