import type { Connection } from 'mysql2/promise';
import { Decimal, parseLegacyNumber } from '@cozgut/shared';
import { bulkInsert, mapIdsByKey } from '../sql-helpers.js';
import { nullIfSentinel, parseLegacyDate, combineDateTime, decStr } from '../transform.js';
import type { MigrationContext, MigrationReport } from '../types.js';
import { bumpSkipped, setTableCount } from '../types.js';

const FALLBACK_CATEGORY = 'Umumy';
function resolveCategoryName(raw: unknown): string {
  return nullIfSentinel(raw as string | null) ?? FALLBACK_CATEGORY;
}

function dateKey(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

interface SaleMeta {
  legacySowdaId: string;
  receiptNo: number;
  datetime: Date;
  lines: any[];
}

/**
 * Sale + SaleLine (main shop) ← `satylanharytlar` grouped by `sowdaId`,
 * payment split joined from `fakturtoleg` by (sene, faktur=sowdaNomer) per
 * SPEC §4.2. `changeGiven` has no reliable legacy source (Nagt/Nagt_dal/Karz
 * already reflect post-change amounts) and is migrated as 0 — a historical
 * display-only field, not used by any live calculation.
 */
export async function migrateMainSales(
  saleLineRows: any[],
  fakturtolegRows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const fakturByKey = new Map<string, any>();
  for (const row of fakturtolegRows) {
    const faktur = nullIfSentinel(row.faktur);
    if (!faktur) continue;
    const key = `${dateKey(parseLegacyDate(row.sene))}|${faktur}`;
    if (!fakturByKey.has(key)) fakturByKey.set(key, row);
  }

  const groups = new Map<string, any[]>();
  for (const row of saleLineRows) {
    const sowdaId = nullIfSentinel(row.sowdaId);
    if (!sowdaId) continue;
    if (!groups.has(sowdaId)) groups.set(sowdaId, []);
    groups.get(sowdaId)!.push(row);
  }

  const metas: SaleMeta[] = [];
  const saleRows: unknown[][] = [];
  let skippedBadReceiptNo = 0;
  let unmatchedPayment = 0;

  for (const [sowdaId, lines] of groups) {
    const first = lines[0];
    const receiptNoRaw = nullIfSentinel(first.sowdaNomer);
    if (!receiptNoRaw || !/^\d+$/.test(receiptNoRaw)) {
      skippedBadReceiptNo += 1;
      continue;
    }
    const receiptNo = Number(receiptNoRaw);
    const datetime = combineDateTime(first.sene, first.sagat) ?? new Date(0);

    const total = lines.reduce((sum, l) => sum.plus(parseLegacyNumber(l.baha)), new Decimal(0));
    const key = `${dateKey(parseLegacyDate(first.sene))}|${receiptNoRaw}`;
    const payment = fakturByKey.get(key);
    let paidCash = new Decimal(0);
    let paidCard = new Decimal(0);
    let paidDebt = new Decimal(0);
    let discount = new Decimal(0);
    let debtorId: number | null = null;
    if (payment) {
      paidCash = parseLegacyNumber(payment.Nagt);
      paidCard = parseLegacyNumber(payment.Nagt_dal);
      paidDebt = parseLegacyNumber(payment.karz);
      discount = parseLegacyNumber(payment.Skidka);
      const debtorCode = nullIfSentinel(payment.karzKot);
      debtorId = debtorCode ? (ctx.customerIdByCode.get(debtorCode) ?? null) : null;
    } else {
      unmatchedPayment += 1;
      paidCash = total; // best-effort fallback: assume plain cash sale
    }

    const rateRaw = parseLegacyNumber(first.kurs);
    const exchangeRate = rateRaw.greaterThan(0) ? rateRaw : ctx.currentExchangeRate;

    metas.push({ legacySowdaId: sowdaId, receiptNo, datetime, lines });
    saleRows.push([
      receiptNo,
      datetime,
      ctx.legacyImportUserId,
      decStr(total, 2),
      decStr(paidCash, 2),
      decStr(paidCard, 2),
      decStr(paidDebt, 2),
      '0.00',
      decStr(discount, 2),
      debtorId,
      decStr(exchangeRate, 2),
      '0.00', // cogsTotal — filled in below once we know which lines resolved
      'MAIN',
      sowdaId,
    ]);
  }

  await bulkInsert(
    target,
    'sales',
    [
      'receiptNo',
      'datetime',
      'cashierId',
      'total',
      'paidCash',
      'paidCard',
      'paidDebt',
      'changeGiven',
      'discount',
      'debtorId',
      'exchangeRate',
      'cogsTotal',
      'shopId',
      'legacySowdaId',
    ],
    saleRows,
  );

  const saleIdByLegacy = await mapIdsByKey(
    target,
    'sales',
    'legacySowdaId',
    metas.map((m) => m.legacySowdaId),
  );

  const lineRows: unknown[][] = [];
  const cogsBySaleId = new Map<number, Decimal>();
  let skippedOrphanProduct = 0;
  for (const meta of metas) {
    const saleId = saleIdByLegacy.get(meta.legacySowdaId);
    if (!saleId) continue;
    // Legacy `sowdaNomer` resets to 1 each day (confirmed against the real
    // dump — the same receipt number is reused across hundreds of different
    // dates), so it is only unique per day, not globally as SPEC's schema
    // comment assumed. Key the lookup by date+receiptNo to avoid collisions;
    // the *stored* Sale.receiptNo still keeps the original legacy number
    // (matches what was printed on the paper receipt at the time).
    ctx.saleIdByReceiptNo.set(`${dateKey(meta.datetime)}|${meta.receiptNo}`, saleId);
    let cogs = new Decimal(0);
    for (const line of meta.lines) {
      const code = nullIfSentinel(line.kot);
      const productId = code ? ctx.productIdByCode.get(code) : undefined;
      if (!productId) {
        skippedOrphanProduct += 1;
        continue;
      }
      const qty = parseLegacyNumber(line.san);
      const lineTotal = parseLegacyNumber(line.baha);
      const birlikBahaRaw = nullIfSentinel(line.birlikBaha);
      const unitPrice = birlikBahaRaw
        ? parseLegacyNumber(birlikBahaRaw)
        : qty.greaterThan(0)
          ? lineTotal.dividedBy(qty)
          : lineTotal;
      const buyPrice = parseLegacyNumber(line.alnanBaha);
      const lineCogs = qty.times(buyPrice);
      cogs = cogs.plus(lineCogs);
      const legacyAmmarId = nullIfSentinel(line.ammarId);
      const batchId = legacyAmmarId
        ? (ctx.stockBatchIdByLegacyAmmarId.get(legacyAmmarId) ?? null)
        : null;
      lineRows.push([
        saleId,
        productId,
        JSON.stringify([{ batchId, qty: decStr(qty, 3), buyPrice: decStr(buyPrice, 2) }]),
        decStr(qty, 3),
        null,
        decStr(unitPrice, 2),
        decStr(lineTotal, 2),
        decStr(lineCogs, 2),
        resolveCategoryName(line.kategoriya),
        code, // no separate name snapshot column in legacy sale lines — code is the best stable label
      ]);
    }
    cogsBySaleId.set(saleId, cogs);
  }

  await bulkInsert(
    target,
    'sale_lines',
    [
      'saleId',
      'productId',
      'batchBreakdown',
      'qty',
      'unitPackId',
      'unitPrice',
      'lineTotal',
      'cogs',
      'categoryNameSnapshot',
      'productNameSnapshot',
    ],
    lineRows,
  );

  for (const [saleId, cogs] of cogsBySaleId) {
    await target.query('UPDATE `sales` SET `cogsTotal` = ? WHERE `id` = ?', [
      decStr(cogs, 2),
      saleId,
    ]);
  }

  if (skippedBadReceiptNo > 0) {
    report.warnings.push(`${skippedBadReceiptNo} sale group(s) skipped: no valid sowdaNomer.`);
  }
  if (unmatchedPayment > 0) {
    report.warnings.push(
      `${unmatchedPayment} sale(s) had no matching fakturtoleg row — paidCash defaulted to the sale total.`,
    );
  }
  if (skippedOrphanProduct > 0) {
    report.warnings.push(
      `${skippedOrphanProduct} sale line(s) skipped: product code not found (orphan legacy reference).`,
    );
  }
  setTableCount(report, 'sales', groups.size, metas.length);
  setTableCount(report, 'sale_lines', saleLineRows.length, lineRows.length);
}

/** Second-shop Sale + SaleLine ← `satylanharytlarikinjidukan`, grouped by
 * `sowdaNomer` (its own receipt sequence — no sowdaId/ammarId/alnanBaha in
 * this simplified legacy table, so per-line COGS/batch linkage isn't
 * available; migrated as 0/empty, a known legacy data-availability gap). */
export async function migrateSecondShopSales(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const receiptNo = nullIfSentinel(row.sowdaNomer);
    if (!receiptNo) continue;
    const key = `second:${receiptNo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const metas: SaleMeta[] = [];
  const saleRows: unknown[][] = [];
  for (const [legacyKey, lines] of groups) {
    const first = lines[0];
    const receiptNoRaw = nullIfSentinel(first.sowdaNomer)!;
    if (!/^\d+$/.test(receiptNoRaw)) continue;
    const receiptNo = Number(receiptNoRaw);
    const datetime = combineDateTime(first.sene, first.sagat) ?? new Date(0);
    const total = lines.reduce((sum, l) => sum.plus(parseLegacyNumber(l.baha)), new Decimal(0));
    const byMethod = (method: string) =>
      lines
        .filter((l) => nullIfSentinel(l.tolegGornus) === method)
        .reduce((sum, l) => sum.plus(parseLegacyNumber(l.baha)), new Decimal(0));
    const paidCash = byMethod('Nagt');
    const paidCard = byMethod('Nagt_dal');
    const paidDebt = byMethod('Karz');

    metas.push({ legacySowdaId: legacyKey, receiptNo, datetime, lines });
    saleRows.push([
      receiptNo,
      datetime,
      ctx.legacyImportUserId,
      decStr(total, 2),
      decStr(paidCash, 2),
      decStr(paidCard, 2),
      decStr(paidDebt, 2),
      '0.00',
      '0.00',
      null,
      decStr(ctx.currentExchangeRate, 2),
      '0.00',
      'SECOND',
      legacyKey,
    ]);
  }

  await bulkInsert(
    target,
    'sales',
    [
      'receiptNo',
      'datetime',
      'cashierId',
      'total',
      'paidCash',
      'paidCard',
      'paidDebt',
      'changeGiven',
      'discount',
      'debtorId',
      'exchangeRate',
      'cogsTotal',
      'shopId',
      'legacySowdaId',
    ],
    saleRows,
  );

  const saleIdByLegacy = await mapIdsByKey(
    target,
    'sales',
    'legacySowdaId',
    metas.map((m) => m.legacySowdaId),
  );

  const lineRows: unknown[][] = [];
  let skippedOrphanProduct = 0;
  for (const meta of metas) {
    const saleId = saleIdByLegacy.get(meta.legacySowdaId);
    if (!saleId) continue;
    for (const line of meta.lines) {
      const code = nullIfSentinel(line.kot);
      const productId = code ? ctx.productIdByCode.get(code) : undefined;
      if (!productId) {
        skippedOrphanProduct += 1;
        continue;
      }
      const qty = parseLegacyNumber(line.san);
      const lineTotal = parseLegacyNumber(line.baha);
      const unitPrice = qty.greaterThan(0) ? lineTotal.dividedBy(qty) : lineTotal;
      lineRows.push([
        saleId,
        productId,
        JSON.stringify([]),
        decStr(qty, 3),
        null,
        decStr(unitPrice, 2),
        decStr(lineTotal, 2),
        '0.00',
        resolveCategoryName(line.kategoriya),
        code,
      ]);
    }
  }
  await bulkInsert(
    target,
    'sale_lines',
    [
      'saleId',
      'productId',
      'batchBreakdown',
      'qty',
      'unitPackId',
      'unitPrice',
      'lineTotal',
      'cogs',
      'categoryNameSnapshot',
      'productNameSnapshot',
    ],
    lineRows,
  );

  if (skippedOrphanProduct > 0) {
    report.warnings.push(
      `${skippedOrphanProduct} second-shop sale line(s) skipped: product code not found.`,
    );
  }
  setTableCount(report, 'sales_second_shop', groups.size, metas.length);
}

/** DebtSale ← `karzsatylanharytlar`, linked to the just-migrated Sale via the
 * shared receipt/invoice number (`faktur` = `sowdaNomer`). Deduped by
 * resolved saleId since DebtSale.saleId is unique. */
export async function migrateDebtSales(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  const usedSaleIds = new Set<number>();
  for (const row of rows) {
    const debtorCode = nullIfSentinel(row.kot);
    const debtorId = debtorCode ? ctx.customerIdByCode.get(debtorCode) : undefined;
    const faktur = nullIfSentinel(row.faktur);
    const saleDate = parseLegacyDate(row.satylan_sene);
    // sowdaNomer/faktur resets daily in the legacy data — must match on
    // date+number, same key shape used when populating saleIdByReceiptNo.
    const saleId =
      faktur && saleDate ? ctx.saleIdByReceiptNo.get(`${dateKey(saleDate)}|${faktur}`) : undefined;
    if (!debtorId || !saleId || !saleDate) {
      bumpSkipped(report, 'debtSales');
      continue;
    }
    if (usedSaleIds.has(saleId)) {
      bumpSkipped(report, 'debtSales');
      continue;
    }
    usedSaleIds.add(saleId);
    insertRows.push([
      debtorId,
      saleId,
      faktur && /^\d+$/.test(faktur) ? Number(faktur) : null,
      saleDate,
      parseLegacyDate(row.gelmeli_sene),
      decStr(parseLegacyNumber(row.bergi), 2),
      decStr(parseLegacyNumber(row.bereni), 2),
    ]);
  }
  await bulkInsert(
    target,
    'debt_sales',
    ['debtorId', 'saleId', 'invoiceNo', 'saleDate', 'dueDate', 'amount', 'paid'],
    insertRows,
  );
  setTableCount(report, 'debt_sales', rows.length, insertRows.length);
}

/** DebtSchedule ← `karzabarotka` (monthly installment ledger, SPEC §6.5). */
export async function migrateDebtSchedules(
  rows: any[],
  target: Connection,
  report: MigrationReport,
  ctx: MigrationContext,
): Promise<void> {
  const insertRows: unknown[][] = [];
  for (const row of rows) {
    const debtorCode = nullIfSentinel(row.kot);
    const debtorId = debtorCode ? ctx.customerIdByCode.get(debtorCode) : undefined;
    const txDate = parseLegacyDate(row.amal_sene);
    if (!debtorId || !txDate) {
      bumpSkipped(report, 'debtSchedules');
      continue;
    }
    const faktur = nullIfSentinel(row.faktur);
    insertRows.push([
      debtorId,
      faktur && /^\d+$/.test(faktur) ? Number(faktur) : null,
      txDate,
      parseLegacyDate(row.getirmeli_sene),
      decStr(parseLegacyNumber(row.basdakyGalyndy), 2),
      decStr(parseLegacyNumber(row.bergi), 2),
      decStr(parseLegacyNumber(row.tolenen), 2),
      decStr(parseLegacyNumber(row.sonkyGalyndy), 2),
    ]);
  }
  await bulkInsert(
    target,
    'debt_schedules',
    [
      'debtorId',
      'invoiceNo',
      'txDate',
      'dueDate',
      'openingBalance',
      'amount',
      'paid',
      'closingBalance',
    ],
    insertRows,
  );
  setTableCount(report, 'debt_schedules', rows.length, insertRows.length);
}

/** SupplierDebtMove ← `karzdukanabarotka` (the newer `karzdukanhereketler`
 * table is empty in this dump). No explicit type column, so PURCHASE/PAYMENT
 * is inferred from which of bergi/tolenen is non-zero; rows with neither
 * (pure opening-balance rows) are skipped — Supplier.balance already carries
 * the current balance directly from `karzdukana.hasap`. */
export async function migrateSupplierDebtMoves(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  for (const row of rows) {
    const code = nullIfSentinel(row.kot);
    const supplierId = code ? ctx.supplierIdByCode.get(code) : undefined;
    const txDate = parseLegacyDate(row.amal_sene);
    if (!supplierId || !txDate) {
      bumpSkipped(report, 'supplierDebtMoves');
      continue;
    }
    const bergi = parseLegacyNumber(row.bergi);
    const tolenen = parseLegacyNumber(row.tolenen);
    let type: 'PURCHASE' | 'PAYMENT';
    let amount: Decimal;
    if (bergi.greaterThan(0)) {
      type = 'PURCHASE';
      amount = bergi;
    } else if (tolenen.greaterThan(0)) {
      type = 'PAYMENT';
      amount = tolenen;
    } else {
      bumpSkipped(report, 'supplierDebtMoves');
      continue;
    }
    const faktur = nullIfSentinel(row.faktur);
    insertRows.push([
      supplierId,
      faktur && /^\d+$/.test(faktur) ? Number(faktur) : null,
      txDate,
      type,
      decStr(amount, 2),
      decStr(parseLegacyNumber(row.basdakyGalyndy), 2),
      decStr(parseLegacyNumber(row.sonkyGalyndy), 2),
      null,
    ]);
  }
  await bulkInsert(
    target,
    'supplier_debt_moves',
    ['supplierId', 'invoiceNo', 'txDate', 'type', 'amount', 'opening', 'closing', 'note'],
    insertRows,
  );
  setTableCount(report, 'supplier_debt_moves', rows.length, insertRows.length);
}
