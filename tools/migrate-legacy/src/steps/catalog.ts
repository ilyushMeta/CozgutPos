import type { Connection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { Decimal } from '@cozgut/shared';
import { bulkInsert, insertOne, mapIdsByKey } from '../sql-helpers.js';
import {
  nullIfSentinel,
  parseLegacyDate,
  combineDateTime,
  decStr,
  isCleanNumeric,
  truncate,
} from '../transform.js';
import { parseLegacyNumber } from '@cozgut/shared';
import type { MigrationContext, MigrationReport } from '../types.js';
import { setTableCount } from '../types.js';

const FALLBACK_CATEGORY = 'Umumy';

function resolveCategoryName(raw: unknown): string {
  return nullIfSentinel(raw as string | null) ?? FALLBACK_CATEGORY;
}

/** Category ← distinct `ammar.kategoriya` values (legacy `kategoriya` table is empty). */
export async function migrateCategories(
  ammarRows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const names = new Set<string>();
  for (const row of ammarRows) names.add(resolveCategoryName(row.kategoriya));
  const list = [...names];
  for (const name of list) {
    const id = await insertOne(target, 'categories', ['name'], [name]);
    ctx.categoryIdByName.set(name, id);
  }
  setTableCount(report, 'categories', list.length, list.length);
}

/** User ← legacy `admin` (2 rows; `ulanyjy` is empty in this dump) + one
 * synthetic inactive `legacy-import` user to own historical Sale/LoginAudit
 * rows that have no real per-row cashier attribution in the legacy schema. */
export async function migrateUsers(
  adminRows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  let created = 0;
  for (const row of adminRows) {
    const username = String(row.at ?? '').trim();
    if (!username) continue;
    const legacyPassword = String(row.parol ?? '');
    const passwordHash = await bcrypt.hash(legacyPassword || 'changeme', 10);
    const id = await insertOne(
      target,
      'users',
      ['username', 'passwordHash', 'role', 'isActive', 'mustResetPassword', 'updatedAt'],
      [username, passwordHash, 'ADMIN', 1, 1, new Date()],
    );
    ctx.userIdByUsername.set(username, id);
    created += 1;
  }

  const randomHash = await bcrypt.hash(`legacy-import-${Date.now()}-${Math.random()}`, 10);
  ctx.legacyImportUserId = await insertOne(
    target,
    'users',
    ['username', 'passwordHash', 'role', 'isActive', 'mustResetPassword', 'updatedAt'],
    ['legacy-import', randomHash, 'ADMIN', 0, 0, new Date()],
  );
  created += 1;

  setTableCount(report, 'users', adminRows.length, created);
}

interface AmmarGroup {
  kot: string;
  rows: any[];
}

function groupAmmarByKot(ammarRows: any[]): AmmarGroup[] {
  const groups = new Map<string, any[]>();
  for (const row of ammarRows) {
    const kot = nullIfSentinel(row.kot);
    if (!kot) continue; // no product code — can't identify the product, skip
    if (!groups.has(kot)) groups.set(kot, []);
    groups.get(kot)!.push(row);
  }
  return [...groups.entries()].map(([kot, rows]) => ({
    kot,
    rows: rows.sort((a, b) => {
      const da = combineDateTime(a.sene, a.sagat)?.getTime() ?? 0;
      const db = combineDateTime(b.sene, b.sagat)?.getTime() ?? 0;
      return da - db;
    }),
  }));
}

/**
 * Product + StockBatch ← `ammar` grouped by `kot`. The latest row (by
 * sene+sagat) in each group supplies Product-level fields; every row becomes
 * one StockBatch. `isComposite` is set from `umumystirhkot` (composite code
 * aliases) — `f2`/`harytmukdar` (recipe ingredient lines) are empty in this
 * dump, so Recipe/RecipeItem are intentionally left empty (reported as a
 * known legacy data gap, not a migration bug).
 */
export async function migrateProductsAndBatches(
  ammarRows: any[],
  umumystirhkotRows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
  currentRate: Decimal,
): Promise<void> {
  const compositeCodes = new Set<string>();
  for (const row of umumystirhkotRows) {
    const code = nullIfSentinel(row.kotOz);
    if (code) compositeCodes.add(code);
  }

  const groups = groupAmmarByKot(ammarRows);

  const productRows: unknown[][] = [];
  const productCodes: string[] = [];
  for (const group of groups) {
    const latest = group.rows[group.rows.length - 1];
    const categoryName = resolveCategoryName(latest.kategoriya);
    const categoryId = ctx.categoryIdByName.get(categoryName) ?? null;
    const expiryDate = parseLegacyDate(nullIfSentinel(latest.mohlet));
    const secondPriceRaw = nullIfSentinel(latest.ikinjiSatlyk);
    productRows.push([
      truncate(String(latest.at ?? group.kot).trim() || group.kot, 191),
      group.kot,
      categoryId,
      0, // isScaleItem — no per-product flag in legacy (global terezi.txt setting only)
      '0.000', // lowStockThreshold — no legacy source, admin configures post-migration
      expiryDate,
      decStr(parseLegacyNumber(latest.skidka), 2),
      secondPriceRaw ? decStr(parseLegacyNumber(secondPriceRaw), 2) : null,
      compositeCodes.has(group.kot) ? 1 : 0,
      new Date(),
    ]);
    productCodes.push(group.kot);
  }
  await bulkInsert(
    target,
    'products',
    [
      'name',
      'code',
      'categoryId',
      'isScaleItem',
      'lowStockThreshold',
      'expiryDate',
      'discountPercent',
      'secondPrice',
      'isComposite',
      'updatedAt',
    ],
    productRows,
  );
  const productIdByCode = await mapIdsByKey(target, 'products', 'code', productCodes);
  for (const [code, id] of productIdByCode) ctx.productIdByCode.set(code, id);
  setTableCount(report, 'products', groups.length, productIdByCode.size);

  const batchRows: unknown[][] = [];
  const batchLegacyIds: string[] = [];
  let skippedNoProduct = 0;
  for (const group of groups) {
    const productId = ctx.productIdByCode.get(group.kot);
    if (!productId) {
      skippedNoProduct += group.rows.length;
      continue;
    }
    for (const [index, row] of group.rows.entries()) {
      const legacyAmmarId = nullIfSentinel(row.ammarId) ?? `${group.kot}:${index}`;
      const currency = nullIfSentinel(row.walyuta) === 'usd' ? 'USD' : 'TMT';
      const sellPriceUsdRaw = nullIfSentinel(row.satlykbahaUSD);
      const sellPrice = parseLegacyNumber(row.satlykBaha);
      const sellPriceUsd = sellPriceUsdRaw ? parseLegacyNumber(sellPriceUsdRaw) : null;
      // No explicit purchase-time exchange rate column in legacy `ammar`; derive
      // it from the sell-price pair when possible, else fall back to the
      // dump's current rate (tolegskidka 'Walyuta' row) — documented assumption,
      // flagged in the reconciliation report if it materially affects totals.
      let buyRate: Decimal | null = null;
      if (currency === 'USD') {
        buyRate =
          sellPriceUsd && sellPriceUsd.greaterThan(0)
            ? sellPrice.dividedBy(sellPriceUsd)
            : currentRate;
      }
      const invoiceNoRaw = nullIfSentinel(row.faktur);
      const invoiceNo = invoiceNoRaw && /^\d+$/.test(invoiceNoRaw) ? Number(invoiceNoRaw) : null;
      batchRows.push([
        productId,
        decStr(parseLegacyNumber(row.hemmeSan), 3),
        decStr(parseLegacyNumber(row.galanSan), 3),
        decStr(parseLegacyNumber(row.alynanBaha), 2),
        decStr(sellPrice, 2),
        sellPriceUsd ? decStr(sellPriceUsd, 2) : null,
        currency,
        buyRate ? decStr(buyRate, 2) : null,
        combineDateTime(row.sene, row.sagat) ?? new Date(0),
        invoiceNo,
        nullIfSentinel(row.karzKot),
        legacyAmmarId,
      ]);
      batchLegacyIds.push(legacyAmmarId);
    }
  }
  await bulkInsert(
    target,
    'stock_batches',
    [
      'productId',
      'qtyInitial',
      'qtyRemaining',
      'buyPrice',
      'sellPrice',
      'sellPriceUSD',
      'currency',
      'buyRate',
      'receivedAt',
      'invoiceNo',
      'supplierDebtCode',
      'legacyAmmarId',
    ],
    batchRows,
  );
  const batchIdByLegacy = await mapIdsByKey(
    target,
    'stock_batches',
    'legacyAmmarId',
    batchLegacyIds,
  );
  for (const [legacyId, id] of batchIdByLegacy) ctx.stockBatchIdByLegacyAmmarId.set(legacyId, id);
  if (skippedNoProduct > 0) {
    report.warnings.push(
      `${skippedNoProduct} ammar row(s) skipped: could not resolve a product (empty/sentinel kot).`,
    );
  }
  setTableCount(report, 'stock_batches', ammarRows.length, batchRows.length);
}

/** Customer ← `karzcylar`. `shot='wlyt'` → USD account, else TMT (SPEC §6.5). */
export async function migrateCustomers(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const code = nullIfSentinel(row.karzkot);
    if (!code || seen.has(code)) continue; // legacy has no unique constraint; dedupe defensively
    seen.add(code);
    const name = truncate(String(row.at ?? code).trim() || code, 191)!;
    const currency = nullIfSentinel(row.shot) === 'wlyt' ? 'USD' : 'TMT';
    if (!isCleanNumeric(row.hasap)) {
      report.warnings.push(`Customer ${code}: unparseable balance "${row.hasap}" — migrated as 0.`);
    }
    const phone = row.tel !== null && row.tel !== undefined ? String(row.tel) : null;
    insertRows.push([
      code,
      name,
      nullIfSentinel(row.bellik),
      phone,
      currency,
      decStr(parseLegacyNumber(row.hasap), 2),
      new Date(),
    ]);
    codes.push(code);
  }
  await bulkInsert(
    target,
    'customers',
    ['code', 'name', 'note', 'phone', 'accountCurrency', 'balance', 'updatedAt'],
    insertRows,
  );
  const idByCode = await mapIdsByKey(target, 'customers', 'code', codes);
  for (const [code, id] of idByCode) ctx.customerIdByCode.set(code, id);
  setTableCount(report, 'customers', rows.length, idByCode.size);
}

/** Supplier ← `karzdukana`. */
export async function migrateSuppliers(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const code = nullIfSentinel(row.karzKot);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const name = truncate(String(row.at ?? code).trim() || code, 191)!;
    if (!isCleanNumeric(row.hasap)) {
      report.warnings.push(`Supplier ${code}: unparseable balance "${row.hasap}" — migrated as 0.`);
    }
    insertRows.push([
      code,
      name,
      nullIfSentinel(row.bellik),
      null,
      decStr(parseLegacyNumber(row.hasap), 2),
      new Date(),
    ]);
    codes.push(code);
  }
  await bulkInsert(
    target,
    'suppliers',
    ['code', 'name', 'note', 'phone', 'balance', 'updatedAt'],
    insertRows,
  );
  const idByCode = await mapIdsByKey(target, 'suppliers', 'code', codes);
  for (const [code, id] of idByCode) ctx.supplierIdByCode.set(code, id);
  setTableCount(report, 'suppliers', rows.length, idByCode.size);
}
