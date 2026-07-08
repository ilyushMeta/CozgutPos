import type { Connection } from 'mysql2/promise';

/**
 * Bulk-inserts rows into the target app database. Always parameterized
 * (mysql2's `VALUES ?` bulk form escapes every value — never string
 * concatenation, per CLAUDE.md rule #3) and chunked so a single statement
 * never carries more than ~1000 rows (the largest legacy tables run into the
 * tens of thousands of rows).
 */
export async function bulkInsert(
  target: Connection,
  table: string,
  columns: string[],
  rows: unknown[][],
  chunkSize = 1000,
): Promise<void> {
  if (rows.length === 0) return;
  const columnList = columns.map((c) => `\`${c}\``).join(', ');
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await target.query(`INSERT INTO \`${table}\` (${columnList}) VALUES ?`, [chunk]);
  }
}

/** Insert one row and return its AUTO_INCREMENT id. */
export async function insertOne(
  target: Connection,
  table: string,
  columns: string[],
  values: unknown[],
): Promise<number> {
  const columnList = columns.map((c) => `\`${c}\``).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const [result] = await target.query<any>(
    `INSERT INTO \`${table}\` (${columnList}) VALUES (${placeholders})`,
    values,
  );
  return (result as any).insertId as number;
}

/** Build a `legacyKey -> newId` map from a just-inserted batch, by re-selecting
 * on the legacy key column (needed because bulk `INSERT ... VALUES ?` does not
 * return per-row insertIds). */
export async function mapIdsByKey(
  target: Connection,
  table: string,
  keyColumn: string,
  keys: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (keys.length === 0) return map;
  const CHUNK = 2000;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const [rows] = await target.query<any[]>(
      `SELECT id, \`${keyColumn}\` AS k FROM \`${table}\` WHERE \`${keyColumn}\` IN (${placeholders})`,
      chunk,
    );
    for (const row of rows as any[]) map.set(String(row.k), Number(row.id));
  }
  return map;
}

export async function tableIsEmpty(target: Connection, table: string): Promise<boolean> {
  const [rows] = await target.query<any[]>(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return Number((rows as any)[0].c) === 0;
}
