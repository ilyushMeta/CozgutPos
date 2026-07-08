import type { Response } from 'express';
import { toCsv, type CsvColumn } from '@cozgut/shared';

/**
 * Sends JSON or (when `?format=csv`) a CSV attachment. Uses full manual
 * `@Res()` mode (no passthrough) since Nest's passthrough response handling
 * re-serializes the handler's return value as JSON, which would corrupt a
 * CSV body. Shared by report endpoints that all follow this same shape
 * (established in stock-views.controller.ts).
 */
export function respondCsvOrJson(
  res: Response,
  format: string | undefined,
  filename: string,
  rows: unknown[],
  columns: CsvColumn<any>[],
): void {
  if (format === 'csv') {
    res
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(toCsv(rows, columns));
  } else {
    res.status(200).json(rows);
  }
}
