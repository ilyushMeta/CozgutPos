import type { Connection } from 'mysql2/promise';
import { parseLegacyNumber } from '@cozgut/shared';
import { bulkInsert, insertOne } from '../sql-helpers.js';
import { nullIfSentinel, parseLegacyDate, combineDateTime, decStr } from '../transform.js';
import type { MigrationContext, MigrationReport } from '../types.js';
import { bumpSkipped, setTableCount } from '../types.js';

const FALLBACK_CATEGORY = 'Umumy';
function resolveCategoryName(raw: unknown): string {
  return nullIfSentinel(raw as string | null) ?? FALLBACK_CATEGORY;
}

/** NeededProduct ← `gerekharytlar`. */
export async function migrateNeededProducts(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  for (const row of rows) {
    const name = nullIfSentinel(row.at);
    if (!name) continue;
    const categoryId = ctx.categoryIdByName.get(resolveCategoryName(row.kategoriya)) ?? null;
    insertRows.push([
      name,
      nullIfSentinel(row.kot),
      decStr(parseLegacyNumber(row.san), 3),
      categoryId,
    ]);
  }
  await bulkInsert(target, 'needed_products', ['name', 'code', 'qty', 'categoryId'], insertRows);
  setTableCount(report, 'needed_products', rows.length, insertRows.length);
}

/** StockRevision + RevisionLine ← `rewiz`. Legacy rows have no "session"
 * grouping concept, so each row becomes its own one-line revision (plan
 * decision — no invented grouping). */
export async function migrateRevisions(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  let created = 0;
  for (const row of rows) {
    const code = nullIfSentinel(row.kot);
    const productId = code ? ctx.productIdByCode.get(code) : undefined;
    if (!productId) {
      bumpSkipped(report, 'revisions');
      continue;
    }
    const createdAt = combineDateTime(row.sene, row.sagat) ?? new Date(0);
    const revisionId = await insertOne(
      target,
      'stock_revisions',
      ['createdAt', 'note'],
      [createdAt, 'Migrated from legacy rewiz'],
    );
    const sellPriceRefRaw = nullIfSentinel(row.satlyk);
    await insertOne(
      target,
      'revision_lines',
      [
        'revisionId',
        'productId',
        'systemQty',
        'countedQty',
        'diff',
        'unitPrice',
        'amount',
        'sellPriceRef',
        'result',
        'note',
      ],
      [
        revisionId,
        productId,
        decStr(parseLegacyNumber(row.ammar), 3),
        decStr(parseLegacyNumber(row.dukan), 3),
        decStr(parseLegacyNumber(row.tapawut), 3),
        decStr(parseLegacyNumber(row.baha), 2),
        decStr(parseLegacyNumber(row.jem), 2),
        sellPriceRefRaw ? decStr(parseLegacyNumber(sellPriceRefRaw), 2) : null,
        nullIfSentinel(row.netije),
        nullIfSentinel(row.bellik),
      ],
    );
    created += 1;
  }
  setTableCount(report, 'stock_revisions', rows.length, created);
}

/** LoginAudit ← `hasabat`. Unmatched usernames (no such migrated User) fall
 * back to the synthetic legacy-import user rather than being dropped. */
export async function migrateLoginAudits(
  rows: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const insertRows: unknown[][] = [];
  let unmatched = 0;
  for (const row of rows) {
    const username = nullIfSentinel(row.at);
    const userId = username ? ctx.userIdByUsername.get(username) : undefined;
    if (!userId) unmatched += 1;
    const at = combineDateTime(row.sene, row.sagat) ?? new Date(0);
    insertRows.push([userId ?? ctx.legacyImportUserId, at]);
  }
  await bulkInsert(target, 'login_audits', ['userId', 'at'], insertRows);
  if (unmatched > 0) {
    report.warnings.push(
      `${unmatched} login_audits row(s) had an unrecognized username — attributed to legacy-import.`,
    );
  }
  setTableCount(report, 'login_audits', rows.length, insertRows.length);
}

/** License ← `rugsat` (single row). Legacy license value 95 meant unlimited
 * (SPEC §2); this dump's real row has rst=31, a normal paid-plan countdown. */
export async function migrateLicense(
  rows: any[],
  target: Connection,
  report: MigrationReport,
): Promise<void> {
  const row = rows[0];
  if (!row) {
    report.warnings.push('rugsat had no rows — License left at its seeded default.');
    return;
  }
  const rst = Number(row.rst) || 0;
  const unlimited = rst === 95;
  const lastSeenDate = parseLegacyDate(row.lastSene) ?? new Date();
  // UPSERT: DEPLOYMENT.md recommends skipping the demo seed before a real
  // migration, so the singleton License row may not exist yet.
  await target.query(
    `INSERT INTO \`license\` (\`id\`, \`remainingDays\`, \`lastSeenDate\`, \`plan\`, \`updatedAt\`)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`remainingDays\` = VALUES(\`remainingDays\`),
       \`lastSeenDate\` = VALUES(\`lastSeenDate\`),
       \`plan\` = VALUES(\`plan\`),
       \`updatedAt\` = VALUES(\`updatedAt\`)`,
    [unlimited ? 999999 : rst, lastSeenDate, unlimited ? 'UNLIMITED' : 'STANDARD', new Date()],
  );
  setTableCount(report, 'license', 1, 1);
}

/**
 * Highest numeric value among `values`. `maxDigits`, when set, ignores
 * outliers longer than the normal code width — the real dump has at least
 * one supplier row whose `karzKot` is an 8-digit phone number typed into the
 * code field by mistake (confirmed: real product/debtor/supplier codes are
 * consistently 4 digits). Blindly seeding the next-code sequence past a
 * mistyped phone number would make every future generated code an unwieldy
 * 8-digit number; the mistyped row's own data is still migrated faithfully,
 * this only affects what number the generator hands out *next*.
 */
function maxNumeric(values: (string | null | undefined)[], maxDigits?: number): number {
  let max = 0;
  for (const v of values) {
    const n = nullIfSentinel(v ?? null);
    if (n && /^\d+$/.test(n) && (!maxDigits || n.length <= maxDigits))
      max = Math.max(max, Number(n));
  }
  return max;
}

/**
 * Post-seeds `CodeSequence.next` past the highest code/number already in
 * use — both from the legacy registries (`codes`/`karzkotlar`/
 * `karzdukankotlar`) and from what actually landed in the new tables — so
 * the generator (SPEC §6.9) and the receipt/invoice counters (SalesService,
 * ReceivingService, SecondShopService) never reissue a number that already
 * exists. Legacy `sowdaNomer` resets to 1 every day (confirmed against the
 * real dump), while the live app's 'receipt'/'receipt-second' pools are
 * simple ever-incrementing global counters — seeding past the historical
 * max makes every future receipt number distinct going forward, even though
 * historical numbers repeat across different dates (as they did on paper).
 */
export async function seedCodeSequences(
  legacyCodes: any[],
  legacyKarzkotlar: any[],
  legacyKarzdukankotlar: any[],
  target: Connection,
  ctx: MigrationContext,
  report: MigrationReport,
): Promise<void> {
  const CODE_WIDTH = 4; // observed convention across product/debtor/supplier codes
  const productMax = Math.max(
    maxNumeric(
      legacyCodes.map((r) => r.code),
      CODE_WIDTH,
    ),
    maxNumeric([...ctx.productIdByCode.keys()], CODE_WIDTH),
  );
  const debtorMax = Math.max(
    maxNumeric(
      legacyKarzkotlar.map((r) => r.code),
      CODE_WIDTH,
    ),
    maxNumeric([...ctx.customerIdByCode.keys()], CODE_WIDTH),
  );
  const supplierMax = Math.max(
    maxNumeric(
      legacyKarzdukankotlar.map((r) => r.code),
      CODE_WIDTH,
    ),
    maxNumeric([...ctx.supplierIdByCode.keys()], CODE_WIDTH),
  );

  const [[receiptRow]] = await target.query<any[]>(
    "SELECT COALESCE(MAX(`receiptNo`),0) AS m FROM `sales` WHERE `shopId` = 'MAIN'",
  );
  const [[receiptSecondRow]] = await target.query<any[]>(
    "SELECT COALESCE(MAX(`receiptNo`),0) AS m FROM `sales` WHERE `shopId` = 'SECOND'",
  );
  const [[invoiceRow]] = await target.query<any[]>(
    'SELECT COALESCE(MAX(`invoiceNo`),0) AS m FROM `stock_batches`',
  );

  const pools: [string, number][] = [
    ['product', productMax + 1],
    ['composite', productMax + 1],
    ['debtor', debtorMax + 1],
    ['supplier', supplierMax + 1],
    ['invoice', Number(invoiceRow.m) + 1],
    ['receipt', Number(receiptRow.m) + 1],
    ['receipt-second', Number(receiptSecondRow.m) + 1],
  ];
  for (const [pool, next] of pools) {
    await target.query(
      'INSERT INTO `code_sequences` (`pool`, `next`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `next` = VALUES(`next`)',
      [pool, next],
    );
  }
  setTableCount(report, 'code_sequences', pools.length, pools.length);
}

/** DailySummary rebuild (SPEC §6.13) from the just-migrated Sales — a single
 * aggregate SQL statement, equivalent to the server's DailySummaryService
 * rebuildRange() but run inline here (this CLI has no NestJS DI context). */
export async function rebuildDailySummaries(
  target: Connection,
  report: MigrationReport,
): Promise<void> {
  await target.query(`
    INSERT INTO \`daily_summaries\` (\`date\`, \`revenue\`, \`cogs\`, \`profit\`)
    SELECT DATE(\`datetime\`), SUM(\`total\`), SUM(\`cogsTotal\`), SUM(\`total\`) - SUM(\`cogsTotal\`)
    FROM \`sales\`
    GROUP BY DATE(\`datetime\`)
    ON DUPLICATE KEY UPDATE
      \`revenue\` = VALUES(\`revenue\`),
      \`cogs\` = VALUES(\`cogs\`),
      \`profit\` = VALUES(\`profit\`)
  `);
  const [rows] = await target.query<any[]>('SELECT COUNT(*) AS c FROM `daily_summaries`');
  setTableCount(report, 'daily_summaries', 0, Number((rows as any)[0].c));
}
