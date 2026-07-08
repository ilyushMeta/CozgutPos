import { readFileSync } from 'node:fs';
import type { Connection } from 'mysql2/promise';

/**
 * Loads the legacy `dump.sql` into a scratch schema. The dump itself already
 * contains `DROP DATABASE IF EXISTS \`dukan\`` + `CREATE DATABASE \`dukan\`` +
 * `USE \`dukan\`` (SPEC §10 calls this a "temp legacy_dukan schema" — we keep
 * the dump's own hardcoded name `dukan` rather than rewriting it; the name has
 * no semantic meaning, it is just a disposable source schema for this run).
 *
 * Requires a connection with CREATE DATABASE privilege (not the app's
 * least-privilege `cozgut_app` user — see README for the `--legacy-db-url` flag).
 */
export async function loadDumpIntoScratchSchema(
  admin: Connection,
  dumpPath: string,
): Promise<void> {
  const sql = readFileSync(dumpPath, 'utf8');
  // mysql2 supports executing a whole multi-statement script in one call
  // when the connection was opened with multipleStatements: true.
  await admin.query(sql);
}

/** Row count for a scratch-schema table (used by the reconciliation report). */
export async function countLegacyRows(admin: Connection, table: string): Promise<number> {
  const [rows] = await admin.query<any[]>(`SELECT COUNT(*) AS c FROM \`dukan\`.\`${table}\``);
  return Number((rows as any)[0].c);
}

/** Fetch every row of a legacy scratch table (tables here are at most ~33k rows
 * of narrow varchar columns — comfortably fits in memory, no streaming needed). */
export async function fetchLegacyTable<T = Record<string, unknown>>(
  admin: Connection,
  table: string,
): Promise<T[]> {
  const [rows] = await admin.query<any[]>(`SELECT * FROM \`dukan\`.\`${table}\``);
  return rows as T[];
}
