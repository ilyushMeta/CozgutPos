import type { Connection } from 'mysql2/promise';

/** Child-to-parent FK order so DELETE never trips a foreign key constraint. */
const TABLES_CHILD_FIRST = [
  'returns',
  'debt_payments',
  'debt_schedules',
  'debt_sales',
  'sale_lines',
  'sales',
  'supplier_debt_moves',
  'cash_moves',
  'cash_register_days',
  'stocktake_lines',
  'stocktakes',
  'revision_lines',
  'stock_revisions',
  'needed_products',
  'recipe_items',
  'recipes',
  'unit_packs',
  'stock_batches',
  'products',
  'categories',
  'customers',
  'suppliers',
  'login_audits',
  'users',
  'daily_summaries',
  'exchange_rates',
  'payment_discounts',
  'activation_codes',
  'code_sequences',
];

/** Truncates every app table (FK-safe order) before a fresh migration run.
 * Never runs implicitly — the CLI requires an explicit `--reset` flag. */
export async function resetAppTables(target: Connection): Promise<void> {
  await target.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of TABLES_CHILD_FIRST) {
      await target.query(`DELETE FROM \`${table}\``);
    }
  } finally {
    await target.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/** True if any of the core app tables already has rows (used to refuse running
 * without --reset against a non-empty target DB). */
export async function targetHasData(target: Connection): Promise<boolean> {
  const [rows] = await target.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM customers) AS customers,
       (SELECT COUNT(*) FROM sales) AS sales`,
  );
  const row = (rows as any)[0];
  return Number(row.products) + Number(row.customers) + Number(row.sales) > 0;
}
