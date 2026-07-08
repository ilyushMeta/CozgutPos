/**
 * Legacy migration CLI (SPEC §10). Loads legacy/dump.sql into a scratch MySQL
 * schema, transforms every table into the new Prisma-mapped schema via
 * parameterized SQL, then prints a reconciliation report (SPEC §13 item 6).
 *
 * Usage:
 *   pnpm migrate:legacy --dump legacy/dump.sql --reset
 *   pnpm migrate:legacy --dump legacy/dump.sql --reset --legacy-db-url mysql://root@localhost:3306/
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { dec } from '@cozgut/shared';
import { openTargetConnection, openLegacyAdminConnection } from './db.js';
import { loadDumpIntoScratchSchema, fetchLegacyTable } from './legacy-load.js';
import { resetAppTables, targetHasData } from './reset.js';
import {
  migrateCategories,
  migrateUsers,
  migrateProductsAndBatches,
  migrateCustomers,
  migrateSuppliers,
} from './steps/catalog.js';
import {
  migrateMainSales,
  migrateSecondShopSales,
  migrateDebtSales,
  migrateDebtSchedules,
  migrateSupplierDebtMoves,
} from './steps/sales.js';
import {
  migratePaymentDiscountsAndRate,
  migrateCashRegisterDays,
  migrateCashMoves,
} from './steps/cash.js';
import {
  migrateNeededProducts,
  migrateRevisions,
  migrateLoginAudits,
  migrateLicense,
  seedCodeSequences,
  rebuildDailySummaries,
} from './steps/misc.js';
import { buildReconciliation, formatReport } from './reconcile.js';
import { newReport } from './types.js';
import type { MigrationContext } from './types.js';

// tools/migrate-legacy/src -> repo root (pnpm -F runs scripts with cwd = the
// package directory, not the caller's shell cwd, so defaults are anchored
// here rather than to process.cwd()).
const repoRoot = resolve(import.meta.dirname, '../../..');

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      dump: { type: 'string', default: resolve(repoRoot, 'legacy/dump.sql') },
      'legacy-db-url': { type: 'string', default: 'mysql://root@localhost:3306/' },
      'server-env': { type: 'string', default: resolve(repoRoot, 'apps/server/.env') },
      reset: { type: 'boolean', default: false },
    },
  });

  const dumpPath = resolve(repoRoot, values.dump!);
  const serverEnvPath = resolve(repoRoot, values['server-env']!);
  const target = await openTargetConnection(serverEnvPath);
  const legacyAdmin = await openLegacyAdminConnection(values['legacy-db-url']!);

  try {
    if (!values.reset && (await targetHasData(target))) {
      throw new Error(
        'Target database already has data. Re-run with --reset to truncate app tables first ' +
          '(refuses to run silently against a non-empty/production database).',
      );
    }
    if (values.reset) {
      // eslint-disable-next-line no-console
      console.log('Resetting target app tables...');
      await resetAppTables(target);
    }

    // eslint-disable-next-line no-console
    console.log(`Loading legacy dump from ${dumpPath} into scratch schema...`);
    await loadDumpIntoScratchSchema(legacyAdmin, dumpPath);

    // eslint-disable-next-line no-console
    console.log('Reading legacy tables into memory...');
    const [
      ammarRows,
      satylanharytlarRows,
      fakturtolegRows,
      karzcylarRows,
      karzdukanaRows,
      karzabarotkaRows,
      karzdukanabarotkaRows,
      karzsatylanharytlarRows,
      abarotkakassaRows,
      kassaheretRows,
      tolegskidkaRows,
      gerekharytlarRows,
      rewizRows,
      hasabatRows,
      rugsatRows,
      codesRows,
      karzkotlarRows,
      karzdukankotlarRows,
      satylanharytlarikinjidukanRows,
      adminRows,
      umumystirhkotRows,
    ] = await Promise.all(
      [
        'ammar',
        'satylanharytlar',
        'fakturtoleg',
        'karzcylar',
        'karzdukana',
        'karzabarotka',
        'karzdukanabarotka',
        'karzsatylanharytlar',
        'abarotkakassa',
        'kassahereket',
        'tolegskidka',
        'gerekharytlar',
        'rewiz',
        'hasabat',
        'rugsat',
        'codes',
        'karzkotlar',
        'karzdukankotlar',
        'satylanharytlarikinjidukan',
        'admin',
        'umumystirhkot',
      ].map((t) => fetchLegacyTable(legacyAdmin, t)),
    );

    const report = newReport();
    const ctx: MigrationContext = {
      categoryIdByName: new Map(),
      userIdByUsername: new Map(),
      legacyImportUserId: 0,
      productIdByCode: new Map(),
      stockBatchIdByLegacyAmmarId: new Map(),
      customerIdByCode: new Map(),
      supplierIdByCode: new Map(),
      saleIdByReceiptNo: new Map(),
      currentExchangeRate: dec(20),
    };

    // FK-dependency order (SPEC §10 step 3).
    // eslint-disable-next-line no-console
    console.log('1/16 Category...');
    await migrateCategories(ammarRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('2/16 User...');
    await migrateUsers(adminRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('3/16 PaymentDiscount + ExchangeRate...');
    ctx.currentExchangeRate = await migratePaymentDiscountsAndRate(tolegskidkaRows, target, report);
    // eslint-disable-next-line no-console
    console.log('4/16 Product + StockBatch...');
    await migrateProductsAndBatches(
      ammarRows,
      umumystirhkotRows,
      target,
      ctx,
      report,
      ctx.currentExchangeRate,
    );
    // eslint-disable-next-line no-console
    console.log('5/16 Customer + Supplier...');
    await migrateCustomers(karzcylarRows, target, ctx, report);
    await migrateSuppliers(karzdukanaRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('6/16 Sale + SaleLine (main shop)...');
    await migrateMainSales(satylanharytlarRows, fakturtolegRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('7/16 Sale + SaleLine (second shop)...');
    await migrateSecondShopSales(satylanharytlarikinjidukanRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('8/16 DebtSale...');
    await migrateDebtSales(karzsatylanharytlarRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('9/16 DebtSchedule...');
    await migrateDebtSchedules(karzabarotkaRows, target, report, ctx);
    // eslint-disable-next-line no-console
    console.log('10/16 SupplierDebtMove...');
    await migrateSupplierDebtMoves(karzdukanabarotkaRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('11/16 CashRegisterDay + CashMove...');
    await migrateCashRegisterDays(abarotkakassaRows, target, report);
    await migrateCashMoves(kassaheretRows, target, report);
    // eslint-disable-next-line no-console
    console.log('12/16 NeededProduct...');
    await migrateNeededProducts(gerekharytlarRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('13/16 StockRevision + RevisionLine...');
    await migrateRevisions(rewizRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('14/16 LoginAudit...');
    await migrateLoginAudits(hasabatRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('15/16 License + CodeSequence...');
    await migrateLicense(rugsatRows, target, report);
    await seedCodeSequences(codesRows, karzkotlarRows, karzdukankotlarRows, target, ctx, report);
    // eslint-disable-next-line no-console
    console.log('16/16 DailySummary rebuild...');
    await rebuildDailySummaries(target, report);

    const lines = await buildReconciliation(ammarRows, karzcylarRows, karzdukanaRows, target);
    const text = formatReport(lines, report);
    // eslint-disable-next-line no-console
    console.log('\n' + text);
    if (!lines.every((l) => l.pass)) process.exitCode = 1;
  } finally {
    await target.end();
    await legacyAdmin.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
